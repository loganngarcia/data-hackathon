"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  AreaChart,
  Area,
  Cell,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
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
import ResilienceGauge from "@/components/ResilienceGauge";
import StatusBadge from "@/components/StatusBadge";
import PersonCard from "@/components/PersonCard";

const METRIC_LABELS: Record<string, string> = {
  revenue_concentration_hhi: "Revenue Diversification",
  operating_reserve_ratio: "Operating Reserve",
  revenue_growth_trend: "Revenue Growth",
  expense_vs_revenue_growth: "Expense Management",
  program_expense_ratio: "Program Efficiency",
  revenue_volatility: "Revenue Stability",
  net_asset_trend: "Net Asset Growth",
  surplus_deficit_consistency: "Surplus Consistency",
};

type Tab = "summary" | "people" | "financials" | "risk";

export default function OrgDetailPage() {
  const params = useParams();
  const ein = params.ein as string;
  const [profile, setProfile] = useState<NonprofitProfile | null>(null);
  const [peers, setPeers] = useState<PeerComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("summary");

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
      <div className="p-12 text-center text-ink-tertiary">
        <div
          className="inline-block w-5 h-5 border-2 border-brand/20 border-t-brand rounded-full mb-3"
          style={{ animation: "spin 0.8s linear infinite" }}
        />
        <p className="text-sm">Loading report...</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="p-8 text-center">
        <p className="text-status-urgent text-base mb-2">{error || "Not found"}</p>
        <Link
          href="/"
          className="text-brand text-sm mt-2 inline-block hover:underline"
        >
          Back to Portfolio
        </Link>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "summary", label: "Summary" },
    { key: "people", label: "People" },
    { key: "financials", label: "Financials" },
    { key: "risk", label: "Risk" },
  ];

  // Build detail line
  const detailParts: string[] = [];
  if (profile.state) detailParts.push(profile.state);
  if (profile.formation_year) detailParts.push(`Founded ${profile.formation_year}`);
  if (profile.employee_count != null && profile.employee_count > 0)
    detailParts.push(`${profile.employee_count} employees`);
  detailParts.push(`EIN ${profile.ein}`);

  return (
    <div className="px-6 py-5 max-w-[1440px] mx-auto">
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-brand hover:underline mb-4"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Portfolio
      </Link>

      {/* Header */}
      <div className="card mb-5">
        <div className="flex flex-wrap items-start gap-6">
          {/* Resilience Gauge */}
          <div className="flex-shrink-0 pt-1">
            <ResilienceGauge
              score={profile.composite_score ?? 0}
              tier={profile.tier ?? "Stable"}
              size="lg"
            />
          </div>

          {/* Org Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl text-ink mb-1" style={{ fontWeight: 600 }}>
              {profile.org_name || "Unknown Organization"}
            </h1>
            {profile.mission_description && (
              <p className="text-sm text-ink-secondary leading-relaxed mb-2 max-w-[600px] line-clamp-2">
                {profile.mission_description}
              </p>
            )}
            <p className="text-xs text-ink-tertiary">
              {detailParts.join(" \u00B7 ")}
            </p>
          </div>

          {/* Right: badge + link */}
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <StatusBadge tier={profile.tier || "Stable"} />
            <a
              href={`https://projects.propublica.org/nonprofits/organizations/${profile.ein}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand hover:underline"
            >
              ProPublica Profile
            </a>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex mb-5" style={{ borderBottom: "1px solid var(--boundary)" }}>
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
      {activeTab === "summary" && <SummaryTab profile={profile} />}
      {activeTab === "people" && <PeopleTab profile={profile} />}
      {activeTab === "financials" && <FinancialsTab profile={profile} />}
      {activeTab === "risk" && <RiskTab profile={profile} peers={peers} />}
    </div>
  );
}

/* ============================================================
   SUMMARY TAB
   ============================================================ */
function SummaryTab({ profile }: { profile: NonprofitProfile }) {
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

  const programRatioMetric = profile.metrics?.program_expense_ratio;
  const programEfficiency = programRatioMetric != null
    ? programRatioMetric * 10
    : null;

  const hhi = profile.metrics?.revenue_concentration_hhi;
  const hhiLabel = hhi != null
    ? (hhi >= 7 ? "Diversified" : hhi >= 4 ? "Moderate" : "Concentrated")
    : null;

  const reserveColor = reserveMonths != null
    ? (reserveMonths > 6 ? "var(--status-healthy)" : reserveMonths >= 3 ? "var(--status-attention)" : "var(--status-urgent)")
    : "var(--ink-muted)";

  const metricEntries = profile.metrics
    ? Object.entries(METRIC_LABELS).map(([key, label]) => ({
        key,
        label,
        value:
          (profile.metrics as unknown as Record<string, number | null>)[key] ?? 0,
      }))
    : [];

  const [showMethodology, setShowMethodology] = useState(false);

  return (
    <div className="space-y-5">
      {/* Key Metrics Grid */}
      {latest && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-px" style={{ background: "var(--boundary)" }}>
          <MetricCell
            label="Total Revenue"
            value={formatFullCurrency(latest.total_revenue)}
            delta={revenueDelta}
          />
          <MetricCell
            label="Total Expenses"
            value={formatFullCurrency(latest.total_expenses)}
            delta={expenseDelta}
            invertDelta
          />
          <MetricCell
            label="Net Surplus"
            value={formatFullCurrency(netSurplus)}
            delta={surplusDelta}
            valueColor={(netSurplus ?? 0) >= 0 ? "var(--status-healthy)" : "var(--status-urgent)"}
          />
          <MetricCell
            label="Operating Reserve"
            value={reserveMonths != null ? `${reserveMonths.toFixed(1)} months` : "N/A"}
            valueColor={reserveColor}
            dotColor={reserveColor}
          />
          <MetricCell
            label="Program Efficiency"
            value={programEfficiency != null ? `${programEfficiency.toFixed(1)}%` : "N/A"}
          />
          <MetricCell
            label="Revenue Concentration"
            value={hhi != null ? `${hhi.toFixed(1)} / 10` : "N/A"}
            suffix={hhiLabel || undefined}
          />
        </div>
      )}

      {/* Score Breakdown */}
      {metricEntries.length > 0 && (
        <div className="card">
          <h2 className="text-base text-ink mb-4" style={{ fontWeight: 600 }}>
            Resilience Score Breakdown
          </h2>
          <div className="space-y-4">
            {metricEntries.map((m) => {
              const color = metricScoreColor(m.value);
              const pct = Math.min(Math.max((m.value / 10) * 100, 0), 100);
              const explanation = interpretMetric(m.key, m.value);

              return (
                <div key={m.key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-ink">
                      {m.label}
                    </span>
                    <span
                      className="text-sm tabular-nums"
                      style={{ fontWeight: 600, color }}
                    >
                      {m.value.toFixed(1)} / 10
                    </span>
                  </div>
                  {/* Bar */}
                  <div
                    className="rounded-full overflow-hidden"
                    style={{ height: 4, background: "var(--paper-inset)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                  <p className="text-xs text-ink-tertiary mt-1">
                    {explanation}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Methodology (collapsible) */}
      <div className="card">
        <button
          onClick={() => setShowMethodology(!showMethodology)}
          className="w-full flex items-center justify-between text-left"
        >
          <span className="text-sm text-ink-secondary" style={{ fontWeight: 600 }}>
            How this score is calculated
          </span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-ink-tertiary"
            style={{
              transform: showMethodology ? "rotate(180deg)" : "rotate(0deg)",
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {showMethodology && (
          <div className="mt-3 space-y-2 text-sm text-ink-secondary leading-relaxed">
            <p>
              The Resilience Score (0-100) measures a nonprofit&apos;s financial health and ability to
              withstand economic shocks. It combines 8 financial metrics extracted from IRS Form 990 filings.
            </p>
            <p>
              Each metric is scored 0-10 based on performance relative to all nonprofits in the database.
              Revenue Diversification and Operating Reserves are weighted 2x because they are the strongest
              predictors of financial resilience. The weighted average is scaled to 0-100.
            </p>
            <p className="text-xs text-ink-tertiary pt-1">
              Data source: IRS Form 990 public filings.{" "}
              <a
                href={`https://projects.propublica.org/nonprofits/organizations/${profile.ein}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand hover:underline"
              >
                View on ProPublica
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   METRIC CELL — Used in the key metrics grid
   ============================================================ */
function MetricCell({
  label,
  value,
  delta,
  invertDelta,
  valueColor,
  dotColor,
  suffix,
}: {
  label: string;
  value: string;
  delta?: { text: string; positive: boolean } | null;
  invertDelta?: boolean;
  valueColor?: string;
  dotColor?: string;
  suffix?: string;
}) {
  const deltaIsGood = delta
    ? (invertDelta ? !delta.positive : delta.positive)
    : false;

  return (
    <div className="bg-paper-raised p-4">
      <p className="text-xs text-ink-tertiary mb-1" style={{ letterSpacing: "0.02em" }}>
        {label}
      </p>
      <div className="flex items-baseline gap-2">
        {dotColor && (
          <span
            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: dotColor }}
          />
        )}
        <p
          className="text-lg tabular-nums"
          style={{ fontWeight: 600, color: valueColor || "var(--ink)" }}
        >
          {value}
        </p>
        {suffix && (
          <span className="text-xs text-ink-tertiary">{suffix}</span>
        )}
      </div>
      {delta && (
        <p
          className="text-xs mt-1 tabular-nums"
          style={{
            fontWeight: 600,
            color: deltaIsGood ? "var(--status-healthy)" : "var(--status-urgent)",
          }}
        >
          {delta.text} vs prior
        </p>
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
      <div className="text-center py-16 text-ink-tertiary">
        <p className="text-base mb-1">No people data available</p>
        <p className="text-sm">
          Officer and director information may not be included in this filing.
        </p>
      </div>
    );
  }

  const officers = people.filter((p) => p.is_officer);
  const directors = people.filter((p) => p.is_director);

  return (
    <div className="space-y-4">
      {/* Count summary */}
      <div className="flex gap-5 text-sm text-ink-tertiary">
        <span>{officers.length} officers</span>
        <span>{directors.length} directors</span>
        <span>{people.length} total</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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

  // Revenue composition donut — monochrome-ish palette
  const revenueData = latest
    ? [
        { name: "Contributions & Grants", value: latest.contributions_grants || 0, color: "#3B69B7" },
        { name: "Program Revenue", value: latest.program_service_rev || 0, color: "#4A5568" },
        { name: "Investment Income", value: latest.investment_income || 0, color: "#718096" },
        { name: "Other Revenue", value: latest.other_revenue || 0, color: "#A0AEC0" },
      ].filter((d) => d.value > 0)
    : [];

  // Year-over-year table
  const yoyData = [...profile.financials].reverse();

  return (
    <div className="space-y-5">
      {/* Revenue & Expense Trend */}
      <div className="card">
        <h2 className="text-base text-ink mb-1" style={{ fontWeight: 600 }}>
          Revenue & Expense Trend
        </h2>
        <p className="text-xs text-ink-tertiary mb-4">
          Multi-year financial trajectory
        </p>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--boundary)" />
              <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#718096" }} />
              <YAxis
                tickFormatter={(v) =>
                  Number(v) >= 1e9
                    ? `$${(Number(v) / 1e9).toFixed(1)}B`
                    : Number(v) >= 1e6
                    ? `$${(Number(v) / 1e6).toFixed(1)}M`
                    : `$${(Number(v) / 1e3).toFixed(0)}K`
                }
                tick={{ fontSize: 12, fill: "#718096" }}
              />
              <Tooltip
                formatter={(value) => formatFullCurrency(Number(value))}
                labelFormatter={(label) => `Tax Year ${label}`}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="Revenue"
                stroke="#3B69B7"
                strokeWidth={2}
                fill="#3B69B7"
                fillOpacity={0.05}
                dot={{ r: 3, fill: "#3B69B7" }}
              />
              <Area
                type="monotone"
                dataKey="Expenses"
                stroke="#718096"
                strokeWidth={2}
                fill="#718096"
                fillOpacity={0.03}
                dot={{ r: 3, fill: "#718096" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-ink-tertiary text-sm">No financial data available.</p>
        )}
      </div>

      {/* Revenue Composition & YoY side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue Composition */}
        {revenueData.length > 0 && (
          <div className="card">
            <h2 className="text-base text-ink mb-1" style={{ fontWeight: 600 }}>
              Revenue Composition
            </h2>
            <p className="text-xs text-ink-tertiary mb-4">Latest tax year</p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={revenueData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={2}
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
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2 justify-center">
              {revenueData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-xs text-ink-tertiary">{entry.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* YoY Table */}
        {yoyData.length > 0 && (
          <div className="card-flush">
            <div className="px-4 py-3">
              <h2 className="text-base text-ink" style={{ fontWeight: 600 }}>
                Year-over-Year
              </h2>
              <p className="text-xs text-ink-tertiary">Key metrics with change indicators</p>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th className="col-right">Revenue</th>
                    <th className="col-right">Expenses</th>
                    <th className="col-right">Net</th>
                    <th className="col-right">Assets</th>
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
                        <td className="text-sm" style={{ fontWeight: 500 }}>{f.tax_year}</td>
                        <td className="col-right col-mono">
                          {formatCurrency(f.total_revenue)}
                          {revDelta && (
                            <span
                              className="block text-[10px] tabular-nums"
                              style={{
                                fontWeight: 600,
                                color: revDelta.positive ? "var(--status-healthy)" : "var(--status-urgent)",
                              }}
                            >
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
                              color: (f.rev_less_expenses ?? 0) >= 0
                                ? "var(--status-healthy)"
                                : "var(--status-urgent)",
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

  const vulnColor =
    profile.vulnerability_score != null
      ? profile.vulnerability_score > 0.7
        ? "var(--status-urgent)"
        : profile.vulnerability_score > 0.3
        ? "var(--status-attention)"
        : "var(--status-healthy)"
      : "var(--ink-muted)";

  return (
    <div className="space-y-5">
      {/* Vulnerability Gauge */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-8">
          <div className="flex-shrink-0">
            {vulnPct != null ? (
              <div className="text-center">
                <p className="text-3xl tabular-nums" style={{ fontWeight: 600, color: vulnColor }}>
                  {vulnPct}%
                </p>
                <p className="text-xs text-ink-tertiary mt-0.5" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Risk Probability
                </p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-2xl text-status-healthy" style={{ fontWeight: 600 }}>Low</p>
                <p className="text-xs text-ink-tertiary mt-0.5" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Risk Level
                </p>
              </div>
            )}
          </div>

          {vulnPct != null && (
            <div className="flex-1 min-w-[200px]">
              <div
                className="rounded-full overflow-hidden"
                style={{ height: 6, background: "var(--paper-inset)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${vulnPct}%`,
                    backgroundColor: vulnColor,
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-ink-muted mt-1">
                <span>Low Risk</span>
                <span>High Risk</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Warning Factors */}
      {hasWarnings && (
        <div className="card">
          <h2 className="text-base text-ink mb-3" style={{ fontWeight: 600 }}>
            Risk Indicators
          </h2>
          <ul className="space-y-2">
            {profile.warning_factors!.map((factor, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-ink-secondary"
              >
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                  style={{
                    backgroundColor:
                      profile.vulnerability_score != null && profile.vulnerability_score > 0.7
                        ? "var(--status-urgent)"
                        : "var(--status-attention)",
                  }}
                />
                {factor}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Advisory Note */}
      {profile.recommendation && (
        <div className="card" style={{ borderLeft: "3px solid var(--brand)" }}>
          <p className="text-xs text-brand mb-1" style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Advisory Note
          </p>
          <p className="text-sm text-ink-secondary leading-relaxed">
            {profile.recommendation}
          </p>
        </div>
      )}

      {/* Peer Benchmarking */}
      {peers && peers.peers.length > 0 && (
        <div className="card-flush">
          <div className="px-4 py-3">
            <h2 className="text-base text-ink" style={{ fontWeight: 600 }}>
              Peer Benchmarking
            </h2>
            <p className="text-xs text-ink-tertiary">
              {peers.peers.length} similar organizations in {profile.state}
              {peers.peer_avg_score != null &&
                ` | Peer avg: ${formatScore(peers.peer_avg_score)}`}
            </p>
          </div>
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
                {/* Current org highlighted */}
                <tr style={{ background: "var(--brand-light)" }}>
                  <td>
                    <span className="text-sm" style={{ fontWeight: 500 }}>
                      {profile.org_name || "This Organization"}
                    </span>
                    <span className="text-xs text-ink-muted ml-1">(current)</span>
                  </td>
                  <td className="col-right col-mono" style={{ fontWeight: 600 }}>
                    {formatScore(profile.composite_score)}
                  </td>
                  <td>
                    <StatusBadge tier={profile.tier || "Stable"} />
                  </td>
                  <td className="col-right col-mono">
                    {formatCurrency(profile.financials.at(-1)?.total_revenue ?? null)}
                  </td>
                </tr>
                {peers.peers.map((peer) => (
                  <tr key={peer.ein}>
                    <td>
                      <Link
                        href={`/org/${peer.ein}`}
                        className="text-sm hover:text-brand"
                      >
                        {peer.org_name || "Unknown"}
                      </Link>
                    </td>
                    <td className="col-right col-mono">
                      {formatScore(peer.composite_score)}
                    </td>
                    <td>
                      <StatusBadge tier={peer.tier || "Stable"} />
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

      {/* No risk info */}
      {!hasWarnings && !profile.recommendation && vulnPct == null && (
        <div className="text-center py-12 text-ink-tertiary">
          <p className="text-base mb-1">No risk indicators</p>
          <p className="text-sm">
            This organization shows healthy financial patterns.
          </p>
        </div>
      )}
    </div>
  );
}
