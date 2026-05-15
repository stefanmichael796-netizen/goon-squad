"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { BookCover } from "@/components/ui/book-cover";
import { StarRating } from "@/components/ui/star-rating";
import { EmptyState } from "@/components/ui/empty-state";
import { Loading } from "@/components/ui/loading";
import { LogBookSheet } from "@/components/shared/log-book-sheet";
import { timeAgo } from "@/lib/utils";
import { BarChart3, LogOut, ChevronLeft, ChevronRight, Search, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Profile, UserBook, Log, Quote, GoogleBooksVolume } from "@/lib/types";

type ShelfTab = "reading" | "want" | "read";

export default function PersonalPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [favourites, setFavourites] = useState<UserBook[]>([]);
  const [shelfTab, setShelfTab] = useState<ShelfTab>("reading");
  const [shelfBooks, setShelfBooks] = useState<UserBook[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [stats, setStats] = useState({ booksThisYear: 0, totalBooks: 0, topAuthor: "" });
  const [logSheetOpen, setLogSheetOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clubId, setClubId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GoogleBooksVolume[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedVolume, setSelectedVolume] = useState<GoogleBooksVolume | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const supabase = createClient();
  const router = useRouter();

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [
      profileRes,
      favouritesRes,
      shelfRes,
      logsRes,
      quotesRes,
      memberRes,
      statsRes,
    ] = await Promise.all([
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
        .eq("shelf", shelfTab)
        .order("updated_at", { ascending: false }),
      supabase
        .from("logs")
        .select("*, book:books(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("quotes")
        .select("*, book:books(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("club_members")
        .select("club_id")
        .eq("user_id", user.id)
        .limit(1)
        .single(),
      supabase
        .from("user_books")
        .select("*, book:books(*)")
        .eq("user_id", user.id)
        .eq("shelf", "read"),
    ]);

    if (profileRes.data) setProfile(profileRes.data);
    if (favouritesRes.data) setFavourites(favouritesRes.data);
    if (shelfRes.data) {
      const seen = new Set<string>();
      setShelfBooks(shelfRes.data.filter((ub) => {
        if (seen.has(ub.book_id)) return false;
        seen.add(ub.book_id);
        return true;
      }));
    }
    if (logsRes.data) setLogs(logsRes.data);
    if (quotesRes.data) setQuotes(quotesRes.data);
    if (memberRes.data) setClubId(memberRes.data.club_id);

    if (statsRes.data) {
      const readBooks = statsRes.data;
      const thisYear = readBooks.filter(
        (b) => b.finished_at && new Date(b.finished_at).getFullYear() === new Date().getFullYear()
      );

      const authorCounts: Record<string, number> = {};
      readBooks.forEach((ub) => {
        (ub.book as any)?.authors?.forEach((a: string) => {
          authorCounts[a] = (authorCounts[a] || 0) + 1;
        });
      });
      const topAuthor = Object.entries(authorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

      setStats({
        booksThisYear: thisYear.length,
        totalBooks: readBooks.length,
        topAuthor,
      });
    }

    setLoading(false);
  }, [supabase, shelfTab]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function updateProgress(userBookId: string, page: number, pageCount: number | null) {
    const pct = pageCount ? Math.min(100, (page / pageCount) * 100) : null;
    await supabase
      .from("user_books")
      .update({ progress_page: page, progress_pct: pct, updated_at: new Date().toISOString() })
      .eq("id", userBookId);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const ub = shelfBooks.find((b) => b.id === userBookId);
      if (ub) {
        await supabase.from("logs").insert({
          user_id: user.id,
          book_id: ub.book_id,
          kind: "progress",
          progress_pct: pct,
        });
      }
    }
    loadData();
  }

  async function toggleFavourite(userBookId: string, currentFav: boolean) {
    if (!currentFav) {
      const nextRank = favourites.length + 1;
      if (nextRank > 5) return;
      await supabase
        .from("user_books")
        .update({ is_favourite: true, favourite_rank: nextRank })
        .eq("id", userBookId);
    } else {
      await supabase
        .from("user_books")
        .update({ is_favourite: false, favourite_rank: null })
        .eq("id", userBookId);
    }
    loadData();
  }

  async function moveFavourite(index: number, direction: -1 | 1) {
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= favourites.length) return;
    const a = favourites[index];
    const b = favourites[swapIndex];
    await Promise.all([
      supabase.from("user_books").update({ favourite_rank: swapIndex + 1 }).eq("id", a.id),
      supabase.from("user_books").update({ favourite_rank: index + 1 }).eq("id", b.id),
    ]);
    loadData();
  }

  function handleSearch(q: string) {
    setSearchQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (q.length < 2) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/books/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setSearchResults(data.items || []);
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 400);
  }

  function selectSearchResult(vol: GoogleBooksVolume) {
    setSelectedVolume(vol);
    setLogSheetOpen(true);
    setSearchQuery("");
    setSearchResults([]);
    setSearchFocused(false);
  }

  if (loading) return <Loading />;

  return (
    <div className="max-w-lg mx-auto w-full px-4 py-6 space-y-8">
      {/* Profile header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-coral/20 flex items-center justify-center text-coral font-serif text-xl font-bold">
            {profile?.display_name?.[0]?.toUpperCase() || "?"}
          </div>
          <div>
            <h1 className="font-serif font-bold text-xl text-[var(--foreground)]">
              {profile?.display_name}
            </h1>
            <div className="flex gap-3 text-sm text-[var(--muted)]">
              <span>{stats.booksThisYear} this year</span>
              <span>{stats.totalBooks} total</span>
            </div>
            {stats.topAuthor && (
              <p className="text-xs text-[var(--muted)]">
                Top: {stats.topAuthor}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/insights"
            className="p-2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            title="Insights"
          >
            <BarChart3 className="w-5 h-5" />
          </Link>
          <button
            onClick={handleSignOut}
            className="p-2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            title="Sign out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-[var(--muted)]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          placeholder="Search books to add..."
          className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-coral/50"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-3 w-4 h-4 text-[var(--muted)] animate-spin" />
        )}

        {searchFocused && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--background)] border border-[var(--border)] rounded-lg shadow-lg z-30 max-h-80 overflow-y-auto">
            {searchResults.map((vol) => (
              <button
                key={vol.id}
                onClick={() => selectSearchResult(vol)}
                className="w-full flex gap-3 p-3 hover:bg-[var(--surface)] transition-colors text-left border-b border-[var(--border)] last:border-b-0"
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
      </div>

      {/* Dismiss search overlay */}
      {searchFocused && searchResults.length > 0 && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => { setSearchFocused(false); setSearchResults([]); }}
        />
      )}

      {/* 5 Favourites shelf */}
      <section>
        <h2 className="font-serif font-semibold text-lg text-[var(--foreground)] mb-3">
          5 Favourites
        </h2>
        {favourites.length === 0 ? (
          <EmptyState message="Pick 5. It should hurt a little." />
        ) : (
          <div className="grid grid-cols-5 gap-2">
            {[...Array(5)].map((_, i) => {
              const fav = favourites[i];
              if (fav?.book) {
                return (
                  <div key={fav.id} className="flex flex-col items-center gap-1">
                    <Link href={`/book/${fav.book_id}`}>
                      <BookCover
                        coverUrl={(fav.book as any).cover_url}
                        title={(fav.book as any).title}
                        size="md"
                      />
                    </Link>
                    <div className="flex gap-0.5">
                      <button
                        onClick={() => moveFavourite(i, -1)}
                        disabled={i === 0}
                        className="p-0.5 text-[var(--muted)] hover:text-coral disabled:opacity-20 transition-colors"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => moveFavourite(i, 1)}
                        disabled={i === favourites.length - 1}
                        className="p-0.5 text-[var(--muted)] hover:text-coral disabled:opacity-20 transition-colors"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
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
        )}
      </section>

      {/* Shelves */}
      <section>
        <div className="flex gap-1 mb-4">
          {(["reading", "want", "read"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setShelfTab(tab)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                shelfTab === tab
                  ? "bg-coral text-white"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {tab === "want" ? "Want to read" : tab === "reading" ? "Reading" : "Read"}
            </button>
          ))}
        </div>

        {shelfBooks.length === 0 ? (
          <EmptyState
            message={
              shelfTab === "reading"
                ? "Nothing on the go. Pick something up."
                : shelfTab === "want"
                ? "No books waiting. Search and add some."
                : "No books finished yet. Keep reading."
            }
          />
        ) : (
          <div className="space-y-3">
            {shelfBooks.map((ub) => {
              const book = ub.book as any;
              return (
                <div key={ub.id} className="flex gap-3 p-3 rounded-lg bg-[var(--surface)]">
                  <Link href={`/book/${ub.book_id}`}>
                    <BookCover coverUrl={book?.cover_url} title={book?.title || ""} size="sm" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link href={`/book/${ub.book_id}`}>
                      <p className="font-serif font-medium text-[var(--foreground)] truncate">
                        {book?.title}
                      </p>
                    </Link>
                    <p className="text-sm text-[var(--muted)]">
                      {book?.authors?.join(", ")}
                    </p>

                    {shelfTab === "reading" && (
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-[var(--border)]">
                            <div
                              className="h-full rounded-full bg-coral transition-all"
                              style={{ width: `${ub.progress_pct || 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-[var(--muted)]">
                            {ub.progress_page ? `p.${ub.progress_page}` : `${Math.round(ub.progress_pct || 0)}%`}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={book?.page_count || 100}
                          value={ub.progress_page || 0}
                          onChange={(e) =>
                            updateProgress(ub.id, parseInt(e.target.value), book?.page_count)
                          }
                          className="w-full h-2 accent-coral"
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={() => toggleFavourite(ub.id, ub.is_favourite)}
                        className={`text-xs ${
                          ub.is_favourite ? "text-ochre" : "text-[var(--muted)]"
                        } hover:text-ochre transition-colors`}
                      >
                        {ub.is_favourite ? "★ Favourite" : "☆ Add to favourites"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Quotes */}
      <section>
        <h2 className="font-serif font-semibold text-lg text-[var(--foreground)] mb-3">
          Quotes
        </h2>
        {quotes.length === 0 ? (
          <EmptyState message="No quotes saved yet. Find a passage worth keeping." />
        ) : (
          <div className="space-y-3">
            {quotes.map((q) => (
              <div key={q.id} className="p-4 rounded-lg bg-[var(--surface)] space-y-2">
                <blockquote className="font-serif italic text-[var(--foreground)] leading-relaxed">
                  &ldquo;{q.body}&rdquo;
                </blockquote>
                <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                  <span className="font-serif">{(q.book as any)?.title}</span>
                  {q.page_number && <span>p.{q.page_number}</span>}
                </div>
                {q.note && (
                  <p className="text-sm text-[var(--muted)]">{q.note}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Activity feed */}
      <section>
        <h2 className="font-serif font-semibold text-lg text-[var(--foreground)] mb-3">
          Activity
        </h2>
        {logs.length === 0 ? (
          <EmptyState message="Nothing here yet. Log your first book." />
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="flex gap-3 p-3 rounded-lg bg-[var(--surface)]">
                <Link href={`/book/${log.book_id}`}>
                  <BookCover
                    coverUrl={(log.book as any)?.cover_url}
                    title={(log.book as any)?.title || ""}
                    size="sm"
                  />
                </Link>
                <div className="flex-1 min-w-0">
                  <p className="font-serif font-medium text-[var(--foreground)] truncate">
                    {(log.book as any)?.title}
                  </p>
                  {log.kind === "review" && log.rating && (
                    <StarRating rating={log.rating} size="sm" readonly />
                  )}
                  {log.review && (
                    <p className="text-sm text-[var(--foreground)] mt-1 font-serif line-clamp-2">
                      {log.review}
                    </p>
                  )}
                  {log.kind === "shelf_change" && log.shelf && (
                    <p className="text-sm text-[var(--muted)]">
                      Shelved as {log.shelf === "want" ? "want to read" : log.shelf}
                    </p>
                  )}
                  {log.kind === "progress" && (
                    <p className="text-sm text-[var(--muted)]">
                      Progress: {Math.round(log.progress_pct || 0)}%
                    </p>
                  )}
                  <p className="text-xs text-[var(--muted)] mt-1">
                    {timeAgo(log.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <LogBookSheet
        open={logSheetOpen}
        onClose={() => { setLogSheetOpen(false); setSelectedVolume(null); }}
        onSuccess={loadData}
        clubId={clubId}
        preSelectedVolume={selectedVolume}
      />
    </div>
  );
}
