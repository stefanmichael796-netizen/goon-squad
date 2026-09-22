import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Saved quotes for the Quotes page and the ambient quote lines.
//   scope=me   → every quote the current user has saved
//   scope=club → every quote saved by anyone in the user's club
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scope = new URL(request.url).searchParams.get("scope") === "club" ? "club" : "me";

  if (scope === "club") {
    const { data: membership } = await supabase
      .from("club_members")
      .select("club_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();
    if (!membership) return NextResponse.json({ quotes: [] });

    const { data } = await supabase
      .from("quotes")
      .select("id, body, page_number, note, book:books(title, authors), profile:profiles(display_name)")
      .eq("club_id", membership.club_id)
      .order("created_at", { ascending: false });

    const quotes = (data || []).map((q: any) => ({
      id: q.id,
      body: q.body,
      pageNumber: q.page_number,
      note: q.note,
      bookTitle: (q.book as any)?.title || null,
      author: (q.book as any)?.authors?.[0] || null,
      person: (q.profile as any)?.display_name || null,
    }));
    return NextResponse.json({ quotes });
  }

  const { data } = await supabase
    .from("quotes")
    .select("id, body, page_number, note, book:books(title, authors)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const quotes = (data || []).map((q: any) => ({
    id: q.id,
    body: q.body,
    pageNumber: q.page_number,
    note: q.note,
    bookTitle: (q.book as any)?.title || null,
    author: (q.book as any)?.authors?.[0] || null,
    person: null,
  }));
  return NextResponse.json({ quotes });
}
