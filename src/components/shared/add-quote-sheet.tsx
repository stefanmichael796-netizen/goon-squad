"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface AddQuoteSheetProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  bookId: string;
  bookTitle: string;
  clubId?: string | null;
}

export function AddQuoteSheet({ open, onClose, onSuccess, bookId, bookTitle, clubId }: AddQuoteSheetProps) {
  const [body, setBody] = useState("");
  const [pageNumber, setPageNumber] = useState("");
  const [note, setNote] = useState("");
  const [shareToClub, setShareToClub] = useState(!!clubId);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setBody("");
      setPageNumber("");
      setNote("");
      setShareToClub(!!clubId);
    }
  }, [open, clubId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSaving(true);

    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId,
          body: body.trim(),
          pageNumber: pageNumber ? parseInt(pageNumber) : null,
          note: note.trim() || null,
          clubId: shareToClub ? clubId : null,
        }),
      });

      if (res.ok) {
        onSuccess();
        onClose();
      }
    } catch {
      // handle error
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
            Add quote
          </h2>
          <button onClick={onClose} className="p-1 text-[var(--muted)] hover:text-[var(--foreground)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <p className="text-sm text-[var(--muted)]">
            From <span className="font-serif italic text-[var(--foreground)]">{bookTitle}</span>
          </p>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Passage
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="The words that stuck"
              rows={4}
              required
              className="w-full px-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-coral/50 resize-none font-serif"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Page number
            </label>
            <input
              type="number"
              value={pageNumber}
              onChange={(e) => setPageNumber(e.target.value)}
              placeholder="Optional"
              min={0}
              className="w-full px-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-coral/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Note
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why this stuck"
              rows={2}
              className="w-full px-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-coral/50 resize-none"
            />
          </div>

          {clubId && (
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-[var(--foreground)]">
                Share to club?
              </label>
              <button
                type="button"
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

          <button
            type="submit"
            disabled={saving || !body.trim()}
            className="w-full py-3 rounded-lg bg-coral text-white font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save quote"}
          </button>
        </form>
      </div>
    </div>
  );
}
