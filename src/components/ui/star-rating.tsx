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

  function handleClick(star: number, isHalf: boolean) {
    if (readonly || !onChange) return;
    const newRating = isHalf ? star - 0.5 : star;
    onChange(newRating === rating ? 0 : newRating);
  }

  return (
    <div
      className={cn("flex gap-0.5 select-none", starSizes[size])}
      onMouseLeave={() => !readonly && setHoverRating(null)}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = displayRating >= star;
        const halfFilled = !filled && displayRating >= star - 0.5;

        return (
          <div key={star} className="relative cursor-pointer">
            <div
              className="absolute inset-0 w-1/2"
              onMouseEnter={() => !readonly && setHoverRating(star - 0.5)}
              onClick={() => handleClick(star, true)}
            />
            <div
              className="absolute inset-0 left-1/2 w-1/2"
              onMouseEnter={() => !readonly && setHoverRating(star)}
              onClick={() => handleClick(star, false)}
            />
            <span
              className={cn(
                "transition-colors",
                filled
                  ? "text-coral"
                  : halfFilled
                  ? "text-coral"
                  : "text-[var(--border)]",
                !readonly && "hover:scale-110 active:scale-95"
              )}
            >
              {filled ? "★" : halfFilled ? "⯨" : "☆"}
            </span>
          </div>
        );
      })}
      {size !== "sm" && rating > 0 && (
        <span className="text-sm self-center ml-1 text-[var(--muted)]">
          {rating}
        </span>
      )}
    </div>
  );
}
