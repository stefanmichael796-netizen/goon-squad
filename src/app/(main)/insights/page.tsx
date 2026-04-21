"use client";

import { useState, useEffect } from "react";
import { Loading } from "@/components/ui/loading";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
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
  booksPerMonth: { month: string; current: number; previous: number }[];
  topAuthors: { name: string; count: number; covers: string[] }[];
  authorCountries: { country: string; count: number }[];
  genres: { genre: string; count: number }[];
  readingPace: {
    totalBooks: number;
    monthsSinceFirst: number;
    booksPerMonth: number;
    totalPages: number;
    pagesPerMonth: number;
  };
  yearInReview: {
    totalBooks: number;
    totalPages: number;
    longestBook: { title: string; pages: number } | null;
    shortestBook: { title: string; pages: number } | null;
    mostReadAuthor: string | null;
    topRatedBook: { title: string; rating: number } | null;
    pulledQuote: { body: string; bookTitle: string } | null;
    authorCountries: { country: string; count: number }[];
  };
}

export default function InsightsPage() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"stats" | "year">("stats");

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/insights");
      if (res.ok) {
        setData(await res.json());
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <Loading />;

  if (!data || data.readingPace.totalBooks === 0) {
    return (
      <div className="max-w-lg mx-auto w-full px-4 py-6">
        <Link
          href="/personal"
          className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <EmptyState message="Come back after a few books." />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto w-full px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/personal"
          className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <h1 className="font-serif font-bold text-xl text-[var(--foreground)]">
          Insights
        </h1>
        <div className="w-16" />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setTab("stats")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "stats"
              ? "bg-coral text-white"
              : "text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          Statistics
        </button>
        <button
          onClick={() => setTab("year")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "year"
              ? "bg-coral text-white"
              : "text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          Year in Review
        </button>
      </div>

      {tab === "stats" && (
        <div className="space-y-8">
          {/* Books per month chart */}
          <section>
            <h2 className="font-serif font-semibold text-lg text-[var(--foreground)] mb-3">
              Books per month
            </h2>
            <div className="h-48 w-full">
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
                    contentStyle={{
                      backgroundColor: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      color: "var(--foreground)",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="previous" fill="var(--border)" radius={[2, 2, 0, 0]} name="Last year" />
                  <Bar dataKey="current" radius={[2, 2, 0, 0]} name="This year">
                    {data.booksPerMonth.map((_, i) => (
                      <Cell key={i} fill="#D98872" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Top authors */}
          <section>
            <h2 className="font-serif font-semibold text-lg text-[var(--foreground)] mb-3">
              Top authors
            </h2>
            <div className="space-y-2">
              {data.topAuthors.map((author, i) => (
                <div key={author.name} className="flex items-center gap-3 p-2 rounded-lg">
                  <span className="text-sm text-[var(--muted)] w-5 text-right">{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[var(--foreground)]">{author.name}</p>
                  </div>
                  <span className="text-sm text-[var(--muted)]">
                    {author.count} {author.count === 1 ? "book" : "books"}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Author countries */}
          {data.authorCountries.length > 0 && (
            <section>
              <h2 className="font-serif font-semibold text-lg text-[var(--foreground)] mb-3">
                Author countries
              </h2>
              <div className="space-y-2">
                {data.authorCountries.map((ac) => (
                  <div key={ac.country} className="flex items-center justify-between p-2">
                    <span className="text-sm text-[var(--foreground)]">{ac.country}</span>
                    <span className="text-sm text-[var(--muted)]">{ac.count}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Genres */}
          {data.genres.length > 0 && (
            <section>
              <h2 className="font-serif font-semibold text-lg text-[var(--foreground)] mb-3">
                Genres
              </h2>
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

          {/* Reading pace */}
          <section>
            <h2 className="font-serif font-semibold text-lg text-[var(--foreground)] mb-3">
              Reading pace
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-lg bg-[var(--surface)] text-center">
                <p className="text-2xl font-bold text-coral">{data.readingPace.totalBooks}</p>
                <p className="text-xs text-[var(--muted)]">books read</p>
              </div>
              <div className="p-4 rounded-lg bg-[var(--surface)] text-center">
                <p className="text-2xl font-bold text-coral">{data.readingPace.booksPerMonth}</p>
                <p className="text-xs text-[var(--muted)]">books / month</p>
              </div>
              <div className="p-4 rounded-lg bg-[var(--surface)] text-center">
                <p className="text-2xl font-bold text-coral">{data.readingPace.totalPages.toLocaleString()}</p>
                <p className="text-xs text-[var(--muted)]">total pages</p>
              </div>
              <div className="p-4 rounded-lg bg-[var(--surface)] text-center">
                <p className="text-2xl font-bold text-coral">{data.readingPace.pagesPerMonth.toLocaleString()}</p>
                <p className="text-xs text-[var(--muted)]">pages / month</p>
              </div>
            </div>
          </section>
        </div>
      )}

      {tab === "year" && (
        <div className="space-y-6">
          <h2 className="font-serif font-semibold text-xl text-[var(--foreground)] text-center">
            {new Date().getFullYear()} in Review
          </h2>

          {data.yearInReview.totalBooks === 0 ? (
            <EmptyState message="No books finished this year yet." />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-lg bg-[var(--surface)] text-center">
                  <p className="text-3xl font-bold text-coral">{data.yearInReview.totalBooks}</p>
                  <p className="text-xs text-[var(--muted)]">books read</p>
                </div>
                <div className="p-4 rounded-lg bg-[var(--surface)] text-center">
                  <p className="text-3xl font-bold text-coral">{data.yearInReview.totalPages.toLocaleString()}</p>
                  <p className="text-xs text-[var(--muted)]">pages turned</p>
                </div>
              </div>

              {data.yearInReview.longestBook && (
                <div className="p-4 rounded-lg bg-[var(--surface)]">
                  <p className="text-xs text-[var(--muted)] mb-1">Longest book</p>
                  <p className="font-serif font-medium text-[var(--foreground)]">
                    {data.yearInReview.longestBook.title}
                  </p>
                  <p className="text-sm text-[var(--muted)]">{data.yearInReview.longestBook.pages} pages</p>
                </div>
              )}

              {data.yearInReview.shortestBook && (
                <div className="p-4 rounded-lg bg-[var(--surface)]">
                  <p className="text-xs text-[var(--muted)] mb-1">Shortest book</p>
                  <p className="font-serif font-medium text-[var(--foreground)]">
                    {data.yearInReview.shortestBook.title}
                  </p>
                  <p className="text-sm text-[var(--muted)]">{data.yearInReview.shortestBook.pages} pages</p>
                </div>
              )}

              {data.yearInReview.mostReadAuthor && (
                <div className="p-4 rounded-lg bg-[var(--surface)]">
                  <p className="text-xs text-[var(--muted)] mb-1">Most-read author</p>
                  <p className="font-serif font-medium text-[var(--foreground)]">
                    {data.yearInReview.mostReadAuthor}
                  </p>
                </div>
              )}

              {data.yearInReview.topRatedBook && (
                <div className="p-4 rounded-lg bg-[var(--surface)]">
                  <p className="text-xs text-[var(--muted)] mb-1">Top rated</p>
                  <p className="font-serif font-medium text-[var(--foreground)]">
                    {data.yearInReview.topRatedBook.title}
                  </p>
                  <p className="text-sm text-coral">
                    {"★".repeat(Math.floor(data.yearInReview.topRatedBook.rating))}
                    {data.yearInReview.topRatedBook.rating % 1 >= 0.5 ? "½" : ""}
                  </p>
                </div>
              )}

              {data.yearInReview.pulledQuote && (
                <div className="p-4 rounded-lg bg-[var(--surface)]">
                  <p className="text-xs text-[var(--muted)] mb-2">A quote from this year</p>
                  <blockquote className="font-serif italic text-[var(--foreground)] leading-relaxed">
                    &ldquo;{data.yearInReview.pulledQuote.body}&rdquo;
                  </blockquote>
                  <p className="text-sm text-[var(--muted)] mt-1 font-serif">
                    {data.yearInReview.pulledQuote.bookTitle}
                  </p>
                </div>
              )}

              {data.yearInReview.authorCountries.length > 0 && (
                <div className="p-4 rounded-lg bg-[var(--surface)]">
                  <p className="text-xs text-[var(--muted)] mb-2">Countries represented</p>
                  <div className="flex flex-wrap gap-1">
                    {data.yearInReview.authorCountries.map((ac) => (
                      <span
                        key={ac.country}
                        className="text-sm px-2 py-0.5 rounded-full bg-[var(--border)] text-[var(--foreground)]"
                      >
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
