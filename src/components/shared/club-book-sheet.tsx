"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { BookCover } from "@/components/ui/book-cover";
import { StarRating } from "@/components/ui/star-rating";
import { X, MessageCircle, Plus } from "lucide-react";
import Link from "next/link";

interface MemberRating {
  user_id: string;
  display_name: string;
  rating: number | null;
  review: string | null;
}

interface ClubQuote {
  id: string;
  body: string;
  page_number: number | null;
  note: string | null;
  user_id: string;
  display_name: string;
}

interface ClubBookSheetProps {
  open: boolean;
  onClose: () => void;
  clubBookId: string | null;
  bookId: string | null;
  bookTitle: string;
  bookAuthors: string[] | null;
  coverUrl: string | null;
  description: string | null;
  characters: string | null;
  endedOn: string | null;
  avgRating: number | null;
  memberRatings: MemberRating[];
  clubId: string;
  onUpdate: () => void;
}

export function ClubBookSheet({
  open,
  onClose,
  clubBookId,
  bookId,
  bookTitle,
  bookAuthors,
  coverUrl,
  description,
  characters,
  endedOn,
  avgRating,
  memberRatings,
  clubId,
  onUpdate,
}: ClubBookSheetProps) {
  const [quotes, setQuotes] = useState<ClubQuote[]>([]);
  const [charactersText, setCharactersText] = useState("");
  const [editingChars, setEditingChars] = useState(false);
  const [savingChars, setSavingChars] = useState(false);
  const [dateRead, setDateRead] = useState("");
  const [savingDate, setSavingDate] = useState(false);
  const [newQuote, setNewQuote] = useState("");
  const [newQuotePage, setNewQuotePage] = useState("");
  const [addingQuote, setAddingQuote] = useState(false);
  const [savingQuote, setSavingQuote] = useState(false);

  const supabase = createClient();

  const loadQuotes = useCallback(async () => {
    if (!bookId) return;
    const { data } = await supabase
      .from("quotes")
      .select("id, body, page_number, note, user_id, profile:profiles(display_name)")
      .eq("book_id", bookId)
      .eq("club_id", clubId)
      .order("created_at", { ascending: false });

    if (data) {
      setQuotes(
        data.map((q: any) => ({
          id: q.id,
          body: q.body,
          page_number: q.page_number,
          note: q.note,
          user_id: q.user_id,
          display_name: q.profile?.display_name || "?",
        }))
      );
    }
  }, [bookId, clubId, supabase]);

  useEffect(() => {
    if (open) {
      setCharactersText(characters || "");
      setDateRead(endedOn || "");
      setEditingChars(false);
      setAddingQuote(false);
      setNewQuote("");
      setNewQuotePage("");
      loadQuotes();
    }
  }, [open, characters, endedOn, loadQuotes]);

  async function saveDateRead(value: string) {
    if (!clubBookId) return;
    setDateRead(value);
    setSavingDate(true);
    await supabase
      .from("club_books")
      .update({ ended_on: value || null })
      .eq("id", clubBookId);
    setSavingDate(false);
    onUpdate();
  }

  async function saveCharacters() {
    if (!clubBookId) return;
    setSavingChars(true);
    await supabase
      .from("club_books")
      .update({ characters: charactersText || null })
      .eq("id", clubBookId);
    setEditingChars(false);
    setSavingChars(false);
    onUpdate();
  }

  async function submitQuote() {
    if (!bookId || !newQuote.trim()) return;
    setSavingQuote(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSavingQuote(false);
      return;
    }

    await supabase.from("quotes").insert({
      user_id: user.id,
      book_id: bookId,
      club_id: clubId,
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
          {/* Header: cover + title + avg rating */}
          <div className="flex gap-4">
            <BookCover coverUrl={coverUrl} title={bookTitle} size="lg" />
            <div className="flex-1 min-w-0 space-y-1">
              <h3 className="font-serif font-bold text-xl text-[var(--foreground)] leading-tight">
                {bookTitle}
              </h3>
              <p className="text-sm text-[var(--muted)] italic">
                {bookAuthors?.join(", ")}
              </p>
              {avgRating !== null ? (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-3xl font-bold text-[var(--foreground)]">
                    {avgRating}
                  </span>
                  <div className="flex flex-col">
                    <StarRating rating={avgRating} size="sm" readonly />
                    <span className="text-xs text-[var(--muted)] mt-0.5">squad avg</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--muted)] italic pt-1">No ratings yet</p>
              )}
              {bookId && (
                <Link
                  href={`/book/${bookId}`}
                  className="inline-block text-xs text-coral hover:underline pt-1"
                >
                  Open in personal →
                </Link>
              )}
            </div>
          </div>

          {/* Date read */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                Date read
              </h4>
              {savingDate && <span className="text-xs text-[var(--muted)]">Saving…</span>}
            </div>
            <input
              type="date"
              value={dateRead}
              max={new Date().toISOString().split("T")[0]}
              onChange={(e) => saveDateRead(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-coral/30"
            />
          </section>

          {/* Individual scores */}
          {memberRatings.length > 0 && (
            <section>
              <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">
                Squad scores
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {memberRatings.map((mr) => (
                  <div
                    key={mr.user_id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)]"
                  >
                    <span className="text-sm text-[var(--foreground)] truncate">
                      {mr.display_name}
                    </span>
                    {mr.rating !== null ? (
                      <span className="text-sm font-bold text-[var(--foreground)]">
                        {mr.rating}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--muted)]">—</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Synopsis */}
          {cleanDescription && (
            <section>
              <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">
                Synopsis
              </h4>
              <p className="text-sm text-[var(--foreground)] font-serif leading-relaxed">
                {cleanDescription}
              </p>
            </section>
          )}

          {/* Main characters */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                Main characters
              </h4>
              {!editingChars && (
                <button
                  onClick={() => setEditingChars(true)}
                  className="text-xs text-coral hover:underline"
                >
                  {characters ? "Edit" : "Add"}
                </button>
              )}
            </div>
            {editingChars ? (
              <div className="space-y-2">
                <textarea
                  value={charactersText}
                  onChange={(e) => setCharactersText(e.target.value)}
                  placeholder={"Toru — narrator, university student in 1960s Tokyo\nNaoko — Toru's fragile first love\nMidori — vivacious classmate..."}
                  rows={6}
                  className="w-full px-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] text-sm font-serif focus:outline-none focus:ring-2 focus:ring-coral/30 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveCharacters}
                    disabled={savingChars}
                    className="flex-1 py-2 rounded-lg bg-coral text-white text-sm font-medium disabled:opacity-50"
                  >
                    {savingChars ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => {
                      setCharactersText(characters || "");
                      setEditingChars(false);
                    }}
                    className="flex-1 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : characters ? (
              <p className="text-sm text-[var(--foreground)] font-serif leading-relaxed whitespace-pre-wrap">
                {characters}
              </p>
            ) : (
              <p className="text-sm text-[var(--muted)] italic">
                No characters listed yet.
              </p>
            )}
          </section>

          {/* Quotes */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                Favourite quotes
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
                    onClick={() => {
                      setAddingQuote(false);
                      setNewQuote("");
                      setNewQuotePage("");
                    }}
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
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-coral">{q.display_name}</span>
                      {q.page_number && (
                        <span className="text-xs text-[var(--muted)]">
                          p.{q.page_number}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Discussion link */}
          {clubBookId && (
            <Link
              href={`/club/discussion/${clubBookId}`}
              className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-coral text-white text-sm font-medium transition-opacity hover:opacity-90"
            >
              <MessageCircle className="w-4 h-4" /> Open discussion
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
