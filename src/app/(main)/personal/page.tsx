"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { BookCover } from "@/components/ui/book-cover";
import { PageSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { PersonalBookSheet } from "@/components/shared/personal-book-sheet";
import { AmbientQuote } from "@/components/shared/ambient-quote";
import { useToast } from "@/components/ui/toast";
import { Search, Loader2, BookOpen, Plus, LogOut, ChevronLeft, ChevronRight, CheckCircle2, RotateCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Profile, UserBook, GoogleBooksVolume } from "@/lib/types";

export default function PersonalPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [favourites, setFavourites] = useState<UserBook[]>([]);
  const [reading, setReading] = useState<UserBook[]>([]);
  const [readBooks, setReadBooks] = useState<UserBook[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [rereadCounts, setRereadCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [pickOpen, setPickOpen] = useState(false);
  const [pickMode, setPickMode] = useState<"reading" | "read">("read");
  const [pickQuery, setPickQuery] = useState("");
  const [pickResults, setPickResults] = useState<GoogleBooksVolume[]>([]);
  const [pickSearching, setPickSearching] = useState(false);
  const [pickSaving, setPickSaving] = useState(false);
  const [selected, setSelected] = useState<UserBook | null>(null);
  const [readingNotes, setReadingNotes] = useState<Record<string, string>>({});
  const [savingReadingNote, setSavingReadingNote] = useState<string | null>(null);
  const [finishingId, setFinishingId] = useState<string | null>(null);
  const overviewTriedRef = useRef<Set<string>>(new Set());
  const syncedRef = useRef(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const supabase = createClient();
  const router = useRouter();
  const toast = useToast();

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [profileRes, favRes, readingRes, readRes, ratingsRes, rereadsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase
        .from("user_books")
        .select("*, book:books(*)")
        .eq("user_id", user.id)
        .eq("is_favourite", true)
        .order("favourite_rank"),
      supabase
        .from("user_books")
        .select("*, book:books(*)")
        .eq("user_id", user.id)
        .eq("shelf", "reading")
        .order("updated_at", { ascending: false }),
      supabase
        .from("user_books")
        .select("*, book:books(*)")
        .eq("user_id", user.id)
        .eq("shelf", "read")
        .order("finished_at", { ascending: false }),
      supabase
        .from("logs")
        .select("book_id, rating")
        .eq("user_id", user.id)
        .is("club_id", null)
        .eq("kind", "review")
        .not("rating", "is", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("logs")
        .select("book_id")
        .eq("user_id", user.id)
        .is("club_id", null)
        .eq("kind", "reread"),
    ]);

    const rereadMap: Record<string, number> = {};
    (rereadsRes.data || []).forEach((r: any) => {
      rereadMap[r.book_id] = (rereadMap[r.book_id] || 0) + 1;
    });
    setRereadCounts(rereadMap);

    if (profileRes.data) setProfile(profileRes.data);
    if (favRes.data) setFavourites(favRes.data as any);
    if (readingRes.data) setReading(readingRes.data as any);
    if (readRes.data) setReadBooks(readRes.data as any);

    if (ratingsRes.data) {
      const map: Record<string, number> = {};
      (ratingsRes.data as any[]).forEach((r) => {
        // ordered desc, so the first per book is the latest rating
        if (!(r.book_id in map)) map[r.book_id] = r.rating;
      });
      setRatings(map);
    }

    setLoading(false);
  }, [supabase]);

  // Pull any books the club has finished onto this member's personal "read"
  // shelf, and copy their club ratings across. Idempotent — the unique
  // (user_id, book_id) constraint plus ignoreDuplicates means re-running is safe.
  // This is what makes club reads show up under Personal, whoever marked them done.
  const syncFromClub = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: memberships } = await supabase
      .from("club_members")
      .select("club_id")
      .eq("user_id", user.id);
    const clubIds = (memberships || []).map((m: any) => m.club_id);
    if (clubIds.length === 0) return;

    const { data: pastBooks } = await supabase
      .from("club_books")
      .select("book_id, ended_on")
      .in("club_id", clubIds)
      .eq("status", "past");
    if (!pastBooks || pastBooks.length === 0) return;

    const { data: existing } = await supabase
      .from("user_books")
      .select("book_id")
      .eq("user_id", user.id);
    const have = new Set((existing || []).map((e: any) => e.book_id));

    const seen = new Set<string>();
    const toInsert = pastBooks
      .filter((cb: any) => {
        if (have.has(cb.book_id) || seen.has(cb.book_id)) return false;
        seen.add(cb.book_id);
        return true;
      })
      .map((cb: any) => ({
        user_id: user.id,
        book_id: cb.book_id,
        shelf: "read",
        finished_at: cb.ended_on,
      }));

    if (toInsert.length > 0) {
      await supabase
        .from("user_books")
        .upsert(toInsert, { onConflict: "user_id,book_id", ignoreDuplicates: true });
    }

    // Copy each club rating into a personal rating, unless one already exists.
    const { data: clubRatings } = await supabase
      .from("logs")
      .select("book_id, rating, created_at")
      .eq("user_id", user.id)
      .in("club_id", clubIds)
      .in("kind", ["review", "reread"])
      .not("rating", "is", null)
      .order("created_at", { ascending: false });
    const { data: personalRatings } = await supabase
      .from("logs")
      .select("book_id")
      .eq("user_id", user.id)
      .is("club_id", null)
      .in("kind", ["review", "reread"])
      .not("rating", "is", null);
    const havePersonal = new Set((personalRatings || []).map((r: any) => r.book_id));

    const latestClub = new Map<string, number>();
    (clubRatings || []).forEach((r: any) => {
      if (!latestClub.has(r.book_id)) latestClub.set(r.book_id, r.rating);
    });

    const ratingInserts = [...latestClub.entries()]
      .filter(([bookId]) => !havePersonal.has(bookId))
      .map(([bookId, rating]) => ({
        user_id: user.id,
        book_id: bookId,
        kind: "review",
        rating,
        club_id: null,
      }));

    if (ratingInserts.length > 0) {
      await supabase.from("logs").insert(ratingInserts);
    }
  }, [supabase]);

  useEffect(() => {
    (async () => {
      if (!syncedRef.current) {
        syncedRef.current = true;
        await syncFromClub();
      }
      await loadData();
    })();
  }, [syncFromClub, loadData]);

  const readingIds = reading.map(r => r.book_id).join(",");

  useEffect(() => {
    if (!readingIds) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const bookIds = readingIds.split(",");
      const results = await Promise.all(
        bookIds.map(bookId =>
          supabase
            .from("logs")
            .select("review")
            .eq("user_id", user.id)
            .eq("book_id", bookId)
            .is("club_id", null)
            .eq("kind", "note")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        )
      );
      const notes: Record<string, string> = {};
      bookIds.forEach((id, i) => {
        notes[id] = results[i].data?.review ?? "";
      });
      setReadingNotes(notes);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readingIds]);

  useEffect(() => {
    for (const ub of reading) {
      const book = ub.book as any;
      if (!book?.ai_synopsis && !overviewTriedRef.current.has(ub.book_id)) {
        overviewTriedRef.current.add(ub.book_id);
        fetch("/api/club/overview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookId: ub.book_id }),
        }).then((res) => {
          if (res.ok) loadData();
        });
      }
    }
  }, [reading, loadData]);

  async function saveReadingNote(bookId: string) {
    setSavingReadingNote(bookId);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingReadingNote(null); return; }
    await supabase
      .from("logs")
      .delete()
      .eq("user_id", user.id)
      .eq("book_id", bookId)
      .is("club_id", null)
      .eq("kind", "note");
    const noteText = readingNotes[bookId]?.trim();
    if (noteText) {
      await supabase.from("logs").insert({
        user_id: user.id,
        book_id: bookId,
        kind: "note",
        review: noteText,
      });
    }
    setSavingReadingNote(null);
  }

  async function finishReadingBook(userBookId: string) {
    setFinishingId(userBookId);
    try {
      const res = await fetch("/api/personal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "finish_book", userBookId }),
      });
      if (res.ok) {
        await loadData();
        toast("Marked as finished — it's on your shelf now", "success");
      } else {
        toast("Couldn't mark it finished — try again", "error");
      }
    } catch {
      toast("Couldn't mark it finished — try again", "error");
    }
    setFinishingId(null);
  }

  async function moveFavourite(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= favourites.length) return;

    // Reorder the list, then renumber every favourite 1..n. This is robust even
    // when existing favourite_rank values are missing or duplicated (older data),
    // where a simple two-row swap would be a no-op.
    const reordered = [...favourites];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    setFavourites(reordered); // optimistic — arrows feel instant

    await Promise.all(
      reordered.map((ub, i) =>
        supabase.from("user_books").update({ favourite_rank: i + 1 }).eq("id", ub.id)
      )
    );
    loadData();
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function handlePickSearch(q: string) {
    setPickQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.length < 2) { setPickResults([]); setPickSearching(false); return; }
    setPickSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/books/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setPickResults(data.items || []);
      } catch { setPickResults([]); }
      setPickSearching(false);
    }, 300);
  }

  function openPicker(mode: "reading" | "read") {
    setPickMode(mode);
    setPickQuery("");
    setPickResults([]);
    setPickOpen(true);
  }

  async function handlePickBook(vol: GoogleBooksVolume) {
    setPickSaving(true);
    try {
      const res = await fetch("/api/personal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_book", googleBooksVolume: vol, shelf: pickMode }),
      });
      if (!res.ok) {
        toast("Couldn't add that book — try again", "error");
      } else {
        setPickOpen(false);
        setPickQuery("");
        setPickResults([]);
        loadData();
      }
    } catch {
      toast("Couldn't add that book — try again", "error");
    }
    setPickSaving(false);
  }

  if (loading) return <PageSkeleton />;

  return (
    <div className="max-w-lg mx-auto w-full px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif font-bold text-2xl text-[var(--foreground)]">
            My reading
          </h1>
          {profile?.display_name && (
            <p className="text-sm text-[var(--muted)] mt-0.5">{profile.display_name}</p>
          )}
        </div>
        <button
          onClick={handleSignOut}
          className="p-2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          title="Sign out"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      <AmbientQuote
        scope="me"
        className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-4"
      />

      {/* Top 5 */}
      <section>
        <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
          Top 5
        </h2>
        <div className="grid grid-cols-5 gap-2">
          {[...Array(5)].map((_, i) => {
            const fav = favourites[i];
            if (fav?.book) {
              return (
                <div key={fav.id} className="flex flex-col items-center gap-1">
                  <button
                    onClick={() => setSelected(fav)}
                    className="group w-full press"
                  >
                    <div className="relative transition-transform duration-200 group-hover:-translate-y-1">
                      <BookCover
                        coverUrl={(fav.book as any).cover_url}
                        title={(fav.book as any).title}
                        size="md"
                        className="w-full h-auto aspect-[2/3]"
                      />
                      <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-[var(--accent)] text-white text-[10px] font-bold flex items-center justify-center book-shadow">
                        {i + 1}
                      </span>
                    </div>
                  </button>
                  {favourites.length > 1 && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => moveFavourite(i, -1)}
                        disabled={i === 0}
                        className="p-0.5 text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-20 transition-colors"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => moveFavourite(i, 1)}
                        disabled={i >= favourites.length - 1}
                        className="p-0.5 text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-20 transition-colors"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            }
            return (
              <div
                key={i}
                className="w-full aspect-[2/3] rounded-[3px] border-2 border-dashed border-[var(--border)] flex items-center justify-center"
              >
                <span className="text-[var(--muted)] text-xs font-serif">{i + 1}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Inline pick-book search */}
      {pickOpen && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 w-4 h-4 text-[var(--muted)]" />
              <input
                type="text"
                value={pickQuery}
                onChange={(e) => handlePickSearch(e.target.value)}
                autoFocus
                placeholder={pickMode === "reading" ? "Search a book you're reading" : "Search a book you've read"}
                className="w-full pl-9 pr-9 py-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-coral/50"
              />
              {pickSearching && (
                <Loader2 className="absolute right-3 top-3 w-4 h-4 text-[var(--muted)] animate-spin" />
              )}
            </div>
            <button
              type="button"
              onClick={() => { setPickOpen(false); setPickQuery(""); setPickResults([]); }}
              className="text-sm text-coral font-medium flex-shrink-0 px-1"
            >
              Cancel
            </button>
          </div>

          {pickResults.length > 0 && (
            <div className="space-y-2">
              {pickResults.map((vol) => (
                <button
                  key={vol.id}
                  onClick={() => handlePickBook(vol)}
                  disabled={pickSaving}
                  className="w-full flex gap-3 p-3 rounded-lg hover:bg-[var(--surface)] transition-colors text-left border border-[var(--border)] disabled:opacity-50"
                >
                  <BookCover
                    coverUrl={vol.volumeInfo.imageLinks?.thumbnail}
                    title={vol.volumeInfo.title}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-serif font-medium text-[var(--foreground)] truncate">
                      {vol.volumeInfo.title}
                    </p>
                    <p className="text-sm text-[var(--muted)]">
                      {vol.volumeInfo.authors?.join(", ")}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {vol.volumeInfo.publishedDate}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {pickQuery.length >= 2 && !pickSearching && pickResults.length === 0 && (
            <p className="text-sm text-[var(--muted)] italic py-2 text-center">
              No books found.
            </p>
          )}
        </div>
      )}

      {/* Currently reading */}
      <section className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden book-shadow">
        <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
            Currently reading
          </h2>
          <button
            onClick={() => openPicker("reading")}
            className="text-xs text-coral font-medium flex items-center gap-1 hover:underline"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>

        {reading.length > 0 ? (
          <div className="divide-y divide-[var(--border)]">
            {reading.map((ub) => {
              const book = ub.book as any;
              return (
                <div key={ub.id} className="p-5">
                  <div className="flex gap-5">
                    <button onClick={() => setSelected(ub)} className="flex-shrink-0 press">
                      <BookCover coverUrl={book?.cover_url} title={book?.title || ""} size="xl" />
                    </button>
                    <div className="flex-1 min-w-0 pt-1">
                      <p className="text-[10px] font-semibold text-[var(--accent)] uppercase tracking-[0.15em] mb-1.5">
                        Now reading
                      </p>
                      <button onClick={() => setSelected(ub)} className="text-left">
                        <h3 className="font-serif font-bold text-2xl text-[var(--foreground)] leading-[1.15]">
                          {book?.title}
                        </h3>
                      </button>
                      <p className="text-sm text-[var(--muted)] italic mt-1">{book?.authors?.join(", ")}</p>
                      {book?.page_count && (
                        <p className="text-xs text-[var(--muted)] mt-2">{book.page_count} pages</p>
                      )}
                    </div>
                  </div>

                  {book?.ai_synopsis ? (
                    <div className="mt-4 space-y-4">
                      <div>
                        <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">
                          Synopsis
                        </h4>
                        <p className="text-sm text-[var(--foreground)] font-serif leading-relaxed">
                          {book.ai_synopsis}
                        </p>
                      </div>
                      {book.ai_characters && (
                        <div>
                          <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">
                            Who&apos;s who
                          </h4>
                          <p className="text-sm text-[var(--foreground)] font-serif leading-relaxed whitespace-pre-wrap">
                            {book.ai_characters}
                          </p>
                        </div>
                      )}
                      <p className="text-[10px] text-[var(--muted)] italic">AI-generated</p>
                    </div>
                  ) : (
                    <div className="mt-4 flex items-center gap-2 text-sm text-[var(--muted)]">
                      <Loader2 className="w-4 h-4 animate-spin" /> Writing an overview…
                    </div>
                  )}

                  <section className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                        My notes
                      </h4>
                      {savingReadingNote === ub.book_id && <span className="text-xs text-[var(--muted)]">Saving…</span>}
                    </div>
                    <textarea
                      value={readingNotes[ub.book_id] || ""}
                      onChange={(e) => setReadingNotes(prev => ({ ...prev, [ub.book_id]: e.target.value }))}
                      onBlur={() => saveReadingNote(ub.book_id)}
                      placeholder="Thoughts, themes, things to remember…"
                      rows={3}
                      className="w-full px-3 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm font-serif focus:outline-none focus:ring-2 focus:ring-coral/30 resize-none"
                    />
                    <p className="text-[10px] text-[var(--muted)] italic mt-1">Only you can see this</p>
                  </section>

                  <button
                    onClick={() => finishReadingBook(ub.id)}
                    disabled={finishingId === ub.id}
                    className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-coral text-white text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {finishingId === ub.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Mark as finished
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 text-center space-y-3">
            <p className="text-[var(--muted)]">Nothing on the go.</p>
            <button
              onClick={() => openPicker("reading")}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-coral text-white text-sm font-medium transition-opacity hover:opacity-90"
            >
              <BookOpen className="w-4 h-4" /> Pick a book
            </button>
          </div>
        )}
      </section>

      {/* The shelf — finished books */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
            The shelf
          </h2>
          <button
            onClick={() => openPicker("read")}
            className="text-xs text-coral font-medium flex items-center gap-1 hover:underline"
          >
            <Plus className="w-3.5 h-3.5" /> Add a book
          </button>
        </div>

        {readBooks.length > 0 ? (
          <div className="grid grid-cols-3 gap-3 stagger">
            {readBooks.map((ub, idx) => {
              const book = ub.book as any;
              const rating = ratings[ub.book_id];
              return (
                <button
                  key={ub.id}
                  onClick={() => setSelected(ub)}
                  style={{ ["--i" as string]: idx } as React.CSSProperties}
                  className="group text-left press"
                >
                  <div className="relative transition-transform duration-200 group-hover:-translate-y-1">
                    <BookCover
                      coverUrl={book?.cover_url}
                      title={book?.title || ""}
                      size="lg"
                      className="w-full h-auto aspect-[2/3]"
                    />
                    {rating !== undefined && (
                      <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/70 text-white text-[11px] font-bold backdrop-blur-sm">
                        {rating}
                      </span>
                    )}
                    {rereadCounts[ub.book_id] > 0 && (
                      <span className="absolute top-1.5 left-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-black/70 text-white text-[10px] font-medium backdrop-blur-sm" title="Reread">
                        <RotateCw className="w-2.5 h-2.5" />
                        {rereadCounts[ub.book_id]}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <EmptyState message="Your shelf is waiting. Add a book you've read." icon={BookOpen} />
        )}
      </section>

      {selected && (
        <PersonalBookSheet
          open={!!selected}
          onClose={() => setSelected(null)}
          userBookId={selected.id}
          bookId={selected.book_id}
          bookTitle={(selected.book as any)?.title || ""}
          bookAuthors={(selected.book as any)?.authors || null}
          coverUrl={(selected.book as any)?.cover_url || null}
          description={(selected.book as any)?.description || null}
          shelf={selected.shelf}
          endedOn={selected.finished_at || null}
          progressPct={selected.progress_pct}
          progressPage={selected.progress_page}
          pageCount={(selected.book as any)?.page_count || null}
          isFavourite={selected.is_favourite}
          canFavourite={favourites.length < 5}
          nextFavRank={favourites.length + 1}
          onUpdate={loadData}
        />
      )}
    </div>
  );
}
