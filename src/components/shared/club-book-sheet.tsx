"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { BookCover } from "@/components/ui/book-cover";
import { StarRating } from "@/components/ui/star-rating";
import { X, MessageCircle, Plus, Loader2, Sparkles, Trash2, RotateCw } from "lucide-react";
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
  endedOn: string | null;
  recommendedBy: string | null;
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
  endedOn,
  recommendedBy,
  avgRating,
  memberRatings,
  clubId,
  onUpdate,
}: ClubBookSheetProps) {
  const [quotes, setQuotes] = useState<ClubQuote[]>([]);
  const [overview, setOverview] = useState<{ synopsis: string; characters: string; quotes: string | null } | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [myRating, setMyRating] = useState(0);
  const [savingRating, setSavingRating] = useState(false);
  const [dateRead, setDateRead] = useState("");
  const [savingDate, setSavingDate] = useState(false);
  const [recBy, setRecBy] = useState("");
  const [savingRecBy, setSavingRecBy] = useState(false);
  const [newQuote, setNewQuote] = useState("");
  const [newQuotePage, setNewQuotePage] = useState("");
  const [addingQuote, setAddingQuote] = useState(false);
  const [savingQuote, setSavingQuote] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [sheetOpenId, setSheetOpenId] = useState<string | null>(null);
  const [personalNotes, setPersonalNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [rereads, setRereads] = useState<{ id: string; created_at: string; rating: number | null }[]>([]);
  const [loggingReread, setLoggingReread] = useState(false);
  const [rereadDate, setRereadDate] = useState("");
  const [rereadRating, setRereadRating] = useState(0);
  const [savingReread, setSavingReread] = useState(false);

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

  const loadOverview = useCallback(async (id: string, refresh = false) => {
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const res = await fetch("/api/club/overview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clubBookId: id, refresh }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOverviewError(data.error || "Couldn't generate an overview.");
      } else {
        setOverview({ synopsis: data.synopsis, characters: data.characters, quotes: data.quotes || null });
      }
    } catch {
      setOverviewError("Network error. Try again.");
    }
    setOverviewLoading(false);
  }, []);

  const loadMyRating = useCallback(async () => {
    if (!bookId || !clubId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("logs")
      .select("rating")
      .eq("user_id", user.id)
      .eq("book_id", bookId)
      .eq("club_id", clubId)
      .eq("kind", "review")
      .not("rating", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setMyRating(data?.rating ?? 0);
  }, [bookId, clubId, supabase]);

  const loadRereads = useCallback(async () => {
    if (!bookId || !clubId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("logs")
      .select("id, created_at, rating")
      .eq("user_id", user.id)
      .eq("book_id", bookId)
      .eq("club_id", clubId)
      .eq("kind", "reread")
      .order("created_at", { ascending: false });
    if (data) setRereads(data);
  }, [bookId, clubId, supabase]);

  async function addReread() {
    if (!bookId || !clubId) return;
    setSavingReread(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingReread(false); return; }
    await supabase.from("logs").insert({
      user_id: user.id,
      book_id: bookId,
      club_id: clubId,
      club_book_id: clubBookId,
      kind: "reread",
      rating: rereadRating > 0 ? rereadRating : null,
      ...(rereadDate ? { created_at: new Date(rereadDate + "T12:00:00").toISOString() } : {}),
    });
    setLoggingReread(false);
    setRereadDate("");
    setRereadRating(0);
    setSavingReread(false);
    loadRereads();
    onUpdate();
  }

  async function deleteReread(id: string) {
    await supabase.from("logs").delete().eq("id", id);
    loadRereads();
    onUpdate();
  }

  const loadPersonalNotes = useCallback(async () => {
    if (!bookId || !clubId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("logs")
      .select("review")
      .eq("user_id", user.id)
      .eq("book_id", bookId)
      .eq("club_id", clubId)
      .eq("kind", "note")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setPersonalNotes(data?.review ?? "");
  }, [bookId, clubId, supabase]);

  async function savePersonalNotes() {
    if (!bookId || !clubId) return;
    setSavingNotes(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingNotes(false); return; }

    await supabase
      .from("logs")
      .delete()
      .eq("user_id", user.id)
      .eq("book_id", bookId)
      .eq("club_id", clubId)
      .eq("kind", "note");

    if (personalNotes.trim()) {
      await supabase.from("logs").insert({
        user_id: user.id,
        book_id: bookId,
        club_id: clubId,
        club_book_id: clubBookId,
        kind: "note",
        review: personalNotes.trim(),
      });
    }
    setSavingNotes(false);
  }

  async function saveRating(value: number) {
    if (!bookId || !clubId) return;
    setMyRating(value);
    setSavingRating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingRating(false); return; }

    // Wipe every existing review/reread entry for this book+club, then insert
    // a fresh one. This avoids silent update failures from stale or duplicate rows.
    await supabase
      .from("logs")
      .delete()
      .eq("user_id", user.id)
      .eq("book_id", bookId)
      .eq("club_id", clubId)
      .eq("kind", "review");

    if (value > 0) {
      await supabase.from("logs").insert({
        user_id: user.id,
        book_id: bookId,
        club_id: clubId,
        club_book_id: clubBookId,
        kind: "review",
        rating: value,
      });
    }
    setSavingRating(false);
    onUpdate();
  }

  async function removeFromShelf() {
    if (!clubBookId) return;
    setRemoving(true);
    try {
      const res = await fetch("/api/club", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove_from_shelf", clubBookId }),
      });
      if (res.ok) {
        onUpdate();
        onClose();
      }
    } catch {}
    setRemoving(false);
    setConfirmRemove(false);
  }

  useEffect(() => {
    const id = open ? clubBookId : null;
    if (id && id !== sheetOpenId) {
      setSheetOpenId(id);
      setDateRead(endedOn || "");
      setRecBy(recommendedBy || "");
      setMyRating(0);
      setAddingQuote(false);
      setNewQuote("");
      setNewQuotePage("");
      setOverview(null);
      setOverviewError(null);
      setConfirmRemove(false);
      setPersonalNotes("");
      setLoggingReread(false);
      setRereadDate("");
      setRereadRating(0);
      setRereads([]);
      loadQuotes();
      loadMyRating();
      loadPersonalNotes();
      loadRereads();
      loadOverview(id);
    }
    if (!open && sheetOpenId) {
      setSheetOpenId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clubBookId]);

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

  async function saveRecommendedBy(value: string) {
    if (!clubBookId) return;
    setRecBy(value);
    setSavingRecBy(true);
    await supabase
      .from("club_books")
      .update({ recommended_by: value || null })
      .eq("id", clubBookId);
    setSavingRecBy(false);
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
                    <span className="text-xs text-[var(--muted)] mt-0.5">club avg</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--muted)] italic pt-1">No ratings yet</p>
              )}
            </div>
          </div>

          {/* Your rating */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                Your rating
              </h4>
              {savingRating && <span className="text-xs text-[var(--muted)]">Saving…</span>}
            </div>
            <StarRating rating={myRating} onChange={saveRating} size="lg" />
          </section>

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

          {/* Rereads */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider flex items-center gap-1.5">
                <RotateCw className="w-3.5 h-3.5" /> Rereads
              </h4>
              {!loggingReread && (
                <button
                  onClick={() => { setLoggingReread(true); setRereadDate(new Date().toISOString().split("T")[0]); }}
                  className="text-xs text-coral hover:underline flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" /> Log a reread
                </button>
              )}
            </div>

            {loggingReread && (
              <div className="space-y-2 mb-3 p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
                <div>
                  <label className="text-xs text-[var(--muted)]">When</label>
                  <input
                    type="date"
                    value={rereadDate}
                    max={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setRereadDate(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-coral/30"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Rating this time (optional)</label>
                  <div className="mt-1">
                    <StarRating rating={rereadRating} onChange={setRereadRating} size="md" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={addReread}
                    disabled={savingReread}
                    className="flex-1 py-1.5 rounded-lg bg-coral text-white text-sm font-medium disabled:opacity-50"
                  >
                    {savingReread ? "Saving…" : "Save reread"}
                  </button>
                  <button
                    onClick={() => { setLoggingReread(false); setRereadDate(""); setRereadRating(0); }}
                    className="flex-1 py-1.5 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {rereads.length === 0 && !loggingReread ? (
              <p className="text-sm text-[var(--muted)] italic">No rereads logged yet.</p>
            ) : (
              <div className="space-y-2">
                {rereads.map((rr) => (
                  <div
                    key={rr.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)]"
                  >
                    <span className="text-sm text-[var(--foreground)]">
                      {new Date(rr.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                    </span>
                    <div className="flex items-center gap-2">
                      {rr.rating !== null && (
                        <span className="text-sm font-bold text-[var(--foreground)]">{rr.rating}</span>
                      )}
                      <button
                        onClick={() => deleteReread(rr.id)}
                        className="text-[var(--muted)] hover:text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Recommended by */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                Recommended by
              </h4>
              {savingRecBy && <span className="text-xs text-[var(--muted)]">Saving…</span>}
            </div>
            <input
              type="text"
              value={recBy}
              onChange={(e) => setRecBy(e.target.value)}
              onBlur={() => saveRecommendedBy(recBy)}
              placeholder="Who picked this book?"
              className="w-full px-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-coral/30"
            />
          </section>

          {/* Individual scores — only members who have actually rated it */}
          {memberRatings.some((mr) => mr.rating !== null) && (
            <section>
              <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">
                Club scores
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {memberRatings
                  .filter((mr) => mr.rating !== null)
                  .map((mr) => (
                    <div
                      key={mr.user_id}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)]"
                    >
                      <span className="text-sm text-[var(--foreground)] truncate">
                        {mr.display_name}
                      </span>
                      <span className="text-sm font-bold text-[var(--foreground)]">
                        {mr.rating}
                      </span>
                    </div>
                  ))}
              </div>
            </section>
          )}

          {/* AI synopsis + characters — generated automatically */}
          {overviewLoading ? (
            <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <Loader2 className="w-4 h-4 animate-spin" /> Writing an overview…
            </div>
          ) : overview ? (
            <>
              <section>
                <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">
                  Synopsis
                </h4>
                <p className="text-sm text-[var(--foreground)] font-serif leading-relaxed">
                  {overview.synopsis}
                </p>
              </section>
              {overview.characters && (
                <section>
                  <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">
                    Who&apos;s who
                  </h4>
                  <p className="text-sm text-[var(--foreground)] font-serif leading-relaxed whitespace-pre-wrap">
                    {overview.characters}
                  </p>
                </section>
              )}
              {overview.quotes && (
                <section>
                  <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">
                    Notable quotes
                  </h4>
                  <div className="space-y-2">
                    {overview.quotes.split("\n").filter(Boolean).map((q, i) => (
                      <blockquote key={i} className="font-serif italic text-sm text-[var(--foreground)] leading-relaxed pl-3 border-l-2 border-[var(--border)]">
                        {q.replace(/^—\s*/, "")}
                      </blockquote>
                    ))}
                  </div>
                </section>
              )}
              <p className="text-[10px] text-[var(--muted)] italic">AI-generated</p>
            </>
          ) : overviewError ? (
            <section className="space-y-2">
              <p className="text-xs text-red-500">{overviewError}</p>
              <button
                onClick={() => clubBookId && loadOverview(clubBookId, true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-coral text-white text-sm font-medium transition-opacity hover:opacity-90"
              >
                <Sparkles className="w-4 h-4" /> Try again
              </button>
              {cleanDescription && (
                <p className="text-sm text-[var(--foreground)] font-serif leading-relaxed pt-1">
                  {cleanDescription}
                </p>
              )}
            </section>
          ) : cleanDescription ? (
            <section>
              <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">
                Synopsis
              </h4>
              <p className="text-sm text-[var(--foreground)] font-serif leading-relaxed">
                {cleanDescription}
              </p>
            </section>
          ) : null}

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

          {/* Personal notes — only visible to the current user */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                My notes
              </h4>
              {savingNotes && <span className="text-xs text-[var(--muted)]">Saving…</span>}
            </div>
            <textarea
              value={personalNotes}
              onChange={(e) => setPersonalNotes(e.target.value)}
              onBlur={savePersonalNotes}
              placeholder="Thoughts, themes, things to remember…"
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] text-sm font-serif focus:outline-none focus:ring-2 focus:ring-coral/30 resize-none"
            />
            <p className="text-[10px] text-[var(--muted)] italic mt-1">Only you can see this</p>
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

          {/* Remove from shelf */}
          {clubBookId && (
            <div className="pt-2">
              {confirmRemove ? (
                <div className="flex gap-2">
                  <button
                    onClick={removeFromShelf}
                    disabled={removing}
                    className="flex-1 py-2 rounded-lg bg-red-500 text-white text-sm font-medium disabled:opacity-50"
                  >
                    {removing ? "Removing…" : "Yes, remove"}
                  </button>
                  <button
                    onClick={() => setConfirmRemove(false)}
                    className="flex-1 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)]"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmRemove(true)}
                  className="w-full flex items-center justify-center gap-2 py-2 text-sm text-red-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Remove from shelf
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
