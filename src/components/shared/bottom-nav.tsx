"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, BookMarked, BarChart3 } from "lucide-react";
import { ThemeToggle } from "@/components/shared/theme-toggle";

const tabs = [
  { href: "/club", label: "Club", icon: Users },
  { href: "/personal", label: "Personal", icon: BookMarked },
  { href: "/insights", label: "Insights", icon: BarChart3 },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 bg-[var(--surface)] border-b border-[var(--border)] z-50">
      <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-2.5">
        <Link href="/club" className="font-serif font-bold text-lg text-coral hidden min-[420px]:block">
          Goon Squad
        </Link>
        <div className="flex items-center gap-0.5">
          {tabs.map((tab) => {
            const active = pathname.startsWith(tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-coral text-white"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className={active ? "inline" : "hidden min-[360px]:inline"}>{tab.label}</span>
              </Link>
            );
          })}
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
