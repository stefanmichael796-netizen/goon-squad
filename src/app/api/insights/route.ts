import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: readBooks } = await supabase
    .from("user_books")
    .select("*, book:books(*)")
    .eq("user_id", user.id)
    .eq("shelf", "read");

  const { data: allBooks } = await supabase
    .from("user_books")
    .select("*, book:books(*)")
    .eq("user_id", user.id);

  const { data: userQuotes } = await supabase
    .from("quotes")
    .select("*, book:books(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const books = readBooks || [];

  // Fill in author nationality for any read books that don't have it yet, using
  // one batched Claude call. Cached on the books row (author_countries), so this
  // only ever runs once per book — later loads skip straight past it.
  const missingCountry = Array.from(
    new Map(
      books
        .map((ub) => ub.book as any)
        .filter((b) => b && b.title && (!b.author_countries || b.author_countries.length === 0))
        .map((b) => [b.id, b])
    ).values()
  );

  if (missingCountry.length > 0 && process.env.ANTHROPIC_API_KEY) {
    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic();
      const batch = missingCountry.slice(0, 60);
      const list = batch
        .map(
          (b: any, i: number) =>
            `${i + 1}. "${b.title}"${b.authors?.length ? ` by ${b.authors.join(", ")}` : ""}`
        )
        .join("\n");

      const message = await client.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 2000,
        thinking: { type: "disabled" },
        output_config: {
          format: {
            type: "json_schema",
            schema: {
              type: "object",
              properties: {
                authors: {
                  type: "array",
                  description: "One entry per numbered book, in the same order as the list.",
                  items: {
                    type: "object",
                    properties: {
                      index: { type: "number", description: "The book's number from the list." },
                      country: {
                        type: "string",
                        description:
                          "The primary author's nationality as a plain country name (e.g. 'United States', 'Ireland', 'Japan', 'Nigeria'). Use 'Unknown' only if you genuinely do not know the author.",
                      },
                    },
                    required: ["index", "country"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["authors"],
              additionalProperties: false,
            },
          },
        },
        system: [
          {
            type: "text",
            text: "You identify the nationality (country of origin or citizenship) of book authors. Be accurate and concise; return a single country name per author. If you genuinely do not know, return 'Unknown' rather than guessing.",
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: `For each book below, give the primary author's nationality as a country:\n\n${list}`,
          },
        ],
      });

      const textBlock = message.content.find((b) => b.type === "text");
      const raw = textBlock && "text" in textBlock ? textBlock.text : "";
      const parsed = JSON.parse(raw) as { authors: { index: number; country: string }[] };

      for (const entry of parsed.authors || []) {
        const b = batch[entry.index - 1] as any;
        if (b && entry.country) {
          const countries = [entry.country];
          await supabase.from("books").update({ author_countries: countries }).eq("id", b.id);
          // reflect it in the in-memory data so the breakdown below is fresh
          books.forEach((ub) => {
            if ((ub.book as any)?.id === b.id) (ub.book as any).author_countries = countries;
          });
        }
      }
    } catch {
      // best-effort — if the lookup fails, those books just stay "Unknown"
    }
  }

  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;

  // Books per month (current year and last year)
  const booksPerMonth: { month: string; current: number; previous: number }[] = [];
  for (let m = 0; m < 12; m++) {
    const monthName = new Date(currentYear, m).toLocaleString("en-US", { month: "short" });
    const current = books.filter((b) => {
      if (!b.finished_at) return false;
      const d = new Date(b.finished_at);
      return d.getFullYear() === currentYear && d.getMonth() === m;
    }).length;
    const previous = books.filter((b) => {
      if (!b.finished_at) return false;
      const d = new Date(b.finished_at);
      return d.getFullYear() === lastYear && d.getMonth() === m;
    }).length;
    booksPerMonth.push({ month: monthName, current, previous });
  }

  // Top authors
  const authorCounts: Record<string, { count: number; covers: string[] }> = {};
  books.forEach((ub) => {
    const book = ub.book as any;
    book?.authors?.forEach((a: string) => {
      if (!authorCounts[a]) authorCounts[a] = { count: 0, covers: [] };
      authorCounts[a].count++;
      if (book.cover_url && authorCounts[a].covers.length < 3) {
        authorCounts[a].covers.push(book.cover_url);
      }
    });
  });
  const topAuthors = Object.entries(authorCounts)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Author countries
  const countryCounts: Record<string, number> = {};
  books.forEach((ub) => {
    const book = ub.book as any;
    if (book?.author_countries?.length) {
      book.author_countries.forEach((c: string) => {
        countryCounts[c] = (countryCounts[c] || 0) + 1;
      });
    } else {
      countryCounts["Unknown"] = (countryCounts["Unknown"] || 0) + 1;
    }
  });
  const authorCountries = Object.entries(countryCounts)
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count);

  // Genres / categories
  const categoryCounts: Record<string, number> = {};
  books.forEach((ub) => {
    const book = ub.book as any;
    book?.categories?.forEach((c: string) => {
      categoryCounts[c] = (categoryCounts[c] || 0) + 1;
    });
  });
  const genres = Object.entries(categoryCounts)
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Reading pace
  const finishedDates = books
    .filter((b) => b.finished_at)
    .map((b) => new Date(b.finished_at!).getTime());
  const firstFinished = finishedDates.length ? Math.min(...finishedDates) : null;
  const monthsSinceFirst = firstFinished
    ? Math.max(1, Math.ceil((Date.now() - firstFinished) / (30 * 24 * 60 * 60 * 1000)))
    : 0;
  const totalPages = books.reduce((sum, ub) => sum + ((ub.book as any)?.page_count || 0), 0);

  const readingPace = {
    totalBooks: books.length,
    monthsSinceFirst,
    booksPerMonth: monthsSinceFirst ? +(books.length / monthsSinceFirst).toFixed(1) : 0,
    totalPages,
    pagesPerMonth: monthsSinceFirst ? Math.round(totalPages / monthsSinceFirst) : 0,
  };

  // Year in review
  const yearBooks = books.filter((b) => {
    if (!b.finished_at) return false;
    return new Date(b.finished_at).getFullYear() === currentYear;
  });

  const yearPages = yearBooks.reduce((sum, ub) => sum + ((ub.book as any)?.page_count || 0), 0);
  const longestBook = yearBooks.reduce(
    (max, ub) => ((ub.book as any)?.page_count || 0) > ((max?.book as any)?.page_count || 0) ? ub : max,
    yearBooks[0] || null
  );
  const shortestBook = yearBooks.reduce(
    (min, ub) => {
      const pc = (ub.book as any)?.page_count;
      const minPc = (min?.book as any)?.page_count;
      return pc && (!minPc || pc < minPc) ? ub : min;
    },
    yearBooks[0] || null
  );

  const yearAuthorCounts: Record<string, number> = {};
  yearBooks.forEach((ub) => {
    (ub.book as any)?.authors?.forEach((a: string) => {
      yearAuthorCounts[a] = (yearAuthorCounts[a] || 0) + 1;
    });
  });
  const mostReadAuthor = Object.entries(yearAuthorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  // Find the top-rated book this year from logs
  const { data: yearLogs } = await supabase
    .from("logs")
    .select("*, book:books(*)")
    .eq("user_id", user.id)
    .eq("kind", "review")
    .not("rating", "is", null)
    .order("rating", { ascending: false })
    .limit(50);

  const topRatedLog = (yearLogs || []).find((l) => {
    return yearBooks.some((yb) => yb.book_id === l.book_id);
  });

  const yearInReview = {
    totalBooks: yearBooks.length,
    totalPages: yearPages,
    longestBook: longestBook ? { title: (longestBook.book as any)?.title, pages: (longestBook.book as any)?.page_count } : null,
    shortestBook: shortestBook ? { title: (shortestBook.book as any)?.title, pages: (shortestBook.book as any)?.page_count } : null,
    mostReadAuthor,
    topRatedBook: topRatedLog ? { title: (topRatedLog.book as any)?.title, rating: topRatedLog.rating } : null,
    pulledQuote: userQuotes?.[0] ? { body: userQuotes[0].body, bookTitle: (userQuotes[0].book as any)?.title } : null,
    authorCountries: authorCountries.filter((ac) => ac.country !== "Unknown"),
  };

  return NextResponse.json({
    booksPerMonth,
    topAuthors,
    authorCountries,
    genres,
    readingPace,
    yearInReview,
  });
}
