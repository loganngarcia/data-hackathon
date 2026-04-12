import type { OrgDetail, ScenarioResult, ScreenerRow } from "@/lib/types";

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatSignedPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

/**
 * "Why Flagged" intent -- explains why this org was flagged at its risk band.
 * Uses the screener flags, topSignals, and watchouts.
 */
export function buildWhyFlagged(row: ScreenerRow, detail: OrgDetail): string[] {
  const bandDescriptor: Record<string, string> = {
    Foundation: "a low-risk, foundation-level organization",
    Steady: "a steady performer with manageable risk",
    Watch: "a watch-list case that warrants closer monitoring",
    "At Risk": "an at-risk organization requiring immediate attention",
  };

  const descriptor = bandDescriptor[row.riskBand] ?? "a flagged organization";

  const flagSummary = row.flags.length > 0
    ? `The screener flagged ${row.flags.map((f) => f.toLowerCase()).join(", ")}.`
    : "No specific flags were raised.";

  const signalSentence = detail.topSignals.length > 0
    ? `What stands out: ${detail.topSignals[0].replace(/\.$/, "").toLowerCase()}.`
    : "";

  const watchoutSentence = detail.watchouts.length > 0
    ? `However, ${detail.watchouts[0].replace(/\.$/, "").toLowerCase()}.`
    : "";

  return [
    `${detail.organizationName} scores ${row.screenScore} out of 100 and is classified as ${descriptor}. ${flagSummary}`,
    signalSentence,
    watchoutSentence,
  ].filter(Boolean);
}

/**
 * "What Changed Over Time" intent -- generates a trend narrative from
 * currentYearRevenue, priorYearRevenue, and peer benchmarks.
 */
export function buildTrendNarrative(row: ScreenerRow, detail: OrgDetail): string[] {
  const growthRate =
    ((detail.currentYearRevenue - detail.priorYearRevenue) / detail.priorYearRevenue) * 100;
  const growing = growthRate > 0;
  const direction = growing ? "grew" : "contracted";
  const magnitude = Math.abs(growthRate);

  const revenueLine = `Revenue ${direction} by ${magnitude.toFixed(1)}% year-over-year, moving from ${formatCompactCurrency(detail.priorYearRevenue)} to ${formatCompactCurrency(detail.currentYearRevenue)}.`;

  const growthBenchmark = detail.peerBenchmarks.find((b) =>
    b.label.toLowerCase().includes("growth"),
  );
  let peerLine: string;
  if (growthBenchmark) {
    const diff = growthBenchmark.orgValue - growthBenchmark.peerMedian;
    const comparison = diff >= 0 ? "above" : "below";
    peerLine = `At ${formatSignedPercent(growthBenchmark.orgValue)} growth, the organization sits ${Math.abs(diff).toFixed(1)} percentage points ${comparison} the peer median of ${formatSignedPercent(growthBenchmark.peerMedian)}.`;
  } else {
    peerLine = `The reported growth rate of ${formatSignedPercent(row.growthRate)} should be compared against local peer medians for context.`;
  }

  const reserveBenchmark = detail.peerBenchmarks.find((b) =>
    b.label.toLowerCase().includes("reserve"),
  );
  let reserveLine: string;
  if (reserveBenchmark) {
    const ahead = reserveBenchmark.orgValue >= reserveBenchmark.peerMedian;
    reserveLine = `Reserve coverage stands at ${row.reserveMonths.toFixed(1)} months, ${ahead ? "ahead of" : "trailing"} the peer median of ${reserveBenchmark.peerMedian.toFixed(1)} months. ${ahead ? "This cushion supports continued investment." : "Rebuilding this buffer should be a near-term priority."}`;
  } else {
    reserveLine = `Reserve coverage of ${row.reserveMonths.toFixed(1)} months should be evaluated against the organization's operating rhythm and grant timing.`;
  }

  return [revenueLine, peerLine, reserveLine];
}

/**
 * "Best Intervention" intent -- generates a concise recommendation paragraph
 * citing scenario evidence and projected outcomes.
 */
export function buildBestIntervention(
  row: ScreenerRow,
  scenario: ScenarioResult,
): string[] {
  const projectedDirection = scenario.projectedGrowth >= 0 ? "positive" : "negative";

  const openingLine = `For ${row.organizationName}, the recommended intervention is: ${scenario.recommendation.replace(/\.$/, "").toLowerCase()}.`;

  const scenarioLine = `Under the "${scenario.title}" scenario, the model assumes ${scenario.assumption.charAt(0).toLowerCase()}${scenario.assumption.slice(1)} The projected outcome is ${projectedDirection} growth of ${formatSignedPercent(scenario.projectedGrowth)} with reserve coverage reaching ${scenario.projectedReserveMonths.toFixed(1)} months.`;

  const evidenceLine = scenario.evidence.length > 0
    ? `Key evidence: ${scenario.evidence[0].replace(/\.$/, "").toLowerCase()}. The risk trajectory ${scenario.riskShift.toLowerCase()}.`
    : `The risk trajectory ${scenario.riskShift.toLowerCase()}.`;

  return [openingLine, scenarioLine, evidenceLine];
}

/**
 * "Advisor Memo" intent -- the existing buildMemoParagraphs, extracted here
 * for colocation with the other intents.
 */
export function buildAdvisorMemo(
  row: ScreenerRow,
  detail: OrgDetail,
  scenario: ScenarioResult,
): string[] {
  return [
    `${detail.organizationName} should be framed as the ${row.riskBand.toLowerCase()} case in the portfolio because ${detail.topSignals[0].replace(/\.$/, "")}.`,
    `The operating defense is concrete: ${formatSignedPercent(row.growthRate)} growth on ${formatCompactCurrency(row.revenue)} of revenue, ${row.reserveMonths.toFixed(1)} months of reserves, and a peer story that stays legible under scrutiny.`,
    `Recommended move: ${scenario.recommendation} If the team ${scenario.assumption.charAt(0).toLowerCase()}${scenario.assumption.slice(1)}, the file projects to ${scenario.riskShift.toLowerCase()}.`,
  ];
}
