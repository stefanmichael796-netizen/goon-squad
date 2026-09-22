"use client";

import { useState, useEffect } from "react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Quote as QuoteIcon } from "lucide-react";

interface SavedQuote {
  id: string;
  body: string;
  pageNumber: number | null;
  note: string | null;
  bookTitle: string | null;
  author: string | null;
  person: string | null;
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<SavedQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"me" | "club">("me");

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/quotes/list?scope=${scope}`);
        if (active && res.ok) {
          const data = await res.json();
          setQuotes(data.quotes || []);
        }
      } catch {}
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [scope]);

  if (loading) return <PageSkeleton />;

  return (
    <div className="max-w-lg mx-auto w-full px-4 py-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-serif font-bold text-2xl text-[var(--foreground)]">Quotes</h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">Lines worth keeping.</p>
        </div>
        <div className="inline-flex rounded-lg bg-[var(--surface)] border border-[var(--border)] p-0.5">
          {(["me", "club"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                scope === s ? "bg-coral text-white" : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {s === "me" ? "You" : "Club"}
            </button>
          ))}
        </div>
      </div>

      {quotes.length === 0 ? (
        <EmptyState
          message={
            scope === "club"
              ? "No quotes saved by the club yet. Add one from any book."
              : "No quotes yet. Save a line you love from any book."
          }
          icon={QuoteIcon}
          withQuote
        />
      ) : (
        <div className="space-y-3 stagger">
          {quotes.map((q, i) => (
            <div
              key={q.id}
              style={{ ["--i" as string]: i } as React.CSSProperties}
              className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] border-l-2 border-l-[var(--accent)]"
            >
              <blockquote className="font-serif italic text-[var(--foreground)] leading-relaxed">
                &ldquo;{q.body}&rdquo;
              </blockquote>
              {q.note && (
                <p className="text-sm text-[var(--muted)] mt-2">{q.note}</p>
              )}
              <div className="flex items-center justify-between mt-3 gap-2">
                <p className="text-xs text-[var(--muted)] truncate">
                  {[q.bookTitle, q.author].filter(Boolean).join(" · ")}
                  {q.pageNumber ? ` · p.${q.pageNumber}` : ""}
                </p>
                {q.person && (
                  <span className="text-xs text-coral flex-shrink-0">{q.person}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
