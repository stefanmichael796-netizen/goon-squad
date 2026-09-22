import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { CURATED_QUOTES, pickRandom } from "@/lib/quotes";

interface EmptyStateProps {
  message: string;
  icon?: LucideIcon;
  withQuote?: boolean;
  className?: string;
}

export function EmptyState({ message, icon: Icon, withQuote, className }: EmptyStateProps) {
  const quote = withQuote ? pickRandom(CURATED_QUOTES) : undefined;

  return (
    <div className={cn("py-12 flex flex-col items-center text-center gap-3", className)}>
      {Icon && (
        <div className="w-12 h-12 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center">
          <Icon className="w-5 h-5 text-[var(--muted)]" />
        </div>
      )}
      <p className="text-[var(--muted)] font-serif italic text-lg max-w-xs">
        {message}
      </p>
      {quote && (
        <div className="mt-4 max-w-xs">
          <p className="font-serif italic text-sm text-[var(--muted)] leading-relaxed">
            &ldquo;{quote.body}&rdquo;
          </p>
          {(quote.author || quote.bookTitle) && (
            <p className="text-xs text-[var(--muted)] mt-1.5">
              — {[quote.author, quote.bookTitle].filter(Boolean).join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
