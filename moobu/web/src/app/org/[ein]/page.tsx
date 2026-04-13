"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { fetchNonprofit, fetchPeers } from "@/lib/api";
import type { NonprofitProfile, PeerComparison } from "@/lib/types";
import Link from "next/link";
import {
  formatCurrency,
  formatScore,
  tierColor,
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

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "people", label: "People" },
    { key: "financials", label: "Financials" },
    { key: "risk", label: "Risk" },
  ];

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-moobu-blue hover:underline mb-5"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Portfolio
      </Link>

      {/* Header Section */}
      <div className="glass-card p-6 mb-6 animate-card-in">
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
              <h1 className="text-2xl font-bold text-foreground">
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
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                  {profile.state}
                </span>
              )}
              {profile.formation_year && (
                <span className="detail-pill">
                  Founded {profile.formation_year}
                </span>
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
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                  Website
                </a>
              )}
              <span className="detail-pill">
                EIN: {profile.ein}
              </span>
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
      {activeTab === "overview" && (
        <OverviewTab profile={profile} />
      )}
      {activeTab === "people" && (
        <PeopleTab profile={profile} />
      )}
      {activeTab === "financials" && (
        <FinancialsTab profile={profile} />
      )}
      {activeTab === "risk" && (
        <RiskTab profile={profile} peers={peers} />
      )}
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
          (profile.metrics as unknown as Record<string, number | null>)[key] ??
          0,
      }))
    : [];

  const latest = profile.financials.at(-1);

  return (
    <div className="space-y-6 animate-card-in">
      {/* About card */}
      <div className="glass-card p-6">
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
          <MiniStat
            label="Confidence"
            value={profile.confidence || "N/A"}
          />
        </div>
      </div>

      {/* Score Breakdown */}
      {metricEntries.length > 0 && (
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">
            Resilience Score Breakdown
          </h2>
          <div className="space-y-3">
            {metricEntries.map((m) => (
              <MetricBar
                key={m.key}
                label={m.label}
                value={m.value}
                maxValue={10}
                tier={profile.tier}
              />
            ))}
          </div>
        </div>
      )}

      {/* Key Financial Stats */}
      {latest && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FinStatCard
            label="Total Revenue"
            value={formatCurrency(latest.total_revenue)}
            color="#3B69B7"
          />
          <FinStatCard
            label="Total Expenses"
            value={formatCurrency(latest.total_expenses)}
            color="#F5A623"
          />
          <FinStatCard
            label="Net Assets"
            value={formatCurrency(latest.net_assets_eoy)}
            color="#16A34A"
          />
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
        <svg className="mx-auto mb-3" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <p className="text-lg mb-1">No people data available</p>
        <p className="text-sm">Officer and director information may not be included in this filing.</p>
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
    "Net Assets": f.net_assets_eoy || 0,
  }));

  const latest = profile.financials.at(-1);

  return (
    <div className="space-y-6 animate-card-in">
      {/* Financial Trajectory Chart */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold mb-4">Financial Trajectory</h2>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={chartData}>
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
              <Line
                type="monotone"
                dataKey="Revenue"
                stroke="#3B69B7"
                strokeWidth={2.5}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="Expenses"
                stroke="#F5A623"
                strokeWidth={2.5}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="Net Assets"
                stroke="#16A34A"
                strokeWidth={2.5}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-muted text-sm">No financial data available.</p>
        )}
      </div>

      {/* Revenue Breakdown */}
      {latest && (
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">
            Revenue Breakdown (Latest Year)
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MiniStat
              label="Contributions & Grants"
              value={formatCurrency(latest.contributions_grants)}
            />
            <MiniStat
              label="Program Service Revenue"
              value={formatCurrency(latest.program_service_rev)}
            />
            <MiniStat
              label="Investment Income"
              value={formatCurrency(latest.investment_income)}
            />
            <MiniStat
              label="Other Revenue"
              value={formatCurrency(latest.other_revenue)}
            />
          </div>
        </div>
      )}
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

  return (
    <div className="space-y-6 animate-card-in">
      {/* Vulnerability Gauge */}
      <div className="glass-card p-6 flex flex-wrap items-center gap-6">
        <div className="text-center">
          <p className="text-xs text-muted uppercase tracking-wide mb-2">
            Vulnerability Score
          </p>
          {vulnPct != null ? (
            <p
              className="text-5xl font-bold"
              style={{
                color:
                  profile.vulnerability_score! > 0.7
                    ? "#DC2626"
                    : profile.vulnerability_score! > 0.3
                    ? "#F5A623"
                    : "#16A34A",
              }}
            >
              {vulnPct}%
            </p>
          ) : (
            <p className="text-3xl font-bold text-thriving">Low Risk</p>
          )}
        </div>
        {vulnPct != null && (
          <div className="flex-1 min-w-[200px]">
            <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${vulnPct}%`,
                  background:
                    profile.vulnerability_score! > 0.7
                      ? "linear-gradient(90deg, #DC2626, #F87171)"
                      : profile.vulnerability_score! > 0.3
                      ? "linear-gradient(90deg, #F5A623, #FBBF24)"
                      : "linear-gradient(90deg, #16A34A, #4ADE80)",
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted mt-1">
              <span>Low</span>
              <span>High</span>
            </div>
          </div>
        )}
      </div>

      {/* Warning Factors */}
      {hasWarnings && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Early Warning Signals</h2>
          {profile.warning_factors!.map((factor, i) => (
            <div
              key={i}
              className={
                profile.vulnerability_score != null &&
                profile.vulnerability_score > 0.7
                  ? "alert-card-urgent"
                  : "alert-card"
              }
              style={{ borderRadius: 12, padding: 16 }}
            >
              <div className="flex items-start gap-2">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={
                    profile.vulnerability_score != null &&
                    profile.vulnerability_score > 0.7
                      ? "#DC2626"
                      : "#F5A623"
                  }
                  strokeWidth="2"
                  className="flex-shrink-0 mt-0.5"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span className="text-sm">{factor}</span>
              </div>
            </div>
          ))}
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
        <div className="glass-card p-6">
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
                  <th className="px-4 py-3">Organization</th>
                  <th className="px-4 py-3 text-right">Score</th>
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {/* Highlight current org */}
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
                    className="border-b border-border hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/org/${peer.ein}`}
                        className="hover:text-moobu-blue"
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
          <svg className="mx-auto mb-3" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <p className="text-lg mb-1">No risk indicators</p>
          <p className="text-sm">This organization shows healthy financial patterns.</p>
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

function MetricBar({
  label,
  value,
  maxValue,
  tier,
}: {
  label: string;
  value: number;
  maxValue: number;
  tier: string | null;
}) {
  const pct = Math.min(Math.max((value / maxValue) * 100, 0), 100);
  const color = tierColor(tier);

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted w-36 text-right flex-shrink-0">
        {label}
      </span>
      <div className="metric-bar-track flex-1">
        <div
          className="metric-bar-fill"
          style={{
            width: `${pct}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <span className="text-xs font-mono font-medium w-10 text-right">
        {value.toFixed(1)}
      </span>
    </div>
  );
}

function FinStatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="glass-card p-5">
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className="text-xl font-bold" style={{ color }}>
        {value}
      </p>
    </div>
  );
}
