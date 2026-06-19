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
  const { action } = body;

  if (action === "add_book") {
    const { googleBooksVolume, shelf } = body as {
      googleBooksVolume: GoogleBooksVolume;
      shelf: "reading" | "want" | "read";
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
        return NextResponse.json({ error: "Failed to create book" }, { status: 500 });
      }
      bookId = newBook.id;
    }

    const today = new Date().toISOString().split("T")[0];

    // One row per (user, book). If it already exists, just move it to the shelf.
    const { data: existing } = await supabase
      .from("user_books")
      .select("id")
      .eq("user_id", user.id)
      .eq("book_id", bookId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("user_books")
        .update({
          shelf,
          finished_at: shelf === "read" ? today : null,
          started_at: shelf === "reading" ? today : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      return NextResponse.json({ success: true, bookId, userBookId: existing.id });
    }

    const { data: inserted, error: ubError } = await supabase
      .from("user_books")
      .insert({
        user_id: user.id,
        book_id: bookId,
        shelf,
        finished_at: shelf === "read" ? today : null,
        started_at: shelf === "reading" ? today : null,
      })
      .select("id")
      .single();

    if (ubError) {
      return NextResponse.json({ error: ubError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, bookId, userBookId: inserted.id });
  }

  if (action === "remove_book") {
    const { userBookId } = body;
    if (!userBookId) {
      return NextResponse.json({ error: "Missing userBookId" }, { status: 400 });
    }

    const { error } = await supabase
      .from("user_books")
      .delete()
      .eq("id", userBookId)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
