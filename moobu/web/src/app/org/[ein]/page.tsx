"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
} from "recharts";
import { fetchNonprofit, fetchPeers } from "@/lib/api";
import type { NonprofitProfile, PeerComparison } from "@/lib/types";
import Link from "next/link";
import {
  formatCurrency,
  formatScore,
  metricColor,
} from "@/lib/utils";
import ScoreRing from "@/components/ScoreRing";
import TierBadge from "@/components/TierBadge";
import PersonCard from "@/components/PersonCard";

const METRIC_LABELS: Record<string, string> = {
  revenue_concentration_hhi: "Revenue Diversification",
  operating_reserve_ratio: "Operating Reserves",
  revenue_growth_trend: "Revenue Growth",
  expense_vs_revenue_growth: "Expense Control",
  program_expense_ratio: "Program Efficiency",
  revenue_volatility: "Revenue Stability",
  net_asset_trend: "Asset Growth",
  surplus_deficit_consistency: "Surplus Consistency",
};

type Tab = "overview" | "people" | "financials" | "risk";

export default function OrgDetailPage() {
  const params = useParams();
  const ein = params.ein as string;
  const [profile, setProfile] = useState<NonprofitProfile | null>(null);
  const [peers, setPeers] = useState<PeerComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  useEffect(() => {
    async function load() {
      try {
        const [p, pe] = await Promise.all([
          fetchNonprofit(ein),
          fetchPeers(ein),
        ]);
        setProfile(p);
        setPeers(pe);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [ein]);

  if (loading) {
    return (
      <div className="p-12 text-center text-muted">
        <div className="inline-block w-6 h-6 border-2 border-moobu-blue/20 border-t-moobu-blue rounded-full animate-spin mb-3" />
        <p>Loading profile...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 text-lg mb-2">{error || "Not found"}</p>
        <Link
          href="/"
          className="text-moobu-blue text-sm mt-2 inline-block hover:underline"
        >
          Back to Portfolio
        </Link>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "overview", label: "Overview", icon: "grid" },
    { key: "people", label: "People", icon: "users" },
    { key: "financials", label: "Financials", icon: "chart" },
    { key: "risk", label: "Risk", icon: "alert" },
  ];

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-moobu-blue hover:underline mb-5"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Portfolio
      </Link>

      {/* Hero Header */}
      <div className="widget-chart p-6 mb-6 animate-card-in">
        <div className="flex flex-wrap items-start gap-6">
          {/* Score Ring */}
          <ScoreRing
            score={profile.composite_score ?? 0}
            tier={profile.tier ?? "Stable"}
            size={120}
          />

          {/* Org Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                {profile.org_name || "Unknown Organization"}
              </h1>
              <TierBadge tier={profile.tier || "Stable"} />
            </div>

            {/* Mission */}
            {profile.mission_description && (
              <p className="text-sm text-muted leading-relaxed mb-4 max-w-[700px]">
                {profile.mission_description}
              </p>
            )}

            {/* Detail pills */}
            <div className="flex flex-wrap gap-2">
              {profile.state && (
                <span className="detail-pill">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {profile.state}
                </span>
              )}
              {profile.formation_year && (
                <span className="detail-pill">Founded {profile.formation_year}</span>
              )}
              {profile.employee_count != null && profile.employee_count > 0 && (
                <span className="detail-pill">
                  {profile.employee_count.toLocaleString()} Employees
                </span>
              )}
              {profile.volunteer_count != null && profile.volunteer_count > 0 && (
                <span className="detail-pill">
                  {profile.volunteer_count.toLocaleString()} Volunteers
                </span>
              )}
              {profile.website && (
                <a
                  href={
                    profile.website.startsWith("http")
                      ? profile.website
                      : `https://${profile.website}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="detail-pill hover:bg-moobu-blue-light transition-colors"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  Website
                </a>
              )}
              <span className="detail-pill">EIN: {profile.ein}</span>
              <span className="detail-pill">
                {profile.years_of_data} yrs data ({profile.confidence})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`tab-btn ${activeTab === tab.key ? "tab-btn-active" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && <OverviewTab profile={profile} />}
      {activeTab === "people" && <PeopleTab profile={profile} />}
      {activeTab === "financials" && <FinancialsTab profile={profile} />}
      {activeTab === "risk" && <RiskTab profile={profile} peers={peers} />}
    </div>
  );
}

/* ============================================================
   OVERVIEW TAB
   ============================================================ */
function OverviewTab({ profile }: { profile: NonprofitProfile }) {
  const metricEntries = profile.metrics
    ? Object.entries(METRIC_LABELS).map(([key, label]) => ({
        key,
        label,
        value:
          (profile.metrics as unknown as Record<string, number | null>)[key] ?? 0,
      }))
    : [];

  const latest = profile.financials.at(-1);

  return (
    <div className="space-y-6 animate-card-in">
      {/* About card */}
      <div className="widget-chart p-6">
        <h2 className="text-lg font-semibold mb-3">About</h2>
        {profile.mission_description ? (
          <p className="text-sm text-muted leading-relaxed mb-4">
            {profile.mission_description}
          </p>
        ) : (
          <p className="text-sm text-muted italic">
            No mission description available.
          </p>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MiniStat label="EIN" value={profile.ein} />
          {profile.website && (
            <MiniStat label="Website" value={profile.website} />
          )}
          {profile.formation_year && (
            <MiniStat label="Founded" value={String(profile.formation_year)} />
          )}
          <MiniStat label="Confidence" value={profile.confidence || "N/A"} />
        </div>
      </div>

      {/* Score Breakdown */}
      {metricEntries.length > 0 && (
        <div className="widget-chart p-6">
          <h2 className="text-lg font-semibold mb-1">
            Resilience Score Breakdown
          </h2>
          <p className="text-xs text-muted mb-5">
            Individual metric scores out of 10
          </p>
          <div className="space-y-4">
            {metricEntries.map((m, i) => (
              <ColorMetricBar
                key={m.key}
                label={m.label}
                value={m.value}
                maxValue={10}
                color={metricColor(m.key)}
                index={i}
              />
            ))}
          </div>
        </div>
      )}

      {/* Key Financial Stats */}
      {latest && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="widget widget-blue animate-card-in" style={{ animationDelay: "0ms" }}>
            <p className="kpi-label mb-2">Total Revenue</p>
            <p className="kpi-number text-[#3B69B7]">
              {formatCurrency(latest.total_revenue)}
            </p>
          </div>
          <div className="widget widget-rose animate-card-in" style={{ animationDelay: "60ms" }}>
            <p className="kpi-label mb-2">Total Expenses</p>
            <p className="kpi-number text-[#F43F5E]">
              {formatCurrency(latest.total_expenses)}
            </p>
          </div>
          <div className="widget widget-emerald animate-card-in" style={{ animationDelay: "120ms" }}>
            <p className="kpi-label mb-2">Net Assets</p>
            <p className="kpi-number text-[#10B981]">
              {formatCurrency(latest.net_assets_eoy)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   PEOPLE TAB
   ============================================================ */
function PeopleTab({ profile }: { profile: NonprofitProfile }) {
  const people = profile.people || [];

  if (people.length === 0) {
    return (
      <div className="text-center py-16 text-muted animate-card-in">
        <svg
          className="mx-auto mb-3"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          opacity="0.4"
        >
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <p className="text-lg mb-1">No people data available</p>
        <p className="text-sm">
          Officer and director information may not be included in this filing.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-card-in">
      <p className="text-sm text-muted mb-4">
        {people.length} officers and directors
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {people.map((person, i) => (
          <PersonCard key={`${person.person_name}-${i}`} person={person} />
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   FINANCIALS TAB
   ============================================================ */
function FinancialsTab({ profile }: { profile: NonprofitProfile }) {
  const chartData = profile.financials.map((f) => ({
    year: f.tax_year,
    Revenue: f.total_revenue || 0,
    Expenses: f.total_expenses || 0,
  }));

  const latest = profile.financials.at(-1);

  // Revenue composition donut
  const revenueData = latest
    ? [
        {
          name: "Contributions & Grants",
          value: latest.contributions_grants || 0,
          color: "#8B5CF6",
        },
        {
          name: "Program Revenue",
          value: latest.program_service_rev || 0,
          color: "#0891B2",
        },
        {
          name: "Investment Income",
          value: latest.investment_income || 0,
          color: "#F5A623",
        },
        {
          name: "Other Revenue",
          value: latest.other_revenue || 0,
          color: "#6B7280",
        },
      ].filter((d) => d.value > 0)
    : [];

  // Year-over-year table data
  const yoyData = [...profile.financials].reverse();

  return (
    <div className="space-y-6 animate-card-in">
      {/* Revenue & Expenses Area Chart */}
      <div className="widget-chart p-6">
        <h2 className="text-lg font-semibold mb-1">Revenue & Expenses</h2>
        <p className="text-xs text-muted mb-4">
          Financial trajectory over time
        </p>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B69B7" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3B69B7" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradExpenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#F43F5E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="year" tick={{ fontSize: 12 }} />
              <YAxis
                tickFormatter={(v: number) =>
                  v >= 1e9
                    ? `$${(v / 1e9).toFixed(1)}B`
                    : v >= 1e6
                    ? `$${(v / 1e6).toFixed(1)}M`
                    : `$${(v / 1e3).toFixed(0)}K`
                }
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value))}
                labelFormatter={(label) => `Tax Year ${label}`}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="Revenue"
                stroke="#3B69B7"
                strokeWidth={2.5}
                fill="url(#gradRevenue)"
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Area
                type="monotone"
                dataKey="Expenses"
                stroke="#F43F5E"
                strokeWidth={2.5}
                fill="url(#gradExpenses)"
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-muted text-sm">No financial data available.</p>
        )}
      </div>

      {/* Revenue Composition & YOY side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue Composition Donut */}
        {revenueData.length > 0 && (
          <div className="widget-chart p-6">
            <h2 className="text-base font-semibold mb-1">
              Revenue Composition
            </h2>
            <p className="text-xs text-muted mb-4">Latest tax year breakdown</p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={revenueData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {revenueData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2 justify-center">
              {revenueData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-xs text-muted">{entry.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Year-over-Year Table */}
        {yoyData.length > 0 && (
          <div className="widget-chart p-6">
            <h2 className="text-base font-semibold mb-1">
              Year-over-Year Comparison
            </h2>
            <p className="text-xs text-muted mb-4">
              Financial summary by tax year
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted">
                    <th className="px-3 py-2 text-xs font-medium">Year</th>
                    <th className="px-3 py-2 text-xs font-medium text-right">
                      Revenue
                    </th>
                    <th className="px-3 py-2 text-xs font-medium text-right">
                      Expenses
                    </th>
                    <th className="px-3 py-2 text-xs font-medium text-right">
                      Net Assets
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {yoyData.map((f) => (
                    <tr
                      key={f.tax_year}
                      className="border-b border-border/50 hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-3 py-2.5 font-medium">{f.tax_year}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs">
                        {formatCurrency(f.total_revenue)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs">
                        {formatCurrency(f.total_expenses)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs">
                        {formatCurrency(f.net_assets_eoy)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   RISK TAB
   ============================================================ */
function RiskTab({
  profile,
  peers,
}: {
  profile: NonprofitProfile;
  peers: PeerComparison | null;
}) {
  const hasWarnings =
    profile.warning_factors && profile.warning_factors.length > 0;
  const vulnPct =
    profile.vulnerability_score != null
      ? (profile.vulnerability_score * 100).toFixed(0)
      : null;

  // Radial gauge data for vulnerability
  const gaugeData = vulnPct
    ? [
        {
          name: "Vulnerability",
          value: Number(vulnPct),
          fill:
            profile.vulnerability_score! > 0.7
              ? "#EF4444"
              : profile.vulnerability_score! > 0.3
              ? "#F5A623"
              : "#10B981",
        },
      ]
    : [];

  return (
    <div className="space-y-6 animate-card-in">
      {/* Vulnerability Gauge */}
      <div className="widget-chart p-6">
        <div className="flex flex-wrap items-center gap-8">
          {/* Gauge */}
          <div className="flex-shrink-0">
            {gaugeData.length > 0 ? (
              <div className="relative">
                <ResponsiveContainer width={200} height={140}>
                  <RadialBarChart
                    cx="50%"
                    cy="100%"
                    innerRadius={60}
                    outerRadius={90}
                    startAngle={180}
                    endAngle={0}
                    barSize={12}
                    data={gaugeData}
                  >
                    <RadialBar
                      dataKey="value"
                      cornerRadius={6}
                      background={{ fill: "#F3F4F6" }}
                    />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-end justify-center pb-4">
                  <div className="text-center">
                    <p
                      className="text-3xl font-bold"
                      style={{
                        color: gaugeData[0].fill,
                      }}
                    >
                      {vulnPct}%
                    </p>
                    <p className="text-[10px] text-muted uppercase tracking-wider">
                      Vulnerability
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center px-8 py-6">
                <p className="text-4xl font-bold text-[#10B981]">Low</p>
                <p className="text-xs text-muted uppercase tracking-wider mt-1">
                  Risk Level
                </p>
              </div>
            )}
          </div>

          {/* Vulnerability bar */}
          {vulnPct != null && (
            <div className="flex-1 min-w-[200px]">
              <p className="text-sm font-medium text-foreground mb-2">
                Risk Assessment
              </p>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${vulnPct}%`,
                    background:
                      profile.vulnerability_score! > 0.7
                        ? "linear-gradient(90deg, #EF4444, #F87171)"
                        : profile.vulnerability_score! > 0.3
                        ? "linear-gradient(90deg, #F5A623, #FBBF24)"
                        : "linear-gradient(90deg, #10B981, #34D399)",
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted mt-1">
                <span>Low Risk</span>
                <span>High Risk</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Warning Factors */}
      {hasWarnings && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Early Warning Signals</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {profile.warning_factors!.map((factor, i) => (
              <div
                key={i}
                className={`rounded-2xl p-4 border ${
                  profile.vulnerability_score != null &&
                  profile.vulnerability_score > 0.7
                    ? "bg-red-50 border-red-200/60"
                    : "bg-amber-50 border-amber-200/60"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={
                      profile.vulnerability_score != null &&
                      profile.vulnerability_score > 0.7
                        ? "#EF4444"
                        : "#F5A623"
                    }
                    strokeWidth="2"
                    className="flex-shrink-0 mt-0.5"
                  >
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span className="text-sm leading-relaxed">{factor}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendation */}
      {profile.recommendation && (
        <div className="callout-box">
          <p className="text-sm font-semibold text-moobu-blue mb-1">
            Recommendation
          </p>
          <p className="text-sm text-foreground leading-relaxed">
            {profile.recommendation}
          </p>
        </div>
      )}

      {/* Peer Comparison */}
      {peers && peers.peers.length > 0 && (
        <div className="widget-chart p-6">
          <h2 className="text-lg font-semibold mb-1">Peer Comparison</h2>
          <p className="text-sm text-muted mb-4">
            {peers.peers.length} similar organizations in {profile.state}
            {peers.peer_avg_score != null &&
              ` (peer avg: ${formatScore(peers.peer_avg_score)})`}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="px-4 py-3 text-xs font-medium">
                    Organization
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-right">
                    Score
                  </th>
                  <th className="px-4 py-3 text-xs font-medium">Tier</th>
                  <th className="px-4 py-3 text-xs font-medium text-right">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Current org row */}
                <tr className="border-b border-border bg-moobu-blue-light/40">
                  <td className="px-4 py-3 font-medium">
                    {profile.org_name || "This Organization"}{" "}
                    <span className="text-xs text-muted">(current)</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">
                    {formatScore(profile.composite_score)}
                  </td>
                  <td className="px-4 py-3">
                    <TierBadge tier={profile.tier || "Stable"} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatCurrency(
                      profile.financials.at(-1)?.total_revenue ?? null
                    )}
                  </td>
                </tr>
                {peers.peers.map((peer) => (
                  <tr
                    key={peer.ein}
                    className="border-b border-border/50 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/org/${peer.ein}`}
                        className="hover:text-moobu-blue transition-colors"
                      >
                        {peer.org_name || "Unknown"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatScore(peer.composite_score)}
                    </td>
                    <td className="px-4 py-3">
                      <TierBadge tier={peer.tier || "Stable"} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(peer.latest_total_revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No risk info */}
      {!hasWarnings && !profile.recommendation && vulnPct == null && (
        <div className="text-center py-12 text-muted">
          <svg
            className="mx-auto mb-3"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            opacity="0.4"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <p className="text-lg mb-1">No risk indicators</p>
          <p className="text-sm">
            This organization shows healthy financial patterns.
          </p>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   SHARED COMPONENTS
   ============================================================ */

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-foreground truncate">{value}</p>
    </div>
  );
}

function ColorMetricBar({
  label,
  value,
  maxValue,
  color,
  index,
}: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  index: number;
}) {
  const pct = Math.min(Math.max((value / maxValue) * 100, 0), 100);

  return (
    <div
      className="flex items-center gap-3 animate-slide-in"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <span className="text-xs text-muted w-36 text-right flex-shrink-0">
        {label}
      </span>
      <div className="metric-bar-track flex-1">
        <div
          className="metric-bar-fill animate-bar-grow"
          style={{
            width: `${pct}%`,
            backgroundColor: color,
            animationDelay: `${index * 50 + 200}ms`,
          }}
        />
      </div>
      <span className="text-xs font-mono font-semibold w-10 text-right" style={{ color }}>
        {value.toFixed(1)}
      </span>
    </div>
  );
}
