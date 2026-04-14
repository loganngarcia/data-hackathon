"use client";

import { type ReactNode } from "react";
import { OrgWebsiteChip } from "./org-website-chip";

type Props = {
  ein: string;
  initialWebsiteUrl?: string;
  /** TEOS / D1 org phone when present */
  orgPhone?: string;
  /** When TEOS or CRM provides a single org email */
  orgEmail?: string;
  foundedYear?: number | null;
  employeeCount?: number | null;
  volunteerCount?: number | null;
};

function MailGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M4 6H20C21.1 6 22 6.9 22 8V16C22 17.1 21.1 18 20 18H4C2.9 18 2 17.1 2 16V8C2 6.9 2.9 6 4 6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M22 8L12 13L2 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PhoneGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M15.6 14.522c-2.395 2.52-8.504-3.534-6.1-6.064c1.468-1.545-.19-3.31-1.108-4.609c-1.723-2.435-5.504.927-5.39 3.066c.363 6.746 7.66 14.74 14.726 14.042c2.21-.218 4.75-4.21 2.215-5.669c-1.268-.73-3.009-2.17-4.343-.767"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function phoneToTelHref(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith("+")) return `tel:${trimmed.replace(/\s/g, "")}`;
  const d = trimmed.replace(/\D/g, "");
  if (d.length === 10) return `tel:+1${d}`;
  if (d.length === 11 && d[0] === "1") return `tel:+${d}`;
  if (d.length >= 7) return `tel:+${d}`;
  return `tel:${trimmed.replace(/\s/g, "")}`;
}

/**
 * Pill row: Website (link) + optional Email / Phone from TEOS + optional Founded / employees / volunteers.
 */
export function OrgDetailMetaChips(props: Props) {
  const { ein, initialWebsiteUrl, orgPhone, orgEmail, foundedYear, employeeCount, volunteerCount } = props;

  const nodes: ReactNode[] = [
    <OrgWebsiteChip key="web" ein={ein} initialWebsiteUrl={initialWebsiteUrl} />,
  ];

  if (orgEmail?.trim()) {
    const em = orgEmail.trim();
    nodes.push(
      <a
        key="email"
        className="tp-org-website-chip"
        href={`mailto:${em}`}
        aria-label={`Email ${em}`}
      >
        <MailGlyph />
        <span>Email</span>
      </a>,
    );
  }

  if (orgPhone?.trim()) {
    const ph = orgPhone.trim();
    nodes.push(
      <a
        key="phone"
        className="tp-org-website-chip"
        href={phoneToTelHref(ph)}
        aria-label={`Call ${ph}`}
      >
        <PhoneGlyph />
        <span>Phone</span>
      </a>,
    );
  }

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
    <div className="tp-org-detail-meta-chips-row" aria-label="Organization website, contact, and scale">
      {nodes}
    </div>
  );
}
