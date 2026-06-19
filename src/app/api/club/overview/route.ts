import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// Generates (and caches) a spoiler-free synopsis + main-character overview +
// notable quotes for a book using Claude. Works for two contexts:
//   - club books: pass { clubBookId } — cached on the club_books row.
//   - personal books: pass { bookId } — cached on the shared books row.
// We only pay for generation once per book (per context).
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clubBookId, bookId, refresh } = await request.json();
  if (!clubBookId && !bookId) {
    return NextResponse.json({ error: "Missing clubBookId or bookId" }, { status: 400 });
  }

  // Resolve the book + where we read/write the cached overview.
  let cached: { ai_synopsis: string | null; ai_characters: string | null; ai_quotes: string | null } | null = null;
  let book: { title?: string; authors?: string[]; description?: string } | null = null;
  let cacheTable: "club_books" | "books";
  let cacheId: string;

  if (clubBookId) {
    const { data: clubBook } = await supabase
      .from("club_books")
      .select("id, club_id, ai_synopsis, ai_characters, ai_quotes, book:books(title, authors, description)")
      .eq("id", clubBookId)
      .single();

    if (!clubBook) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from("club_members")
      .select("user_id")
      .eq("club_id", (clubBook as any).club_id)
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Not a club member" }, { status: 403 });
    }

    cached = clubBook as any;
    book = (clubBook as any).book;
    cacheTable = "club_books";
    cacheId = clubBookId;
  } else {
    const { data: bookRow } = await supabase
      .from("books")
      .select("id, title, authors, description, ai_synopsis, ai_characters, ai_quotes")
      .eq("id", bookId)
      .single();

    if (!bookRow) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    cached = bookRow as any;
    book = bookRow as any;
    cacheTable = "books";
    cacheId = bookId;
  }

  // Return the cached overview unless a refresh was explicitly requested.
  // Require ai_quotes too, so older books regenerate to pick them up.
  if (!refresh && cached?.ai_synopsis && cached?.ai_characters && cached?.ai_quotes) {
    return NextResponse.json({
      synopsis: cached.ai_synopsis,
      characters: cached.ai_characters,
      quotes: cached.ai_quotes || null,
      cached: true,
    });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Overviews aren't set up yet. Add ANTHROPIC_API_KEY in Vercel." },
      { status: 503 }
    );
  }

  const title: string = book?.title || "";
  const authors: string[] = book?.authors || [];
  const description: string = (book?.description || "").replace(/<[^>]*>/g, "").slice(0, 1500);

  const client = new Anthropic();

  try {
    const message = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1500,
      thinking: { type: "disabled" },
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              synopsis: {
                type: "string",
                description: "A warm, inviting 3-4 sentence overview of the book's premise and themes. Absolutely no spoilers — do not reveal twists, the ending, or major plot developments.",
              },
              characters: {
                type: "string",
                description: "A spoiler-free overview of the main characters. One short line each, formatted as 'Name — one-line description'. Separate each character with a newline. Describe who they are at the start of the story only; reveal no arcs, fates, or twists.",
              },
              quotes: {
                type: "string",
                description: "Exactly 3 memorable quotes from the book that capture its voice and themes without spoiling the plot. Each quote on its own line, prefixed with an em dash (— ). Prefer well-known lines. If you genuinely cannot recall verbatim lines, paraphrase a characteristic passage and keep it short — but always provide 3 lines. Only return an empty string if you have never heard of this book at all.",
              },
            },
            required: ["synopsis", "characters", "quotes"],
            additionalProperties: false,
          },
        },
      },
      system: [
        {
          type: "text",
          text: "You are a knowledgeable book-club companion. You write concise, spoiler-free synopses and main-character overviews to help a reader get oriented before they start a book. Never reveal plot twists, endings, character deaths, or any major development. Describe characters only as they are introduced. If you are not familiar with the book, say so honestly in the synopsis rather than inventing details.",
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Book: "${title}"${authors.length ? ` by ${authors.join(", ")}` : ""}\n\n${
            description ? `Publisher description (may help, may be marketing fluff):\n${description}` : "No description available."
          }\n\nWrite a spoiler-free synopsis, a spoiler-free main-character overview, and 3 notable quotes from the book.`,
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text : "";
    const parsed = JSON.parse(raw) as { synopsis: string; characters: string; quotes: string };

    await supabase
      .from(cacheTable)
      .update({ ai_synopsis: parsed.synopsis, ai_characters: parsed.characters, ai_quotes: parsed.quotes || null })
      .eq("id", cacheId);

    return NextResponse.json({ synopsis: parsed.synopsis, characters: parsed.characters, quotes: parsed.quotes || null, cached: false });
  } catch (err: any) {
    const status = err?.status === 401 ? 401 : 500;
    return NextResponse.json(
      { error: status === 401 ? "Invalid ANTHROPIC_API_KEY" : "Couldn't generate an overview right now." },
      { status }
    );
  }
}
