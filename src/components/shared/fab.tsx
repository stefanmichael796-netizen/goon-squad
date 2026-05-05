"use client";

import { Plus } from "lucide-react";

interface FabProps {
  onClick: () => void;
}

export function Fab({ onClick }: FabProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-4 z-40 w-14 h-14 rounded-full bg-coral text-white shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
      aria-label="Log book"
    >
      <Plus className="w-6 h-6" />
    </button>
  );
}
