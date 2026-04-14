/**
 * Merges optional "You" profile (LeftSidebar → settings) into chat system instructions.
 * Client sends the same shape as `loadYouProfile()` in `dashboard-ui/profile/youStorage.ts`.
 */

export type UserProfilePayload = {
  name?: string;
  jobTitle?: string;
  favoriteThings?: string;
};

function formatUserProfileBlock(profile: UserProfilePayload | undefined | null): string {
  if (!profile) return "";
  const name = typeof profile.name === "string" ? profile.name.trim() : "";
  const job = typeof profile.jobTitle === "string" ? profile.jobTitle.trim() : "";
  const rawLines =
    typeof profile.favoriteThings === "string"
      ? profile.favoriteThings
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
      : [];
  if (!name && !job && rawLines.length === 0) return "";

  const lines: string[] = [
    "[End-user profile — personalization]",
    "The person using the app shared this in “Your profile”. Use it to address them naturally, tailor nonprofit examples to their background when helpful, and respect stated interests. Do not invent biographical facts beyond this block.",
  ];
  if (name) lines.push(`Preferred name: ${name}`);
  if (job) lines.push(`Role / professional context: ${job}`);
  if (rawLines.length) {
    lines.push("Skills, interests, or facts they asked you to remember:");
    for (const l of rawLines) lines.push(`- ${l}`);
  }
  return lines.join("\n");
}

/** Appends a profile section to the nonprofit agent system prompt when any field is non-empty. */
export function mergeNonprofitSystemWithUserProfile(
  baseSystem: string,
  profile: UserProfilePayload | undefined | null,
): string {
  const block = formatUserProfileBlock(profile);
  if (!block) return baseSystem;
  return `${baseSystem}\n\n${block}`;
}

/** Safe parse from POST JSON (untrusted client). */
export function parseUserProfilePayload(raw: unknown): UserProfilePayload | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const name = o.name;
  const jobTitle = o.jobTitle;
  const favoriteThings = o.favoriteThings;
  const out: UserProfilePayload = {};
  if (typeof name === "string") out.name = name;
  if (typeof jobTitle === "string") out.jobTitle = jobTitle;
  if (typeof favoriteThings === "string") out.favoriteThings = favoriteThings;
  if (Object.keys(out).length === 0) return undefined;
  return out;
}
