import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { bookId, body: quoteBody, pageNumber, note, clubId } = body;

  const { error } = await supabase.from("quotes").insert({
    user_id: user.id,
    book_id: bookId,
    club_id: clubId || null,
    body: quoteBody,
    page_number: pageNumber,
    note,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
