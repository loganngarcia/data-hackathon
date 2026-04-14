"use client";

import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import {
  ORG_RAIL_DEFAULT_PX,
  OrgRailStateProvider,
  readOrgRailWidthFromStorage,
} from "@/features/tipping-point/org-rail-context";
import { useDashboardShell } from "./shell-context";

/**
 * Single org-rail width state + CSS var for `--org-rail-width` on any route with `?org=`.
 * Must render under `DashboardShellContext` (uses `isMobile`).
 */
export function OrgRailShell({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const { isMobile } = useDashboardShell();
  const orgPanelOpen = Boolean(searchParams.get("org"));
  const [railWidthPx, setRailWidthPx] = useState(ORG_RAIL_DEFAULT_PX);
  const [railResizing, setRailResizing] = useState(false);

  useLayoutEffect(() => {
    setRailWidthPx(readOrgRailWidthFromStorage());
  }, []);

  useEffect(() => {
    const w = orgPanelOpen && !isMobile ? railWidthPx : 0;
    document.documentElement.style.setProperty("--org-rail-width", `${w}px`);
    return () => {
      document.documentElement.style.removeProperty("--org-rail-width");
    };
  }, [orgPanelOpen, isMobile, railWidthPx]);

  return (
    <OrgRailStateProvider
      widthPx={railWidthPx}
      setWidthPx={setRailWidthPx}
      isResizing={railResizing}
      setIsResizing={setRailResizing}
    >
      {children}
    </OrgRailStateProvider>
  );
}
