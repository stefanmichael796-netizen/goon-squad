"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { BookCover } from "@/components/ui/book-cover";
import { StarRating } from "@/components/ui/star-rating";
import { EmptyState } from "@/components/ui/empty-state";
import { Loading } from "@/components/ui/loading";
import { LogBookSheet } from "@/components/shared/log-book-sheet";
import { Fab } from "@/components/shared/fab";
import { timeAgo } from "@/lib/utils";
import { Copy, Check, Share2 } from "lucide-react";
import Link from "next/link";
import type { Club, ClubMember, ClubBook, Log, Profile } from "@/lib/types";

export default function ClubPage() {
  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<(ClubMember & { profile: Profile })[]>([]);
  const [currentBook, setCurrentBook] = useState<ClubBook | null>(null);
  const [pastBooks, setPastBooks] = useState<ClubBook[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [memberProgress, setMemberProgress] = useState<Record<string, number>>({});
  const [logSheetOpen, setLogSheetOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

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

    const [clubRes, membersRes, currentBookRes, pastBooksRes, logsRes] = await Promise.all([
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
        .select("*, book:books(*), profile:profiles(*)")
        .eq("club_id", clubId)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    if (clubRes.data) setClub(clubRes.data);
    if (membersRes.data) setMembers(membersRes.data as any);
    if (currentBookRes.data) {
      setCurrentBook(currentBookRes.data as any);
      const memberIds = (membersRes.data || []).map((m: any) => m.user_id);
      if (memberIds.length > 0 && currentBookRes.data.book_id) {
        const { data: progData } = await supabase
          .from("user_books")
          .select("user_id, progress_pct")
          .eq("book_id", currentBookRes.data.book_id)
          .in("user_id", memberIds);

        const progress: Record<string, number> = {};
        progData?.forEach((p) => {
          progress[p.user_id] = p.progress_pct || 0;
        });
        setMemberProgress(progress);
      }
    }
    if (pastBooksRes.data) setPastBooks(pastBooksRes.data as any);
    if (logsRes.data) setLogs(logsRes.data as any);

    setLoading(false);
  }, [supabase]);

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
                  className="w-full px-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-coral/50"
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
                  className="w-full px-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-coral/50 resize-none"
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
                className="w-full px-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-coral/50 uppercase tracking-widest text-center text-lg"
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
    <div className="max-w-lg mx-auto w-full px-4 py-6 space-y-8">
      {/* Club header */}
      <div>
        <h1 className="font-serif font-bold text-2xl text-[var(--foreground)]">
          {club.name}
        </h1>
        {club.description && (
          <p className="text-sm text-[var(--muted)] mt-1">{club.description}</p>
        )}
        <div className="flex items-center gap-3 mt-2">
          <span className="text-sm text-[var(--muted)]">
            {members.length} {members.length === 1 ? "member" : "members"}
          </span>
        </div>
      </div>

      {/* Invite section */}
      <section className="p-4 rounded-xl bg-[var(--surface)] space-y-3">
        <h2 className="font-serif font-semibold text-sm text-[var(--muted)] uppercase tracking-wide">
          Invite friends
        </h2>
        <p className="text-sm text-[var(--foreground)]">
          Share this code with people you want in the club:
        </p>
        <div className="flex items-center gap-3">
          <div className="flex-1 py-3 px-4 rounded-lg bg-[var(--background)] border border-[var(--border)] text-center">
            <span className="text-2xl font-bold tracking-[0.3em] text-coral">
              {club.invite_code}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={copyInviteCode}
            className="flex-1 py-2 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--foreground)] flex items-center justify-center gap-2 transition-colors hover:bg-[var(--background)]"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied" : "Copy code"}
          </button>
          <button
            onClick={shareInvite}
            className="flex-1 py-2 rounded-lg bg-coral text-white text-sm font-medium flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
          >
            <Share2 className="w-4 h-4" />
            Share invite
          </button>
        </div>
        <p className="text-xs text-[var(--muted)]">
          They sign up on the app, then tap "Join a club" and enter this code.
        </p>
      </section>

      {/* Current read */}
      {currentBook?.book && (
        <section className="p-4 rounded-xl bg-[var(--surface)] space-y-4">
          <h2 className="font-serif font-semibold text-sm text-[var(--muted)] uppercase tracking-wide">
            Currently reading
          </h2>
          <div className="flex gap-3">
            <Link href={`/book/${currentBook.book_id}`}>
              <BookCover
                coverUrl={(currentBook.book as any).cover_url}
                title={(currentBook.book as any).title}
                size="lg"
              />
            </Link>
            <div className="flex-1 min-w-0">
              <Link href={`/book/${currentBook.book_id}`}>
                <h3 className="font-serif font-semibold text-lg text-[var(--foreground)]">
                  {(currentBook.book as any).title}
                </h3>
              </Link>
              <p className="text-sm text-[var(--muted)]">
                {(currentBook.book as any).authors?.join(", ")}
              </p>
              {currentBook.target_end_date && (
                <p className="text-xs text-[var(--muted)] mt-1">
                  Target: {new Date(currentBook.target_end_date).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>

          {/* Member progress */}
          <div className="space-y-2">
            {members.map((m) => {
              const pct = memberProgress[m.user_id] || 0;
              return (
                <div key={m.user_id} className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-coral/20 flex items-center justify-center text-xs font-bold text-coral flex-shrink-0">
                    {(m.profile as any)?.display_name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1">
                    <div className="h-1.5 rounded-full bg-[var(--border)]">
                      <div
                        className="h-full rounded-full bg-coral transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
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
            className="block text-sm text-coral hover:underline"
          >
            Open discussion
          </Link>
        </section>
      )}

      {!currentBook && (
        <EmptyState message="No book picked yet. The club owner can set one." />
      )}

      {/* Activity feed */}
      <section>
        <h2 className="font-serif font-semibold text-lg text-[var(--foreground)] mb-3">
          Activity
        </h2>
        {logs.length === 0 ? (
          <EmptyState message="Quiet in here. Log something." />
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
                  <p className="text-sm text-[var(--muted)]">
                    <span className="text-[var(--foreground)] font-medium">
                      {(log.profile as any)?.display_name}
                    </span>
                    {" "}
                    {log.kind === "review"
                      ? "reviewed"
                      : log.kind === "shelf_change"
                      ? "shelved"
                      : log.kind === "progress"
                      ? "updated progress on"
                      : "favourited"}
                  </p>
                  <p className="font-serif font-medium text-[var(--foreground)] truncate">
                    {(log.book as any)?.title}
                  </p>
                  {log.rating && <StarRating rating={log.rating} size="sm" readonly />}
                  {log.review && (
                    <p className="text-sm font-serif text-[var(--foreground)] mt-1 line-clamp-2">
                      {log.review}
                    </p>
                  )}
                  <p className="text-xs text-[var(--muted)] mt-1">{timeAgo(log.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Members */}
      <section>
        <h2 className="font-serif font-semibold text-lg text-[var(--foreground)] mb-3">
          Members
        </h2>
        <div className="flex flex-wrap gap-3">
          {members.map((m) => (
            <Link
              key={m.user_id}
              href={`/club/member/${m.user_id}`}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--surface)] hover:bg-[var(--border)] transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-coral/20 flex items-center justify-center text-sm font-bold text-coral">
                {(m.profile as any)?.display_name?.[0]?.toUpperCase() || "?"}
              </div>
              <span className="text-sm text-[var(--foreground)]">
                {(m.profile as any)?.display_name}
              </span>
              {m.role === "owner" && (
                <span className="text-xs text-ochre">owner</span>
              )}
            </Link>
          ))}
        </div>
      </section>

      {/* Past picks */}
      {pastBooks.length > 0 && (
        <section>
          <h2 className="font-serif font-semibold text-lg text-[var(--foreground)] mb-3">
            Past picks
          </h2>
          <div className="space-y-3">
            {pastBooks.map((cb) => (
              <Link
                key={cb.id}
                href={`/club/discussion/${cb.id}`}
                className="flex gap-3 p-3 rounded-lg bg-[var(--surface)] hover:bg-[var(--border)] transition-colors"
              >
                <BookCover
                  coverUrl={(cb.book as any)?.cover_url}
                  title={(cb.book as any)?.title || ""}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-serif font-medium text-[var(--foreground)] truncate">
                    {(cb.book as any)?.title}
                  </p>
                  <p className="text-sm text-[var(--muted)]">
                    {(cb.book as any)?.authors?.join(", ")}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <LogBookSheet
        open={logSheetOpen}
        onClose={() => setLogSheetOpen(false)}
        onSuccess={loadData}
        clubId={club.id}
      />
      <Fab onClick={() => setLogSheetOpen(true)} />
    </div>
  );
}
