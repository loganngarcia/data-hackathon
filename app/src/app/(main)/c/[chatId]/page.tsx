"use client";

import { Suspense } from "react";
import { ChatWithOrgRail } from "./ChatWithOrgRail";

export default function ChatRoutePage() {
  return (
    <Suspense fallback={null}>
      <ChatWithOrgRail />
    </Suspense>
  );
}
