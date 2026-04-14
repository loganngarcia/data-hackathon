"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavBar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const linkClass = (href: string) =>
    `text-sm pb-3 ${
      isActive(href)
        ? "nav-link-active"
        : "text-ink-tertiary hover:text-ink"
    }`;

  return (
    <nav
      className="bg-paper-raised px-6 flex items-center justify-between sticky top-0 z-50"
      style={{
        height: 48,
        borderBottom: "1px solid var(--boundary)",
      }}
    >
      <div className="flex items-center gap-8">
        <Link href="/" className="flex items-baseline gap-1.5">
          <span className="text-base text-ink" style={{ fontWeight: 600 }}>
            Fairlight
          </span>
          <span
            className="text-ink-tertiary"
            style={{
              fontSize: 9,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
            }}
          >
            Advisors
          </span>
        </Link>
        <div className="flex gap-5 items-end h-full">
          <Link href="/" className={linkClass("/")}>
            Portfolio
          </Link>
          <Link href="/hidden-gems" className={linkClass("/hidden-gems")}>
            Hidden Gems
          </Link>
          <Link href="/at-risk" className={linkClass("/at-risk")}>
            Risk Monitor
          </Link>
        </div>
      </div>
      <span className="text-xs text-ink-muted">
        Nonprofit Resilience Platform
      </span>
    </nav>
  );
}
