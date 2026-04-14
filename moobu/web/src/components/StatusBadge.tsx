"use client";

interface StatusBadgeProps {
  tier: string;
}

const TIER_CLASS: Record<string, string> = {
  Thriving: "status-healthy",
  Stable: "status-stable",
  "Needs Support": "status-attention",
  Urgent: "status-urgent",
};

export default function StatusBadge({ tier }: StatusBadgeProps) {
  const className = TIER_CLASS[tier] || "status-stable";
  return <span className={className}>{tier}</span>;
}
