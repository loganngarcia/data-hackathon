export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null) return "N/A";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null) return "N/A";
  return `${(value * 100).toFixed(1)}%`;
}

export function formatScore(value: number | null | undefined): string {
  if (value == null) return "N/A";
  return value.toFixed(1);
}

export function tierClass(tier: string | null | undefined): string {
  switch (tier) {
    case "Thriving":
      return "tier-thriving";
    case "Stable":
      return "tier-stable";
    case "Needs Support":
      return "tier-needs-support";
    case "Urgent":
      return "tier-urgent";
    default:
      return "";
  }
}

export function tierColor(tier: string | null | undefined): string {
  switch (tier) {
    case "Thriving":
      return "#16A34A";
    case "Stable":
      return "#3B69B7";
    case "Needs Support":
      return "#F5A623";
    case "Urgent":
      return "#DC2626";
    default:
      return "#6B7280";
  }
}

export function truncateMission(text: string | null, maxLen = 120): string {
  if (!text) return "No mission description available.";
  if (text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + "...";
}

const AVATAR_PALETTE = [
  "#3B69B7", "#16A34A", "#F5A623", "#DC2626",
  "#8B5CF6", "#0891B2", "#DB2777", "#65A30D",
];

export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}
