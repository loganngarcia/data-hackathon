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
      return "#10B981";
    case "Stable":
      return "#3B69B7";
    case "Needs Support":
      return "#F5A623";
    case "Urgent":
      return "#EF4444";
    default:
      return "#6B7280";
  }
}

export function tierStripClass(tier: string | null | undefined): string {
  switch (tier) {
    case "Thriving":
      return "tier-strip-thriving";
    case "Stable":
      return "tier-strip-stable";
    case "Needs Support":
      return "tier-strip-needs-support";
    case "Urgent":
      return "tier-strip-urgent";
    default:
      return "tier-strip-stable";
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
  "#3B69B7", "#10B981", "#F5A623", "#EF4444",
  "#8B5CF6", "#0891B2", "#F43F5E", "#65A30D",
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

export function formatReserveMonths(
  netAssets: number | null | undefined,
  expenses: number | null | undefined,
): string {
  if (netAssets == null || expenses == null || expenses === 0) return "N/A";
  const months = (netAssets / expenses) * 12;
  if (months < 0) return "0.0 mo";
  return `${months.toFixed(1)} mo`;
}

export function reserveMonthsRaw(
  netAssets: number | null | undefined,
  expenses: number | null | undefined,
): number | null {
  if (netAssets == null || expenses == null || expenses === 0) return null;
  return (netAssets / expenses) * 12;
}

export function formatDelta(
  current: number | null | undefined,
  previous: number | null | undefined,
): { text: string; positive: boolean } | null {
  if (current == null || previous == null || previous === 0) return null;
  const pctChange = ((current - previous) / Math.abs(previous)) * 100;
  const sign = pctChange >= 0 ? "+" : "";
  return {
    text: `${sign}${pctChange.toFixed(1)}%`,
    positive: pctChange >= 0,
  };
}

// Metric accent colors for score breakdown bars
const METRIC_COLORS: Record<string, string> = {
  revenue_concentration_hhi: "#8B5CF6",
  operating_reserve_ratio: "#3B69B7",
  revenue_growth_trend: "#10B981",
  expense_vs_revenue_growth: "#F43F5E",
  program_expense_ratio: "#0891B2",
  revenue_volatility: "#F5A623",
  net_asset_trend: "#10B981",
  surplus_deficit_consistency: "#3B69B7",
};

export function metricColor(metricKey: string): string {
  return METRIC_COLORS[metricKey] || "#6B7280";
}
