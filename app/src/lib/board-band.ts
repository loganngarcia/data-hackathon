/**
 * Governing-body / board size bands (TEOS `governing_body_voting_cnt` with fallback to `voting_members_governing_cnt`).
 */
export const BOARD_BAND_IDS = ["all", "0_3", "4", "5", "6", "7", "8p"] as const;

export type BoardBandId = (typeof BOARD_BAND_IDS)[number];

export const BOARD_BAND_MENU_LABELS: Record<Exclude<BoardBandId, "all">, string> = {
  "0_3": "0–3 members",
  "4": "4 members",
  "5": "5 members",
  "6": "6 members",
  "7": "7 members",
  "8p": "8+ members",
};

export function isBoardBandId(s: string): s is BoardBandId {
  return (BOARD_BAND_IDS as readonly string[]).includes(s);
}

export function parseBoardBandQuery(param: string | null): BoardBandId {
  if (!param?.trim()) return "all";
  const id = param.trim();
  if (isBoardBandId(id)) return id;
  return "all";
}
