/**
 * Logo.dev image CDN URLs — built on the Worker using `LOGO_DEV_PUBLISHABLE_KEY` (pk_…)
 * so the Next.js app does not need `NEXT_PUBLIC_LOGO_DEV_*`; D1 remains source of domain truth.
 */

export function normalizeWebsiteDomain(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

function logoDevImageUrl(
  domain: string,
  publishableKey: string,
  opts?: { size?: number; retina?: boolean },
): string | null {
  const host = normalizeWebsiteDomain(domain);
  if (!host || !/^[\w.-]+$/.test(host)) return null;
  const size = opts?.size ?? 72;
  const params = new URLSearchParams({
    token: publishableKey,
    size: String(size),
    format: "png",
  });
  if (opts?.retina) params.set("retina", "true");
  return `https://img.logo.dev/${encodeURIComponent(host)}?${params.toString()}`;
}

function logoDevImageUrlByBrandName(
  brandName: string,
  publishableKey: string,
  opts?: { size?: number; retina?: boolean },
): string | null {
  const name = brandName.trim();
  if (name.length < 2 || name.length > 200) return null;
  const size = opts?.size ?? 72;
  const params = new URLSearchParams({
    token: publishableKey,
    size: String(size),
    format: "png",
  });
  if (opts?.retina) params.set("retina", "true");
  return `https://img.logo.dev/name/${encodeURIComponent(name)}?${params.toString()}`;
}

/** Prefer TEOS website, then D1 `org_logo_cache`, then name-based Logo.dev endpoint. */
export function resolveLogoDevImageUrl(
  organizationName: string,
  websiteTxt: string,
  cachedLogoDomain: string | undefined,
  publishableKey: string,
  opts?: { size?: number; retina?: boolean },
): string | null {
  const fromSite = logoDevImageUrl(websiteTxt, publishableKey, opts);
  if (fromSite) return fromSite;
  const fromCache = logoDevImageUrl(cachedLogoDomain ?? "", publishableKey, opts);
  if (fromCache) return fromCache;
  return logoDevImageUrlByBrandName(organizationName, publishableKey, opts);
}
