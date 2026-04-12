import type {
  HeroCaseStudy,
  MemoContext,
  OrgDetail,
  ScenarioResult,
  ScreenerRow,
  ScreenKey,
} from "@/lib/types";

export const screens: Array<{ key: ScreenKey; label: string; blurb: string }> = [
  {
    key: "screener",
    label: "Portfolio Screener",
    blurb: "Rank the nonprofit portfolio and pick a target worth deeper analysis.",
  },
  {
    key: "detail",
    label: "Organization Detail",
    blurb: "Open an org, inspect the signals, and defend the story with peers.",
  },
  {
    key: "scenario",
    label: "Scenario + Memo",
    blurb: "Turn the analysis into a decision memo and a presentation-ready recommendation.",
  },
];

export const screenerRows: ScreenerRow[] = [
  {
    id: "ocean-bridge",
    organizationName: "Ocean Bridge Coalition",
    ein: "94-2817031",
    city: "San Diego",
    state: "CA",
    missionArea: "Coastal resilience",
    revenue: 12450000,
    growthRate: 14.2,
    reserveMonths: 11.4,
    staffCount: 86,
    riskBand: "Steady",
    screenScore: 86,
    flags: ["Strong multi-year growth", "Healthy reserves", "Balanced grant mix"],
  },
  {
    id: "bright-path",
    organizationName: "Bright Path Youth",
    ein: "91-4421189",
    city: "Sacramento",
    state: "CA",
    missionArea: "Youth services",
    revenue: 5410000,
    growthRate: 4.8,
    reserveMonths: 6.1,
    staffCount: 42,
    riskBand: "Watch",
    screenScore: 72,
    flags: ["Reserve dip", "Payroll pressure", "Program demand rising"],
  },
  {
    id: "harbor-house",
    organizationName: "Harbor House Network",
    ein: "87-5054120",
    city: "Oakland",
    state: "CA",
    missionArea: "Housing stability",
    revenue: 8090000,
    growthRate: -3.1,
    reserveMonths: 3.8,
    staffCount: 59,
    riskBand: "At Risk",
    screenScore: 54,
    flags: ["Revenue contraction", "Low liquidity", "Large grant concentration"],
  },
];

export const orgDetails: Record<string, OrgDetail> = {
  "ocean-bridge": {
    id: "ocean-bridge",
    organizationName: "Ocean Bridge Coalition",
    summary: "A mid-sized nonprofit with stable operations, expanding earned revenue, and a grant base that is diversifying faster than peers.",
    website: "oceanbridge.example",
    missionArea: "Coastal resilience",
    geography: "California coast",
    currentYearRevenue: 12450000,
    priorYearRevenue: 10900000,
    revenueMix: [
      { label: "Program fees", value: 42, tone: "accent" },
      { label: "Foundation grants", value: 31, tone: "warm" },
      { label: "Individual gifts", value: 19, tone: "muted" },
      { label: "Other", value: 8, tone: "muted" },
    ],
    topSignals: [
      "Revenue has compounded for three years without a matching staffing spike.",
      "Liquid reserves cover almost a year of expenses, above the benchmark set.",
      "No single funding source exceeds 45 percent of total revenue.",
    ],
    watchouts: [
      "Program growth could outpace operational capacity if hiring lags.",
      "The earned revenue stream should be stress-tested for seasonality.",
    ],
    peerBenchmarks: [
      { label: "Reserve months", orgValue: 11.4, peerMedian: 7.2 },
      { label: "Revenue growth %", orgValue: 14.2, peerMedian: 6.0 },
      { label: "Staff per $1M", orgValue: 6.9, peerMedian: 8.1 },
    ],
    narrative:
      "This is the kind of organization that looks strong on paper and becomes even more compelling when the peer frame is added. It is a good demo target because the recommendation is clear but still defensible.",
  },
};

export const scenarioResults: Record<string, ScenarioResult> = {
  "ocean-bridge": {
    scenarioId: "ocean-bridge-scale",
    title: "Scale the earned revenue program",
    assumption: "Increase earned revenue by 12 percent while holding hiring flat for one quarter.",
    projectedReserveMonths: 13.1,
    projectedGrowth: 16.4,
    riskShift: "Moves from Steady to Foundation",
    recommendation:
      "Recommend a growth-oriented plan with a short risk review cadence and a reserve floor guardrail.",
    evidence: [
      "Revenue growth absorbs the planned investment without eroding the reserve buffer.",
      "The org stays above the peer median on liquidity even after the scenario shift.",
      "The memo can justify action with concrete benchmark deltas instead of abstract optimism.",
    ],
  },
  "bright-path": {
    scenarioId: "bright-path-stabilize",
    title: "Stabilize the program footprint",
    assumption: "Hold headcount flat and direct incremental funding into reserve rebuilding.",
    projectedReserveMonths: 7.2,
    projectedGrowth: 5.6,
    riskShift: "Moves from Watch to Steady",
    recommendation:
      "Recommend a stabilization plan with reserve recovery milestones before any larger expansion.",
    evidence: [
      "Reserve coverage returns closer to the peer median without slowing the mission.",
      "A conservative plan keeps the funding story credible for judges.",
      "The recommendation balances growth potential with a realistic operating posture.",
    ],
  },
  "harbor-house": {
    scenarioId: "harbor-house-protect",
    title: "Protect core programs",
    assumption: "Redirect limited flexibility toward core housing services and cash conservation.",
    projectedReserveMonths: 4.4,
    projectedGrowth: -1.4,
    riskShift: "Remains At Risk",
    recommendation:
      "Recommend a defensive plan focused on continuity, cash protection, and grant diversification.",
    evidence: [
      "The operating story stays fragile even after the scenario shift.",
      "The memo can point to liquidity preservation as the main decision criterion.",
      "The case is a good example of when a caution-first recommendation is warranted.",
    ],
  },
};

export const memoContext: MemoContext = {
  audience: "Hackathon judges and Fairlight Advisors",
  ask: "Select the strongest nonprofit to support with capital, counsel, or follow-up diligence.",
  timeHorizon: "12 months",
  constraints: [
    "Keep the story under five minutes",
    "Show why the org stands out against peers",
    "Connect metrics to a specific recommendation",
  ],
  talkTrack: [
    "Start with the screener's ranking logic.",
    "Use the org detail to prove the narrative.",
    "End with the scenario and the memo recommendation.",
  ],
};

export const heroCaseStudy: HeroCaseStudy = {
  organizationId: "ocean-bridge",
  headline: "From 3,000 rows of tax data to one clear recommendation",
  oneLiner: "A mock case study showing how the screener, detail view, and scenario memo chain into a judge-ready story.",
  outcome: "Ocean Bridge becomes the demo's flagship 'support now' case because the data points all move in the same direction.",
  whyItMatters:
    "The hero case lets the team narrate a complete portfolio triage workflow without depending on the backend being finished.",
};
