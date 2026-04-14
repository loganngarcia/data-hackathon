/**
 * Logo.dev image CDN — optional local/dev fallback when the Worker does not return `logoImageUrl`.
 * Production: set `LOGO_DEV_PUBLISHABLE_KEY` on the Cloudflare Worker so browse rows include `logo_image_url`.
 */

let devMissingLogoDevKeyLogged = false;

function publishableKey(): string | null {
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY?.trim();
  if (token) return token;
  if (
    process.env.NODE_ENV === "development" &&
    !devMissingLogoDevKeyLogged &&
    typeof window !== "undefined"
  ) {
    devMissingLogoDevKeyLogged = true;
    // eslint-disable-next-line no-console -- intentional once-per-session dev hint
    console.info(
      "[Tipping Point] Org avatars use Logo.dev when NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY is set (pk_… in app/.env.local). Without it, initials show. https://www.logo.dev/",
    );
  }
  return null;
}

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
  const token = publishableKey();
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

/**
 * Logo.dev “name” endpoint — resolves a brand via Brand Search and serves the top match’s logo.
 * @see https://docs.logo.dev/logo-images/name
 */
export function logoDevImageUrlByBrandName(
  brandName: string,
  opts?: { size?: number; retina?: boolean },
): string | null {
  const token = publishableKey();
  if (!token) return null;
  const name = brandName.trim();
  if (name.length < 2 || name.length > 200) return null;
  const size = opts?.size ?? 72;
  const params = new URLSearchParams({
    token,
    size: String(size),
    format: "png",
  });
  if (opts?.retina) params.set("retina", "true");
  return `https://img.logo.dev/name/${encodeURIComponent(name)}?${params.toString()}`;
}

/** Prefer verified website domain, then D1-cached domain from Brand Search, then name lookup. */
export function resolveLogoDevImageUrl(
  organizationName: string,
  websiteDomain: string,
  cachedLogoDomain: string | undefined,
  opts?: { size?: number; retina?: boolean },
): string | null {
  const fromSite = logoDevImageUrl(websiteDomain, opts);
  if (fromSite) return fromSite;
  const fromCache = logoDevImageUrl(cachedLogoDomain ?? "", opts);
  if (fromCache) return fromCache;
  return logoDevImageUrlByBrandName(organizationName, opts);
}
