"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/personal", label: "Personal", icon: BookOpen },
  { href: "/club", label: "Club", icon: Users },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 bg-[var(--surface)] border-b border-[var(--border)] z-50">
      <div className="max-w-lg mx-auto flex">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors",
                active ? "text-coral" : "text-[var(--muted)]"
              )}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
