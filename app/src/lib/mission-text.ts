/**
 * Normalize IRS/TEOS mission text for display: trim, paragraph breaks, sentence case
 * when the source is mostly ALL CAPS.
 */
export function formatOrgMissionDescription(raw: string | null | undefined): string | undefined {
  const t = typeof raw === "string" ? raw.trim() : "";
  if (!t) return undefined;

  let s = t.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ");
  const paras = s
    .split(/\n\n+/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (paras.length === 0) return undefined;

  const out = paras.map((p) => sentenceCaseIfShouting(p)).join("\n\n");
  return out || undefined;
}

/** Heuristic: if very few lowercase letters, treat as ALL CAPS / title case from IRS. */
function sentenceCaseIfShouting(text: string): string {
  const letters = text.replace(/[^a-zA-Z]/g, "");
  if (letters.length === 0) return text;
  const lowerCount = (letters.match(/[a-z]/g) ?? []).length;
  const ratio = lowerCount / letters.length;
  if (ratio > 0.35) {
    return text.trim();
  }
  return sentenceCaseParagraph(text);
}

function sentenceCaseParagraph(text: string): string {
  let s = text.trim().replace(/\s+/g, " ");
  if (!s) return "";
  s = s.toLowerCase();
  s = s.charAt(0).toUpperCase() + s.slice(1);
  s = s.replace(/([.!?]\s+)([a-z])/g, (_, punct: string, c: string) => punct + c.toUpperCase());
  return s;
}

/** Prefer the richer IRS activity/mission line when both exist. */
export function pickMissionRaw(
  activityMissionDesc: string | null | undefined,
  missionDesc: string | null | undefined,
): string | undefined {
  const a = typeof activityMissionDesc === "string" ? activityMissionDesc.trim() : "";
  const m = typeof missionDesc === "string" ? missionDesc.trim() : "";
  if (a && m) return a.length >= m.length ? a : m;
  if (a) return a;
  if (m) return m;
  return undefined;
}
