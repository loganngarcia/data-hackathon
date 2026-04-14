"use client";

import { useSearchParams } from "next/navigation";
import {
  ORG_RAIL_DEFAULT_PX,
  useOrgRailOptional,
} from "@/features/tipping-point/org-rail-context";
import { TippingPointDashboard } from "@/features/tipping-point";
import { ChatSessionPage } from "@/dashboard-ui/pages/ChatSessionPage";
import { useDashboardShell } from "@/dashboard-ui/shell-context";

/** Org panel + portfolio data layer when `?org=` is present — same behavior as home, without requiring `/` first. */
export function ChatWithOrgRail() {
  const { padLeft, isMobile } = useDashboardShell();
  const searchParams = useSearchParams();
  const hasOrg = Boolean(searchParams.get("org"));
  const rail = useOrgRailOptional();
  const railW = rail?.widthPx ?? ORG_RAIL_DEFAULT_PX;
  const orgPanelOpen = Boolean(searchParams.get("org"));
  const rightInset = orgPanelOpen && !isMobile ? railW : 0;

  return (
    <>
      {hasOrg ? <TippingPointDashboard embedded railOnly /> : null}
      <ChatSessionPage leftInset={padLeft} rightInset={rightInset} isMobile={isMobile} />
    </>
  );
}
