import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// Generates (and caches) a spoiler-free synopsis + main-character overview for a
// club's current book using Claude. Results are stored on the club_books row so we
// only pay for generation once per book.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clubBookId, refresh } = await request.json();
  if (!clubBookId) {
    return NextResponse.json({ error: "Missing clubBookId" }, { status: 400 });
  }

  // Load the club book + its book, and confirm the user belongs to the club.
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

  // Return the cached overview unless a refresh was explicitly requested.
  // Require ai_quotes too, so older books (synopsis/characters only) regenerate
  // and pick up quotes.
  if (!refresh && (clubBook as any).ai_synopsis && (clubBook as any).ai_characters && (clubBook as any).ai_quotes) {
    return NextResponse.json({
      synopsis: (clubBook as any).ai_synopsis,
      characters: (clubBook as any).ai_characters,
      quotes: (clubBook as any).ai_quotes || null,
      cached: true,
    });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Overviews aren't set up yet. Add ANTHROPIC_API_KEY in Vercel." },
      { status: 503 }
    );
  }

  const book = (clubBook as any).book;
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
                description: "3 memorable, widely-known quotes from the book. Each quote on its own line, prefixed with an em dash (— ). Choose quotes that capture the book's voice and themes without spoiling plot. If you are not confident you can recall exact quotes, return an empty string.",
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
          text: "You are a knowledgeable book-club companion. You write concise, spoiler-free synopses and main-character overviews to help a reading group get oriented before they start a book. Never reveal plot twists, endings, character deaths, or any major development. Describe characters only as they are introduced. If you are not familiar with the book, say so honestly in the synopsis rather than inventing details.",
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Book: "${title}"${authors.length ? ` by ${authors.join(", ")}` : ""}\n\n${
            description ? `Publisher description (may help, may be marketing fluff):\n${description}` : "No description available."
          }\n\nWrite a spoiler-free synopsis, a spoiler-free main-character overview, and 3 notable quotes from the book for our book club.`,
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text : "";
    const parsed = JSON.parse(raw) as { synopsis: string; characters: string; quotes: string };

    await supabase
      .from("club_books")
      .update({ ai_synopsis: parsed.synopsis, ai_characters: parsed.characters, ai_quotes: parsed.quotes || null })
      .eq("id", clubBookId);

    return NextResponse.json({ synopsis: parsed.synopsis, characters: parsed.characters, quotes: parsed.quotes || null, cached: false });
  } catch (err: any) {
    const status = err?.status === 401 ? 401 : 500;
    return NextResponse.json(
      { error: status === 401 ? "Invalid ANTHROPIC_API_KEY" : "Couldn't generate an overview right now." },
      { status }
    );
  }
}
