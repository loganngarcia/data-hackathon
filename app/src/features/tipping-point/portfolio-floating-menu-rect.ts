/** Shared positioning for portfolio toolbar / home filter floating menus (fixed + portal). */

export const VIEWPORT_MENU_MARGIN = 8;
export const MENU_GAP_PX = 4;

/** Height guess for clamping before paint; scrollable menus cap ~50vh/320px like CSS maxHeight. */
export function estimatePortfolioMenuHeight(optionCount: number, menuMaxHeight: string | undefined): number {
  const vh = typeof window === "undefined" ? 800 : window.innerHeight;
  const pad = 24;
  const row = 40;
  if (menuMaxHeight) {
    const cap = Math.min(vh * 0.5, 320);
    return Math.min(cap + pad, vh - 2 * VIEWPORT_MENU_MARGIN);
  }
  return Math.min(optionCount * row + pad, vh * 0.85);
}

/**
 * Keeps fixed menus on-screen: clamps horizontal position/width and flips above the trigger when
 * there is not enough space below.
 */
export function clampPortfolioFloatingMenuRect(
  chip: DOMRect,
  menuWidth: number,
  estimatedHeight: number,
): { top: number; left: number; width: number } {
  const M = VIEWPORT_MENU_MARGIN;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const w = Math.min(Math.max(menuWidth, 160), vw - 2 * M);
  let left = chip.left;
  if (left + w > vw - M) {
    left = vw - M - w;
  }
  if (left < M) {
    left = M;
  }

  const h = Math.min(estimatedHeight, vh - 2 * M);

  let top = chip.bottom + MENU_GAP_PX;
  if (top + h > vh - M) {
    const tryAbove = chip.top - MENU_GAP_PX - h;
    if (tryAbove >= M) {
      top = tryAbove;
    } else {
      top = M;
    }
  }

  return { top, left, width: w };
}
