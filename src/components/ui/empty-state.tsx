import { cn } from "@/lib/utils";

interface EmptyStateProps {
  message: string;
  className?: string;
}

export function EmptyState({ message, className }: EmptyStateProps) {
  return (
    <div className={cn("py-12 text-center", className)}>
      <p className="text-[var(--muted)] font-serif italic text-lg">
        {message}
      </p>
    </div>
  );
}
