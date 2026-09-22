"use client";

import { useState, useEffect } from "react";
import {
  CURATED_QUOTES,
  cacheQuotes,
  readCachedQuotes,
  type DisplayQuote,
} from "@/lib/quotes";

interface AmbientQuoteProps {
  scope?: "me" | "club";
  greeting?: string; // e.g. "Welcome back" — shown above the quote
  curatedOnly?: boolean; // for pre-auth screens (login)
  className?: string;
}

// A quiet, rotating line of a saved quote (falling back to a curated classic).
// Pulls the reader's / club's quotes, caches them, and gently cycles.
export function AmbientQuote({ scope = "me", greeting, curatedOnly, className }: AmbientQuoteProps) {
  const [pool, setPool] = useState<DisplayQuote[]>(() =>
    curatedOnly ? CURATED_QUOTES : []
  );
  const [i, setI] = useState(0);

  useEffect(() => {
    if (curatedOnly) return;
    const cached = readCachedQuotes(scope);
    if (cached.length) setPool(cached);

    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/quotes/list?scope=${scope}`);
        if (!res.ok) return;
        const data = await res.json();
        const quotes: DisplayQuote[] = (data.quotes || []).map((q: any) => ({
          body: q.body,
          bookTitle: q.bookTitle,
          author: q.author,
          person: q.person,
        }));
        if (active && quotes.length) {
          setPool(quotes);
          cacheQuotes(scope, quotes);
        }
      } catch {}
    })();
    return () => { active = false; };
  }, [scope, curatedOnly]);

  const quotes = pool.length ? pool : CURATED_QUOTES;

  // Start on a random quote, then rotate slowly.
  useEffect(() => {
    setI(Math.floor(Math.random() * quotes.length));
    if (quotes.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % quotes.length), 9000);
    return () => clearInterval(t);
  }, [quotes.length]);

  const q = quotes[i % quotes.length];
  if (!q) return null;

  const attribution = [q.author, q.bookTitle].filter(Boolean).join(", ");

  return (
    <div className={className}>
      {greeting && (
        <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
          {greeting}
        </p>
      )}
      <blockquote key={i} className="animate-fade-in">
        <p className="font-serif italic text-[var(--foreground)] leading-relaxed line-clamp-3">
          &ldquo;{q.body}&rdquo;
        </p>
        {attribution && (
          <p className="text-xs text-[var(--muted)] mt-1">— {attribution}</p>
        )}
      </blockquote>
    </div>
  );
}
