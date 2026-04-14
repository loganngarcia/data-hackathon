"use client";

import { useCallback, useState } from "react";
import { resolveLogoDevImageUrl } from "@/lib/logo-dev";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

type Props = {
  organizationName: string;
  /** Domain only, e.g. `example.org` (from TEOS `website_txt`). */
  websiteDomain: string;
  /** D1 `org_logo_cache.logo_domain` — from IRS website or Logo.dev Brand Search warm. */
  cachedLogoDomain?: string;
  /** Prefer this when set — full URL from Worker (`logo_image_url`) so Vercel does not need Logo.dev keys. */
  logoImageUrl?: string;
};

export function OrgLogoAvatar({
  organizationName,
  websiteDomain,
  cachedLogoDomain,
  logoImageUrl,
}: Props) {
  const [failed, setFailed] = useState(false);
  const src =
    logoImageUrl?.trim() ||
    resolveLogoDevImageUrl(organizationName, websiteDomain, cachedLogoDomain, {
      size: 72,
      retina: true,
    });
  const showLogo = Boolean(src) && !failed;

  const onError = useCallback(() => setFailed(true), []);

  return (
    <div className="tp-org-avatar" aria-hidden>
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element -- Logo.dev CDN; dynamic signed URL
        <img
          src={src!}
          alt=""
          width={36}
          height={36}
          className="tp-org-avatar-img"
          loading="lazy"
          decoding="async"
          onError={onError}
        />
      ) : (
        initials(organizationName)
      )}
    </div>
  );
}
