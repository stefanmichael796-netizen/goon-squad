"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { CURATED_QUOTES, readCachedQuotes, pickRandom, type DisplayQuote } from "@/lib/quotes";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-md", className)} />;
}

// A saved (or curated) quote shown while the page loads — turns the wait into a
// small moment rather than a blank shimmer.
function LoadingQuote() {
  const [q, setQ] = useState<DisplayQuote | null>(null);

  useEffect(() => {
    const cached = [...readCachedQuotes("me"), ...readCachedQuotes("club")];
    const pool = cached.length ? cached : CURATED_QUOTES;
    setQ(pickRandom(pool) || null);
  }, []);

  if (!q) return null;
  const attribution = [q.author, q.bookTitle].filter(Boolean).join(", ");

  return (
    <div className="pt-2 text-center animate-fade-in">
      <p className="font-serif italic text-[var(--muted)] leading-relaxed max-w-sm mx-auto">
        &ldquo;{q.body}&rdquo;
      </p>
      {attribution && <p className="text-xs text-[var(--muted)] mt-1.5">— {attribution}</p>}
    </div>
  );
}

// Content-shaped placeholder for the club/personal pages while data loads.
export function PageSkeleton() {
  return (
    <div className="max-w-lg mx-auto w-full px-4 py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="w-16 h-16 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-3.5 w-1/3" />
        </div>
      </div>

      <Skeleton className="h-3 w-24" />
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="w-full aspect-[2/3] rounded-[3px]" />
        ))}
      </div>

      <div className="rounded-2xl border border-[var(--border)] overflow-hidden">
        <div className="p-5 flex gap-5">
          <Skeleton className="w-28 aspect-[2/3] rounded-[3px]" />
          <div className="flex-1 space-y-2.5 pt-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      </div>

      <LoadingQuote />
    </div>
  );
}
