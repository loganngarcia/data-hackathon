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
