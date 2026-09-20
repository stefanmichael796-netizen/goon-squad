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

// A subtle spine + page-edge treatment shared by real and placeholder covers,
// so every cover reads as a physical book rather than a flat rectangle.
function Spine() {
  return (
    <>
      {/* soft shadow down the spine (left edge) */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-[9%] bg-gradient-to-r from-black/25 via-black/10 to-transparent"
      />
      {/* thin highlight just inside the spine */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-[9%] w-px bg-white/25"
      />
      {/* faint sheen across the whole cover */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-transparent to-white/10"
      />
    </>
  );
}

export function BookCover({ coverUrl, title, size = "md", className }: BookCoverProps) {
  const s = sizes[size];

  if (!coverUrl) {
    return (
      <div
        className={cn(
          s.class,
          "relative rounded-[3px] book-shadow overflow-hidden flex-shrink-0 flex items-center justify-center p-2",
          "bg-gradient-to-br from-[var(--accent)] to-[color-mix(in_srgb,var(--accent)_70%,black)]",
          className
        )}
      >
        <span className="relative z-10 text-xs text-white/90 font-serif text-center leading-tight line-clamp-4">
          {title}
        </span>
        <Spine />
      </div>
    );
  }

  return (
    <div
      className={cn(
        s.class,
        "relative rounded-[3px] book-shadow overflow-hidden flex-shrink-0",
        className
      )}
    >
      <Image
        src={coverUrl}
        alt={title}
        width={s.width}
        height={s.height}
        className="w-full h-full object-cover"
        unoptimized
      />
      <Spine />
    </div>
  );
}
