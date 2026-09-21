import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scope = new URL(request.url).searchParams.get("scope") === "club" ? "club" : "me";

  // Build a common `books` shape ({ finished_at, book_id, book }) for whichever
  // scope we're in, so all the aggregation below is identical.
  let clubId: string | null = null;
  let books: { finished_at: string | null; book_id: string; book: any }[] = [];

  const emptyResponse = {
    scope,
    booksPerMonth: [],
    topAuthors: [],
    authorCountries: [],
    genres: [],
    members: [],
    readingPace: { totalBooks: 0, monthsSinceFirst: 0, booksPerMonth: 0, totalPages: 0, pagesPerMonth: 0 },
    yearInReview: {
      totalBooks: 0, totalPages: 0, longestBook: null, shortestBook: null,
      mostReadAuthor: null, topRatedBook: null, pulledQuote: null, authorCountries: [],
    },
  };

  if (scope === "club") {
    const { data: membership } = await supabase
      .from("club_members")
      .select("club_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!membership) return NextResponse.json(emptyResponse);
    clubId = membership.club_id;

    const { data: pastBooks } = await supabase
      .from("club_books")
      .select("book_id, ended_on, book:books(*)")
      .eq("club_id", clubId)
      .eq("status", "past");

    books = (pastBooks || []).map((cb: any) => ({
      finished_at: cb.ended_on,
      book_id: cb.book_id,
      book: cb.book,
    }));
  } else {
    const { data: readBooks } = await supabase
      .from("user_books")
      .select("*, book:books(*)")
      .eq("user_id", user.id)
      .eq("shelf", "read");

    books = (readBooks || []).map((ub: any) => ({
      finished_at: ub.finished_at,
      book_id: ub.book_id,
      book: ub.book,
    }));
  }

  // Fill in author nationality for any books that don't have it yet, using one
  // batched Claude call. Cached on the books row (author_countries), so this only
  // ever runs once per book — later loads skip straight past it.
  // Fill in author nationality AND a distinct genre for any books that are
  // missing either, using one batched Claude call. Both are cached on the books
  // row, so this only runs once per book — later loads skip straight past it.
  const needsEnrich = Array.from(
    new Map(
      books
        .map((ub) => ub.book as any)
        .filter(
          (b) =>
            b &&
            b.title &&
            ((!b.author_countries || b.author_countries.length === 0) || !b.genre)
        )
        .map((b) => [b.id, b])
    ).values()
  );

  if (needsEnrich.length > 0 && process.env.ANTHROPIC_API_KEY) {
    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic();
      const batch = needsEnrich.slice(0, 50);
      const list = batch
        .map(
          (b: any, i: number) =>
            `${i + 1}. "${b.title}"${b.authors?.length ? ` by ${b.authors.join(", ")}` : ""}`
        )
        .join("\n");

      const message = await client.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 3000,
        thinking: { type: "disabled" },
        output_config: {
          format: {
            type: "json_schema",
            schema: {
              type: "object",
              properties: {
                books: {
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
                      genre: {
                        type: "string",
                        description:
                          "The single best-fitting genre, chosen from exactly this list: Literary Fiction, Contemporary Fiction, Historical Fiction, Science Fiction, Fantasy, Mystery, Thriller, Horror, Romance, Young Adult, Classic, Short Stories, Poetry, Memoir, Biography, History, Science, Nature, Philosophy, Psychology, Self-Help, Business, Economics, Politics, True Crime, Travel, Essays, Religion, Art, Cookery, Graphic Novel, Children's, Drama. Pick the most specific one that genuinely fits; never answer just 'Fiction' or 'Nonfiction'. Use 'Other' only if nothing fits.",
                      },
                    },
                    required: ["index", "country", "genre"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["books"],
              additionalProperties: false,
            },
          },
        },
        system: [
          {
            type: "text",
            text: "You are a knowledgeable librarian. For each book you identify the primary author's nationality (country of origin or citizenship) and assign the single most fitting genre from the provided list. Be accurate; if you truly don't know a nationality, use 'Unknown'. Always pick a specific genre rather than the generic 'Fiction'.",
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: `For each book below, give the primary author's nationality (as a country) and its single best-fitting genre:\n\n${list}`,
          },
        ],
      });

      const textBlock = message.content.find((b) => b.type === "text");
      const raw = textBlock && "text" in textBlock ? textBlock.text : "";
      const parsed = JSON.parse(raw) as { books: { index: number; country: string; genre: string }[] };

      for (const entry of parsed.books || []) {
        const b = batch[entry.index - 1] as any;
        if (!b) continue;
        // Separate updates so a missing `genre` column (migration not yet run)
        // can't stop the nationality write, and vice versa.
        if (entry.country) {
          const countries = [entry.country];
          await supabase.from("books").update({ author_countries: countries }).eq("id", b.id);
          books.forEach((ub) => {
            if ((ub.book as any)?.id === b.id) (ub.book as any).author_countries = countries;
          });
        }
        if (entry.genre) {
          const { error: gErr } = await supabase.from("books").update({ genre: entry.genre }).eq("id", b.id);
          if (!gErr) {
            books.forEach((ub) => {
              if ((ub.book as any)?.id === b.id) (ub.book as any).genre = entry.genre;
            });
          }
        }
      }
    } catch {
      // best-effort — if the lookup fails, those books just keep what they have
    }
  }

  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;

  // Backfill missing page counts from Google Books. Search results often omit
  // pageCount, so older books can have null (counted as 0 pages). Fetch the full
  // volume for those and cache it on the books row — one-time per book.
  const missingPages = Array.from(
    new Map(
      books
        .map((ub) => ub.book as any)
        .filter((b) => b && b.google_books_id && (!b.page_count || b.page_count === 0))
        .map((b) => [b.id, b])
    ).values()
  ).slice(0, 40);

  if (missingPages.length > 0) {
    const { getBookById } = await import("@/lib/google-books");
    const { pageCountFromOpenLibrary } = await import("@/lib/open-library");
    await Promise.all(
      missingPages.map(async (b: any) => {
        try {
          // Open Library first (exact by ISBN), then Google Books as a fallback.
          let pc = await pageCountFromOpenLibrary({
            isbn13: b.isbn_13,
            title: b.title,
            authors: b.authors,
          });
          if (!pc) {
            const full = await getBookById(b.google_books_id);
            pc = full?.volumeInfo?.pageCount ?? null;
          }
          if (pc && pc > 0) {
            await supabase.from("books").update({ page_count: pc }).eq("id", b.id);
            books.forEach((ub) => {
              if ((ub.book as any)?.id === b.id) (ub.book as any).page_count = pc;
            });
          }
        } catch {
          // best-effort; leave it as-is if the lookup fails
        }
      })
    );
  }

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

  // Genres — prefer the distinct AI genre; fall back to a book's first Google
  // Books category for anything not yet enriched.
  const categoryCounts: Record<string, number> = {};
  books.forEach((ub) => {
    const book = ub.book as any;
    if (book?.genre) {
      categoryCounts[book.genre] = (categoryCounts[book.genre] || 0) + 1;
    } else if (book?.categories?.length) {
      const c = book.categories[0];
      categoryCounts[c] = (categoryCounts[c] || 0) + 1;
    }
  });
  const genres = Object.entries(categoryCounts)
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

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

  // Top-rated + a pulled quote + (club) member leaderboard — scope-aware.
  let topRatedBook: { title: string; rating: number } | null = null;
  let pulledQuote: { body: string; bookTitle: string } | null = null;
  let members: { name: string; booksRated: number }[] = [];

  if (scope === "club" && clubId) {
    const { data: clubLogs } = await supabase
      .from("logs")
      .select("book_id, rating, user_id, book:books(title)")
      .eq("club_id", clubId)
      .in("kind", ["review", "reread"])
      .not("rating", "is", null);

    // Average rating per book, then pick the best among this year's books.
    const agg: Record<string, { sum: number; n: number; title: string }> = {};
    (clubLogs || []).forEach((l: any) => {
      const cur = agg[l.book_id] || { sum: 0, n: 0, title: (l.book as any)?.title };
      cur.sum += l.rating;
      cur.n += 1;
      agg[l.book_id] = cur;
    });
    yearBooks.forEach((yb) => {
      const a = agg[yb.book_id];
      if (a) {
        const avg = Math.round((a.sum / a.n) * 10) / 10;
        if (!topRatedBook || avg > topRatedBook.rating) {
          topRatedBook = { title: a.title || (yb.book as any)?.title, rating: avg };
        }
      }
    });

    // Member leaderboard: how many distinct books each member has rated.
    const perMember: Record<string, Set<string>> = {};
    (clubLogs || []).forEach((l: any) => {
      (perMember[l.user_id] ||= new Set()).add(l.book_id);
    });
    const { data: memberRows } = await supabase
      .from("club_members")
      .select("user_id, profile:profiles(display_name)")
      .eq("club_id", clubId);
    members = (memberRows || [])
      .map((m: any) => ({
        name: (m.profile as any)?.display_name || "Someone",
        booksRated: perMember[m.user_id]?.size || 0,
      }))
      .sort((a, b) => b.booksRated - a.booksRated);

    const { data: clubQuotes } = await supabase
      .from("quotes")
      .select("body, book:books(title)")
      .eq("club_id", clubId)
      .order("created_at", { ascending: false })
      .limit(1);
    pulledQuote = clubQuotes?.[0]
      ? { body: clubQuotes[0].body, bookTitle: (clubQuotes[0].book as any)?.title }
      : null;
  } else {
    const { data: yearLogs } = await supabase
      .from("logs")
      .select("*, book:books(*)")
      .eq("user_id", user.id)
      .eq("kind", "review")
      .not("rating", "is", null)
      .order("rating", { ascending: false })
      .limit(50);

    const topRatedLog = (yearLogs || []).find((l) => yearBooks.some((yb) => yb.book_id === l.book_id));
    topRatedBook = topRatedLog
      ? { title: (topRatedLog.book as any)?.title, rating: topRatedLog.rating }
      : null;

    const { data: userQuotes } = await supabase
      .from("quotes")
      .select("*, book:books(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);
    pulledQuote = userQuotes?.[0]
      ? { body: userQuotes[0].body, bookTitle: (userQuotes[0].book as any)?.title }
      : null;
  }

  const yearInReview = {
    totalBooks: yearBooks.length,
    totalPages: yearPages,
    longestBook: longestBook ? { title: (longestBook.book as any)?.title, pages: (longestBook.book as any)?.page_count } : null,
    shortestBook: shortestBook ? { title: (shortestBook.book as any)?.title, pages: (shortestBook.book as any)?.page_count } : null,
    mostReadAuthor,
    topRatedBook,
    pulledQuote,
    authorCountries: authorCountries.filter((ac) => ac.country !== "Unknown"),
  };

  return NextResponse.json({
    scope,
    booksPerMonth,
    topAuthors,
    authorCountries,
    genres,
    members,
    readingPace,
    yearInReview,
  });
}
