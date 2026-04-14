"use client";

import { Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ORG_RAIL_DEFAULT_PX,
  useOrgRailOptional,
} from "@/features/tipping-point/org-rail-context";
import { getOrgContextForOutgoingUserMessage } from "@/lib/org-context-for-message";
import { saveChatMessages } from "../chat/persistChat";
import type { ChatMessage } from "../chat/types";
import { ChatBar, type ChatBarOnSend } from "../components/ChatBar";
import { useDashboardShell } from "../shell-context";
import { TippingPointDashboard } from "@/features/tipping-point";

function HomeWithChatInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { padLeft, isMobile } = useDashboardShell();
  const orgPanelOpen = Boolean(searchParams.get("org"));
  const rail = useOrgRailOptional();
  const railWidthPx = rail?.widthPx ?? ORG_RAIL_DEFAULT_PX;
  const rightInset = orgPanelOpen && !isMobile ? railWidthPx : 0;

  const onSend: ChatBarOnSend = useCallback(
    ({ text, files }) => {
      const attachmentNote =
        files.length > 0 ? `\n\n(Attached file names: ${files.map((f) => f.name).join(", ")})` : "";
      const full = (text.trim() + attachmentNote).trim();
      if (!full) return;

      const chatId = crypto.randomUUID();
      const orgContext = getOrgContextForOutgoingUserMessage();
      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        text: full,
        ...(orgContext ? { orgContext } : {}),
      };
      saveChatMessages(chatId, [userMsg]);
      const q = searchParams.toString();
      router.push(`/c/${chatId}${q ? `?${q}` : ""}`);
    },
    [router, searchParams],
  );

  return (
    <>
      <TippingPointDashboard embedded />
      <ChatBar leftInset={padLeft} rightInset={rightInset} onSend={onSend} />
    </>
  );
}

/** Home: hackathon data mosaic + bottom composer (matches data-hackathon-dashboard HomePage). */
export function HomeWithChat() {
  return (
    <Suspense fallback={null}>
      <HomeWithChatInner />
    </Suspense>
  );
}
