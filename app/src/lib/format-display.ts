/** Shared number formatting for Tipping Point surfaces (dashboard + legacy deck). */

export function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/** Full dollars for tooltips and precise reads. */
export function formatUsdFull(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatSignedPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

/** Apple HIG system colors (light) for 0–100 screener scores. */
export type ScreenScoreTone = "positive" | "critical" | "orange" | "amber" | "neutral";

/** >= 90 green; < 25 red; < 40 orange; < 50 amber; else neutral. */
export function screenScoreTone(score: number): ScreenScoreTone {
  if (score >= 90) return "positive";
  if (score < 25) return "critical";
  if (score < 40) return "orange";
  if (score < 50) return "amber";
  return "neutral";
}

export function screenScoreToneClasses(score: number): string {
  return `tp-screen-score tp-screen-score--${screenScoreTone(score)}`;
}

/**
 * Reserve runway: >= 12 months shown as months (no trailing “.0”); under 1 year as days.
 * `months` is fractional (e.g. from 990-derived runway).
 */
export function formatReserveCoverage(months: number): string {
  if (months >= 12) {
    const m = months.toFixed(1).replace(/\.0$/, "");
    return `${m} mo`;
  }
  const days = Math.max(0, Math.round(months * (365 / 12)));
  if (days <= 0) return "0 days";
  return days === 1 ? "1 day" : `${days} days`;
}

export function formatBenchmarkValue(label: string, value: number) {
  if (label.includes("%")) {
    return `${value.toFixed(1)}%`;
  }
  if (label === "Reserve months") {
    return formatReserveCoverage(value);
  }

  return value.toFixed(1);
}
