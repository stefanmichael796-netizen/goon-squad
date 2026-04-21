"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BookCover } from "@/components/ui/book-cover";
import { StarRating } from "@/components/ui/star-rating";
import { EmptyState } from "@/components/ui/empty-state";
import { Loading } from "@/components/ui/loading";
import { AddQuoteSheet } from "@/components/shared/add-quote-sheet";
import { LogBookSheet } from "@/components/shared/log-book-sheet";
import { ArrowLeft, Quote, BookPlus } from "lucide-react";
import { timeAgo } from "@/lib/utils";
import Link from "next/link";
import type { Book, Log, Quote as QuoteType, UserBook, ClubBook } from "@/lib/types";

export default function BookDetailPage() {
  const params = useParams();
  const bookId = params.id as string;
  const [book, setBook] = useState<Book | null>(null);
  const [userBook, setUserBook] = useState<UserBook | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [quotes, setQuotes] = useState<QuoteType[]>([]);
  const [clubBook, setClubBook] = useState<ClubBook | null>(null);
  const [clubId, setClubId] = useState<string | null>(null);
  const [quoteSheetOpen, setQuoteSheetOpen] = useState(false);
  const [logSheetOpen, setLogSheetOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [bookRes, userBookRes, logsRes, quotesRes, memberRes] = await Promise.all([
      supabase.from("books").select("*").eq("id", bookId).single(),
      supabase.from("user_books").select("*").eq("user_id", user.id).eq("book_id", bookId).single(),
      supabase
        .from("logs")
        .select("*")
        .eq("user_id", user.id)
        .eq("book_id", bookId)
        .order("created_at", { ascending: false }),
      supabase
        .from("quotes")
        .select("*")
        .eq("user_id", user.id)
        .eq("book_id", bookId)
        .order("created_at", { ascending: false }),
      supabase.from("club_members").select("club_id").eq("user_id", user.id).limit(1).single(),
    ]);

    if (bookRes.data) setBook(bookRes.data);
    if (userBookRes.data) setUserBook(userBookRes.data);
    if (logsRes.data) setLogs(logsRes.data);
    if (quotesRes.data) setQuotes(quotesRes.data);
    if (memberRes.data) {
      setClubId(memberRes.data.club_id);
      const { data: cb } = await supabase
        .from("club_books")
        .select("*")
        .eq("club_id", memberRes.data.club_id)
        .eq("book_id", bookId)
        .single();
      if (cb) setClubBook(cb);
    }

    setLoading(false);
  }, [supabase, bookId]);

  useEffect(() => { loadData(); }, [loadData]);

  async function changeShelf(shelf: "reading" | "want" | "read") {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !book) return;

    if (userBook) {
      await supabase
        .from("user_books")
        .update({
          shelf,
          finished_at: shelf === "read" ? new Date().toISOString() : null,
          started_at: shelf === "reading" ? new Date().toISOString() : userBook.started_at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userBook.id);
    } else {
      await supabase.from("user_books").insert({
        user_id: user.id,
        book_id: book.id,
        shelf,
        started_at: shelf === "reading" ? new Date().toISOString() : null,
        finished_at: shelf === "read" ? new Date().toISOString() : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    await supabase.from("logs").insert({
      user_id: user.id,
      book_id: book.id,
      kind: "shelf_change",
      shelf,
    });

    loadData();
  }

  if (loading) return <Loading />;
  if (!book) return <EmptyState message="Book not found." />;

  return (
    <div className="max-w-lg mx-auto w-full px-4 py-6 space-y-6">
      <Link
        href="/personal"
        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <div className="flex gap-4">
        <BookCover coverUrl={book.cover_url} title={book.title} size="xl" />
        <div className="flex-1 min-w-0 space-y-1">
          <h1 className="font-serif font-bold text-2xl text-[var(--foreground)] leading-tight">
            {book.title}
          </h1>
          <p className="text-[var(--muted)]">{book.authors?.join(", ")}</p>
          {book.publisher && (
            <p className="text-sm text-[var(--muted)]">{book.publisher}</p>
          )}
          <div className="flex gap-3 text-sm text-[var(--muted)]">
            {book.published_date && <span>{book.published_date}</span>}
            {book.page_count && <span>{book.page_count} pages</span>}
          </div>
          {book.categories && book.categories.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {book.categories.map((cat) => (
                <span
                  key={cat}
                  className="text-xs px-2 py-0.5 rounded-full bg-[var(--border)] text-[var(--muted)]"
                >
                  {cat}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setLogSheetOpen(true)}
          className="flex-1 py-2.5 rounded-lg bg-coral text-white font-medium flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
        >
          <BookPlus className="w-4 h-4" /> Log
        </button>
        <button
          onClick={() => setQuoteSheetOpen(true)}
          className="flex-1 py-2.5 rounded-lg border border-[var(--border)] text-[var(--foreground)] font-medium flex items-center justify-center gap-2 transition-colors hover:bg-[var(--surface)]"
        >
          <Quote className="w-4 h-4" /> Quote
        </button>
      </div>

      {/* Shelf toggle */}
      <div>
        <p className="text-sm font-medium text-[var(--foreground)] mb-2">Shelf</p>
        <div className="flex gap-2">
          {(["reading", "want", "read"] as const).map((s) => (
            <button
              key={s}
              onClick={() => changeShelf(s)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                userBook?.shelf === s
                  ? "bg-coral text-white"
                  : "bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)]"
              }`}
            >
              {s === "want" ? "Want to read" : s === "reading" ? "Reading" : "Read"}
            </button>
          ))}
        </div>
      </div>

      {clubBook && (
        <Link
          href={`/club/discussion/${clubBook.id}`}
          className="block p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-sm text-coral hover:underline"
        >
          View club discussion for this book
        </Link>
      )}

      {/* Description */}
      {book.description && (
        <section>
          <h2 className="font-serif font-semibold text-lg text-[var(--foreground)] mb-2">
            About
          </h2>
          <p className="text-sm text-[var(--foreground)] opacity-80 leading-relaxed line-clamp-6">
            {book.description.replace(/<[^>]*>/g, "")}
          </p>
        </section>
      )}

      {/* My log history */}
      <section>
        <h2 className="font-serif font-semibold text-lg text-[var(--foreground)] mb-3">
          My history
        </h2>
        {logs.length === 0 ? (
          <EmptyState message="No activity for this book yet." />
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="p-3 rounded-lg bg-[var(--surface)]">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--muted)] capitalize">{log.kind.replace("_", " ")}</span>
                  <span className="text-xs text-[var(--muted)]">{timeAgo(log.created_at)}</span>
                </div>
                {log.rating && <StarRating rating={log.rating} size="sm" readonly />}
                {log.review && (
                  <p className="text-sm font-serif text-[var(--foreground)] mt-1">{log.review}</p>
                )}
                {log.shelf && (
                  <p className="text-sm text-[var(--muted)]">
                    {log.shelf === "want" ? "Want to read" : log.shelf}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Quotes for this book */}
      {quotes.length > 0 && (
        <section>
          <h2 className="font-serif font-semibold text-lg text-[var(--foreground)] mb-3">
            Quotes
          </h2>
          <div className="space-y-3">
            {quotes.map((q) => (
              <div key={q.id} className="p-4 rounded-lg bg-[var(--surface)]">
                <blockquote className="font-serif italic text-[var(--foreground)] leading-relaxed">
                  &ldquo;{q.body}&rdquo;
                </blockquote>
                {q.page_number && (
                  <p className="text-sm text-[var(--muted)] mt-1">p.{q.page_number}</p>
                )}
                {q.note && (
                  <p className="text-sm text-[var(--muted)] mt-1">{q.note}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <AddQuoteSheet
        open={quoteSheetOpen}
        onClose={() => setQuoteSheetOpen(false)}
        onSuccess={loadData}
        bookId={bookId}
        bookTitle={book.title}
        clubId={clubId}
      />

      <LogBookSheet
        open={logSheetOpen}
        onClose={() => setLogSheetOpen(false)}
        onSuccess={loadData}
        clubId={clubId}
      />
    </div>
  );
}
