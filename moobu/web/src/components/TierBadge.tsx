"use client";

import { tierColor } from "@/lib/utils";

interface TierBadgeProps {
  tier: string;
}

const TIER_STYLES: Record<string, { bg: string; text: string }> = {
  Thriving: { bg: "linear-gradient(135deg, #DCFCE7, #BBF7D0)", text: "#166534" },
  Stable: { bg: "linear-gradient(135deg, #E8EEF7, #DBEAFE)", text: "#1E3A6E" },
  "Needs Support": { bg: "linear-gradient(135deg, #FEF3E2, #FED7AA)", text: "#92400E" },
  Urgent: { bg: "linear-gradient(135deg, #FEE2E2, #FECACA)", text: "#991B1B" },
};

export default function TierBadge({ tier }: TierBadgeProps) {
  const style = TIER_STYLES[tier] || { bg: "#F3F4F6", text: "#6B7280" };
  const dotColor = tierColor(tier);

  return (
    <span
      className="tier-badge"
      style={{
        background: style.bg,
        color: style.text,
      }}
    >
      <span
        className="tier-badge-dot"
        style={{ backgroundColor: dotColor }}
      />
      {tier}
    </span>
  );
}
