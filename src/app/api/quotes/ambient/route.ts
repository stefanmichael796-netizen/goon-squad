import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface AmbientQuote {
  body: string;
  bookTitle: string | null;
  author: string | null;
}

function parseAiQuotes(aiQuotes: string | null, bookTitle: string | null, author: string | null): AmbientQuote[] {
  if (!aiQuotes) return [];
  return aiQuotes
    .split("\n")
    .map((s) => s.replace(/^[—-]\s*/, "").replace(/^["“]|["”]$/g, "").trim())
    .filter(Boolean)
    .map((body) => ({ body, bookTitle, author }));
}

// The individualised ambient-quote pool: only quotes from books the reader (or
// their club) has actually engaged with — their saved quotes plus the AI notable
// quotes for books in their library / the club shelf. No generic classics here.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ quotes: [] });

  const scope = new URL(request.url).searchParams.get("scope") === "club" ? "club" : "me";
  const pool: AmbientQuote[] = [];

  if (scope === "club") {
    const { data: membership } = await supabase
      .from("club_members")
      .select("club_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();
    if (!membership) return NextResponse.json({ quotes: [] });

    const [savedRes, shelfRes] = await Promise.all([
      supabase
        .from("quotes")
        .select("body, book:books(title, authors)")
        .eq("club_id", membership.club_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("club_books")
        .select("ai_quotes, book:books(title, authors)")
        .eq("club_id", membership.club_id),
    ]);

    (savedRes.data || []).forEach((q: any) =>
      pool.push({ body: q.body, bookTitle: (q.book as any)?.title || null, author: (q.book as any)?.authors?.[0] || null })
    );
    (shelfRes.data || []).forEach((cb: any) =>
      pool.push(...parseAiQuotes(cb.ai_quotes, (cb.book as any)?.title || null, (cb.book as any)?.authors?.[0] || null))
    );
  } else {
    const { data: ub } = await supabase
      .from("user_books")
      .select("book_id")
      .eq("user_id", user.id);
    const bookIds = (ub || []).map((x: any) => x.book_id);

    const [savedRes, aiRes] = await Promise.all([
      supabase
        .from("quotes")
        .select("body, book:books(title, authors)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      bookIds.length
        ? supabase
            .from("books")
            .select("title, authors, ai_quotes")
            .in("id", bookIds)
            .not("ai_quotes", "is", null)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    (savedRes.data || []).forEach((q: any) =>
      pool.push({ body: q.body, bookTitle: (q.book as any)?.title || null, author: (q.book as any)?.authors?.[0] || null })
    );
    (aiRes.data || []).forEach((b: any) =>
      pool.push(...parseAiQuotes(b.ai_quotes, b.title || null, b.authors?.[0] || null))
    );
  }

  // De-dupe by body text.
  const seen = new Set<string>();
  const quotes = pool.filter((q) => {
    const key = q.body.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return NextResponse.json({ quotes });
}
