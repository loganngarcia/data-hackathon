/**
 * TEOS portfolio org ids: `irs990-<return_pk>` (digits) or legacy `irs990-ein-<9 digits>`.
 */

export function parseTeosOrgIdParam(orgId: string): { returnPk?: string; ein?: string } {
  const s = orgId.trim();
  if (s.startsWith("irs990-ein-")) {
    const d = s.slice("irs990-ein-".length).replace(/\D/g, "").slice(0, 9);
    return d.length === 9 ? { ein: d } : {};
  }
  if (s.startsWith("irs990-")) {
    const rest = s.slice("irs990-".length);
    if (/^\d+$/.test(rest)) return { returnPk: rest };
  }
  return {};
}

function returnPkFromRowId(id: string): string | undefined {
  const s = id.trim();
  if (!s.startsWith("irs990-")) return undefined;
  const rest = s.slice("irs990-".length);
  if (/^\d+$/.test(rest)) return rest;
  return undefined;
}

/** True if `row` is the org referenced by deep-link `orgParam` (canonical id or ein-only alias). */
export function rowsMatchDeepLink(
  row: { id: string; ein: string },
  orgParam: string,
): boolean {
  if (row.id === orgParam) return true;
  const want = parseTeosOrgIdParam(orgParam);
  if (want.returnPk) {
    const pk = returnPkFromRowId(row.id);
    if (pk && pk === want.returnPk) return true;
  }
  if (want.ein) {
    const digits = row.ein.replace(/\D/g, "").slice(0, 9);
    if (digits === want.ein) return true;
  }
  return false;
}

/** Safe in-app path for chat return (open redirect hardening). */
export function sanitizeReturnChatParam(raw: string | null): string | null {
  if (!raw?.trim()) return null;
  try {
    const path = decodeURIComponent(raw).trim();
    if (!path.startsWith("/c/")) return null;
    if (path.includes("..") || path.includes("//")) return null;
    if (path.length > 256) return null;
    if (!/^\/c\/[0-9a-f-]{10,128}$/i.test(path)) return null;
    return path;
  } catch {
    return null;
  }
}
