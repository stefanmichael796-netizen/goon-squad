"use client";

import Link from "next/link";

// Only the club feature is active for now (the personal shelf is dormant), so
// the top bar is just a simple brand header rather than a multi-tab nav.
export function BottomNav() {
  return (
    <nav className="fixed top-0 left-0 right-0 bg-[var(--surface)] border-b border-[var(--border)] z-50">
      <div className="max-w-lg mx-auto flex items-center justify-center py-3">
        <Link href="/club" className="font-serif font-bold text-lg text-coral">
          Goon Squad
        </Link>
      </div>
    </nav>
  );
}
