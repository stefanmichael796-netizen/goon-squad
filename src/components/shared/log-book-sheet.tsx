"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { BookCover } from "@/components/ui/book-cover";
import { StarRating } from "@/components/ui/star-rating";
import { X, Search, Loader2 } from "lucide-react";
import type { GoogleBooksVolume } from "@/lib/types";

interface LogBookSheetProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clubId?: string | null;
  preSelectedBook?: { id: string; title: string; authors?: string[]; coverUrl?: string; pageCount?: number } | null;
  isReread?: boolean;
  preSelectedVolume?: GoogleBooksVolume | null;
}

export function LogBookSheet({ open, onClose, onSuccess, clubId, preSelectedBook, isReread, preSelectedVolume }: LogBookSheetProps) {
  const [step, setStep] = useState<"search" | "log">("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GoogleBooksVolume[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<GoogleBooksVolume | null>(null);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [shelf, setShelf] = useState<"reading" | "want" | "read">("read");
  const [progressPage, setProgressPage] = useState("");
  const [finishedYear, setFinishedYear] = useState("");
  const [finishedMonth, setFinishedMonth] = useState("");
  const [finishedDay, setFinishedDay] = useState("");
  const [shareToClub, setShareToClub] = useState(!!clubId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const supabase = createClient();

  useEffect(() => {
    if (!open) {
      setStep("search");
      setQuery("");
      setResults([]);
      setSelected(null);
      setRating(0);
      setReview("");
      setShelf("read");
      setProgressPage("");
      setFinishedYear("");
      setFinishedMonth("");
      setFinishedDay("");
      setShareToClub(!!clubId);
    } else if (preSelectedVolume) {
      setSelected(preSelectedVolume);
      setStep("log");
    } else if (preSelectedBook) {
      setSelected({
        id: preSelectedBook.id,
        volumeInfo: {
          title: preSelectedBook.title,
          authors: preSelectedBook.authors,
          imageLinks: preSelectedBook.coverUrl ? { thumbnail: preSelectedBook.coverUrl } : undefined,
          pageCount: preSelectedBook.pageCount,
        },
      } as unknown as GoogleBooksVolume);
      setStep("log");
      setShelf("read");
    }
  }, [open, clubId, preSelectedBook, preSelectedVolume]);

  async function handleSearch(q: string) {
    setQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (q.length < 2) {
      setResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/books/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data.items || []);
      } catch {
        setResults([]);
      }
      setSearching(false);
    }, 400);
  }

  function selectBook(volume: GoogleBooksVolume) {
    setSelected(volume);
    setStep("log");
  }

  async function handleSubmit() {
    if (!selected) return;
    setSaving(true);
    setError("");

    try {
      const payload: Record<string, unknown> = {
        rating: rating || null,
        review: review || null,
        shelf,
        progressPage: shelf === "reading" && progressPage ? parseInt(progressPage) : null,
        finishedDate: shelf === "read" && finishedYear
          ? `${finishedYear}-${finishedMonth || "01"}-${finishedDay || "01"}`
          : null,
        shareToClub,
        clubId: shareToClub ? clubId : null,
      };

      if (isReread && preSelectedBook) {
        payload.bookId = preSelectedBook.id;
        payload.isReread = true;
      } else {
        payload.googleBooksVolume = selected;
      }

      const res = await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        const data = await res.json();
        setError(data.details || data.error || "Failed to save");
      }
    } catch {
      setError("Network error. Try again.");
    }
    setSaving(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[var(--background)] rounded-t-2xl max-h-[85vh] overflow-y-auto animate-slide-up">
        <div className="sticky top-0 bg-[var(--background)] border-b border-[var(--border)] px-4 py-3 flex items-center justify-between z-10">
          <h2 className="font-serif font-semibold text-lg text-[var(--foreground)]">
            {step === "search" ? "Find a book" : isReread ? "Log re-read" : "Log it"}
          </h2>
          <button onClick={onClose} className="p-1 text-[var(--muted)] hover:text-[var(--foreground)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          {step === "search" && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-[var(--muted)]" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search by title or author"
                  autoFocus
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-coral/50"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-3 w-4 h-4 text-[var(--muted)] animate-spin" />
                )}
              </div>

              <div className="space-y-2">
                {results.map((vol) => (
                  <button
                    key={vol.id}
                    onClick={() => selectBook(vol)}
                    className="w-full flex gap-3 p-3 rounded-lg hover:bg-[var(--surface)] transition-colors text-left"
                  >
                    <BookCover
                      coverUrl={vol.volumeInfo.imageLinks?.thumbnail}
                      title={vol.volumeInfo.title}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-serif font-medium text-[var(--foreground)] truncate">
                        {vol.volumeInfo.title}
                      </p>
                      <p className="text-sm text-[var(--muted)]">
                        {vol.volumeInfo.authors?.join(", ")}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        {vol.volumeInfo.publishedDate}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === "log" && selected && (
            <div className="space-y-6">
              <div className="flex gap-4">
                <BookCover
                  coverUrl={selected.volumeInfo.imageLinks?.thumbnail}
                  title={selected.volumeInfo.title}
                  size="lg"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-serif font-semibold text-lg text-[var(--foreground)]">
                    {selected.volumeInfo.title}
                  </h3>
                  <p className="text-[var(--muted)]">
                    {selected.volumeInfo.authors?.join(", ")}
                  </p>
                  {selected.volumeInfo.pageCount && (
                    <p className="text-sm text-[var(--muted)] mt-1">
                      {selected.volumeInfo.pageCount} pages
                    </p>
                  )}
                  {!isReread && (
                    <button
                      onClick={() => setStep("search")}
                      className="text-sm text-coral mt-2 hover:underline"
                    >
                      Change book
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                  Rating
                </label>
                <StarRating rating={rating} onChange={setRating} size="lg" />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                  Review
                </label>
                <textarea
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  placeholder="A sentence or two is plenty."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-coral/50 resize-none font-serif"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                  Shelf
                </label>
                <div className="flex gap-2">
                  {(["reading", "want", "read"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setShelf(s)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        shelf === s
                          ? "bg-coral text-white"
                          : "bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)]"
                      }`}
                    >
                      {s === "want" ? "Want to read" : s === "reading" ? "Reading" : "Read"}
                    </button>
                  ))}
                </div>
              </div>

              {shelf === "reading" && (
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                    Current page
                  </label>
                  <input
                    type="number"
                    value={progressPage}
                    onChange={(e) => setProgressPage(e.target.value)}
                    placeholder="Optional"
                    min={0}
                    max={selected.volumeInfo.pageCount || 9999}
                    className="w-full px-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-coral/50"
                  />
                </div>
              )}

              {shelf === "read" && (
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                    When did you finish it?
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <input
                        type="number"
                        value={finishedYear}
                        onChange={(e) => setFinishedYear(e.target.value)}
                        placeholder="Year"
                        min={1900}
                        max={new Date().getFullYear()}
                        className="w-full px-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] text-center focus:outline-none focus:ring-2 focus:ring-coral/50"
                      />
                    </div>
                    <div className="flex-1">
                      <select
                        value={finishedMonth}
                        onChange={(e) => setFinishedMonth(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-coral/50"
                      >
                        <option value="">Month</option>
                        {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, i) => (
                          <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1">
                      <input
                        type="number"
                        value={finishedDay}
                        onChange={(e) => setFinishedDay(e.target.value)}
                        placeholder="Day"
                        min={1}
                        max={31}
                        className="w-full px-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] text-center focus:outline-none focus:ring-2 focus:ring-coral/50"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-[var(--muted)] mt-1">
                    Only year is needed. Leave blank for today.
                  </p>
                </div>
              )}

              {clubId && (
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-[var(--foreground)]">
                    Share to club?
                  </label>
                  <button
                    onClick={() => setShareToClub(!shareToClub)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      shareToClub ? "bg-coral" : "bg-[var(--border)]"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        shareToClub ? "left-[22px]" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>
              )}

              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}

              <button
                onClick={handleSubmit}
                disabled={saving}
                className="w-full py-3 rounded-lg bg-coral text-white font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saving..." : isReread ? "Log re-read" : "Log book"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
