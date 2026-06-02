"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { BookCover } from "@/components/ui/book-cover";
import { StarRating } from "@/components/ui/star-rating";
import { EmptyState } from "@/components/ui/empty-state";
import { Loading } from "@/components/ui/loading";
import { LogBookSheet } from "@/components/shared/log-book-sheet";
import { ClubBookSheet } from "@/components/shared/club-book-sheet";
import { Fab } from "@/components/shared/fab";
import { Copy, Check, Share2, UserPlus, Search, Loader2, BookOpen, MessageCircle } from "lucide-react";
import Link from "next/link";
import type { Club, ClubMember, ClubBook, Profile, GoogleBooksVolume } from "@/lib/types";

interface MemberRating {
  user_id: string;
  display_name: string;
  rating: number | null;
  review: string | null;
}

interface BookWithRatings {
  clubBook: ClubBook & { characters?: string | null };
  memberRatings: MemberRating[];
  avgRating: number | null;
}

export default function ClubPage() {
  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<(ClubMember & { profile: Profile })[]>([]);
  const [currentBook, setCurrentBook] = useState<ClubBook | null>(null);
  const [pastBooksWithRatings, setPastBooksWithRatings] = useState<BookWithRatings[]>([]);
  const [currentBookRatings, setCurrentBookRatings] = useState<MemberRating[]>([]);
  const [currentAvgRating, setCurrentAvgRating] = useState<number | null>(null);
  const [memberProgress, setMemberProgress] = useState<Record<string, number>>({});
  const [logSheetOpen, setLogSheetOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pickBookOpen, setPickBookOpen] = useState(false);
  const [pickQuery, setPickQuery] = useState("");
  const [pickResults, setPickResults] = useState<GoogleBooksVolume[]>([]);
  const [pickSearching, setPickSearching] = useState(false);
  const [pickSaving, setPickSaving] = useState(false);
  const [selectedBook, setSelectedBook] = useState<BookWithRatings | null>(null);

  const [clubAction, setClubAction] = useState<"create" | "join">("create");
  const [clubName, setClubName] = useState("");
  const [clubDescription, setClubDescription] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  const supabase = createClient();

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: membership } = await supabase
      .from("club_members")
      .select("club_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!membership) {
      setLoading(false);
      return;
    }

    const clubId = membership.club_id;

    const [clubRes, membersRes, currentBookRes, pastBooksRes, ratingsRes] = await Promise.all([
      supabase.from("clubs").select("*").eq("id", clubId).single(),
      supabase
        .from("club_members")
        .select("*, profile:profiles(*)")
        .eq("club_id", clubId),
      supabase
        .from("club_books")
        .select("*, book:books(*)")
        .eq("club_id", clubId)
        .eq("status", "current")
        .single(),
      supabase
        .from("club_books")
        .select("*, book:books(*)")
        .eq("club_id", clubId)
        .eq("status", "past")
        .order("ended_on", { ascending: false }),
      supabase
        .from("logs")
        .select("*, profile:profiles(*)")
        .eq("club_id", clubId)
        .in("kind", ["review", "reread"])
        .not("rating", "is", null),
    ]);

    if (clubRes.data) setClub(clubRes.data);
    const memberList = (membersRes.data || []) as any[];
    setMembers(memberList);

    const allRatings = (ratingsRes.data || []) as any[];

    if (currentBookRes.data) {
      const cb = currentBookRes.data as any;
      setCurrentBook(cb);

      const bookRatings = buildMemberRatings(allRatings, cb.book_id, memberList);
      setCurrentBookRatings(bookRatings.memberRatings);
      setCurrentAvgRating(bookRatings.avgRating);

      const memberIds = memberList.map((m: any) => m.user_id);
      if (memberIds.length > 0 && cb.book_id) {
        const { data: progData } = await supabase
          .from("user_books")
          .select("user_id, progress_pct")
          .eq("book_id", cb.book_id)
          .in("user_id", memberIds);

        const progress: Record<string, number> = {};
        progData?.forEach((p) => {
          progress[p.user_id] = p.progress_pct || 0;
        });
        setMemberProgress(progress);
      }
    }

    if (pastBooksRes.data) {
      const booksWithRatings = (pastBooksRes.data as any[]).map((cb) => ({
        clubBook: cb,
        ...buildMemberRatings(allRatings, cb.book_id, memberList),
      }));
      setPastBooksWithRatings(booksWithRatings);
    }

    setLoading(false);
  }, [supabase]);

  function buildMemberRatings(
    allRatings: any[],
    bookId: string,
    memberList: any[]
  ): { memberRatings: MemberRating[]; avgRating: number | null } {
    const bookRatings = allRatings.filter((r) => r.book_id === bookId);

    const memberRatings: MemberRating[] = memberList.map((m: any) => {
      const log = bookRatings.find((r) => r.user_id === m.user_id);
      return {
        user_id: m.user_id,
        display_name: (m.profile as any)?.display_name || "?",
        rating: log?.rating || null,
        review: log?.review || null,
      };
    });

    const rated = memberRatings.filter((r) => r.rating !== null);
    const avg = rated.length > 0
      ? Math.round((rated.reduce((s, r) => s + r.rating!, 0) / rated.length) * 10) / 10
      : null;

    return { memberRatings, avgRating: avg };
  }

  useEffect(() => { loadData(); }, [loadData]);

  function copyInviteCode() {
    if (!club) return;
    navigator.clipboard.writeText(club.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function shareInvite() {
    if (!club) return;
    const text = `Join my book club "${club.name}" on Goon Squad! Use invite code: ${club.invite_code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join my book club", text });
      } catch {
        copyInviteCode();
      }
    } else {
      copyInviteCode();
    }
  }

  async function handleClubSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormLoading(true);
    setFormError("");

    try {
      const res = await fetch("/api/club", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          clubAction === "create"
            ? { action: "create", name: clubName, description: clubDescription }
            : { action: "join", inviteCode }
        ),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || "Something went wrong");
        setFormLoading(false);
        return;
      }

      loadData();
    } catch {
      setFormError("Something went wrong");
    }
    setFormLoading(false);
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

  async function handlePickBook(vol: GoogleBooksVolume) {
    setPickSaving(true);
    try {
      await fetch("/api/club", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_current_book", googleBooksVolume: vol }),
      });
      setPickBookOpen(false);
      setPickQuery("");
      setPickResults([]);
      loadData();
    } catch {}
    setPickSaving(false);
  }

  if (loading) return <Loading />;

  if (!club) {
    return (
      <div className="max-w-lg mx-auto w-full px-4 py-6 space-y-6 animate-fade-in">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-serif font-bold text-[var(--foreground)]">
            Join a book club
          </h1>
          <p className="text-[var(--muted)]">
            Every reader needs a crew.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setClubAction("create")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              clubAction === "create"
                ? "bg-coral text-white"
                : "bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)]"
            }`}
          >
            Create a club
          </button>
          <button
            onClick={() => setClubAction("join")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              clubAction === "join"
                ? "bg-coral text-white"
                : "bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)]"
            }`}
          >
            Join a club
          </button>
        </div>

        <form onSubmit={handleClubSubmit} className="space-y-4">
          {clubAction === "create" ? (
            <>
              <div>
                <label htmlFor="clubName" className="block text-sm font-medium text-[var(--foreground)] mb-1">
                  Club name
                </label>
                <input
                  id="clubName"
                  type="text"
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  required
                  placeholder="The Slow Readers"
                  className="w-full px-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-coral/30"
                />
              </div>
              <div>
                <label htmlFor="clubDesc" className="block text-sm font-medium text-[var(--foreground)] mb-1">
                  Description
                </label>
                <textarea
                  id="clubDesc"
                  value={clubDescription}
                  onChange={(e) => setClubDescription(e.target.value)}
                  placeholder="Optional"
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-coral/30 resize-none"
                />
              </div>
            </>
          ) : (
            <div>
              <label htmlFor="inviteCodeInput" className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Invite code
              </label>
              <input
                id="inviteCodeInput"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                required
                placeholder="ABC123"
                maxLength={6}
                className="w-full px-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-coral/30 uppercase tracking-widest text-center text-lg"
              />
              <p className="text-xs text-[var(--muted)] mt-1">
                Ask your club owner for the 6-character code
              </p>
            </div>
          )}

          {formError && <p className="text-sm text-red-500">{formError}</p>}

          <button
            type="submit"
            disabled={formLoading}
            className="w-full py-3 rounded-lg bg-coral text-white font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {formLoading
              ? "Setting up..."
              : clubAction === "create"
              ? "Create club"
              : "Join club"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto w-full px-4 py-6 space-y-6">
      {/* Club header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-serif font-bold text-2xl text-[var(--foreground)]">
            {club.name}
          </h1>
          {club.description && (
            <p className="text-sm text-[var(--muted)] mt-0.5">{club.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {members.slice(0, 4).map((m) => (
            <div
              key={m.user_id}
              className="w-8 h-8 rounded-full bg-coral/15 flex items-center justify-center text-xs font-bold text-coral -ml-1 first:ml-0 border-2 border-[var(--background)]"
              title={(m.profile as any)?.display_name}
            >
              {(m.profile as any)?.display_name?.[0]?.toUpperCase() || "?"}
            </div>
          ))}
          {members.length > 4 && (
            <div className="w-8 h-8 rounded-full bg-[var(--border)] flex items-center justify-center text-xs font-medium text-[var(--muted)] -ml-1 border-2 border-[var(--background)]">
              +{members.length - 4}
            </div>
          )}
        </div>
      </div>

      {/* Current read */}
      {currentBook?.book && (
        <section className="rounded-xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
            <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
              Currently reading
            </h2>
            <button
              onClick={() => setPickBookOpen(true)}
              className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              Change
            </button>
          </div>

          <div className="p-4">
            <div className="flex gap-4">
              <Link href={`/book/${currentBook.book_id}`}>
                <BookCover
                  coverUrl={(currentBook.book as any).cover_url}
                  title={(currentBook.book as any).title}
                  size="lg"
                />
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/book/${currentBook.book_id}`}>
                  <h3 className="font-serif font-semibold text-lg text-[var(--foreground)] leading-tight">
                    {(currentBook.book as any).title}
                  </h3>
                </Link>
                <p className="text-sm text-[var(--muted)]">
                  {(currentBook.book as any).authors?.join(", ")}
                </p>
                {currentAvgRating !== null && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-2xl font-bold text-[var(--foreground)]">{currentAvgRating}</span>
                    <StarRating rating={currentAvgRating} size="sm" readonly />
                    <span className="text-xs text-[var(--muted)]">avg</span>
                  </div>
                )}
              </div>
            </div>

            {/* Ratings table */}
            {currentBookRatings.length > 0 && (
              <div className="mt-4 space-y-2">
                {currentBookRatings.map((mr) => (
                  <div key={mr.user_id} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-coral/15 flex items-center justify-center text-xs font-bold text-coral flex-shrink-0">
                      {mr.display_name[0]?.toUpperCase() || "?"}
                    </div>
                    <span className="text-sm text-[var(--foreground)] w-20 truncate">{mr.display_name}</span>
                    <div className="flex-1">
                      {mr.rating ? (
                        <div className="flex items-center gap-2">
                          <StarRating rating={mr.rating} size="sm" readonly />
                          <span className="text-sm font-medium text-[var(--foreground)]">{mr.rating}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--muted)] italic">not rated</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Member progress */}
            <div className="mt-4 pt-4 border-t border-[var(--border)] space-y-2">
              <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">Progress</p>
              {members.map((m) => {
                const pct = memberProgress[m.user_id] || 0;
                return (
                  <div key={m.user_id} className="flex items-center gap-2">
                    <span className="text-xs text-[var(--muted)] w-20 truncate">
                      {(m.profile as any)?.display_name}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-[var(--border)]">
                      <div
                        className="h-full rounded-full bg-coral transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-[var(--muted)] w-8 text-right">
                      {Math.round(pct)}%
                    </span>
                  </div>
                );
              })}
            </div>

            <Link
              href={`/club/discussion/${currentBook.id}`}
              className="mt-4 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-coral text-white text-sm font-medium transition-opacity hover:opacity-90"
            >
              <MessageCircle className="w-4 h-4" /> Discussion
            </Link>
          </div>
        </section>
      )}

      {!currentBook && (
        <section className="p-6 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-center space-y-3">
          <p className="text-[var(--muted)]">No book picked yet.</p>
          <button
            onClick={() => setPickBookOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-coral text-white text-sm font-medium transition-opacity hover:opacity-90"
          >
            <BookOpen className="w-4 h-4" /> Pick a book
          </button>
        </section>
      )}

      {/* Past picks — 3-column cover grid */}
      {pastBooksWithRatings.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
            The shelf
          </h2>

          <div className="grid grid-cols-3 gap-3">
            {pastBooksWithRatings.map((item) => {
              const book = item.clubBook.book as any;
              return (
                <button
                  key={item.clubBook.id}
                  onClick={() => setSelectedBook(item)}
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
                  {item.avgRating !== null ? (
                    <span className="text-sm font-bold text-[var(--foreground)]">
                      {item.avgRating}
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--muted)]">—</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Invite button */}
      <button
        onClick={() => setInviteOpen(true)}
        className="w-full py-2.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors flex items-center justify-center gap-2"
      >
        <UserPlus className="w-4 h-4" /> Invite friends
      </button>

      {/* Invite popup */}
      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setInviteOpen(false)} />
          <div className="relative w-[90%] max-w-sm bg-[var(--background)] rounded-2xl p-6 space-y-4 animate-fade-in">
            <h3 className="font-serif font-semibold text-lg text-[var(--foreground)] text-center">
              Invite friends
            </h3>
            <p className="text-sm text-[var(--muted)] text-center">
              Share this code to let others join your club:
            </p>
            <div className="py-3 px-4 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-center">
              <span className="text-2xl font-bold tracking-[0.3em] text-coral">
                {club.invite_code}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={copyInviteCode}
                className="flex-1 py-2 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--foreground)] flex items-center justify-center gap-2 transition-colors hover:bg-[var(--surface)]"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                onClick={shareInvite}
                className="flex-1 py-2 rounded-lg bg-coral text-white text-sm font-medium flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
              >
                <Share2 className="w-4 h-4" /> Share
              </button>
            </div>
            <p className="text-xs text-[var(--muted)] text-center">
              They sign up, tap &ldquo;Join a club&rdquo; and enter this code.
            </p>
          </div>
        </div>
      )}

      {/* Pick book sheet */}
      {pickBookOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setPickBookOpen(false)} />
          <div className="relative w-full max-w-lg bg-[var(--background)] rounded-t-2xl max-h-[85vh] overflow-y-auto animate-slide-up">
            <div className="sticky top-0 bg-[var(--background)] border-b border-[var(--border)] px-4 py-3 flex items-center justify-between z-10">
              <h2 className="font-serif font-semibold text-lg text-[var(--foreground)]">
                Pick club book
              </h2>
              <button onClick={() => setPickBookOpen(false)} className="p-1 text-[var(--muted)] hover:text-[var(--foreground)]">
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-[var(--muted)]" />
                <input
                  type="text"
                  value={pickQuery}
                  onChange={(e) => handlePickSearch(e.target.value)}
                  placeholder="Search by title or author"
                  autoFocus
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-coral/30"
                />
                {pickSearching && (
                  <Loader2 className="absolute right-3 top-3 w-4 h-4 text-[var(--muted)] animate-spin" />
                )}
              </div>
              <div className="space-y-2">
                {pickResults.map((vol) => (
                  <button
                    key={vol.id}
                    onClick={() => handlePickBook(vol)}
                    disabled={pickSaving}
                    className="w-full flex gap-3 p-3 rounded-lg hover:bg-[var(--surface)] transition-colors text-left disabled:opacity-50"
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
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <LogBookSheet
        open={logSheetOpen}
        onClose={() => setLogSheetOpen(false)}
        onSuccess={loadData}
        clubId={club.id}
      />

      <ClubBookSheet
        open={!!selectedBook}
        onClose={() => setSelectedBook(null)}
        clubBookId={selectedBook?.clubBook.id || null}
        bookId={selectedBook?.clubBook.book_id || null}
        bookTitle={(selectedBook?.clubBook.book as any)?.title || ""}
        bookAuthors={(selectedBook?.clubBook.book as any)?.authors || null}
        coverUrl={(selectedBook?.clubBook.book as any)?.cover_url || null}
        description={(selectedBook?.clubBook.book as any)?.description || null}
        characters={selectedBook?.clubBook.characters || null}
        avgRating={selectedBook?.avgRating || null}
        memberRatings={selectedBook?.memberRatings || []}
        clubId={club.id}
        onUpdate={loadData}
      />

      <Fab onClick={() => setLogSheetOpen(true)} />
    </div>
  );
}
