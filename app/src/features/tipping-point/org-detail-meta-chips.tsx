"use client";

import { type ReactNode } from "react";
import { OrgWebsiteChip } from "./org-website-chip";

type Props = {
  ein: string;
  initialWebsiteUrl?: string;
  foundedYear?: number | null;
  employeeCount?: number | null;
  volunteerCount?: number | null;
};

/**
 * Pill row: Website (link) + optional Founded / employees / volunteers — same 36px height as `tp-org-website-chip`.
 * Visual: Website pill plus optional Founded / employees / volunteers (flex `gap`, no pipe separators).
 */
export function OrgDetailMetaChips(props: Props) {
  const { ein, initialWebsiteUrl, foundedYear, employeeCount, volunteerCount } = props;

  const nodes: ReactNode[] = [
    <OrgWebsiteChip key="web" ein={ein} initialWebsiteUrl={initialWebsiteUrl} />,
  ];
  if (foundedYear != null) {
    nodes.push(
      <span key="fy" className="tp-org-meta-chip">
        Founded {foundedYear}
      </span>,
    );
  }
  if (employeeCount != null && employeeCount > 0) {
    nodes.push(
      <span key="emp" className="tp-org-meta-chip">
        {employeeCount === 1 ? "1 employee" : `${employeeCount} employees`}
      </span>,
    );
  }
  if (volunteerCount != null) {
    nodes.push(
      <span key="vol" className="tp-org-meta-chip">
        {volunteerCount === 1 ? "1 volunteer" : `${volunteerCount} volunteers`}
      </span>,
    );
  }

  return (
    <div className="tp-org-detail-meta-chips-row" aria-label="Organization website and scale">
      {nodes}
    </div>
  );
}
