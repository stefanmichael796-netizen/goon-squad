"use client";

import Image from "next/image";

const FALLBACK_PALETTE = [
  "#C65D3E", // terracotta
  "#5C2A4A", // aubergine
  "#CC8E35", // ochre
  "#6B4226", // umber
  "#3D5A3E", // sage
  "#8A6B45", // sienna
  "#4A3728", // espresso
  "#7A4B3A", // clay
] as const;

function pickColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length];
}

function surname(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1];
}

interface BookCoverProps {
  coverUrl?: string | null;
  title: string;
  author?: string | null;
  bookId?: string;
  size?: "tile" | "detail";
  transitionName?: string;
  className?: string;
}

const dimensions = {
  tile: "aspect-[2/3] w-full",
  detail: "w-[150px] aspect-[2/3]",
};

export function BookCover({
  coverUrl,
  title,
  author,
  bookId,
  size = "tile",
  transitionName,
  className,
}: BookCoverProps) {
  const style: React.CSSProperties = {};
  if (transitionName) {
    (style as Record<string, string>)["viewTransitionName"] = transitionName;
  }

  const dim = dimensions[size];

  if (coverUrl) {
    return (
      <div
        className={`${dim} rounded overflow-hidden flex-shrink-0 ${className ?? ""}`}
        style={style}
      >
        <Image
          src={coverUrl}
          alt={title}
          width={size === "detail" ? 150 : 160}
          height={size === "detail" ? 225 : 240}
          className="w-full h-full object-cover"
          unoptimized
        />
      </div>
    );
  }

  const bg = pickColor(bookId || title);
  const authorSurname = author ? surname(author) : null;

  return (
    <div
      className={`${dim} rounded overflow-hidden flex-shrink-0 flex flex-col justify-end p-3 ${className ?? ""}`}
      style={{ backgroundColor: bg, ...style }}
    >
      <hr
        className="border-0 mb-2"
        style={{
          height: "1px",
          width: "28px",
          backgroundColor: "rgba(255,255,255,0.4)",
        }}
      />
      <p
        className="font-serif leading-tight text-white/90"
        style={{ fontSize: "17px" }}
      >
        {title}
      </p>
      {authorSurname && (
        <p
          className="mt-auto pt-2 uppercase tracking-wider text-white/50"
          style={{ fontSize: "10px" }}
        >
          {authorSurname}
        </p>
      )}
    </div>
  );
}
