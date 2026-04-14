/**
 * Display formatting for legal / IRS organization names: trim, collapse spaces, title case.
 * Splits on whitespace; preserves hyphenated and apostrophe segments (e.g. O'Brien, Non-Profit).
 */

function capitalizeSegment(segment: string): string {
  if (!segment) return segment;
  return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
}

function titleCaseWord(word: string): string {
  if (!word) return word;
  return word
    .split("-")
    .map((p) => p.split("'").map(capitalizeSegment).join("'"))
    .join("-");
}

export function toOrganizationTitleCase(raw: string): string {
  const s = raw.trim().replace(/\s+/g, " ");
  if (!s) return "";
  return s.split(/\s+/).map(titleCaseWord).join(" ");
}

const EM_DASH = "\u2014";

/** City line on screener rows — title case (e.g. San Diego). Preserves placeholder em dash. */
export function formatCityDisplay(raw: string): string {
  const t = raw.trim();
  if (!t || t === EM_DASH) return t || EM_DASH;
  return toOrganizationTitleCase(t);
}

/**
 * US state: two-letter codes as uppercase (CA); full names title-cased; preserves em dash.
 */
export function formatStateAbbrevDisplay(raw: string): string {
  const t = raw.trim();
  if (!t || t === EM_DASH) return t || EM_DASH;
  if (/^[A-Za-z]{2}$/.test(t)) return t.toUpperCase();
  return toOrganizationTitleCase(t);
}
