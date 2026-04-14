"use client";

import { createContext, useContext, useMemo } from "react";

const STORAGE_KEY = "tp_org_rail_width_px";

export const ORG_RAIL_DEFAULT_PX = 440;
export const ORG_RAIL_MIN_PX = 300;
export const ORG_RAIL_MAX_PX = 640;
/** Below this width, org detail uses compact / mobile-style metrics mosaic */
export const ORG_RAIL_NARROW_BREAKPOINT_PX = 480;

export function readOrgRailWidthFromStorage(): number {
  if (typeof window === "undefined") return ORG_RAIL_DEFAULT_PX;
  try {
    const n = Number.parseInt(localStorage.getItem(STORAGE_KEY) ?? "", 10);
    if (Number.isFinite(n)) {
      return Math.min(ORG_RAIL_MAX_PX, Math.max(ORG_RAIL_MIN_PX, n));
    }
  } catch {
    /* ignore */
  }
  return ORG_RAIL_DEFAULT_PX;
}

export function persistOrgRailWidth(w: number) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, String(Math.round(w)));
  } catch {
    /* ignore */
  }
}

type OrgRailContextValue = {
  widthPx: number;
  setWidthPx: (w: number) => void;
  isResizing: boolean;
  setIsResizing: (v: boolean) => void;
};

const OrgRailContext = createContext<OrgRailContextValue | null>(null);

export function OrgRailStateProvider({
  children,
  widthPx,
  setWidthPx,
  isResizing,
  setIsResizing,
}: {
  children: React.ReactNode;
  widthPx: number;
  setWidthPx: (w: number) => void;
  isResizing: boolean;
  setIsResizing: (v: boolean) => void;
}) {
  const value = useMemo(
    () => ({ widthPx, setWidthPx, isResizing, setIsResizing }),
    [widthPx, setWidthPx, isResizing, setIsResizing],
  );
  return <OrgRailContext.Provider value={value}>{children}</OrgRailContext.Provider>;
}

export function useOrgRailOptional(): OrgRailContextValue | null {
  return useContext(OrgRailContext);
}
