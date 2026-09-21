import type { GoogleBooksVolume, Book } from "./types";
import { pageCountFromOpenLibrary } from "./open-library";

const API_BASE = "https://www.googleapis.com/books/v1/volumes";

export type SearchResult =
  | { ok: true; items: GoogleBooksVolume[] }
  | { ok: false; error: "quota" | "network" | "unknown" };

export async function searchBooks(
  query: string,
  maxResults = 40
): Promise<SearchResult> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  const params = new URLSearchParams({
    q: query,
    maxResults: String(maxResults),
    printType: "books",
    orderBy: "relevance",
    ...(apiKey ? { key: apiKey } : {}),
  });

  try {
    const res = await fetch(`${API_BASE}?${params}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      if (res.status === 429 || res.status === 403) {
        return { ok: false, error: "quota" };
      }
      return { ok: false, error: "unknown" };
    }
    const data = await res.json();
    return { ok: true, items: data.items || [] };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function getBookById(
  volumeId: string
): Promise<GoogleBooksVolume | null> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  const params = apiKey ? `?key=${apiKey}` : "";

  const res = await fetch(`${API_BASE}/${volumeId}${params}`);
  if (!res.ok) return null;

  return res.json();
}

// Search results frequently omit pageCount (and sometimes description/categories).
// If the picked volume has no pageCount, try the full Google Books record, then
// Open Library (by ISBN, then title), so the stored book gets an accurate count.
export async function hydrateVolume(
  volume: GoogleBooksVolume
): Promise<GoogleBooksVolume> {
  let v = volume;

  if (!v.volumeInfo?.pageCount) {
    try {
      const full = await getBookById(v.id);
      if (full) v = full;
    } catch {
      // keep original
    }
  }

  if (!v.volumeInfo?.pageCount) {
    const isbn = v.volumeInfo?.industryIdentifiers?.find((id) => id.type === "ISBN_13")?.identifier;
    const pc = await pageCountFromOpenLibrary({
      isbn13: isbn,
      title: v.volumeInfo?.title,
      authors: v.volumeInfo?.authors,
    });
    if (pc) {
      v = { ...v, volumeInfo: { ...v.volumeInfo, pageCount: pc } };
    }
  }

  return v;
}

// ---- Search result ranking + edition de-duplication ---------------------------
// Google Books returns loose matches and one row per edition (hardback,
// paperback, reissues, foreign printings). We re-rank so the closest title/author
// match floats to the top, and collapse editions of the same book down to a
// single best representative.

function norm(s: string | undefined | null): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreVolume(
  volume: GoogleBooksVolume,
  qn: string,
  qTokens: string[],
  index: number
): number {
  const info = volume.volumeInfo as any;
  if (!info?.title) return -1000;

  const title = norm(info.title);
  const authors = norm((info.authors || []).join(" "));
  let score = 0;

  // Title closeness to the query.
  if (title === qn) score += 100;
  else if (title.startsWith(qn)) score += 65;
  else if (title.includes(qn)) score += 45;

  const titleTokens = new Set(title.split(" ").filter(Boolean));
  if (qTokens.length) {
    let hit = 0;
    qTokens.forEach((t) => { if (titleTokens.has(t)) hit++; });
    score += (hit / qTokens.length) * 30;
  }

  // Reward when query words match the author (helps "title author" searches).
  const qSet = new Set(qTokens);
  const authorTokens = authors.split(" ").filter(Boolean);
  if (authorTokens.length) {
    let aHit = 0;
    authorTokens.forEach((t) => { if (qSet.has(t)) aHit++; });
    score += (aHit / authorTokens.length) * 25;
  }

  // Prefer complete, popular, English editions.
  if (info.imageLinks?.thumbnail) score += 8;
  if (info.pageCount) score += 4;
  if (info.language === "en") score += 6;
  if (info.ratingsCount) score += Math.min(6, Math.log10(info.ratingsCount + 1) * 3);

  // Gentle prior on Google's own relevance order.
  score += Math.max(0, 40 - index) * 0.4;

  return score;
}

export function rankAndDedupeVolumes(
  items: GoogleBooksVolume[],
  query: string,
  limit = 15
): GoogleBooksVolume[] {
  const qn = norm(query);
  const qTokens = qn.split(" ").filter(Boolean);

  // Keep the best-scoring edition per (title + first author).
  const groups = new Map<string, { item: GoogleBooksVolume; score: number }>();
  items.forEach((item, index) => {
    const info = item.volumeInfo as any;
    if (!info?.title) return;
    const key = `${norm(info.title)}|${norm((info.authors || [])[0] || "")}`;
    const score = scoreVolume(item, qn, qTokens, index);
    const existing = groups.get(key);
    if (!existing || score > existing.score) groups.set(key, { item, score });
  });

  return Array.from(groups.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((g) => g.item);
}

export function volumeToBook(volume: GoogleBooksVolume): Omit<Book, "id" | "created_at"> {
  const info = volume.volumeInfo;
  const isbn = info.industryIdentifiers?.find((id) => id.type === "ISBN_13");

  return {
    google_books_id: volume.id,
    title: info.title,
    authors: info.authors || [],
    author_countries: null,
    cover_url: info.imageLinks?.thumbnail?.replace("http://", "https://") || null,
    isbn_13: isbn?.identifier || null,
    page_count: info.pageCount || null,
    categories: info.categories || null,
    published_date: info.publishedDate || null,
    publisher: info.publisher || null,
    description: info.description || null,
  };
}
