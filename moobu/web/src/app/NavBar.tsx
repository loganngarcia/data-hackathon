"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavBar() {
  const pathname = usePathname();

  const linkClass = (href: string) => {
    const isActive =
      href === "/"
        ? pathname === "/"
        : pathname.startsWith(href);
    return `text-sm relative pb-1 transition-colors ${
      isActive ? "nav-link-active" : "text-muted hover:text-foreground"
    }`;
  };

  return (
    <nav className="bg-card px-6 py-3 flex items-center justify-between nav-shadow sticky top-0 z-50">
      <div className="flex items-center gap-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-moobu-blue tracking-tight">
            Fairlight
          </span>
          <span className="text-[10px] font-medium text-muted bg-moobu-blue-light px-1.5 py-0.5 rounded">
            ADVISORS
          </span>
        </Link>
        <div className="flex gap-5">
          <Link href="/" className={linkClass("/")}>
            Portfolio X-Ray
          </Link>
          <Link href="/hidden-gems" className={linkClass("/hidden-gems")}>
            Hidden Gems
          </Link>
          <Link href="/at-risk" className={linkClass("/at-risk")}>
            Risk Monitor
          </Link>
        </div>
      </div>
      <span className="text-xs text-muted">
        Nonprofit Financial Resilience Platform
      </span>
    </nav>
  );
}
