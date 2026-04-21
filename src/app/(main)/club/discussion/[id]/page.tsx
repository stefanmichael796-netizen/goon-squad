"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BookCover } from "@/components/ui/book-cover";
import { EmptyState } from "@/components/ui/empty-state";
import { Loading } from "@/components/ui/loading";
import { ArrowLeft, Send } from "lucide-react";
import { timeAgo } from "@/lib/utils";
import Link from "next/link";
import type { ClubComment, ClubBook, Profile } from "@/lib/types";

export default function DiscussionPage() {
  const params = useParams();
  const clubBookId = params.id as string;
  const [clubBook, setClubBook] = useState<ClubBook | null>(null);
  const [comments, setComments] = useState<ClubComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const supabase = createClient();

  const loadData = useCallback(async () => {
    const [cbRes, commentsRes] = await Promise.all([
      supabase
        .from("club_books")
        .select("*, book:books(*)")
        .eq("id", clubBookId)
        .single(),
      supabase
        .from("club_comments")
        .select("*, profile:profiles(*)")
        .eq("club_book_id", clubBookId)
        .order("created_at", { ascending: true }),
    ]);

    if (cbRes.data) setClubBook(cbRes.data as any);
    if (commentsRes.data) {
      const topLevel = commentsRes.data.filter((c: any) => !c.parent_id);
      const replies = commentsRes.data.filter((c: any) => c.parent_id);
      const threaded = topLevel.map((c: any) => ({
        ...c,
        replies: replies.filter((r: any) => r.parent_id === c.id),
      }));
      setComments(threaded as any);
    }
    setLoading(false);
  }, [supabase, clubBookId]);

  useEffect(() => { loadData(); }, [loadData]);

  async function postComment(parentId: string | null = null) {
    const text = parentId ? replyText : newComment;
    if (!text.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setPosting(true);
    await supabase.from("club_comments").insert({
      club_book_id: clubBookId,
      user_id: user.id,
      parent_id: parentId,
      body: text.trim(),
    });

    if (parentId) {
      setReplyTo(null);
      setReplyText("");
    } else {
      setNewComment("");
    }
    setPosting(false);
    loadData();
  }

  if (loading) return <Loading />;

  return (
    <div className="max-w-lg mx-auto w-full px-4 py-6 space-y-6">
      <Link
        href="/club"
        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to club
      </Link>

      {clubBook?.book && (
        <div className="flex gap-3">
          <BookCover
            coverUrl={(clubBook.book as any).cover_url}
            title={(clubBook.book as any).title}
            size="md"
          />
          <div>
            <h1 className="font-serif font-bold text-xl text-[var(--foreground)]">
              {(clubBook.book as any).title}
            </h1>
            <p className="text-sm text-[var(--muted)]">
              {(clubBook.book as any).authors?.join(", ")}
            </p>
            <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-coral/20 text-coral capitalize">
              {clubBook.status}
            </span>
          </div>
        </div>
      )}

      <section className="space-y-4">
        <h2 className="font-serif font-semibold text-lg text-[var(--foreground)]">
          Discussion
        </h2>

        {comments.length === 0 ? (
          <EmptyState message="No comments yet. Start the conversation." />
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => (
              <div key={comment.id} className="space-y-2">
                <div className="p-3 rounded-lg bg-[var(--surface)]">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-full bg-coral/20 flex items-center justify-center text-xs font-bold text-coral">
                      {(comment.profile as any)?.display_name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <span className="text-sm font-medium text-[var(--foreground)]">
                      {(comment.profile as any)?.display_name}
                    </span>
                    <span className="text-xs text-[var(--muted)]">
                      {timeAgo(comment.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--foreground)] leading-relaxed">
                    {comment.body}
                  </p>
                  <button
                    onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                    className="text-xs text-[var(--muted)] hover:text-coral mt-1"
                  >
                    Reply
                  </button>
                </div>

                {comment.replies && comment.replies.length > 0 && (
                  <div className="ml-6 space-y-2">
                    {comment.replies.map((reply) => (
                      <div key={reply.id} className="p-3 rounded-lg bg-[var(--surface)] border-l-2 border-coral/30">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-[var(--foreground)]">
                            {(reply.profile as any)?.display_name}
                          </span>
                          <span className="text-xs text-[var(--muted)]">
                            {timeAgo(reply.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-[var(--foreground)]">{reply.body}</p>
                      </div>
                    ))}
                  </div>
                )}

                {replyTo === comment.id && (
                  <div className="ml-6 flex gap-2">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write a reply"
                      className="flex-1 px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-coral/50"
                      onKeyDown={(e) => e.key === "Enter" && postComment(comment.id)}
                    />
                    <button
                      onClick={() => postComment(comment.id)}
                      disabled={posting || !replyText.trim()}
                      className="p-2 text-coral disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* New comment input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment"
            className="flex-1 px-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-coral/50"
            onKeyDown={(e) => e.key === "Enter" && postComment()}
          />
          <button
            onClick={() => postComment()}
            disabled={posting || !newComment.trim()}
            className="p-2.5 bg-coral text-white rounded-lg disabled:opacity-50 transition-opacity hover:opacity-90"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </section>
    </div>
  );
}
