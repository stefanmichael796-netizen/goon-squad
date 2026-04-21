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
