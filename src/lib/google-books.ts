import type { GoogleBooksVolume, Book } from "./types";

const API_BASE = "https://www.googleapis.com/books/v1/volumes";

export async function searchBooks(
  query: string,
  maxResults = 10
): Promise<GoogleBooksVolume[]> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  const params = new URLSearchParams({
    q: query,
    maxResults: String(maxResults),
    printType: "books",
    ...(apiKey ? { key: apiKey } : {}),
  });

  try {
    const res = await fetch(`${API_BASE}?${params}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch {
    return [];
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
