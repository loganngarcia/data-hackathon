"use client";

import { useEffect, useState } from "react";
import { getCachedMissionText, setCachedMissionText } from "./org-detail-fetch-cache";
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
  const [text, setText] = useState(() => {
    if (initialSummary !== EM_DASH) return initialSummary;
    return getCachedMissionText(ein) ?? initialSummary;
  });

  useEffect(() => {
    setText(initialSummary);
  }, [ein, initialSummary]);

  useEffect(() => {
    if (initialSummary !== EM_DASH) return;
    const cached = getCachedMissionText(ein);
    if (cached) {
      setText(cached);
      return;
    }
    let cancelled = false;
    const q = encodeURIComponent(ein);
    fetch(`/api/org-mission?ein=${q}`)
      .then((r) => r.json())
      .then((body: { mission?: string | null }) => {
        if (cancelled || !body.mission || body.mission.length === 0) return;
        setCachedMissionText(ein, body.mission);
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
