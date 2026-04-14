"use client";

import { useEffect, useState } from "react";
import { normalizeWebsiteUrl } from "@/lib/website-url";

function sanitizeWebsiteHref(raw: string | null | undefined): string | null {
  const normalized = normalizeWebsiteUrl(raw ?? undefined);
  return normalized ?? null;
}

function GlobeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2 12H22"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 2C14.5013 4.73835 15.9228 8.29203 16 12C15.9228 15.708 14.5013 19.2616 12 22C9.49872 19.2616 8.07725 15.708 8 12C8.07725 8.29203 9.49872 4.73835 12 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Props = {
  ein: string;
  /** From TEOS row when already loaded; otherwise fetched from `/api/org-website` (Worker D1). */
  initialWebsiteUrl?: string;
};

/**
 * 36px pill: globe + “Website”, opens org site in a new tab. Renders nothing if D1 has no website.
 */
export function OrgWebsiteChip({ ein, initialWebsiteUrl }: Props) {
  const [href, setHref] = useState<string | null>(() => sanitizeWebsiteHref(initialWebsiteUrl));

  useEffect(() => {
    setHref(sanitizeWebsiteHref(initialWebsiteUrl));
  }, [ein, initialWebsiteUrl]);

  useEffect(() => {
    if (sanitizeWebsiteHref(initialWebsiteUrl)) return;
    let cancelled = false;
    const q = encodeURIComponent(ein);
    fetch(`/api/org-website?ein=${q}`)
      .then((r) => r.json())
      .then((body: { website?: string | null }) => {
        if (cancelled) return;
        const next = sanitizeWebsiteHref(body.website ?? undefined);
        if (next) setHref(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ein, initialWebsiteUrl]);

  if (!href) return null;

  return (
    <a className="tp-org-website-chip" href={href} target="_blank" rel="noopener noreferrer">
      <GlobeIcon />
      <span>Website</span>
    </a>
  );
}
