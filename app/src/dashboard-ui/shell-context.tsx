"use client";

import { createContext, useContext } from "react";

export type DashboardShellChrome = {
  padLeft: number;
  isMobile: boolean;
};

export const DashboardShellContext = createContext<DashboardShellChrome | null>(null);

export function useDashboardShell(): DashboardShellChrome {
  const v = useContext(DashboardShellContext);
  if (!v) {
    throw new Error("useDashboardShell must be used inside DashboardAppShell");
  }
  return v;
}
