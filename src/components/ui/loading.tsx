import { cn } from "@/lib/utils";

export function Loading({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center py-12", className)}>
      <div className="w-6 h-6 border-2 border-coral border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
