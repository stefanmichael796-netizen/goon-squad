"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number;
  onChange?: (rating: number) => void;
  size?: "sm" | "md" | "lg";
  readonly?: boolean;
}

const starSizes = {
  sm: "text-sm",
  md: "text-2xl",
  lg: "text-4xl",
};

export function StarRating({ rating, onChange, size = "md", readonly = false }: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const displayRating = hoverRating ?? rating;

  function handleStarClick(star: number, isHalf: boolean) {
    if (readonly || !onChange) return;
    const newRating = isHalf ? star - 0.5 : star;
    onChange(newRating === rating ? 0 : newRating);
  }

  function handleInputChange(value: string) {
    if (readonly || !onChange) return;
    const num = parseFloat(value);
    if (isNaN(num)) return;
    onChange(Math.min(5, Math.max(0, Math.round(num * 10) / 10)));
  }

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn("flex gap-0.5 select-none", starSizes[size])}
        onMouseLeave={() => !readonly && setHoverRating(null)}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = displayRating >= star;
          const partialFill = !filled && displayRating > star - 1;
          const fillPct = partialFill ? (displayRating - (star - 1)) * 100 : 0;

          return (
            <div key={star} className="relative cursor-pointer">
              <div
                className="absolute inset-0 w-1/2 z-10"
                onMouseEnter={() => !readonly && setHoverRating(star - 0.5)}
                onClick={() => handleStarClick(star, true)}
              />
              <div
                className="absolute inset-0 left-1/2 w-1/2 z-10"
                onMouseEnter={() => !readonly && setHoverRating(star)}
                onClick={() => handleStarClick(star, false)}
              />
              {filled ? (
                <span className={cn("text-ochre transition-colors", !readonly && "hover:scale-110 active:scale-95")}>★</span>
              ) : partialFill ? (
                <span className="relative">
                  <span className="text-[var(--border)]">☆</span>
                  <span
                    className="absolute inset-0 overflow-hidden text-ochre"
                    style={{ width: `${fillPct}%` }}
                  >★</span>
                </span>
              ) : (
                <span className={cn("text-[var(--border)] transition-colors", !readonly && "hover:scale-110 active:scale-95")}>☆</span>
              )}
            </div>
          );
        })}
      </div>
      {!readonly && onChange && size !== "sm" && (
        <input
          type="number"
          min={0}
          max={5}
          step={0.1}
          value={rating || ""}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder="0.0"
          className="w-16 px-2 py-1 text-sm rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] text-center focus:outline-none focus:ring-2 focus:ring-coral/50"
        />
      )}
      {readonly && size !== "sm" && rating > 0 && (
        <span className="text-sm text-[var(--muted)]">{rating}</span>
      )}
    </div>
  );
}
