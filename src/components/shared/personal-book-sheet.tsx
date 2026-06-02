"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { BookCover } from "@/components/ui/book-cover";
import { StarRating } from "@/components/ui/star-rating";
import { X, Plus } from "lucide-react";
import Link from "next/link";

interface PersonalQuote {
  id: string;
  body: string;
  page_number: number | null;
  note: string | null;
}

interface PersonalBookSheetProps {
  open: boolean;
  onClose: () => void;
  userBookId: string;
  bookId: string;
  bookTitle: string;
  bookAuthors: string[] | null;
  coverUrl: string | null;
  description: string | null;
  rating: number | null;
  review: string | null;
  shelf: string;
  progressPct: number | null;
  progressPage: number | null;
  pageCount: number | null;
  isFavourite: boolean;
  onUpdate: () => void;
}

export function PersonalBookSheet({
  open,
  onClose,
  userBookId,
  bookId,
  bookTitle,
  bookAuthors,
  coverUrl,
  description,
  rating,
  review,
  shelf,
  progressPct,
  progressPage,
  pageCount,
  isFavourite,
  onUpdate,
}: PersonalBookSheetProps) {
  const [quotes, setQuotes] = useState<PersonalQuote[]>([]);
  const [newQuote, setNewQuote] = useState("");
  const [newQuotePage, setNewQuotePage] = useState("");
  const [addingQuote, setAddingQuote] = useState(false);
  const [savingQuote, setSavingQuote] = useState(false);

  const supabase = createClient();

  const loadQuotes = useCallback(async () => {
    if (!bookId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("quotes")
      .select("id, body, page_number, note")
      .eq("book_id", bookId)
      .eq("user_id", user.id)
      .is("club_id", null)
      .order("created_at", { ascending: false });

    if (data) setQuotes(data);
  }, [bookId, supabase]);

  useEffect(() => {
    if (open) {
      setAddingQuote(false);
      setNewQuote("");
      setNewQuotePage("");
      loadQuotes();
    }
  }, [open, loadQuotes]);

  async function submitQuote() {
    if (!bookId || !newQuote.trim()) return;
    setSavingQuote(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingQuote(false); return; }

    await supabase.from("quotes").insert({
      user_id: user.id,
      book_id: bookId,
      body: newQuote.trim(),
      page_number: newQuotePage ? parseInt(newQuotePage) : null,
    });

    setNewQuote("");
    setNewQuotePage("");
    setAddingQuote(false);
    setSavingQuote(false);
    loadQuotes();
  }

  if (!open) return null;

  const cleanDescription = description?.replace(/<[^>]*>/g, "") || null;
  const shelfLabel = shelf === "want" ? "Want to read" : shelf === "reading" ? "Reading" : "Read";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[var(--background)] rounded-t-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="sticky top-0 bg-[var(--background)] border-b border-[var(--border)] px-4 py-3 flex items-center justify-between z-10">
          <h2 className="font-serif font-semibold text-base text-[var(--foreground)] truncate pr-2">
            {bookTitle}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-[var(--muted)] hover:text-[var(--foreground)] flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Header: cover + title + rating */}
          <div className="flex gap-4">
            <BookCover coverUrl={coverUrl} title={bookTitle} size="lg" />
            <div className="flex-1 min-w-0 space-y-1">
              <h3 className="font-serif font-bold text-xl text-[var(--foreground)] leading-tight">
                {bookTitle}
              </h3>
              <p className="text-sm text-[var(--muted)] italic">
                {bookAuthors?.join(", ")}
              </p>
              {rating !== null ? (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-3xl font-bold text-[var(--foreground)]">
                    {rating}
                  </span>
                  <div className="flex flex-col">
                    <StarRating rating={rating} size="sm" readonly />
                    <span className="text-xs text-[var(--muted)] mt-0.5">your rating</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--muted)] italic pt-1">Not rated yet</p>
              )}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs px-2 py-0.5 rounded-full bg-coral/10 text-coral font-medium">
                  {shelfLabel}
                </span>
                {isFavourite && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-ochre/10 text-ochre font-medium">
                    ★ Favourite
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Progress (if currently reading) */}
          {shelf === "reading" && (
            <section>
              <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">
                Progress
              </h4>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full bg-[var(--border)]">
                  <div
                    className="h-full rounded-full bg-coral transition-all"
                    style={{ width: `${progressPct || 0}%` }}
                  />
                </div>
                <span className="text-sm text-[var(--foreground)] font-medium">
                  {progressPage ? `p.${progressPage}${pageCount ? ` / ${pageCount}` : ""}` : `${Math.round(progressPct || 0)}%`}
                </span>
              </div>
            </section>
          )}

          {/* Review */}
          {review && (
            <section>
              <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">
                Your review
              </h4>
              <p className="text-sm text-[var(--foreground)] font-serif leading-relaxed">
                {review}
              </p>
            </section>
          )}

          {/* Synopsis */}
          {cleanDescription && (
            <section>
              <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">
                Synopsis
              </h4>
              <p className="text-sm text-[var(--foreground)] font-serif leading-relaxed line-clamp-6">
                {cleanDescription}
              </p>
            </section>
          )}

          {/* Quotes */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                Quotes
              </h4>
              {!addingQuote && (
                <button
                  onClick={() => setAddingQuote(true)}
                  className="text-xs text-coral hover:underline flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              )}
            </div>

            {addingQuote && (
              <div className="space-y-2 mb-3 p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
                <textarea
                  value={newQuote}
                  onChange={(e) => setNewQuote(e.target.value)}
                  placeholder="Type the quote..."
                  rows={3}
                  autoFocus
                  className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm font-serif italic focus:outline-none focus:ring-2 focus:ring-coral/30 resize-none"
                />
                <input
                  type="number"
                  value={newQuotePage}
                  onChange={(e) => setNewQuotePage(e.target.value)}
                  placeholder="Page (optional)"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-coral/30"
                />
                <div className="flex gap-2">
                  <button
                    onClick={submitQuote}
                    disabled={savingQuote || !newQuote.trim()}
                    className="flex-1 py-1.5 rounded-lg bg-coral text-white text-sm font-medium disabled:opacity-50"
                  >
                    {savingQuote ? "Saving..." : "Save quote"}
                  </button>
                  <button
                    onClick={() => { setAddingQuote(false); setNewQuote(""); setNewQuotePage(""); }}
                    className="flex-1 py-1.5 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {quotes.length === 0 && !addingQuote ? (
              <p className="text-sm text-[var(--muted)] italic">No quotes saved yet.</p>
            ) : (
              <div className="space-y-3">
                {quotes.map((q) => (
                  <div
                    key={q.id}
                    className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)]"
                  >
                    <blockquote className="font-serif italic text-[var(--foreground)] leading-relaxed text-sm">
                      &ldquo;{q.body}&rdquo;
                    </blockquote>
                    {q.page_number && (
                      <div className="mt-2 text-right">
                        <span className="text-xs text-[var(--muted)]">p.{q.page_number}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Open full page link */}
          <Link
            href={`/book/${bookId}`}
            className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-coral text-white text-sm font-medium transition-opacity hover:opacity-90"
          >
            View full details →
          </Link>
        </div>
      </div>
    </div>
  );
}
