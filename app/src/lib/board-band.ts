/**
 * Governing-body / board size bands (TEOS `governing_body_voting_cnt` with fallback to `voting_members_governing_cnt`).
 */
export const BOARD_BAND_IDS = ["all", "0_3", "4", "5", "6", "7", "8p"] as const;

export type BoardBandId = (typeof BOARD_BAND_IDS)[number];

export const BOARD_BAND_MENU_LABELS: Record<Exclude<BoardBandId, "all">, string> = {
  "0_3": "0–3 board members",
  "4": "4 board members",
  "5": "5 board members",
  "6": "6 board members",
  "7": "7 board members",
  "8p": "8+ board members",
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

/** Toolbar order (excluding `all`) — used to fill gaps when adding non-adjacent board bands. */
export const BOARD_BAND_MENU_ORDER: Exclude<BoardBandId, "all">[] = ["0_3", "4", "5", "6", "7", "8p"];

export type BoardBandSelection = Exclude<BoardBandId, "all">[];

/** Expand to every band between min and max index in `BOARD_BAND_MENU_ORDER` (contiguous hull). */
export function expandBoardBandSelection(selected: BoardBandSelection): BoardBandSelection {
  if (selected.length === 0) return [];
  const order = BOARD_BAND_MENU_ORDER;
  const idx = selected.map((id) => order.indexOf(id)).filter((i) => i >= 0);
  if (idx.length === 0) return [];
  const lo = Math.min(...idx);
  const hi = Math.max(...idx);
  return order.slice(lo, hi + 1);
}

export function parseBoardBandsQuery(param: string | null): BoardBandSelection {
  if (!param?.trim()) return [];
  const out: BoardBandSelection = [];
  for (const part of param.split(",")) {
    const id = part.trim();
    if (id === "all") continue;
    if (isBoardBandId(id) && id !== "all") out.push(id);
  }
  return [...new Set(out)];
}

/** Short token for chip (not the full menu sentence). */
function boardBandShortToken(id: Exclude<BoardBandId, "all">): string {
  switch (id) {
    case "0_3":
      return "0–3";
    case "4":
      return "4";
    case "5":
      return "5";
    case "6":
      return "6";
    case "7":
      return "7";
    case "8p":
      return "8+";
    default:
      return id;
  }
}

function bandNumericLow(id: Exclude<BoardBandId, "all">): number {
  switch (id) {
    case "0_3":
      return 0;
    case "4":
      return 4;
    case "5":
      return 5;
    case "6":
      return 6;
    case "7":
      return 7;
    case "8p":
      return 8;
    default:
      return 0;
  }
}

function bandNumericHigh(id: Exclude<BoardBandId, "all">): number | null {
  switch (id) {
    case "0_3":
      return 3;
    case "4":
      return 4;
    case "5":
      return 5;
    case "6":
      return 6;
    case "7":
      return 7;
    case "8p":
      return null;
    default:
      return null;
  }
}

/** Chip label: compact ranges (e.g. `5–8+ board members`) instead of repeating long menu text. */
export function formatBoardBandSelectionChip(ids: BoardBandSelection): string {
  if (ids.length === 0) return "Board";
  if (ids.length === 1) return BOARD_BAND_MENU_LABELS[ids[0]];
  const order = BOARD_BAND_MENU_ORDER;
  const sorted = [...ids].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const idxs = sorted.map((id) => order.indexOf(id));
  let contiguous = true;
  for (let i = 1; i < idxs.length; i++) {
    if (idxs[i] !== idxs[i - 1] + 1) {
      contiguous = false;
      break;
    }
  }
  if (!contiguous) {
    return `${sorted.map((id) => boardBandShortToken(id)).join(", ")} board members`;
  }
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const lo = bandNumericLow(first);
  const hi = bandNumericHigh(last);
  if (hi === null) {
    return `${lo}–8+ board members`;
  }
  if (first === "0_3") {
    return `0–${hi} board members`;
  }
  return `${lo}–${hi} board members`;
}

/** Whether governing-body count `b` satisfies at least one selected band (OR). */
/**
 * Toggle a band in the selection. `all` clears. Adding a band fills gaps along `BOARD_BAND_MENU_ORDER`;
 * removing a band does not re-fill (allows disjoint sets like 0–3 and 5).
 */
export function toggleBoardBandSelection(prev: BoardBandSelection, id: BoardBandId): BoardBandSelection {
  if (id === "all") return [];
  const nid = id as Exclude<BoardBandId, "all">;
  const set = new Set(prev);
  if (set.has(nid)) {
    set.delete(nid);
    return [...set] as BoardBandSelection;
  }
  set.add(nid);
  return expandBoardBandSelection([...set] as BoardBandSelection);
}

export function boardCountMatchesSelection(b: number, ids: BoardBandSelection): boolean {
  if (ids.length === 0) return true;
  for (const id of ids) {
    switch (id) {
      case "0_3":
        if (b >= 0 && b <= 3) return true;
        break;
      case "4":
        if (b === 4) return true;
        break;
      case "5":
        if (b === 5) return true;
        break;
      case "6":
        if (b === 6) return true;
        break;
      case "7":
        if (b === 7) return true;
        break;
      case "8p":
        if (b >= 8) return true;
        break;
      default:
        break;
    }
  }
  return false;
}
