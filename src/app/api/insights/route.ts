import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = new URL(request.url).searchParams;
  const scope = sp.get("scope") === "club" ? "club" : "me";
  const yearParam = sp.get("year");

  // Build a common `books` shape ({ finished_at, book_id, book }) for whichever
  // scope we're in, so all the aggregation below is identical.
  let clubId: string | null = null;
  let books: { finished_at: string | null; book_id: string; book: any }[] = [];

  const emptyResponse = {
    scope,
    availableYears: [new Date().getFullYear()],
    booksPerYear: [],
    topAuthors: [],
    authorCountries: [],
    genres: [],
    members: [],
    readingPace: { totalBooks: 0, totalPages: 0 },
    yearInReview: {
      year: new Date().getFullYear(), totalBooks: 0, totalPages: 0, longestBook: null,
      shortestBook: null, topRatedBook: null, pulledQuote: null, authorCountries: [], books: [],
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
  const selectedYear = yearParam && /^\d{4}$/.test(yearParam) ? parseInt(yearParam, 10) : currentYear;

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

  // Personal re-reads count as reads in the year they happened (club has none).
  // Pull them once — used by the per-year graph and the year review.
  let rereadLogs: any[] = [];
  if (scope === "me") {
    const { data } = await supabase
      .from("logs")
      .select("book_id, created_at, rating, book:books(*)")
      .eq("user_id", user.id)
      .eq("kind", "reread")
      .order("created_at", { ascending: false });
    rereadLogs = data || [];
  }

  // Books per year (reads finished that year + personal re-reads that year)
  const yearCounts: Record<number, number> = {};
  books.forEach((b) => {
    if (b.finished_at) {
      const y = new Date(b.finished_at).getFullYear();
      yearCounts[y] = (yearCounts[y] || 0) + 1;
    }
  });
  rereadLogs.forEach((r) => {
    if (r.created_at) {
      const y = new Date(r.created_at).getFullYear();
      yearCounts[y] = (yearCounts[y] || 0) + 1;
    }
  });
  const booksPerYear = Object.entries(yearCounts)
    .map(([y, count]) => ({ year: parseInt(y, 10), count }))
    .sort((a, b) => a.year - b.year);

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
  const totalPages = books.reduce((sum, ub) => sum + ((ub.book as any)?.page_count || 0), 0);
  const readingPace = {
    totalBooks: books.length,
    totalPages,
  };

  // Year in review — for the selected year (defaults to the current year)
  const yearBooks = books.filter((b) => {
    if (!b.finished_at) return false;
    return new Date(b.finished_at).getFullYear() === selectedYear;
  });

  // Rating per book — the club average, or the user's own rating.
  const ratingByBook: Record<string, number> = {};
  let pulledQuote: { body: string; bookTitle: string } | null = null;
  let members: { name: string; booksRated: number }[] = [];

  if (scope === "club" && clubId) {
    const { data: clubLogs } = await supabase
      .from("logs")
      .select("book_id, rating, user_id")
      .eq("club_id", clubId)
      .in("kind", ["review", "reread"])
      .not("rating", "is", null);

    const agg: Record<string, { sum: number; n: number }> = {};
    (clubLogs || []).forEach((l: any) => {
      const cur = agg[l.book_id] || { sum: 0, n: 0 };
      cur.sum += l.rating;
      cur.n += 1;
      agg[l.book_id] = cur;
    });
    Object.entries(agg).forEach(([id, a]) => {
      ratingByBook[id] = Math.round((a.sum / a.n) * 10) / 10;
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
    const { data: myLogs } = await supabase
      .from("logs")
      .select("book_id, rating, created_at")
      .eq("user_id", user.id)
      .in("kind", ["review", "reread"])
      .not("rating", "is", null)
      .order("created_at", { ascending: false });
    (myLogs || []).forEach((l: any) => {
      if (ratingByBook[l.book_id] === undefined) ratingByBook[l.book_id] = l.rating; // latest per book
    });

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

  // Year entries = books finished in the year, plus (personal) re-reads that
  // happened in the year. Each re-read counts as a read of that book that year.
  type YearEntry = { book_id: string; book: any; rating: number | null; reread: boolean };
  const yearEntries: YearEntry[] = yearBooks.map((yb) => ({
    book_id: yb.book_id,
    book: yb.book,
    rating: ratingByBook[yb.book_id] ?? null,
    reread: false,
  }));
  if (scope === "me") {
    rereadLogs
      .filter((r) => r.created_at && new Date(r.created_at).getFullYear() === selectedYear)
      .forEach((r) => {
        yearEntries.push({
          book_id: r.book_id,
          book: r.book,
          rating: r.rating ?? ratingByBook[r.book_id] ?? null,
          reread: true,
        });
      });
  }

  const yearPages = yearEntries.reduce((sum, e) => sum + (e.book?.page_count || 0), 0);
  const longestBook = yearEntries.reduce<YearEntry | null>(
    (max, e) => ((e.book?.page_count || 0) > (max?.book?.page_count || 0) ? e : max),
    yearEntries[0] || null
  );
  const shortestBook = yearEntries.reduce<YearEntry | null>(
    (min, e) => {
      const pc = e.book?.page_count;
      const minPc = min?.book?.page_count;
      return pc && (!minPc || pc < minPc) ? e : min;
    },
    yearEntries[0] || null
  );

  // Top-rated book of the year.
  let topRatedBook: { title: string; rating: number } | null = null;
  yearEntries.forEach((e) => {
    if (e.rating != null && (!topRatedBook || e.rating > topRatedBook.rating)) {
      topRatedBook = { title: e.book?.title, rating: e.rating };
    }
  });

  // Every read from the year, with its rating, best first.
  const yearBooksList = yearEntries
    .map((e) => ({
      bookId: e.book_id,
      title: e.book?.title || "",
      coverUrl: e.book?.cover_url || null,
      rating: e.rating,
      reread: e.reread,
    }))
    .sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));

  // Countries represented in the selected year.
  const yearCountryCounts: Record<string, number> = {};
  yearEntries.forEach((e) => {
    e.book?.author_countries?.forEach((c: string) => {
      if (c && c !== "Unknown") yearCountryCounts[c] = (yearCountryCounts[c] || 0) + 1;
    });
  });
  const yearCountries = Object.entries(yearCountryCounts)
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count);

  // Years that have finished books or re-reads (plus the current year), newest first.
  const availableYears = Array.from(
    new Set([
      ...books.filter((b) => b.finished_at).map((b) => new Date(b.finished_at!).getFullYear()),
      ...rereadLogs.filter((r) => r.created_at).map((r) => new Date(r.created_at).getFullYear()),
    ])
  );
  if (!availableYears.includes(currentYear)) availableYears.push(currentYear);
  availableYears.sort((a, b) => b - a);

  const yearInReview = {
    year: selectedYear,
    totalBooks: yearEntries.length,
    totalPages: yearPages,
    longestBook: longestBook ? { title: (longestBook as YearEntry).book?.title, pages: (longestBook as YearEntry).book?.page_count } : null,
    shortestBook: shortestBook ? { title: (shortestBook as YearEntry).book?.title, pages: (shortestBook as YearEntry).book?.page_count } : null,
    topRatedBook,
    pulledQuote,
    authorCountries: yearCountries,
    books: yearBooksList,
  };

  return NextResponse.json({
    scope,
    availableYears,
    booksPerYear,
    topAuthors,
    authorCountries,
    genres,
    members,
    readingPace,
    yearInReview,
  });
}
