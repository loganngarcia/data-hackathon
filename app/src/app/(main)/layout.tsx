import type { ReactNode } from "react";
import { DashboardAppShell } from "@/dashboard-ui/DashboardAppShell";
import "@/dashboard-ui/styles/shell-entry.css";
import "@/features/tipping-point/tipping-point-dashboard.css";

export default function MainShellLayout({ children }: { children: ReactNode }) {
  return <DashboardAppShell>{children}</DashboardAppShell>;
}
