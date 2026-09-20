"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastType = "error" | "success" | "info";
interface ToastItem { id: number; message: string; type: ToastType; }

const ToastContext = createContext<(message: string, type?: ToastType) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const show = useCallback((message: string, type: ToastType = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="fixed bottom-4 inset-x-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none">
        {toasts.map((t) => {
          const Icon = t.type === "error" ? AlertCircle : t.type === "success" ? CheckCircle2 : Info;
          const accent =
            t.type === "error" ? "text-red-500" : t.type === "success" ? "text-green-500" : "text-[var(--accent)]";
          return (
            <div
              key={t.id}
              role={t.type === "error" ? "alert" : "status"}
              aria-live={t.type === "error" ? "assertive" : "polite"}
              onClick={() => dismiss(t.id)}
              className="pointer-events-auto max-w-sm w-full flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-lg text-sm text-[var(--foreground)] animate-fade-in cursor-pointer"
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${accent}`} />
              <span className="flex-1">{t.message}</span>
              <X className="w-3.5 h-3.5 text-[var(--muted)] flex-shrink-0" />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
