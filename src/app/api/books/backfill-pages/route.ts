import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getBookById } from "@/lib/google-books";
import { pageCountFromOpenLibrary } from "@/lib/open-library";

const BATCH = 20;

// Walks the whole books table one page at a time (cursor by id) and fills in any
// missing page count from Open Library, then Google Books. The client calls this
// repeatedly, passing back nextCursor, until hasMore is false — so it always
// terminates even for books neither source can resolve.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { cursor } = await request.json().catch(() => ({ cursor: null }));

  let query = supabase
    .from("books")
    .select("id, google_books_id, isbn_13, title, authors, page_count")
    .order("id", { ascending: true })
    .limit(BATCH);
  if (cursor) query = query.gt("id", cursor);

  const { data: batch, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let updated = 0;
  for (const b of batch || []) {
    if (b.page_count && b.page_count > 0) continue;
    try {
      let pc = await pageCountFromOpenLibrary({
        isbn13: b.isbn_13,
        title: b.title,
        authors: b.authors,
      });
      if (!pc && b.google_books_id) {
        const full = await getBookById(b.google_books_id);
        pc = full?.volumeInfo?.pageCount ?? null;
      }
      if (pc && pc > 0) {
        await supabase.from("books").update({ page_count: pc }).eq("id", b.id);
        updated++;
      }
    } catch {
      // best-effort — skip this book
    }
  }

  const rows = batch || [];
  const nextCursor = rows.length ? rows[rows.length - 1].id : null;
  const hasMore = rows.length === BATCH;

  return NextResponse.json({ updated, nextCursor, hasMore });
}
