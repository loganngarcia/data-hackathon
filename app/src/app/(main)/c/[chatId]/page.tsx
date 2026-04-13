"use client";

import { ChatSessionPage } from "@/dashboard-ui/pages/ChatSessionPage";
import { useDashboardShell } from "@/dashboard-ui/shell-context";

export default function ChatRoutePage() {
  const { padLeft, isMobile } = useDashboardShell();
  return <ChatSessionPage leftInset={padLeft} isMobile={isMobile} />;
}
