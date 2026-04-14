"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
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
  formatFullCurrency,
  formatScore,
  formatDelta,
  reserveMonthsRaw,
  interpretMetric,
  metricScoreColor,
} from "@/lib/utils";
import ScoreRing from "@/components/ScoreRing";
import TierBadge from "@/components/TierBadge";
import PersonCard from "@/components/PersonCard";

const METRIC_LABELS: Record<string, string> = {
  revenue_concentration_hhi: "Revenue Diversification (HHI)",
  operating_reserve_ratio: "Operating Reserve Adequacy",
  revenue_growth_trend: "Revenue Growth (CAGR)",
  expense_vs_revenue_growth: "Expense Management",
  program_expense_ratio: "Mission Spending Efficiency",
  revenue_volatility: "Revenue Stability",
  net_asset_trend: "Net Asset Growth",
  surplus_deficit_consistency: "Surplus Consistency",
};

type Tab = "financial" | "leadership" | "revenue" | "risk";

export default function OrgXRayReport() {
  const params = useParams();
  const ein = params.ein as string;
  const [profile, setProfile] = useState<NonprofitProfile | null>(null);
  const [peers, setPeers] = useState<PeerComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("financial");

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
        <p>Loading X-Ray report...</p>
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
          Back to Portfolio X-Ray
        </Link>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "financial", label: "Financial Summary" },
    { key: "leadership", label: "Leadership" },
    { key: "revenue", label: "Revenue Analysis" },
    { key: "risk", label: "Risk Assessment" },
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
        Back to Portfolio X-Ray
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
            <p className="text-xs font-semibold text-moobu-blue uppercase tracking-wider mb-1">
              X-Ray Report
            </p>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                {profile.org_name || "Unknown Organization"}
              </h1>
              <TierBadge tier={profile.tier || "Stable"} />
            </div>

            {/* Mission */}
            {profile.mission_description && (
              <p className="text-sm text-muted leading-relaxed mb-4 max-w-[700px] line-clamp-3">
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
      {activeTab === "financial" && <FinancialSummaryTab profile={profile} />}
      {activeTab === "leadership" && <LeadershipTab profile={profile} />}
      {activeTab === "revenue" && <RevenueAnalysisTab profile={profile} />}
      {activeTab === "risk" && <RiskAssessmentTab profile={profile} peers={peers} />}
    </div>
  );
}

/* ============================================================
   FINANCIAL SUMMARY TAB
   ============================================================ */
function FinancialSummaryTab({ profile }: { profile: NonprofitProfile }) {
  const latest = profile.financials.at(-1);
  const previous = profile.financials.length >= 2 ? profile.financials.at(-2) : null;

  const revenueDelta = latest && previous
    ? formatDelta(latest.total_revenue, previous.total_revenue)
    : null;
  const expenseDelta = latest && previous
    ? formatDelta(latest.total_expenses, previous.total_expenses)
    : null;

  const netSurplus = latest?.rev_less_expenses ?? null;
  const surplusDelta = latest && previous
    ? formatDelta(latest.rev_less_expenses, previous.rev_less_expenses)
    : null;

  const reserveMonths = latest
    ? reserveMonthsRaw(latest.net_assets_eoy, latest.total_expenses)
    : null;

  // Program efficiency: program_expense_ratio metric (0-10 scale) or compute from financials
  const programRatioMetric = profile.metrics?.program_expense_ratio;
  const programEfficiency = programRatioMetric != null
    ? programRatioMetric * 10
    : (latest && latest.total_expenses && latest.total_expenses > 0
      ? ((latest.total_expenses - (latest.other_revenue || 0)) / latest.total_expenses * 100)
      : null);

  // Revenue concentration interpretation
  const hhi = profile.metrics?.revenue_concentration_hhi;
  const hhiLabel = hhi != null
    ? (hhi >= 7 ? "Diversified" : hhi >= 4 ? "Moderate" : "Concentrated")
    : null;

  // Reserve months color
  const reserveColor = reserveMonths != null
    ? (reserveMonths > 6 ? "#10B981" : reserveMonths >= 3 ? "#F5A623" : "#EF4444")
    : "#6B7280";

  const metricEntries = profile.metrics
    ? Object.entries(METRIC_LABELS).map(([key, label]) => ({
        key,
        label,
        value:
          (profile.metrics as unknown as Record<string, number | null>)[key] ?? 0,
      }))
    : [];

  // Chart data: Revenue vs Expenses grouped bars
  const barChartData = profile.financials.map((f) => ({
    year: String(f.tax_year),
    Revenue: f.total_revenue || 0,
    Expenses: f.total_expenses || 0,
  }));

  // Surplus/Deficit trend data
  const surplusChartData = profile.financials.map((f) => ({
    year: String(f.tax_year),
    value: f.rev_less_expenses || 0,
  }));

  // Collapsible explanation state
  const [showExplanation, setShowExplanation] = useState(false);

  return (
    <div className="space-y-6 animate-card-in">
      {/* === Key Metrics Row === */}
      {latest && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Revenue */}
          <div className="metric-widget text-center">
            <p className="metric-widget-label">Total Revenue</p>
            <p className="metric-widget-value text-[#3B69B7] mt-1">
              {formatFullCurrency(latest.total_revenue)}
            </p>
            {revenueDelta && (
              <p className={`mt-2 text-xs font-semibold ${revenueDelta.positive ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                {revenueDelta.text} vs prior year
              </p>
            )}
          </div>

          {/* Total Expenses */}
          <div className="metric-widget text-center">
            <p className="metric-widget-label">Total Expenses</p>
            <p className="metric-widget-value text-[#F43F5E] mt-1">
              {formatFullCurrency(latest.total_expenses)}
            </p>
            {expenseDelta && (
              <p className={`mt-2 text-xs font-semibold ${!expenseDelta.positive ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                {expenseDelta.text} vs prior year
              </p>
            )}
          </div>

          {/* Net Surplus/Deficit */}
          <div className="metric-widget text-center">
            <p className="metric-widget-label">Net Surplus / Deficit</p>
            <p
              className="metric-widget-value mt-1"
              style={{ color: (netSurplus ?? 0) >= 0 ? "#10B981" : "#EF4444" }}
            >
              {formatFullCurrency(netSurplus)}
            </p>
            {surplusDelta && (
              <p className={`mt-2 text-xs font-semibold ${surplusDelta.positive ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                {surplusDelta.text} vs prior year
              </p>
            )}
          </div>

          {/* Net Asset Position */}
          <div className="metric-widget text-center">
            <p className="metric-widget-label">Net Asset Position</p>
            <p className="metric-widget-value text-[#8B5CF6] mt-1">
              {formatFullCurrency(latest.net_assets_eoy)}
            </p>
          </div>
        </div>
      )}

      {/* === Operating Health Row === */}
      {latest && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Operating Reserve */}
          <div className="metric-widget">
            <p className="metric-widget-label">Operating Reserve</p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="metric-widget-value" style={{ color: reserveColor }}>
                {reserveMonths != null ? reserveMonths.toFixed(1) : "N/A"}
              </p>
              <span className="text-sm font-medium text-muted">months</span>
              <span
                className="ml-auto inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: reserveColor }}
              />
            </div>
            <p className="text-xs text-muted mt-2">
              {reserveMonths != null
                ? reserveMonths > 6
                  ? "Healthy runway to cover operating costs"
                  : reserveMonths >= 3
                  ? "Moderate -- approaching recommended 6-month target"
                  : "Below recommended minimum of 3 months"
                : "Insufficient data to calculate"}
            </p>
          </div>

          {/* Program Efficiency */}
          <div className="metric-widget">
            <p className="metric-widget-label">Program Efficiency</p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="metric-widget-value text-[#0891B2]">
                {programEfficiency != null ? `${programEfficiency.toFixed(1)}%` : "N/A"}
              </p>
            </div>
            <p className="text-xs text-muted mt-2">
              {programEfficiency != null
                ? `Of every dollar, ${(programEfficiency / 100).toFixed(2)} cents goes to mission`
                : "Insufficient data to calculate"}
            </p>
          </div>

          {/* Revenue Concentration */}
          <div className="metric-widget">
            <p className="metric-widget-label">Revenue Concentration</p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="metric-widget-value text-[#F5A623]">
                {hhi != null ? hhi.toFixed(1) : "N/A"}
                <span className="text-sm font-normal text-muted"> /10</span>
              </p>
              {hhiLabel && (
                <span
                  className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    background: hhi != null && hhi >= 7 ? "#DCFCE7" : hhi != null && hhi >= 4 ? "#FEF3E2" : "#FEE2E2",
                    color: hhi != null && hhi >= 7 ? "#166534" : hhi != null && hhi >= 4 ? "#92400E" : "#991B1B",
                  }}
                >
                  {hhiLabel}
                </span>
              )}
            </div>
            <p className="text-xs text-muted mt-2">
              {hhi != null ? interpretMetric("revenue_concentration_hhi", hhi) : "Insufficient data"}
            </p>
          </div>
        </div>
      )}

      {/* === Revenue vs Expenses Bar Chart === */}
      {barChartData.length > 0 && (
        <div className="widget-chart p-6">
          <h2 className="text-lg font-semibold mb-1">Revenue vs Expenses</h2>
          <p className="text-xs text-muted mb-4">
            Year-over-year comparison of total revenue and total expenses
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barChartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="year" tick={{ fontSize: 12 }} />
              <YAxis
                tickFormatter={(v) =>
                  Number(v) >= 1e9
                    ? `$${(Number(v) / 1e9).toFixed(1)}B`
                    : Number(v) >= 1e6
                    ? `$${(Number(v) / 1e6).toFixed(1)}M`
                    : `$${(Number(v) / 1e3).toFixed(0)}K`
                }
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value) => formatFullCurrency(Number(value))}
                labelFormatter={(label) => `Tax Year ${label}`}
              />
              <Legend />
              <Bar dataKey="Revenue" fill="#3B69B7" radius={[4, 4, 0, 0]} barSize={32} />
              <Bar dataKey="Expenses" fill="#F5A623" radius={[4, 4, 0, 0]} barSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* === Surplus/Deficit Trend === */}
      {surplusChartData.length > 0 && (
        <div className="widget-chart p-6">
          <h2 className="text-lg font-semibold mb-1">Surplus / Deficit Trend</h2>
          <p className="text-xs text-muted mb-4">
            Net income (revenue minus expenses) by tax year
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={surplusChartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="year" tick={{ fontSize: 12 }} />
              <YAxis
                tickFormatter={(v) =>
                  Number(v) >= 1e9
                    ? `$${(Number(v) / 1e9).toFixed(1)}B`
                    : Number(v) >= 1e6
                    ? `$${(Number(v) / 1e6).toFixed(1)}M`
                    : Number(v) <= -1e6
                    ? `-$${(Math.abs(Number(v)) / 1e6).toFixed(1)}M`
                    : `$${(Number(v) / 1e3).toFixed(0)}K`
                }
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value) => formatFullCurrency(Number(value))}
                labelFormatter={(label) => `Tax Year ${label}`}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={36} name="Net Income">
                {surplusChartData.map((entry, i) => (
                  <Cell key={i} fill={entry.value >= 0 ? "#10B981" : "#EF4444"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* === Resilience Score Breakdown === */}
      {metricEntries.length > 0 && (
        <div className="widget-chart p-6">
          <h2 className="text-lg font-semibold mb-1">
            Resilience Score Breakdown
          </h2>
          <p className="text-xs text-muted mb-6">
            Each metric is scored 0 to 10. Colors indicate performance: green (7-10 strong), yellow (4-6.9 moderate), red (0-3.9 at risk).
          </p>
          <div className="space-y-5">
            {metricEntries.map((m, i) => {
              const color = metricScoreColor(m.value);
              const pct = Math.min(Math.max((m.value / 10) * 100, 0), 100);
              const explanation = interpretMetric(m.key, m.value);

              return (
                <div
                  key={m.key}
                  className="animate-slide-in"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground">
                      {m.label}
                    </span>
                    <span
                      className="text-sm font-bold tabular-nums"
                      style={{ color }}
                    >
                      {m.value.toFixed(1)} / 10
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full animate-bar-grow"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: color,
                        animationDelay: `${i * 50 + 200}ms`,
                      }}
                    />
                  </div>
                  {/* Interpretation */}
                  <p className="text-xs text-muted mt-1">
                    {explanation}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* === Understanding the Resilience Score === */}
      <div className="advisory-note">
        <button
          onClick={() => setShowExplanation(!showExplanation)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#3B69B7"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span className="advisory-note-title" style={{ marginBottom: 0 }}>
              Understanding the Resilience Score
            </span>
          </div>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#3B69B7"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: showExplanation ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {showExplanation && (
          <div className="mt-4 space-y-3 text-sm text-foreground leading-relaxed">
            <p>
              The Resilience Score (0-100) measures a nonprofit&apos;s financial health and ability to withstand economic shocks. It combines 8 financial metrics extracted from IRS Form 990 filings.
            </p>

            <div>
              <p className="font-semibold mb-1">How it&apos;s calculated:</p>
              <p>
                Each metric is scored 0-10 based on the organization&apos;s performance relative to all nonprofits in the database. Revenue Diversification and Operating Reserves are weighted 2x because they are the strongest predictors of financial resilience. The weighted average is then scaled to 0-100.
              </p>
            </div>

            <div>
              <p className="font-semibold mb-1">Score tiers:</p>
              <ul className="space-y-1 ml-1">
                <li className="flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#10B981]" />
                  <span><span className="font-semibold">75-100 Thriving:</span> Strong financial position with diversified revenue and adequate reserves</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#3B69B7]" />
                  <span><span className="font-semibold">50-74 Stable:</span> Generally healthy but may have areas for improvement</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#F5A623]" />
                  <span><span className="font-semibold">25-49 Needs Support:</span> Showing financial stress signals that warrant attention</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
                  <span><span className="font-semibold">0-24 Urgent:</span> Multiple critical risk factors requiring immediate intervention</span>
                </li>
              </ul>
            </div>

            <p className="text-xs text-muted pt-1">
              Data source: IRS Form 990 public filings, analyzed across multiple tax years.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   LEADERSHIP TAB
   ============================================================ */
function LeadershipTab({ profile }: { profile: NonprofitProfile }) {
  const people = profile.people || [];
  const officers = people.filter((p) => p.is_officer);
  const directors = people.filter((p) => p.is_director);

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
    <div className="animate-card-in space-y-4">
      {/* Count summary */}
      <div className="flex gap-4 mb-2">
        <div className="metric-widget flex-1">
          <p className="metric-widget-label">Officers</p>
          <p className="metric-widget-value text-[#3B69B7]">{officers.length}</p>
        </div>
        <div className="metric-widget flex-1">
          <p className="metric-widget-label">Directors</p>
          <p className="metric-widget-value text-[#10B981]">{directors.length}</p>
        </div>
        <div className="metric-widget flex-1">
          <p className="metric-widget-label">Total</p>
          <p className="metric-widget-value text-[#8B5CF6]">{people.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {people.map((person, i) => (
          <PersonCard key={`${person.person_name}-${i}`} person={person} />
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   REVENUE ANALYSIS TAB
   ============================================================ */
function RevenueAnalysisTab({ profile }: { profile: NonprofitProfile }) {
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
      {/* Revenue & Expense Trend */}
      <div className="widget-chart p-6">
        <h2 className="text-lg font-semibold mb-1">Revenue & Expense Trend</h2>
        <p className="text-xs text-muted mb-4">
          Multi-year financial trajectory
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
                tickFormatter={(v) =>
                  Number(v) >= 1e9
                    ? `$${(Number(v) / 1e9).toFixed(1)}B`
                    : Number(v) >= 1e6
                    ? `$${(Number(v) / 1e6).toFixed(1)}M`
                    : `$${(Number(v) / 1e3).toFixed(0)}K`
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

        {/* Year-over-Year Financial Summary Table */}
        {yoyData.length > 0 && (
          <div className="widget-chart p-6">
            <h2 className="text-base font-semibold mb-1">
              Year-over-Year Financial Summary
            </h2>
            <p className="text-xs text-muted mb-4">
              Key metrics with change indicators
            </p>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th className="col-right">Revenue</th>
                    <th className="col-right">Expenses</th>
                    <th className="col-right">Surplus/Deficit</th>
                    <th className="col-right">Net Assets</th>
                  </tr>
                </thead>
                <tbody>
                  {yoyData.map((f, idx) => {
                    const nextYear = idx < yoyData.length - 1 ? yoyData[idx + 1] : null;
                    const revDelta = nextYear
                      ? formatDelta(f.total_revenue, nextYear.total_revenue)
                      : null;
                    return (
                      <tr key={f.tax_year}>
                        <td className="font-medium">{f.tax_year}</td>
                        <td className="col-right col-mono">
                          {formatCurrency(f.total_revenue)}
                          {revDelta && (
                            <span className={`block text-[10px] ${revDelta.positive ? "delta-positive" : "delta-negative"}`}>
                              {revDelta.positive ? "\u25B2" : "\u25BC"} {revDelta.text}
                            </span>
                          )}
                        </td>
                        <td className="col-right col-mono">
                          {formatCurrency(f.total_expenses)}
                        </td>
                        <td className="col-right col-mono">
                          <span
                            style={{
                              color:
                                (f.rev_less_expenses ?? 0) >= 0
                                  ? "#10B981"
                                  : "#EF4444",
                            }}
                          >
                            {formatCurrency(f.rev_less_expenses)}
                          </span>
                        </td>
                        <td className="col-right col-mono">
                          {formatCurrency(f.net_assets_eoy)}
                        </td>
                      </tr>
                    );
                  })}
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
   RISK ASSESSMENT TAB
   ============================================================ */
function RiskAssessmentTab({
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
          name: "Risk Probability",
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
      {/* Risk Probability Gauge */}
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
                      Risk Probability
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

      {/* Risk Indicators */}
      {hasWarnings && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Risk Indicators</h2>
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

      {/* Advisory Note */}
      {profile.recommendation && (
        <div className="advisory-note">
          <p className="advisory-note-title">Advisory Note</p>
          <p className="text-sm text-foreground leading-relaxed">
            {profile.recommendation}
          </p>
        </div>
      )}

      {/* Peer Benchmarking */}
      {peers && peers.peers.length > 0 && (
        <div className="widget-chart p-6">
          <h2 className="text-lg font-semibold mb-1">Peer Benchmarking</h2>
          <p className="text-sm text-muted mb-4">
            {peers.peers.length} similar organizations in {profile.state}
            {peers.peer_avg_score != null &&
              ` | Peer avg: ${formatScore(peers.peer_avg_score)}`}
          </p>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Organization</th>
                  <th className="col-right">Score</th>
                  <th>Tier</th>
                  <th className="col-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {/* Current org row highlighted */}
                <tr style={{ background: "rgba(59, 105, 183, 0.06)" }}>
                  <td className="font-medium">
                    {profile.org_name || "This Organization"}{" "}
                    <span className="text-xs text-muted">(current)</span>
                  </td>
                  <td className="col-right col-mono font-semibold">
                    {formatScore(profile.composite_score)}
                  </td>
                  <td>
                    <TierBadge tier={profile.tier || "Stable"} />
                  </td>
                  <td className="col-right col-mono">
                    {formatCurrency(
                      profile.financials.at(-1)?.total_revenue ?? null
                    )}
                  </td>
                </tr>
                {peers.peers.map((peer) => (
                  <tr key={peer.ein}>
                    <td>
                      <Link
                        href={`/org/${peer.ein}`}
                        className="hover:text-moobu-blue transition-colors"
                      >
                        {peer.org_name || "Unknown"}
                      </Link>
                    </td>
                    <td className="col-right col-mono">
                      {formatScore(peer.composite_score)}
                    </td>
                    <td>
                      <TierBadge tier={peer.tier || "Stable"} />
                    </td>
                    <td className="col-right col-mono">
                      {formatCurrency(peer.latest_total_revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No risk info fallback */}
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
