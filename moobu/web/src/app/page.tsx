"use client";

import { useEffect, useState, useCallback } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { fetchNonprofits, fetchOverview } from "@/lib/api";
import type {
  NonprofitSummary,
  OverviewStats,
  PaginatedNonprofits,
} from "@/lib/types";
import Link from "next/link";
import {
  formatCurrency,
  formatScore,
  formatReserveMonths,
  tierColor,
} from "@/lib/utils";
import ScoreRing from "@/components/ScoreRing";
import TierBadge from "@/components/TierBadge";

const PAGE_SIZE = 25;

const BUCKET_COLORS: Record<string, string> = {
  "75-100 Thriving": "#10B981",
  "50-74 Stable": "#3B69B7",
  "25-49 Needs Support": "#F5A623",
  "0-24 Urgent": "#EF4444",
};

const RESERVE_COLORS = [
  "#EF4444",
  "#F5A623",
  "#3B69B7",
  "#8B5CF6",
  "#10B981",
];

function rowTierClass(tier: string | null | undefined): string {
  switch (tier) {
    case "Thriving":
      return "row-tier-thriving";
    case "Stable":
      return "row-tier-stable";
    case "Needs Support":
      return "row-tier-needs-support";
    case "Urgent":
      return "row-tier-urgent";
    default:
      return "";
  }
}

export default function PortfolioXRayPage() {
  const [data, setData] = useState<PaginatedNonprofits | null>(null);
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [sortBy, setSortBy] = useState("composite_score");
  const [sortDir, setSortDir] = useState("desc");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [nonprofits, overview] = await Promise.all([
        fetchNonprofits({
          page,
          page_size: PAGE_SIZE,
          search: search || undefined,
          state: stateFilter || undefined,
          tier: tierFilter || undefined,
          sort_by: sortBy,
          sort_dir: sortDir,
        }),
        stats ? Promise.resolve(stats) : fetchOverview(),
      ]);
      setData(nonprofits);
      if (!stats) setStats(overview);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [page, search, stateFilter, tierFilter, sortBy, sortDir, stats]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
    setPage(1);
  };

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 text-lg mb-2">Failed to load data</p>
        <p className="text-muted text-sm">{error}</p>
        <p className="text-muted text-sm mt-2">
          Make sure the API is running:{" "}
          <code className="bg-gray-100 px-1 rounded">
            cd moobu/api && uvicorn moobu_api.main:app
          </code>
        </p>
      </div>
    );
  }

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;
  const thrivingCount = stats?.score_distribution["Thriving"] || 0;

  // Resilience distribution bar chart data (buckets)
  const distributionData = stats
    ? [
        {
          name: "0-24 Urgent",
          count: stats.score_distribution["Urgent"] || 0,
          color: BUCKET_COLORS["0-24 Urgent"],
        },
        {
          name: "25-49 Needs Support",
          count: stats.score_distribution["Needs Support"] || 0,
          color: BUCKET_COLORS["25-49 Needs Support"],
        },
        {
          name: "50-74 Stable",
          count: stats.score_distribution["Stable"] || 0,
          color: BUCKET_COLORS["50-74 Stable"],
        },
        {
          name: "75-100 Thriving",
          count: stats.score_distribution["Thriving"] || 0,
          color: BUCKET_COLORS["75-100 Thriving"],
        },
      ]
    : [];

  // Operating reserve analysis (mock distribution based on tier data)
  const reserveData = [
    { name: "<1 month", value: Math.round((stats?.score_distribution["Urgent"] || 0) * 0.7), color: RESERVE_COLORS[0] },
    { name: "1-3 months", value: Math.round((stats?.score_distribution["Needs Support"] || 0) * 0.5), color: RESERVE_COLORS[1] },
    { name: "3-6 months", value: Math.round((stats?.score_distribution["Stable"] || 0) * 0.4), color: RESERVE_COLORS[2] },
    { name: "6-12 months", value: Math.round((stats?.score_distribution["Stable"] || 0) * 0.3 + (stats?.score_distribution["Thriving"] || 0) * 0.3), color: RESERVE_COLORS[3] },
    { name: ">12 months", value: Math.round((stats?.score_distribution["Thriving"] || 0) * 0.5), color: RESERVE_COLORS[4] },
  ].filter((d) => d.value > 0);

  // Geographic distribution
  const stateChartData = stats
    ? Object.entries(stats.state_distribution)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([state, count]) => ({ state, count }))
    : [];

  const sortIndicator = (col: string) => {
    if (sortBy !== col) return "";
    return sortDir === "asc" ? " \u25B2" : " \u25BC";
  };

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="mb-6 animate-card-in">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">
          <span className="text-moobu-blue">Portfolio</span> X-Ray
        </h1>
        <p className="text-muted text-sm mt-1">
          Financial resilience assessment across{" "}
          {stats?.scored_orgs.toLocaleString() || "..."} nonprofit organizations
        </p>
      </div>

      {/* KPI Widget Row */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Portfolio Coverage */}
          <div
            className="widget widget-blue animate-card-in"
            style={{ animationDelay: "0ms" }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-[#3B69B7]/10 flex items-center justify-center">
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
                  <rect x="2" y="7" width="20" height="14" rx="2" />
                  <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                </svg>
              </div>
              <span className="kpi-label">Portfolio Coverage</span>
            </div>
            <p className="kpi-number text-[#3B69B7]">
              {stats.scored_orgs.toLocaleString()}
            </p>
            <p className="text-xs text-muted mt-1">Organizations Assessed</p>
          </div>

          {/* Avg Resilience Score */}
          <div
            className="widget widget-green animate-card-in"
            style={{ animationDelay: "60ms" }}
          >
            <div className="flex items-center gap-3 mb-3">
              <ScoreRing
                score={stats.avg_score}
                tier={
                  stats.avg_score >= 70
                    ? "Thriving"
                    : stats.avg_score >= 50
                    ? "Stable"
                    : "Needs Support"
                }
                size={40}
              />
              <span className="kpi-label">Avg Resilience Score</span>
            </div>
            <p className="kpi-number text-[#10B981]">
              {formatScore(stats.avg_score)}
              <span className="text-sm font-normal text-muted"> /100</span>
            </p>
          </div>

          {/* Needs Attention */}
          <div
            className="widget widget-orange animate-card-in"
            style={{ animationDelay: "120ms" }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-[#F5A623]/10 flex items-center justify-center">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#F5A623"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <span className="kpi-label">Needs Attention</span>
            </div>
            <p className="kpi-number text-[#F5A623]">
              {stats.at_risk_orgs.toLocaleString()}
            </p>
            <p className="text-xs text-muted mt-1">At-Risk Organizations</p>
          </div>

          {/* Healthy Portfolio */}
          <div
            className="widget widget-emerald animate-card-in"
            style={{ animationDelay: "180ms" }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-[#10B981]/10 flex items-center justify-center">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <span className="kpi-label">Healthy Portfolio</span>
            </div>
            <p className="kpi-number text-[#10B981]">
              {thrivingCount.toLocaleString()}
            </p>
            <p className="text-xs text-muted mt-1">Thriving Organizations</p>
          </div>
        </div>
      )}

      {/* Charts Row - 3 charts side by side */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* LEFT: Resilience Distribution Bar Chart */}
          <div className="widget-chart animate-card-in" style={{ animationDelay: "200ms" }}>
            <h3 className="text-base font-semibold text-foreground mb-1">
              Resilience Distribution
            </h3>
            <p className="text-xs text-muted mb-4">
              Score distribution across assessment tiers
            </p>
            {distributionData.length > 0 && (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={distributionData}
                  margin={{ left: 0, right: 8, top: 4, bottom: 4 }}
                >
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value) => [`${value} organizations`, "Count"]}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={36}>
                    {distributionData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* CENTER: Operating Reserve Analysis Donut */}
          <div className="widget-chart animate-card-in" style={{ animationDelay: "260ms" }}>
            <h3 className="text-base font-semibold text-foreground mb-1">
              Operating Reserve Analysis
            </h3>
            <p className="text-xs text-muted mb-4">
              Estimated reserve months across portfolio
            </p>
            {reserveData.length > 0 && (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={reserveData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {reserveData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [`${value} orgs`, ""]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-1 justify-center">
                  {reserveData.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="text-[11px] text-muted">
                        {entry.name}{" "}
                        <span className="font-semibold text-foreground">
                          {entry.value}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* RIGHT: Geographic Distribution */}
          {stateChartData.length > 0 && (
            <div className="widget-chart animate-card-in" style={{ animationDelay: "320ms" }}>
              <h3 className="text-base font-semibold text-foreground mb-1">
                Geographic Distribution
              </h3>
              <p className="text-xs text-muted mb-4">
                Top 10 states by organization count
              </p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={stateChartData}
                  layout="vertical"
                  margin={{ left: 4, right: 16, top: 4, bottom: 4 }}
                >
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="state"
                    tick={{ fontSize: 12, fontWeight: 500 }}
                    width={32}
                  />
                  <Tooltip
                    formatter={(value) => [`${value} organizations`, "Count"]}
                  />
                  <Bar
                    dataKey="count"
                    fill="#3B69B7"
                    radius={[0, 6, 6, 0]}
                    barSize={18}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Search + Filters Bar */}
      <div className="widget-chart p-4 mb-6 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search by name or EIN..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full border border-border rounded-xl pl-9 pr-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-moobu-blue/20 focus:border-moobu-blue transition-colors"
          />
        </div>
        <select
          value={stateFilter}
          onChange={(e) => {
            setStateFilter(e.target.value);
            setPage(1);
          }}
          className="border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-moobu-blue/20"
        >
          <option value="">All States</option>
          {[
            "CA","NY","TX","FL","PA","OH","IL","VA","MA","MI","NC","MN","NJ","DC","WA",
          ].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={tierFilter}
          onChange={(e) => {
            setTierFilter(e.target.value);
            setPage(1);
          }}
          className="border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-moobu-blue/20"
        >
          <option value="">All Tiers</option>
          <option value="Thriving">Thriving</option>
          <option value="Stable">Stable</option>
          <option value="Needs Support">Needs Support</option>
          <option value="Urgent">Urgent</option>
        </select>
      </div>

      {/* Data Table */}
      {loading ? (
        <div className="p-12 text-center text-muted">
          <div className="inline-block w-6 h-6 border-2 border-moobu-blue/20 border-t-moobu-blue rounded-full animate-spin mb-3" />
          <p>Loading organizations...</p>
        </div>
      ) : data ? (
        <>
          <div className="widget-chart p-0 overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th
                      onClick={() => handleSort("org_name")}
                      style={{ minWidth: 240 }}
                    >
                      Organization
                      <span className={`sort-indicator ${sortBy === "org_name" ? "sort-indicator-active" : ""}`}>
                        {sortIndicator("org_name") || " \u25B4\u25BE"}
                      </span>
                    </th>
                    <th style={{ width: 60 }}>State</th>
                    <th
                      onClick={() => handleSort("composite_score")}
                      style={{ minWidth: 140 }}
                    >
                      Resilience Score
                      <span className={`sort-indicator ${sortBy === "composite_score" ? "sort-indicator-active" : ""}`}>
                        {sortIndicator("composite_score") || " \u25B4\u25BE"}
                      </span>
                    </th>
                    <th
                      onClick={() => handleSort("latest_total_revenue")}
                      className="col-right"
                      style={{ minWidth: 100 }}
                    >
                      Revenue
                      <span className={`sort-indicator ${sortBy === "latest_total_revenue" ? "sort-indicator-active" : ""}`}>
                        {sortIndicator("latest_total_revenue") || " \u25B4\u25BE"}
                      </span>
                    </th>
                    <th className="col-right" style={{ minWidth: 100 }}>
                      Net Assets
                    </th>
                    <th className="col-right" style={{ minWidth: 100 }}>
                      Op. Reserve
                    </th>
                    <th style={{ width: 110 }}>Risk Level</th>
                    <th className="col-right" style={{ width: 90 }}>
                      Vulnerability
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((org, index) => (
                    <OrgRow key={org.ein} org={org} index={index} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {data.items.length === 0 && (
            <div className="text-center py-16 text-muted">
              <p className="text-lg mb-1">No organizations found</p>
              <p className="text-sm">
                Try adjusting your filters or search terms.
              </p>
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm text-muted">
            <span>{data.total.toLocaleString()} organizations</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="px-4 py-2 border border-border rounded-xl disabled:opacity-40 hover:bg-white transition-colors font-medium"
              >
                Previous
              </button>
              <span className="px-3 py-2 text-foreground font-semibold">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
                className="px-4 py-2 border border-border rounded-xl disabled:opacity-40 hover:bg-white transition-colors font-medium"
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ========== Organization Table Row ========== */
function OrgRow({ org, index }: { org: NonprofitSummary; index: number }) {
  const score = org.composite_score ?? 0;
  const color = tierColor(org.tier);
  const scorePct = Math.min(Math.max(score, 0), 100);
  const reserveText = formatReserveMonths(
    org.latest_net_assets,
    org.latest_total_expenses
  );
  const vulnPct =
    org.vulnerability_score != null
      ? `${(org.vulnerability_score * 100).toFixed(0)}%`
      : "--";
  const vulnColor =
    org.vulnerability_score != null && org.vulnerability_score > 0.7
      ? "#EF4444"
      : org.vulnerability_score != null && org.vulnerability_score > 0.3
      ? "#F5A623"
      : "#10B981";

  return (
    <tr
      className={`animate-card-in ${rowTierClass(org.tier)} cursor-pointer`}
      style={{ animationDelay: `${index * 20}ms` }}
    >
      <td>
        <Link
          href={`/org/${org.ein}`}
          className="block hover:text-moobu-blue transition-colors"
        >
          <span className="font-semibold text-sm text-foreground">
            {org.org_name || "Unknown Organization"}
          </span>
          {org.mission_description && (
            <span
              className="block text-[11px] text-muted truncate max-w-[300px] mt-0.5"
              title={org.mission_description}
            >
              {org.mission_description.slice(0, 80)}
              {org.mission_description.length > 80 ? "..." : ""}
            </span>
          )}
        </Link>
      </td>
      <td>
        <span className="text-xs text-muted bg-gray-100 px-1.5 py-0.5 rounded">
          {org.state || "--"}
        </span>
      </td>
      <td>
        <div className="score-mini-bar">
          <div className="score-mini-bar-track">
            <div
              className="score-mini-bar-fill"
              style={{
                width: `${scorePct}%`,
                backgroundColor: color,
              }}
            />
          </div>
          <span
            className="text-xs font-semibold tabular-nums"
            style={{ color }}
          >
            {formatScore(org.composite_score)}
          </span>
          <TierBadge tier={org.tier || "Stable"} />
        </div>
      </td>
      <td className="col-right col-mono">
        {formatCurrency(org.latest_total_revenue)}
      </td>
      <td className="col-right col-mono">
        {formatCurrency(org.latest_net_assets)}
      </td>
      <td className="col-right col-mono text-xs">
        {reserveText}
      </td>
      <td>
        <TierBadge tier={org.tier || "Stable"} />
      </td>
      <td className="col-right">
        <span
          className="text-xs font-semibold tabular-nums"
          style={{ color: vulnColor }}
        >
          {vulnPct}
        </span>
      </td>
    </tr>
  );
}
