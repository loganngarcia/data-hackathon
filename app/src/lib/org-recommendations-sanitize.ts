/**
 * Remove methodology disclaimers from scenario narrative (model sometimes appended these;
 * also applied on display so cached responses stay clean).
 */
export function sanitizeScenarioNarrative(narrative: string): string {
  const stripped = narrative
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((sent) => {
      const t = sent.toLowerCase().replace(/\*/g, "");
      if (t.includes("assumptions here") && t.includes("illustrative")) return false;
      if (t.includes("illustrative") && t.includes("not a prediction")) return false;
      if (t.includes("extracted figures") && t.includes("peer comparison")) return false;
      return true;
    });
  return stripped.join(" ").replace(/\s{2,}/g, " ").trim();
}
