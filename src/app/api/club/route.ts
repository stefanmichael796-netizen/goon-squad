import { createClient } from "@/lib/supabase/server";
import { generateInviteCode } from "@/lib/utils";
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

  if (action === "create") {
    const { name, description } = body;

    const { data: club, error } = await supabase
      .from("clubs")
      .insert({
        name,
        description: description || null,
        created_by: user.id,
        invite_code: generateInviteCode(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase.from("club_members").insert({
      club_id: club.id,
      user_id: user.id,
      role: "owner",
    });

    return NextResponse.json({ club });
  }

  if (action === "join") {
    const { inviteCode } = body;

    const { data: club, error: clubError } = await supabase
      .from("clubs")
      .select()
      .eq("invite_code", inviteCode.toUpperCase().trim())
      .single();

    if (clubError || !club) {
      return NextResponse.json({ error: "Club not found. Check the invite code." }, { status: 404 });
    }

    const { data: existing } = await supabase
      .from("club_members")
      .select()
      .eq("club_id", club.id)
      .eq("user_id", user.id)
      .single();

    if (existing) {
      return NextResponse.json({ club });
    }

    await supabase.from("club_members").insert({
      club_id: club.id,
      user_id: user.id,
      role: "member",
    });

    return NextResponse.json({ club });
  }

  if (action === "set_current_book") {
    const { googleBooksVolume } = body as { googleBooksVolume: GoogleBooksVolume };

    const { data: membership } = await supabase
      .from("club_members")
      .select("club_id, role")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "You're not in a club" }, { status: 403 });
    }

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

    await supabase
      .from("club_books")
      .update({ status: "past", ended_on: new Date().toISOString().split("T")[0] })
      .eq("club_id", membership.club_id)
      .eq("status", "current");

    const { error: cbError } = await supabase.from("club_books").insert({
      club_id: membership.club_id,
      book_id: bookId,
      status: "current",
      started_on: new Date().toISOString().split("T")[0],
    });

    if (cbError) {
      return NextResponse.json({ error: cbError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, bookId });
  }

  if (action === "add_past_book") {
    const { googleBooksVolume } = body as { googleBooksVolume: GoogleBooksVolume };

    const { data: membership } = await supabase
      .from("club_members")
      .select("club_id, role")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "You're not in a club" }, { status: 403 });
    }

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

    // Don't duplicate a book already tracked by this club.
    const { data: existingClubBook } = await supabase
      .from("club_books")
      .select("id")
      .eq("club_id", membership.club_id)
      .eq("book_id", bookId)
      .maybeSingle();

    if (existingClubBook) {
      return NextResponse.json({ success: true, bookId, alreadyOnShelf: true });
    }

    const { error: cbError } = await supabase.from("club_books").insert({
      club_id: membership.club_id,
      book_id: bookId,
      status: "past",
      ended_on: new Date().toISOString().split("T")[0],
    });

    if (cbError) {
      return NextResponse.json({ error: cbError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, bookId });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
