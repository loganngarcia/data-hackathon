/** Portfolio orgs shown in Tipping Point — EINs match ProPublica Nonprofit Explorer. */
export const PORTFOLIO_ORGS = [
  { id: "ocean-bridge", ein: "330103012" },
  { id: "bright-path", ein: "680073413" },
  { id: "harbor-house", ein: "371437781" },
] as const;

export type PortfolioOrgId = (typeof PORTFOLIO_ORGS)[number]["id"];
