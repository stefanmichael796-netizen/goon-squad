import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  message: string;
  icon?: LucideIcon;
  className?: string;
}

export function EmptyState({ message, icon: Icon, className }: EmptyStateProps) {
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
    </div>
  );
}
