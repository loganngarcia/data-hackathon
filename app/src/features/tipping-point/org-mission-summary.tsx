"use client";

import { useEffect, useState } from "react";
import { EM_DASH } from "./tipping-point-live-detail";

type Props = {
  ein: string;
  /** From TEOS / server when already loaded. */
  initialSummary: string;
};

/**
 * Mission / activity paragraph(s) from D1 TEOS; if missing server-side, fetches `/api/org-mission`.
 */
export function OrgMissionSummary({ ein, initialSummary }: Props) {
  const [text, setText] = useState(initialSummary);

  useEffect(() => {
    setText(initialSummary);
  }, [ein, initialSummary]);

  useEffect(() => {
    if (initialSummary !== EM_DASH) return;
    let cancelled = false;
    const q = encodeURIComponent(ein);
    fetch(`/api/org-mission?ein=${q}`)
      .then((r) => r.json())
      .then((body: { mission?: string | null }) => {
        if (cancelled || !body.mission || body.mission.length === 0) return;
        setText(body.mission);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ein, initialSummary]);

  return (
    <p className="tp-body tp-mission-summary" style={{ color: "var(--text-primary)" }}>
      {text}
    </p>
  );
}
