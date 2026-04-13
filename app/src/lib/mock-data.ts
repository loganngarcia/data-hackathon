import type {
  HeroCaseStudy,
  MemoContext,
  OrgDetail,
  PeopleCard,
  ScenarioResult,
  ScreenerRow,
  ScreenKey,
} from "@/lib/types";

export const screens: Array<{ key: ScreenKey; label: string; blurb: string }> = [
  {
    key: "screener",
    label: "Portfolio Screener",
    blurb: "Sort the portfolio and isolate one organization worth deeper review.",
  },
  {
    key: "detail",
    label: "Organization Detail",
    blurb: "Read the operating story beside the peer frame and the benchmark panels.",
  },
  {
    key: "scenario",
    label: "Scenario + Memo",
    blurb: "Translate the evidence into a recommendation the judges can repeat back.",
  },
];

/** Portfolio rows use real EINs and names (CA nonprofits). Latest revenue & YoY align with the most recent IRS 990 extracts; score/band/reserves in Metrics remain demo heuristics for the hackathon UI. */
export const screenerRows: ScreenerRow[] = [
  {
    id: "ocean-bridge",
    organizationName: "San Diego Oceans Foundation",
    ein: "33-0103012",
    city: "San Diego",
    state: "CA",
    missionArea: "Marine conservation",
    revenue: 42,
    growthRate: -26.3,
    reserveMonths: 11.4,
    staffCount: 86,
    riskBand: "Steady",
    screenScore: 86,
  },
  {
    id: "bright-path",
    organizationName: "Fosterhope Sacramento",
    ein: "68-0073413",
    city: "Sacramento",
    state: "CA",
    missionArea: "Human services",
    revenue: 1_643_424,
    growthRate: 4.0,
    reserveMonths: 6.1,
    staffCount: 42,
    riskBand: "Watch",
    screenScore: 72,
  },
  {
    id: "harbor-house",
    organizationName: "South Oakland Citizens For The Homeless",
    ein: "37-1437781",
    city: "Oakland",
    state: "CA",
    missionArea: "Housing & homeless services",
    revenue: 376_282,
    growthRate: 81.2,
    reserveMonths: 3.8,
    staffCount: 59,
    riskBand: "At Risk",
    screenScore: 54,
  },
];

export const orgDetails: Record<string, OrgDetail> = {
  "ocean-bridge": {
    id: "ocean-bridge",
    organizationName: "San Diego Oceans Foundation",
    summary:
      "San Diego–based marine conservation nonprofit; public 990s show highly variable small-dollar revenue in recent years—use the live revenue series beside this card as the ground truth.",
    website: "sdoceanfoundation.org",
    missionArea: "Marine conservation",
    geography: "California coast",
    currentYearRevenue: 42,
    priorYearRevenue: 57,
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
      "Smaller-file organizations illustrate why multi-year 990 revenue matters: headline years can mislead if peers and volatility are ignored.",
  },
  "bright-path": {
    id: "bright-path",
    organizationName: "Fosterhope Sacramento",
    summary:
      "Sacramento human services nonprofit with material operating scale; revenue has been rebounding after a mid-decade dip—compare the chart to peer medians in Panels.",
    website: "fosterhope.org",
    missionArea: "Human services",
    geography: "Sacramento Valley",
    currentYearRevenue: 1_643_424,
    priorYearRevenue: 1_580_480,
    revenueMix: [
      { label: "Government contracts", value: 38, tone: "accent" },
      { label: "Foundation grants", value: 29, tone: "warm" },
      { label: "Individual gifts", value: 21, tone: "muted" },
      { label: "Events + other", value: 12, tone: "muted" },
    ],
    topSignals: [
      "Demand growth is still supporting positive revenue despite a tighter operating base.",
      "The organization remains close to the peer median on staffing efficiency.",
      "Individual giving is rising fast enough to matter if it is converted into recurring support.",
    ],
    watchouts: [
      "Reserve coverage remains thin for an organization with rising service obligations.",
      "Payroll pressure is absorbing gains that could otherwise strengthen the balance sheet.",
    ],
    peerBenchmarks: [
      { label: "Reserve months", orgValue: 6.1, peerMedian: 6.8 },
      { label: "Revenue growth %", orgValue: 4.8, peerMedian: 5.1 },
      { label: "Staff per $1M", orgValue: 7.8, peerMedian: 7.5 },
    ],
    narrative:
      "Mid-size regional nonprofits often sit between growth stories and stabilization plays—the scenario tools below stress-test that tension.",
  },
  "harbor-house": {
    id: "harbor-house",
    organizationName: "South Oakland Citizens For The Homeless",
    summary:
      "Oakland organization serving people experiencing homelessness; recent filings show sharp revenue movement—ground discussions in the IRS-derived series and peer context.",
    website: "souoaklandhomeless.org",
    missionArea: "Housing & homeless services",
    geography: "East Bay corridor",
    currentYearRevenue: 376_282,
    priorYearRevenue: 207_694,
    revenueMix: [
      { label: "Government grants", value: 47, tone: "warm" },
      { label: "Major foundation partner", value: 28, tone: "accent" },
      { label: "Individual giving", value: 14, tone: "muted" },
      { label: "Other", value: 11, tone: "muted" },
    ],
    topSignals: [
      "The mission remains high-priority, which helps explain why support should focus on continuity rather than expansion.",
      "Staffing is still relatively efficient for the scale of services being delivered.",
      "The file is easy to defend as a tipping-risk example because the pressure points align.",
    ],
    watchouts: [
      "Liquidity is materially below the peer frame for a mission that cannot tolerate service disruption.",
      "The revenue base is too concentrated for a year that is already showing contraction.",
    ],
    peerBenchmarks: [
      { label: "Reserve months", orgValue: 3.8, peerMedian: 6.5 },
      { label: "Revenue growth %", orgValue: -3.1, peerMedian: 2.7 },
      { label: "Staff per $1M", orgValue: 7.3, peerMedian: 7.9 },
    ],
    narrative:
      "High volatility in public filings is a reminder to pair any single-year read with multi-year trends and liquidity context.",
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
  audience: "Fairlight advisors and round-one judges",
  ask: "Choose the organization that merits support now and defend the recommendation with operating evidence.",
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
  headline: "One portfolio scan should lead to one confident recommendation",
  oneLiner: "Real 990 revenue history grounds the story; heuristics in Metrics are for UI flow only.",
  outcome: "San Diego Oceans illustrates how multi-year filing data and peer framing combine into a single recommendation.",
  whyItMatters:
    "Judges can verify revenue against ProPublica’s IRS extracts while you narrate peers, scenarios, and memo logic.",
};

/** Demo contacts for the People strip; replace with CRM or directory data later. */
export const peoplePlaceholders: PeopleCard[] = [
  { id: "p1", name: "Alex Rivera", title: "Program director" },
  { id: "p2", name: "Jordan Lee", title: "Board treasurer" },
  { id: "p3", name: "Sam Okonkwo", title: "Grants lead" },
  { id: "p4", name: "Morgan Ellis", title: "Volunteer coordinator" },
];
