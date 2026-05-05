import { createClient } from "@/lib/supabase/server";
import { volumeToBook } from "@/lib/google-books";
import { NextResponse } from "next/server";
import type { GoogleBooksVolume } from "@/lib/types";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    googleBooksVolume,
    rating,
    review,
    shelf,
    progressPage,
    shareToClub,
    clubId,
  } = body as {
    googleBooksVolume: GoogleBooksVolume;
    rating: number | null;
    review: string | null;
    shelf: "reading" | "want" | "read";
    progressPage: number | null;
    shareToClub: boolean;
    clubId: string | null;
  };

  const bookData = volumeToBook(googleBooksVolume);

  const { data: existingBook } = await supabase
    .from("books")
    .select("id")
    .eq("google_books_id", bookData.google_books_id)
    .single();

  let bookId: string;

  if (existingBook) {
    bookId = existingBook.id;
  } else {
    const { data: newBook, error: bookError } = await supabase
      .from("books")
      .insert(bookData)
      .select("id")
      .single();

    if (bookError || !newBook) {
      return NextResponse.json({ error: "Failed to create book", details: bookError?.message }, { status: 500 });
    }
    bookId = newBook.id;
  }

  const today = new Date().toISOString().split("T")[0];
  const progressPct =
    progressPage && googleBooksVolume.volumeInfo.pageCount
      ? Math.min(100, (progressPage / googleBooksVolume.volumeInfo.pageCount) * 100)
      : null;

  const { error: upsertError } = await supabase
    .from("user_books")
    .upsert(
      {
        user_id: user.id,
        book_id: bookId,
        shelf,
        progress_page: progressPage,
        progress_pct: progressPct,
        started_at: shelf === "reading" ? today : null,
        finished_at: shelf === "read" ? today : null,
      },
      { onConflict: "user_id,book_id" }
    );

  if (upsertError) {
    return NextResponse.json({ error: "Failed to save book", details: upsertError.message }, { status: 500 });
  }

  let resolvedClubId = shareToClub && clubId ? clubId : null;
  let clubBookId: string | null = null;

  if (resolvedClubId) {
    const { data: clubBook } = await supabase
      .from("club_books")
      .select("id")
      .eq("club_id", resolvedClubId)
      .eq("book_id", bookId)
      .single();

    clubBookId = clubBook?.id || null;
  }

  const { error: logError } = await supabase.from("logs").insert({
    user_id: user.id,
    book_id: bookId,
    club_id: resolvedClubId,
    club_book_id: clubBookId,
    kind: (review || rating) ? "review" as const : "shelf_change" as const,
    rating,
    review,
    shelf,
    progress_pct: progressPct,
  });

  if (logError) {
    return NextResponse.json({ error: "Failed to create log", details: logError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, bookId });
}
