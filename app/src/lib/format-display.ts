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

/** YoY-style percent: `+` when up, leading `-` when down (e.g. `-12.3%`). */
export function formatSignedPercent(value: number) {
  const n = Math.round(value * 10) / 10;
  if (n > 0) return `+${n.toFixed(1)}%`;
  if (n < 0) return `${n.toFixed(1)}%`;
  return "0.0%";
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
 * Reserve runway: >= 12 months → **years**; >= 6 and < 12 → **months**; under 6 → **days**.
 * `months` is fractional (e.g. from 990-derived runway).
 */
export function formatReserveCoverage(months: number): string {
  if (months >= 12) {
    const years = months / 12;
    const rounded = Math.round(years * 10) / 10;
    const numStr = Number.isInteger(rounded)
      ? String(rounded)
      : rounded.toFixed(1).replace(/\.0$/, "");
    const singular = rounded === 1;
    return `${numStr} ${singular ? "year" : "years"}`;
  }
  if (months >= 6) {
    const m = Math.round(months * 10) / 10;
    const numStr = Number.isInteger(m)
      ? String(m)
      : m.toFixed(1).replace(/\.0$/, "");
    return `${numStr} months`;
  }
  const days = Math.max(0, Math.round(months * (365 / 12)));
  if (days <= 0) return "0 days";
  return days === 1 ? "1 day" : `${days} days`;
}

/** True when runway is under 6 months (`formatReserveCoverage` uses the days branch). */
export function reserveCoverageIsLow(months: number): boolean {
  return months < 6;
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
