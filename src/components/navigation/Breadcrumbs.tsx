"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  return (
    <nav className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
      <Link href="/" className="hover:text-[var(--color-text-primary)] transition-colors">
        <Home className="w-3.5 h-3.5" />
      </Link>
      {segments.map((segment, index) => {
        const href = "/" + segments.slice(0, index + 1).join("/");
        const isLast = index === segments.length - 1;
        const formatted = segment
          .replace(/-/g, " ")
          .replace(/^\[.*\]$/, (m) => m.slice(1, -1));

        return (
          <React.Fragment key={href}>
            <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            {isLast ? (
              <span className="font-medium text-[var(--color-text-primary)] capitalize">
                {formatted}
              </span>
            ) : (
              <Link href={href} className="hover:text-[var(--color-text-primary)] transition-colors capitalize">
                {formatted}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

