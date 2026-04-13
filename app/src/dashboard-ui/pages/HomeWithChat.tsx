"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { saveChatMessages } from "../chat/persistChat";
import type { ChatMessage } from "../chat/types";
import { ChatBar, type ChatBarOnSend } from "../components/ChatBar";
import { useDashboardShell } from "../shell-context";
import { TippingPointDashboard } from "@/features/tipping-point";

/** Home: hackathon data mosaic + bottom composer (matches data-hackathon-dashboard HomePage). */
export function HomeWithChat() {
  const router = useRouter();
  const { padLeft } = useDashboardShell();

  const onSend: ChatBarOnSend = useCallback(
    async ({ text, files }) => {
      const attachmentNote =
        files.length > 0 ? `\n\n(Attached file names: ${files.map((f) => f.name).join(", ")})` : "";
      const full = (text.trim() + attachmentNote).trim();
      if (!full) return;

      const chatId = crypto.randomUUID();
      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        text: full,
      };
      saveChatMessages(chatId, [userMsg]);
      router.push(`/c/${chatId}`);
    },
    [router],
  );

  return (
    <>
      <TippingPointDashboard embedded />
      <ChatBar leftInset={padLeft} onSend={onSend} />
    </>
  );
}
