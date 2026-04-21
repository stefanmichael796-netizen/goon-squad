"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BookCover } from "@/components/ui/book-cover";
import { StarRating } from "@/components/ui/star-rating";
import { EmptyState } from "@/components/ui/empty-state";
import { Loading } from "@/components/ui/loading";
import { ArrowLeft } from "lucide-react";
import { timeAgo } from "@/lib/utils";
import Link from "next/link";
import type { Profile, UserBook, Log, Quote } from "@/lib/types";

export default function MemberProfilePage() {
  const params = useParams();
  const memberId = params.id as string;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [favourites, setFavourites] = useState<UserBook[]>([]);
  const [readBooks, setReadBooks] = useState<UserBook[]>([]);
  const [recentLogs, setRecentLogs] = useState<Log[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      const [profileRes, favouritesRes, readRes, logsRes, quotesRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", memberId).single(),
        supabase
          .from("user_books")
          .select("*, book:books(*)")
          .eq("user_id", memberId)
          .eq("is_favourite", true)
          .order("favourite_rank"),
        supabase
          .from("user_books")
          .select("*, book:books(*)")
          .eq("user_id", memberId)
          .eq("shelf", "read")
          .order("updated_at", { ascending: false })
          .limit(10),
        supabase
          .from("logs")
          .select("*, book:books(*)")
          .eq("user_id", memberId)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("quotes")
          .select("*, book:books(*)")
          .eq("user_id", memberId)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      if (favouritesRes.data) setFavourites(favouritesRes.data);
      if (readRes.data) setReadBooks(readRes.data);
      if (logsRes.data) setRecentLogs(logsRes.data);
      if (quotesRes.data) setQuotes(quotesRes.data);
      setLoading(false);
    }
    loadData();
  }, [supabase, memberId]);

  if (loading) return <Loading />;
  if (!profile) return <EmptyState message="Member not found." />;

  return (
    <div className="max-w-lg mx-auto w-full px-4 py-6 space-y-8">
      <Link
        href="/club"
        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to club
      </Link>

      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-coral/20 flex items-center justify-center text-coral font-serif text-xl font-bold">
          {profile.display_name?.[0]?.toUpperCase() || "?"}
        </div>
        <div>
          <h1 className="font-serif font-bold text-xl text-[var(--foreground)]">
            {profile.display_name}
          </h1>
          <p className="text-sm text-[var(--muted)]">
            {readBooks.length} books read
          </p>
        </div>
      </div>

      {/* Favourites */}
      {favourites.length > 0 && (
        <section>
          <h2 className="font-serif font-semibold text-lg text-[var(--foreground)] mb-3">
            Favourites
          </h2>
          <div className="grid grid-cols-5 gap-2">
            {favourites.map((fav) => (
              <Link key={fav.id} href={`/book/${fav.book_id}`}>
                <BookCover
                  coverUrl={(fav.book as any)?.cover_url}
                  title={(fav.book as any)?.title || ""}
                  size="md"
                />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Quotes */}
      {quotes.length > 0 && (
        <section>
          <h2 className="font-serif font-semibold text-lg text-[var(--foreground)] mb-3">
            Quotes
          </h2>
          <div className="space-y-3">
            {quotes.map((q) => (
              <div key={q.id} className="p-4 rounded-lg bg-[var(--surface)]">
                <blockquote className="font-serif italic text-[var(--foreground)] leading-relaxed">
                  &ldquo;{q.body}&rdquo;
                </blockquote>
                <p className="text-sm text-[var(--muted)] mt-1 font-serif">
                  {(q.book as any)?.title}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent activity */}
      <section>
        <h2 className="font-serif font-semibold text-lg text-[var(--foreground)] mb-3">
          Recent activity
        </h2>
        {recentLogs.length === 0 ? (
          <EmptyState message="No activity yet." />
        ) : (
          <div className="space-y-3">
            {recentLogs.map((log) => (
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
    </div>
  );
}
