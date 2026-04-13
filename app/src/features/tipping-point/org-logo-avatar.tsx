"use client";

import { useCallback, useState } from "react";
import { logoDevImageUrl } from "@/lib/logo-dev";

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
  /** Domain only, e.g. `example.org` (from org website). */
  websiteDomain: string;
};

export function OrgLogoAvatar({ organizationName, websiteDomain }: Props) {
  const [failed, setFailed] = useState(false);
  const src = logoDevImageUrl(websiteDomain, { size: 72, retina: true });
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
