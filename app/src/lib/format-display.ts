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

export function formatBenchmarkValue(label: string, value: number) {
  if (label.includes("%")) {
    return `${value.toFixed(1)}%`;
  }

  return value.toFixed(1);
}
