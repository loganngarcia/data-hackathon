/** Same rules as `app/src/lib/org-name-format.ts` — keep in sync for Worker JSON responses. */

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

export function formatCityDisplay(raw: string): string {
  const t = raw.trim();
  if (!t || t === EM_DASH) return t || EM_DASH;
  return toOrganizationTitleCase(t);
}

export function formatStateAbbrevDisplay(raw: string): string {
  const t = raw.trim();
  if (!t || t === EM_DASH) return t || EM_DASH;
  if (/^[A-Za-z]{2}$/.test(t)) return t.toUpperCase();
  return toOrganizationTitleCase(t);
}
