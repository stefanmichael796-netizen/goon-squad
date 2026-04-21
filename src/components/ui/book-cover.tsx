"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface BookCoverProps {
  coverUrl: string | null | undefined;
  title: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizes = {
  sm: { width: 48, height: 72, class: "w-12 h-[72px]" },
  md: { width: 80, height: 120, class: "w-20 h-[120px]" },
  lg: { width: 120, height: 180, class: "w-[120px] h-[180px]" },
  xl: { width: 160, height: 240, class: "w-40 h-60" },
};

export function BookCover({ coverUrl, title, size = "md", className }: BookCoverProps) {
  const s = sizes[size];

  if (!coverUrl) {
    return (
      <div
        className={cn(
          s.class,
          "rounded-md bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center p-2 flex-shrink-0",
          className
        )}
      >
        <span className="text-xs text-[var(--muted)] font-serif text-center leading-tight line-clamp-3">
          {title}
        </span>
      </div>
    );
  }

  return (
    <div className={cn(s.class, "rounded-md overflow-hidden flex-shrink-0 shadow-sm", className)}>
      <Image
        src={coverUrl}
        alt={title}
        width={s.width}
        height={s.height}
        className="w-full h-full object-cover"
        unoptimized
      />
    </div>
  );
}
