/** Normalize TEOS / free-text website fields into a safe https URL for links. */
export function normalizeWebsiteUrl(raw: string | null | undefined): string | undefined {
  const t = typeof raw === "string" ? raw.trim() : "";
  if (!t) return undefined;
  let candidate = t;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate.replace(/^\/+/, "")}`;
  }
  try {
    const u = new URL(candidate);
    if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
    if (u.hostname.length < 3) return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

/** Domain only for Logo.dev / display, e.g. `example.org`. */
export function websiteUrlToDomain(url: string | undefined): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
