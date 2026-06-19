"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { BookCover } from "@/components/ui/book-cover";
import { StarRating } from "@/components/ui/star-rating";
import { X, Plus, Loader2, Sparkles, Trash2, Star, RotateCw } from "lucide-react";

interface PersonalQuote {
  id: string;
  body: string;
  page_number: number | null;
  note: string | null;
}

interface PersonalBookSheetProps {
  open: boolean;
  onClose: () => void;
  userBookId: string | null;
  bookId: string | null;
  bookTitle: string;
  bookAuthors: string[] | null;
  coverUrl: string | null;
  description: string | null;
  shelf: string;
  endedOn: string | null;
  progressPct: number | null;
  progressPage: number | null;
  pageCount: number | null;
  isFavourite: boolean;
  canFavourite: boolean;
  nextFavRank: number;
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
  shelf,
  endedOn,
  progressPct,
  progressPage,
  pageCount,
  isFavourite,
  canFavourite,
  nextFavRank,
  onUpdate,
}: PersonalBookSheetProps) {
  const [quotes, setQuotes] = useState<PersonalQuote[]>([]);
  const [overview, setOverview] = useState<{ synopsis: string; characters: string; quotes: string | null } | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [myRating, setMyRating] = useState(0);
  const [savingRating, setSavingRating] = useState(false);
  const [dateRead, setDateRead] = useState("");
  const [savingDate, setSavingDate] = useState(false);
  const [pageInput, setPageInput] = useState("");
  const [savingPage, setSavingPage] = useState(false);
  const [personalNotes, setPersonalNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [newQuote, setNewQuote] = useState("");
  const [newQuotePage, setNewQuotePage] = useState("");
  const [addingQuote, setAddingQuote] = useState(false);
  const [savingQuote, setSavingQuote] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [fav, setFav] = useState(false);
  const [sheetOpenId, setSheetOpenId] = useState<string | null>(null);
  const [rereads, setRereads] = useState<{ id: string; created_at: string; rating: number | null }[]>([]);
  const [loggingReread, setLoggingReread] = useState(false);
  const [rereadDate, setRereadDate] = useState("");
  const [rereadRating, setRereadRating] = useState(0);
  const [savingReread, setSavingReread] = useState(false);

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

  const loadMyRating = useCallback(async () => {
    if (!bookId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("logs")
      .select("rating")
      .eq("user_id", user.id)
      .eq("book_id", bookId)
      .is("club_id", null)
      .eq("kind", "review")
      .not("rating", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setMyRating(data?.rating ?? 0);
  }, [bookId, supabase]);

  const loadRereads = useCallback(async () => {
    if (!bookId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("logs")
      .select("id, created_at, rating")
      .eq("user_id", user.id)
      .eq("book_id", bookId)
      .is("club_id", null)
      .eq("kind", "reread")
      .order("created_at", { ascending: false });
    if (data) setRereads(data);
  }, [bookId, supabase]);

  async function addReread() {
    if (!bookId) return;
    setSavingReread(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingReread(false); return; }
    await supabase.from("logs").insert({
      user_id: user.id,
      book_id: bookId,
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
    if (!bookId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("logs")
      .select("review")
      .eq("user_id", user.id)
      .eq("book_id", bookId)
      .is("club_id", null)
      .eq("kind", "note")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setPersonalNotes(data?.review ?? "");
  }, [bookId, supabase]);

  const loadOverview = useCallback(async (id: string, refresh = false) => {
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const res = await fetch("/api/club/overview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: id, refresh }),
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

  useEffect(() => {
    const id = open ? userBookId : null;
    if (id && id !== sheetOpenId) {
      setSheetOpenId(id);
      setDateRead(endedOn || "");
      setPageInput(progressPage ? String(progressPage) : "");
      setMyRating(0);
      setFav(isFavourite);
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
      if (bookId) loadOverview(bookId);
    }
    if (!open && sheetOpenId) {
      setSheetOpenId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userBookId]);

  async function saveRating(value: number) {
    if (!bookId) return;
    setMyRating(value);
    setSavingRating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingRating(false); return; }

    await supabase
      .from("logs")
      .delete()
      .eq("user_id", user.id)
      .eq("book_id", bookId)
      .is("club_id", null)
      .eq("kind", "review");

    if (value > 0) {
      await supabase.from("logs").insert({
        user_id: user.id,
        book_id: bookId,
        kind: "review",
        rating: value,
      });
    }
    setSavingRating(false);
    onUpdate();
  }

  async function saveDateRead(value: string) {
    if (!userBookId) return;
    setDateRead(value);
    setSavingDate(true);
    await supabase
      .from("user_books")
      .update({ finished_at: value || null })
      .eq("id", userBookId);
    setSavingDate(false);
    onUpdate();
  }

  async function savePage(value: string) {
    if (!userBookId) return;
    setSavingPage(true);
    const page = value ? parseInt(value) : null;
    const pct = page && pageCount ? Math.min(100, Math.round((page / pageCount) * 100)) : null;
    await supabase
      .from("user_books")
      .update({ progress_page: page, progress_pct: pct, updated_at: new Date().toISOString() })
      .eq("id", userBookId);
    setSavingPage(false);
    onUpdate();
  }

  async function savePersonalNotes() {
    if (!bookId) return;
    setSavingNotes(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingNotes(false); return; }

    await supabase
      .from("logs")
      .delete()
      .eq("user_id", user.id)
      .eq("book_id", bookId)
      .is("club_id", null)
      .eq("kind", "note");

    if (personalNotes.trim()) {
      await supabase.from("logs").insert({
        user_id: user.id,
        book_id: bookId,
        kind: "note",
        review: personalNotes.trim(),
      });
    }
    setSavingNotes(false);
  }

  async function toggleFavourite() {
    if (!userBookId) return;
    const next = !fav;
    if (next && !canFavourite) return;
    setFav(next);
    await supabase
      .from("user_books")
      .update({ is_favourite: next, favourite_rank: next ? nextFavRank : null })
      .eq("id", userBookId);
    onUpdate();
  }

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

  async function removeFromShelf() {
    if (!userBookId) return;
    setRemoving(true);
    try {
      const res = await fetch("/api/personal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove_book", userBookId }),
      });
      if (res.ok) {
        onUpdate();
        onClose();
      }
    } catch {}
    setRemoving(false);
    setConfirmRemove(false);
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
              {myRating > 0 ? (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-3xl font-bold text-[var(--foreground)]">
                    {myRating}
                  </span>
                  <div className="flex flex-col">
                    <StarRating rating={myRating} size="sm" readonly />
                    <span className="text-xs text-[var(--muted)] mt-0.5">your rating</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--muted)] italic pt-1">Not rated yet</p>
              )}
              <button
                onClick={toggleFavourite}
                disabled={!fav && !canFavourite}
                className={`mt-1 inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors disabled:opacity-40 ${
                  fav ? "bg-coral/10 text-coral" : "border border-[var(--border)] text-[var(--muted)]"
                }`}
                title={!fav && !canFavourite ? "Top 5 is full" : undefined}
              >
                <Star className={`w-3 h-3 ${fav ? "fill-current" : ""}`} />
                {fav ? "In Top 5" : "Add to Top 5"}
              </button>
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

          {/* Progress (reading shelf) */}
          {shelf === "reading" && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                  Progress
                </h4>
                {savingPage && <span className="text-xs text-[var(--muted)]">Saving…</span>}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full bg-[var(--border)]">
                  <div
                    className="h-full rounded-full bg-coral transition-all"
                    style={{ width: `${progressPct || 0}%` }}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-[var(--muted)]">p.</span>
                  <input
                    type="number"
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    onBlur={() => savePage(pageInput)}
                    placeholder="0"
                    className="w-16 px-2 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-coral/30"
                  />
                  {pageCount && <span className="text-xs text-[var(--muted)]">/ {pageCount}</span>}
                </div>
              </div>
            </section>
          )}

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

          {/* AI overview */}
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
                onClick={() => bookId && loadOverview(bookId, true)}
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

          {/* Personal notes */}
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
          </section>

          {/* Remove from shelf */}
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
                <Trash2 className="w-4 h-4" /> Remove from my books
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
