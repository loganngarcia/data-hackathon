import type { OrgOutreachPersonDraft } from "@/lib/org-outreach-types";

const EM_DASH = "\u2014";

export type OrgOutreachFallbackContext = {
  organizationName: string;
  city: string;
  state: string;
  missionSummary: string;
  orgPhone?: string | null;
  orgEmail?: string | null;
};

/** US-focused: digits → E.164 +1… for `tel:` hrefs; returns null if unusable */
export function normalizePhoneToTel(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  const d = phone.replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  if (d.length >= 10 && d.length <= 15 && !d.startsWith("0")) return `+${d}`;
  return null;
}

function slugDomain(orgName: string): string {
  const s = orgName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .replace(/^(the|a|an)+/g, "")
    .slice(0, 40);
  return s || "nonprofit";
}

/**
 * Ready-made outreach draft so mailto/tel work before AI returns.
 * Uses org main email/phone when present; otherwise a generic info@… address (mailto still opens).
 */
export function buildFallbackOutreachDraft(
  person: { displayName: string },
  ctx: OrgOutreachFallbackContext,
): OrgOutreachPersonDraft {
  const org = ctx.organizationName.trim();
  const loc = `${ctx.city}, ${ctx.state}`;
  const who = person.displayName.trim() || "there";
  const greeting = `Dear ${who},`;

  const mission = ctx.missionSummary.trim();
  const hasMission = Boolean(mission && mission !== EM_DASH && mission.length > 8);

  const bodyLines: string[] = [
    greeting,
    "",
    `I'm reaching out regarding ${org} (${loc}).`,
    "",
  ];
  if (hasMission) {
    bodyLines.push(
      `I read about your mission and would welcome a brief conversation when convenient.`,
      "",
    );
  } else {
    bodyLines.push(`I'd welcome a brief conversation about your work when convenient.`, "");
  }
  bodyLines.push("Thank you,");

  const emailBody = bodyLines.join("\n");

  const domain = slugDomain(org);
  const rawOrgEmail = ctx.orgEmail?.trim();
  const contactEmail =
    rawOrgEmail && rawOrgEmail.includes("@") && rawOrgEmail.includes(".")
      ? rawOrgEmail
      : `info@${domain}.org`;

  const phoneTel = normalizePhoneToTel(ctx.orgPhone) ?? "";

  return {
    contactEmail,
    phoneTel,
    emailSubject: `Introduction — ${org}`,
    emailBody,
  };
}

/**
 * Fix model output so mailto bodies use real newlines (JSON may contain literal \\n,
 * or a single long paragraph that should break for readability).
 */
export function normalizeOutreachEmailBody(body: string): string {
  let t = body.replace(/\r\n/g, "\n").trim();
  if (t.includes("\\n")) {
    t = t
      .split("\\n")
      .map((line) => line.trimEnd())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n");
  }
  if (!/\n/.test(t) && t.length > 80) {
    t = t.replace(/([.!?])\s+(?=[A-Z0-9"'(])/g, "$1\n\n");
  }
  return t.replace(/\n{3,}/g, "\n\n").trim();
}
