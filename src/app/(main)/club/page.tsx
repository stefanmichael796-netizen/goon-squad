"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { BookCover } from "@/components/ui/book-cover";
import { Loading } from "@/components/ui/loading";
import { ClubBookSheet } from "@/components/shared/club-book-sheet";
import { Copy, Check, Share2, UserPlus, Search, Loader2, BookOpen, MessageCircle, Sparkles, Plus, Camera } from "lucide-react";
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
  const [overview, setOverview] = useState<{ synopsis: string; characters: string; quotes: string | null } | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [overviewTried, setOverviewTried] = useState<string | null>(null);
  const [currentBookNotes, setCurrentBookNotes] = useState("");
  const [savingCurrentNotes, setSavingCurrentNotes] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pickBookOpen, setPickBookOpen] = useState(false);
  const [pickMode, setPickMode] = useState<"current" | "past">("current");
  const [pickQuery, setPickQuery] = useState("");
  const [pickResults, setPickResults] = useState<GoogleBooksVolume[]>([]);
  const [pickSearching, setPickSearching] = useState(false);
  const [pickSaving, setPickSaving] = useState(false);
  const [selectedBook, setSelectedBook] = useState<BookWithRatings | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

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
        .not("rating", "is", null)
        .order("created_at", { ascending: false }),
    ]);

    if (clubRes.data) setClub(clubRes.data);
    const memberList = (membersRes.data || []) as any[];
    setMembers(memberList);

    const allRatings = (ratingsRes.data || []) as any[];

    if (currentBookRes.data) {
      const cb = currentBookRes.data as any;
      setCurrentBook(cb);

      // Show any cached AI overview immediately; don't auto-spend on generation.
      // Require quotes too, so older books regenerate to pick them up.
      if (cb.ai_synopsis && cb.ai_characters && cb.ai_quotes) {
        setOverview({ synopsis: cb.ai_synopsis, characters: cb.ai_characters, quotes: cb.ai_quotes || null });
      } else {
        setOverview(null);
      }
      setOverviewError(null);
    } else {
      setCurrentBook(null);
      setOverview(null);
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
    // allRatings is ordered by created_at desc, so the first match per user is
    // the most recent rating — find() naturally picks the right one.
    const bookRatings = allRatings.filter((r) => r.book_id === bookId);

    const memberRatings: MemberRating[] = memberList.map((m: any) => {
      const log = bookRatings.find((r) => r.user_id === m.user_id);
      return {
        user_id: m.user_id,
        display_name: (m.profile as any)?.display_name || "?",
        rating: log?.rating ?? null,
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

  const loadOverview = useCallback(async (clubBookId: string, refresh = false) => {
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const res = await fetch("/api/club/overview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clubBookId, refresh }),
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

  // Auto-generate the spoiler-free overview as soon as a club book is set and
  // there's no cached version yet — no button press needed. The overviewTried
  // guard makes sure we only kick off one generation per book.
  useEffect(() => {
    if (
      currentBook &&
      !overview &&
      !overviewLoading &&
      !overviewError &&
      overviewTried !== currentBook.id
    ) {
      setOverviewTried(currentBook.id);
      loadOverview(currentBook.id);
    }
  }, [currentBook, overview, overviewLoading, overviewError, overviewTried, loadOverview]);

  useEffect(() => {
    if (!currentBook || !club) { setCurrentBookNotes(""); return; }
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("logs")
        .select("review")
        .eq("user_id", user.id)
        .eq("book_id", currentBook.book_id)
        .eq("club_id", club.id)
        .eq("kind", "note")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setCurrentBookNotes(data?.review ?? "");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBook?.id, club?.id]);

  async function saveCurrentBookNotes() {
    if (!currentBook || !club) return;
    setSavingCurrentNotes(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingCurrentNotes(false); return; }
    await supabase
      .from("logs")
      .delete()
      .eq("user_id", user.id)
      .eq("book_id", currentBook.book_id)
      .eq("club_id", club.id)
      .eq("kind", "note");
    if (currentBookNotes.trim()) {
      await supabase.from("logs").insert({
        user_id: user.id,
        book_id: currentBook.book_id,
        club_id: club.id,
        club_book_id: currentBook.id,
        kind: "note",
        review: currentBookNotes.trim(),
      });
    }
    setSavingCurrentNotes(false);
  }

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

  function openPicker(mode: "current" | "past") {
    setPickMode(mode);
    setPickQuery("");
    setPickResults([]);
    setPickBookOpen(true);
  }

  async function handlePickBook(vol: GoogleBooksVolume) {
    setPickSaving(true);
    try {
      await fetch("/api/club", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: pickMode === "past" ? "add_past_book" : "set_current_book",
          googleBooksVolume: vol,
        }),
      });
      setPickBookOpen(false);
      setPickQuery("");
      setPickResults([]);
      loadData();
    } catch {}
    setPickSaving(false);
  }

  // Resize the picked image in the browser and store it as a small data-URL on
  // the club row — no Supabase Storage bucket needed.
  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !club) return;
    setLogoUploading(true);
    try {
      const dataUrl = await resizeImage(file, 320);
      const { error } = await supabase
        .from("clubs")
        .update({ logo_url: dataUrl })
        .eq("id", club.id);
      if (!error) setClub({ ...club, logo_url: dataUrl });
    } catch {}
    setLogoUploading(false);
  }

  function resizeImage(file: File, maxSize: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("no ctx"));
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        };
        img.onerror = reject;
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
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
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => logoInputRef.current?.click()}
          className="relative flex-shrink-0 w-16 h-16 rounded-full overflow-hidden bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center group"
          aria-label="Change club photo"
        >
          {club.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={club.logo_url} alt={club.name} className="w-full h-full object-cover" />
          ) : (
            <Camera className="w-5 h-5 text-[var(--muted)]" />
          )}
          {logoUploading ? (
            <span className="absolute inset-0 flex items-center justify-center bg-black/40">
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            </span>
          ) : (
            <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" />
            </span>
          )}
        </button>
        <input
          ref={logoInputRef}
          type="file"
          accept="image/*"
          onChange={handleLogoChange}
          className="hidden"
        />
        <div className="min-w-0">
          <h1 className="font-serif font-bold text-2xl text-[var(--foreground)] truncate">
            {club.name}
          </h1>
          {club.description && (
            <p className="text-sm text-[var(--muted)] mt-0.5">{club.description}</p>
          )}
        </div>
      </div>

      {/* Inline pick-book search — expands in normal flow so it stays visible */}
      {pickBookOpen && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 w-4 h-4 text-[var(--muted)]" />
              <input
                type="text"
                value={pickQuery}
                onChange={(e) => handlePickSearch(e.target.value)}
                autoFocus
                placeholder={pickMode === "past" ? "Search a book you've read" : "Search a book for the club"}
                className="w-full pl-9 pr-9 py-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-coral/50"
              />
              {pickSearching && (
                <Loader2 className="absolute right-3 top-3 w-4 h-4 text-[var(--muted)] animate-spin" />
              )}
            </div>
            <button
              type="button"
              onClick={() => { setPickBookOpen(false); setPickQuery(""); setPickResults([]); }}
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

      {/* Current read */}
      {currentBook?.book && (
        <section className="rounded-xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
            <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
              Currently reading
            </h2>
            <button
              onClick={() => openPicker("current")}
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
                {(currentBook.book as any).page_count && (
                  <p className="text-xs text-[var(--muted)] mt-1">
                    {(currentBook.book as any).page_count} pages
                  </p>
                )}
              </div>
            </div>

            {/* AI synopsis + spoiler-free characters — generated automatically */}
            {overview ? (
              <div className="mt-4 space-y-4">
                <div>
                  <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">
                    Synopsis
                  </h4>
                  <p className="text-sm text-[var(--foreground)] font-serif leading-relaxed">
                    {overview.synopsis}
                  </p>
                </div>
                {overview.characters && (
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">
                      Who&apos;s who
                    </h4>
                    <p className="text-sm text-[var(--foreground)] font-serif leading-relaxed whitespace-pre-wrap">
                      {overview.characters}
                    </p>
                  </div>
                )}
                <p className="text-[10px] text-[var(--muted)] italic">AI-generated</p>
              </div>
            ) : overviewError ? (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-red-500">{overviewError}</p>
                <button
                  onClick={() => loadOverview(currentBook.id, true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-coral text-white text-sm font-medium transition-opacity hover:opacity-90"
                >
                  <Sparkles className="w-4 h-4" /> Try again
                </button>
              </div>
            ) : (
              <div className="mt-4 flex items-center gap-2 text-sm text-[var(--muted)]">
                <Loader2 className="w-4 h-4 animate-spin" /> Writing an overview…
              </div>
            )}

            {/* Personal notes */}
            <section className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                  My notes
                </h4>
                {savingCurrentNotes && <span className="text-xs text-[var(--muted)]">Saving…</span>}
              </div>
              <textarea
                value={currentBookNotes}
                onChange={(e) => setCurrentBookNotes(e.target.value)}
                onBlur={saveCurrentBookNotes}
                placeholder="Thoughts, themes, things to remember…"
                rows={3}
                className="w-full px-3 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm font-serif focus:outline-none focus:ring-2 focus:ring-coral/30 resize-none"
              />
              <p className="text-[10px] text-[var(--muted)] italic mt-1">Only you can see this</p>
            </section>

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
            onClick={() => openPicker("current")}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-coral text-white text-sm font-medium transition-opacity hover:opacity-90"
          >
            <BookOpen className="w-4 h-4" /> Pick a book
          </button>
        </section>
      )}

      {/* Past picks — 3-column cover grid */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
            The shelf
          </h2>
          <button
            onClick={() => openPicker("past")}
            className="text-xs text-coral font-medium flex items-center gap-1 hover:underline"
          >
            <Plus className="w-3.5 h-3.5" /> Add a book
          </button>
        </div>

        {pastBooksWithRatings.length > 0 ? (
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
                  {(item.clubBook as any).recommended_by && (
                    <span className="text-[10px] text-[var(--muted)] truncate max-w-full">
                      {(item.clubBook as any).recommended_by}
                    </span>
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


      <ClubBookSheet
        open={!!selectedBook}
        onClose={() => setSelectedBook(null)}
        clubBookId={selectedBook?.clubBook.id || null}
        bookId={selectedBook?.clubBook.book_id || null}
        bookTitle={(selectedBook?.clubBook.book as any)?.title || ""}
        bookAuthors={(selectedBook?.clubBook.book as any)?.authors || null}
        coverUrl={(selectedBook?.clubBook.book as any)?.cover_url || null}
        description={(selectedBook?.clubBook.book as any)?.description || null}
        endedOn={selectedBook?.clubBook.ended_on || null}
        recommendedBy={(selectedBook?.clubBook as any)?.recommended_by || null}
        avgRating={selectedBook?.avgRating || null}
        memberRatings={selectedBook?.memberRatings || []}
        clubId={club.id}
        onUpdate={loadData}
      />

    </div>
  );
}
