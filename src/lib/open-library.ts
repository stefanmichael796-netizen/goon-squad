// Open Library (Internet Archive) — a free, key-less source for book metadata.
// We use it for page counts because Google Books' search results frequently omit
// them. An ISBN lookup returns the exact edition's page count; a title/author
// search falls back to the median across known editions.

const OL = "https://openlibrary.org";
const HEADERS = { "User-Agent": "GoonSquad book tracker" };

export async function pageCountFromOpenLibrary(opts: {
  isbn13?: string | null;
  title?: string | null;
  authors?: string[] | null;
}): Promise<number | null> {
  const { isbn13, title, authors } = opts;

  try {
    // 1. Exact edition by ISBN — the most accurate.
    if (isbn13) {
      const res = await fetch(`${OL}/isbn/${isbn13}.json`, { headers: HEADERS });
      if (res.ok) {
        const data = await res.json();
        const pc = data?.number_of_pages;
        if (typeof pc === "number" && pc > 0) return pc;
      }
    }

    // 2. Fall back to a title/author search (median pages across editions).
    if (title) {
      const params = new URLSearchParams({
        title,
        fields: "number_of_pages_median",
        limit: "1",
      });
      if (authors?.length) params.set("author", authors[0]);
      const res = await fetch(`${OL}/search.json?${params}`, { headers: HEADERS });
      if (res.ok) {
        const data = await res.json();
        const pc = data?.docs?.[0]?.number_of_pages_median;
        if (typeof pc === "number" && pc > 0) return pc;
      }
    }
  } catch {
    // best-effort — caller falls back to Google Books
  }

  return null;
}
