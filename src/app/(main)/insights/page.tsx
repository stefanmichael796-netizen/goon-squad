"use client";

import { useState, useEffect } from "react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { BookCover } from "@/components/ui/book-cover";
import { useToast } from "@/components/ui/toast";
import { countryFlag } from "@/lib/flags";
import { BarChart3, Loader2, RotateCw } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface InsightsData {
  scope: "me" | "club";
  availableYears: number[];
  booksPerMonth: { month: string; current: number; previous: number }[];
  topAuthors: { name: string; count: number; covers: string[] }[];
  authorCountries: { country: string; count: number }[];
  genres: { genre: string; count: number }[];
  members: { name: string; booksRated: number }[];
  readingPace: {
    totalBooks: number;
    monthsSinceFirst: number;
    booksPerMonth: number;
    totalPages: number;
    pagesPerMonth: number;
  };
  yearInReview: {
    year: number;
    totalBooks: number;
    totalPages: number;
    longestBook: { title: string; pages: number } | null;
    shortestBook: { title: string; pages: number } | null;
    topRatedBook: { title: string; rating: number } | null;
    pulledQuote: { body: string; bookTitle: string } | null;
    authorCountries: { country: string; count: number }[];
    books: { bookId: string; title: string; coverUrl: string | null; rating: number | null }[];
  };
}

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
    {children}
  </h2>
);

function StatTile({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-center">
      <p className="text-2xl font-bold text-[var(--accent)]">{value}</p>
      <p className="text-xs text-[var(--muted)] mt-0.5">{label}</p>
    </div>
  );
}

export default function InsightsPage() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"me" | "club">("me");
  const [tab, setTab] = useState<"stats" | "year">("stats");
  const [year, setYear] = useState(new Date().getFullYear());
  const [backfilling, setBackfilling] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const toast = useToast();

  useEffect(() => {
    let active = true;
    setLoading(true);
    async function load() {
      const res = await fetch(`/api/insights?scope=${scope}&year=${year}`);
      if (active && res.ok) {
        setData(await res.json());
      }
      if (active) setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [scope, year, reloadKey]);

  async function backfillAllPageCounts() {
    setBackfilling(true);
    let cursor: string | null = null;
    let total = 0;
    let hasMore = true;
    let guard = 0;
    try {
      while (hasMore && guard < 500) {
        guard++;
        const res: Response = await fetch("/api/books/backfill-pages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cursor }),
        });
        if (!res.ok) {
          toast("Couldn't update page counts — try again", "error");
          break;
        }
        const d = await res.json();
        total += d.updated;
        cursor = d.nextCursor;
        hasMore = d.hasMore;
      }
      toast(
        total > 0 ? `Updated ${total} page count${total === 1 ? "" : "s"}` : "Page counts are already up to date",
        "success"
      );
      setReloadKey((k) => k + 1);
    } catch {
      toast("Couldn't update page counts — try again", "error");
    }
    setBackfilling(false);
  }

  const ScopeToggle = () => (
    <div className="inline-flex rounded-lg bg-[var(--surface)] border border-[var(--border)] p-0.5">
      {(["me", "club"] as const).map((s) => (
        <button
          key={s}
          onClick={() => setScope(s)}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            scope === s ? "bg-coral text-white" : "text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          {s === "me" ? "You" : "Club"}
        </button>
      ))}
    </div>
  );

  if (loading) return <PageSkeleton />;

  if (!data || data.readingPace.totalBooks === 0) {
    return (
      <div className="max-w-lg mx-auto w-full px-4 py-6 space-y-6 animate-fade-in">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-serif font-bold text-2xl text-[var(--foreground)]">Insights</h1>
          <ScopeToggle />
        </div>
        <EmptyState
          message={
            scope === "club"
              ? "Once the club has finished a few books, its story shows up here."
              : "Come back after a few books — your reading story will take shape here."
          }
          icon={BarChart3}
        />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto w-full px-4 py-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-serif font-bold text-2xl text-[var(--foreground)]">Insights</h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">
            {scope === "club" ? "The whole squad, by the numbers." : "Your reading, by the numbers."}
          </p>
        </div>
        <ScopeToggle />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setTab("stats")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors press ${
            tab === "stats"
              ? "bg-coral text-white"
              : "bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)]"
          }`}
        >
          Statistics
        </button>
        <button
          onClick={() => setTab("year")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors press ${
            tab === "year"
              ? "bg-coral text-white"
              : "bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)]"
          }`}
        >
          Year in Review
        </button>
      </div>

      {tab === "stats" && (
        <div className="space-y-8">
          {/* Reading pace */}
          <section>
            <SectionLabel>Reading pace</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <StatTile value={data.readingPace.totalBooks} label="books read" />
              <StatTile value={data.readingPace.booksPerMonth} label="books / month" />
              <StatTile value={data.readingPace.totalPages.toLocaleString()} label="total pages" />
              <StatTile value={data.readingPace.pagesPerMonth.toLocaleString()} label="pages / month" />
            </div>
          </section>

          {/* Books per month chart */}
          <section>
            <SectionLabel>Books per month</SectionLabel>
            <div className="h-48 w-full rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.booksPerMonth} barGap={2}>
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "var(--muted)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "var(--muted)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={20}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--border)", opacity: 0.3 }}
                    contentStyle={{
                      backgroundColor: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      color: "var(--foreground)",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="previous" fill="var(--border)" radius={[3, 3, 0, 0]} name="Last year" />
                  <Bar dataKey="current" radius={[3, 3, 0, 0]} name="This year">
                    {data.booksPerMonth.map((_, i) => (
                      <Cell key={i} fill="var(--accent)" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Top authors */}
          <section>
            <SectionLabel>Top authors</SectionLabel>
            <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] divide-y divide-[var(--border)]">
              {data.topAuthors.map((author, i) => (
                <div key={author.name} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-sm font-bold text-[var(--muted)] w-5 text-right">{i + 1}</span>
                  <p className="flex-1 text-sm font-medium text-[var(--foreground)] truncate">{author.name}</p>
                  <span className="text-xs text-[var(--muted)]">
                    {author.count} {author.count === 1 ? "book" : "books"}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Squad leaderboard (club scope) */}
          {data.scope === "club" && data.members.some((m) => m.booksRated > 0) && (
            <section>
              <SectionLabel>Squad leaderboard</SectionLabel>
              <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] divide-y divide-[var(--border)]">
                {data.members
                  .filter((m) => m.booksRated > 0)
                  .map((m, i) => (
                    <div key={m.name + i} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="text-sm font-bold text-[var(--muted)] w-5 text-right">{i + 1}</span>
                      <p className="flex-1 text-sm font-medium text-[var(--foreground)] truncate">{m.name}</p>
                      <span className="text-xs text-[var(--muted)]">
                        {m.booksRated} rated
                      </span>
                    </div>
                  ))}
              </div>
            </section>
          )}

          {/* Author countries */}
          {data.authorCountries.length > 0 && (
            <section>
              <SectionLabel>Author nationalities</SectionLabel>
              <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] divide-y divide-[var(--border)]">
                {data.authorCountries.map((ac) => (
                  <div key={ac.country} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-[var(--foreground)] flex items-center gap-2">
                      <span className="text-base leading-none">{countryFlag(ac.country) || "🏳️"}</span>
                      {ac.country}
                    </span>
                    <span className="text-sm text-[var(--muted)]">{ac.count}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Genres */}
          {data.genres.length > 0 && (
            <section>
              <SectionLabel>Genres</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {data.genres.map((g) => (
                  <span
                    key={g.genre}
                    className="px-3 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--foreground)]"
                  >
                    {g.genre} <span className="text-[var(--muted)]">({g.count})</span>
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Maintenance: fill in page counts across the whole library */}
          <section className="pt-2 text-center">
            <button
              onClick={backfillAllPageCounts}
              disabled={backfilling}
              className="inline-flex items-center gap-2 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors disabled:opacity-60"
            >
              {backfilling ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RotateCw className="w-3.5 h-3.5" />
              )}
              {backfilling ? "Updating page counts…" : "Page counts look off? Refresh every book"}
            </button>
          </section>
        </div>
      )}

      {tab === "year" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-serif font-bold text-2xl text-[var(--foreground)]">
              {data.yearInReview.year} in Review
            </h2>
            {data.availableYears.length > 1 && (
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10))}
                className="px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-sm font-medium text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-coral/30"
              >
                {data.availableYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            )}
          </div>

          {data.yearInReview.totalBooks === 0 ? (
            <EmptyState message={`No books finished in ${data.yearInReview.year}.`} icon={BarChart3} />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <StatTile value={data.yearInReview.totalBooks} label="books read" />
                <StatTile value={data.yearInReview.totalPages.toLocaleString()} label="pages turned" />
              </div>

              {/* Every book from the year, with its rating */}
              <section>
                <SectionLabel>{scope === "club" ? "The club read" : "Books you read"}</SectionLabel>
                <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] divide-y divide-[var(--border)]">
                  {data.yearInReview.books.map((b) => (
                    <div key={b.bookId} className="flex items-center gap-3 px-3 py-2.5">
                      <BookCover coverUrl={b.coverUrl} title={b.title} size="sm" />
                      <p className="flex-1 text-sm font-medium text-[var(--foreground)] leading-tight">
                        {b.title}
                      </p>
                      {b.rating != null ? (
                        <span className="text-base font-bold text-[var(--foreground)]">{b.rating}</span>
                      ) : (
                        <span className="text-xs text-[var(--muted)]">—</span>
                      )}
                    </div>
                  ))}
                </div>
                {scope === "club" && (
                  <p className="text-[10px] text-[var(--muted)] mt-1.5">Scores are the club average.</p>
                )}
              </section>

              {data.yearInReview.topRatedBook && (
                <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
                  <p className="text-xs text-[var(--muted)] uppercase tracking-wider mb-1">Top rated</p>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-serif font-medium text-[var(--foreground)] flex-1">
                      {data.yearInReview.topRatedBook.title}
                    </p>
                    <span className="text-2xl font-bold text-[var(--accent)] flex-shrink-0">
                      {data.yearInReview.topRatedBook.rating}
                    </span>
                  </div>
                </div>
              )}

              {data.yearInReview.longestBook && (
                <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
                  <p className="text-xs text-[var(--muted)] uppercase tracking-wider mb-1">Longest book</p>
                  <p className="font-serif font-medium text-[var(--foreground)]">
                    {data.yearInReview.longestBook.title}
                  </p>
                  <p className="text-sm text-[var(--muted)]">{data.yearInReview.longestBook.pages} pages</p>
                </div>
              )}

              {data.yearInReview.shortestBook && (
                <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
                  <p className="text-xs text-[var(--muted)] uppercase tracking-wider mb-1">Shortest book</p>
                  <p className="font-serif font-medium text-[var(--foreground)]">
                    {data.yearInReview.shortestBook.title}
                  </p>
                  <p className="text-sm text-[var(--muted)]">{data.yearInReview.shortestBook.pages} pages</p>
                </div>
              )}

              {data.yearInReview.pulledQuote && (
                <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] border-l-2 border-l-[var(--accent)]">
                  <p className="text-xs text-[var(--muted)] uppercase tracking-wider mb-2">A quote from this year</p>
                  <blockquote className="font-serif italic text-[var(--foreground)] leading-relaxed">
                    &ldquo;{data.yearInReview.pulledQuote.body}&rdquo;
                  </blockquote>
                  <p className="text-sm text-[var(--muted)] mt-1.5 font-serif">
                    {data.yearInReview.pulledQuote.bookTitle}
                  </p>
                </div>
              )}

              {data.yearInReview.authorCountries.length > 0 && (
                <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
                  <p className="text-xs text-[var(--muted)] uppercase tracking-wider mb-2">Countries represented</p>
                  <div className="flex flex-wrap gap-1.5">
                    {data.yearInReview.authorCountries.map((ac) => (
                      <span
                        key={ac.country}
                        className="text-sm px-2.5 py-0.5 rounded-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] flex items-center gap-1.5"
                      >
                        <span className="text-base leading-none">{countryFlag(ac.country) || "🏳️"}</span>
                        {ac.country}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
