"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { BookCover } from "@/components/ui/book-cover";
import { Loading } from "@/components/ui/loading";
import { PersonalBookSheet } from "@/components/shared/personal-book-sheet";
import { Search, Loader2, BookOpen, Plus, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Profile, UserBook, GoogleBooksVolume } from "@/lib/types";

export default function PersonalPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [favourites, setFavourites] = useState<UserBook[]>([]);
  const [reading, setReading] = useState<UserBook[]>([]);
  const [readBooks, setReadBooks] = useState<UserBook[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [pickOpen, setPickOpen] = useState(false);
  const [pickMode, setPickMode] = useState<"reading" | "read">("read");
  const [pickQuery, setPickQuery] = useState("");
  const [pickResults, setPickResults] = useState<GoogleBooksVolume[]>([]);
  const [pickSearching, setPickSearching] = useState(false);
  const [pickSaving, setPickSaving] = useState(false);
  const [selected, setSelected] = useState<UserBook | null>(null);

  const supabase = createClient();
  const router = useRouter();

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [profileRes, favRes, readingRes, readRes, ratingsRes] = await Promise.all([
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
        .in("kind", ["review", "reread"])
        .not("rating", "is", null)
        .order("created_at", { ascending: false }),
    ]);

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

  useEffect(() => { loadData(); }, [loadData]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function handlePickSearch(q: string) {
    setPickQuery(q);
    if (q.length < 2) { setPickResults([]); return; }
    setPickSearching(true);
    try {
      const res = await fetch(`/api/books/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setPickResults(data.items || []);
    } catch { setPickResults([]); }
    setPickSearching(false);
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
      await fetch("/api/personal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_book", googleBooksVolume: vol, shelf: pickMode }),
      });
      setPickOpen(false);
      setPickQuery("");
      setPickResults([]);
      loadData();
    } catch {}
    setPickSaving(false);
  }

  if (loading) return <Loading />;

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
                <button
                  key={fav.id}
                  onClick={() => setSelected(fav)}
                  className="group"
                >
                  <BookCover
                    coverUrl={(fav.book as any).cover_url}
                    title={(fav.book as any).title}
                    size="md"
                    className="w-full h-auto aspect-[2/3] transition-transform group-hover:-translate-y-0.5"
                  />
                </button>
              );
            }
            return (
              <div
                key={i}
                className="w-full aspect-[2/3] rounded-md border-2 border-dashed border-[var(--border)] flex items-center justify-center"
              >
                <span className="text-[var(--muted)] text-xs">{i + 1}</span>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-[var(--muted)] italic mt-1.5">
          Star a book to add it to your Top 5.
        </p>
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
      <section className="rounded-xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
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
                <button
                  key={ub.id}
                  onClick={() => setSelected(ub)}
                  className="w-full flex gap-4 p-4 text-left hover:bg-[var(--background)]/40 transition-colors"
                >
                  <BookCover coverUrl={book?.cover_url} title={book?.title || ""} size="md" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-serif font-semibold text-[var(--foreground)] leading-tight">
                      {book?.title}
                    </h3>
                    <p className="text-sm text-[var(--muted)]">{book?.authors?.join(", ")}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-1.5 rounded-full bg-[var(--border)]">
                        <div
                          className="h-full rounded-full bg-coral transition-all"
                          style={{ width: `${ub.progress_pct || 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-[var(--muted)]">
                        {Math.round(ub.progress_pct || 0)}%
                      </span>
                    </div>
                  </div>
                </button>
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
          <div className="grid grid-cols-3 gap-3">
            {readBooks.map((ub) => {
              const book = ub.book as any;
              const rating = ratings[ub.book_id];
              return (
                <button
                  key={ub.id}
                  onClick={() => setSelected(ub)}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <div className="w-full transition-transform group-hover:-translate-y-0.5">
                    <BookCover
                      coverUrl={book?.cover_url}
                      title={book?.title || ""}
                      size="lg"
                      className="w-full h-auto aspect-[2/3]"
                    />
                  </div>
                  {rating !== undefined ? (
                    <span className="text-sm font-bold text-[var(--foreground)]">{rating}</span>
                  ) : (
                    <span className="text-xs text-[var(--muted)]">—</span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)] italic">
            No books on the shelf yet. Add one you&apos;ve read.
          </p>
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
