/** Logo.dev image CDN — https://www.logo.dev/ (publishable key safe for client). */

export function normalizeWebsiteDomain(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

/**
 * Returns `img.logo.dev` URL or `null` if `NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY` is unset.
 * Get a key at https://www.logo.dev/ → API keys (publishable `pk_…`).
 */
export function logoDevImageUrl(
  domain: string,
  opts?: { size?: number; retina?: boolean },
): string | null {
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY;
  if (!token) return null;
  const host = normalizeWebsiteDomain(domain);
  if (!host || !/^[\w.-]+$/.test(host)) return null;
  const size = opts?.size ?? 72;
  const params = new URLSearchParams({
    token,
    size: String(size),
    format: "png",
  });
  if (opts?.retina) params.set("retina", "true");
  return `https://img.logo.dev/${encodeURIComponent(host)}?${params.toString()}`;
}
