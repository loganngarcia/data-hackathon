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
  truncateMission,
  tierStripClass,
} from "@/lib/utils";
import ScoreRing from "@/components/ScoreRing";
import TierBadge from "@/components/TierBadge";

const PAGE_SIZE = 18;

const TIER_COLORS: Record<string, string> = {
  Thriving: "#10B981",
  Stable: "#3B69B7",
  "Needs Support": "#F5A623",
  Urgent: "#EF4444",
};

const TIER_ORDER = ["Thriving", "Stable", "Needs Support", "Urgent"];

export default function PortfolioPage() {
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

  // Prepare chart data
  const tierChartData = stats
    ? TIER_ORDER.map((tier) => ({
        name: tier,
        value: stats.score_distribution[tier] || 0,
        color: TIER_COLORS[tier],
      })).filter((d) => d.value > 0)
    : [];

  const stateChartData = stats
    ? Object.entries(stats.state_distribution)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([state, count]) => ({ state, count }))
    : [];

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="mb-6 animate-card-in">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">
          <span className="text-moobu-blue">Portfolio</span> Overview
        </h1>
        <p className="text-muted text-sm mt-1">
          Financial resilience scores for{" "}
          {stats?.scored_orgs.toLocaleString() || "..."} nonprofits
        </p>
      </div>

      {/* KPI Widget Row */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Total Orgs */}
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
              <span className="kpi-label">Total Organizations</span>
            </div>
            <p className="kpi-number text-[#3B69B7]">
              {stats.scored_orgs.toLocaleString()}
            </p>
          </div>

          {/* Average Score */}
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
              <span className="kpi-label">Average Score</span>
            </div>
            <p className="kpi-number text-[#10B981]">
              {formatScore(stats.avg_score)}
            </p>
          </div>

          {/* At Risk */}
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
              <span className="kpi-label">At Risk</span>
            </div>
            <p className="kpi-number text-[#F5A623]">
              {stats.at_risk_orgs.toLocaleString()}
            </p>
          </div>

          {/* Thriving */}
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
              <span className="kpi-label">Thriving</span>
            </div>
            <p className="kpi-number text-[#10B981]">
              {thrivingCount.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Charts Row */}
      {stats && (tierChartData.length > 0 || stateChartData.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Tier Distribution Donut */}
          {tierChartData.length > 0 && (
            <div className="widget-chart animate-card-in" style={{ animationDelay: "200ms" }}>
              <h3 className="text-base font-semibold text-foreground mb-1">
                Tier Distribution
              </h3>
              <p className="text-xs text-muted mb-4">
                Breakdown of organizational health tiers
              </p>
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={tierChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {tierChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) =>
                        [`${value} orgs`, ""]
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Legend */}
              <div className="flex flex-wrap gap-x-5 gap-y-2 mt-2 justify-center">
                {tierChartData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full inline-block"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-xs text-muted">
                      {entry.name}{" "}
                      <span className="font-semibold text-foreground">
                        {entry.value}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top States Bar Chart */}
          {stateChartData.length > 0 && (
            <div className="widget-chart animate-card-in" style={{ animationDelay: "260ms" }}>
              <h3 className="text-base font-semibold text-foreground mb-1">
                Top States by Count
              </h3>
              <p className="text-xs text-muted mb-4">
                Geographic distribution of portfolio organizations
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
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>Sort:</span>
          <button
            onClick={() => handleSort("composite_score")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              sortBy === "composite_score"
                ? "bg-moobu-blue text-white"
                : "bg-gray-100 hover:bg-gray-200 text-foreground"
            }`}
          >
            Score{" "}
            {sortBy === "composite_score" ? (sortDir === "asc" ? "^" : "v") : ""}
          </button>
          <button
            onClick={() => handleSort("org_name")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              sortBy === "org_name"
                ? "bg-moobu-blue text-white"
                : "bg-gray-100 hover:bg-gray-200 text-foreground"
            }`}
          >
            Name{" "}
            {sortBy === "org_name" ? (sortDir === "asc" ? "^" : "v") : ""}
          </button>
          <button
            onClick={() => handleSort("latest_total_revenue")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              sortBy === "latest_total_revenue"
                ? "bg-moobu-blue text-white"
                : "bg-gray-100 hover:bg-gray-200 text-foreground"
            }`}
          >
            Revenue{" "}
            {sortBy === "latest_total_revenue"
              ? sortDir === "asc"
                ? "^"
                : "v"
              : ""}
          </button>
        </div>
      </div>

      {/* Card Grid */}
      {loading ? (
        <div className="p-12 text-center text-muted">
          <div className="inline-block w-6 h-6 border-2 border-moobu-blue/20 border-t-moobu-blue rounded-full animate-spin mb-3" />
          <p>Loading organizations...</p>
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {data.items.map((org, index) => (
              <OrgCard key={org.ein} org={org} index={index} />
            ))}
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
          <div className="mt-8 flex items-center justify-between text-sm text-muted">
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

/* ========== Org Card ========== */
function OrgCard({ org, index }: { org: NonprofitSummary; index: number }) {
  return (
    <Link
      href={`/org/${org.ein}`}
      className="block animate-card-in"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="glass-card overflow-hidden cursor-pointer group">
        {/* Tier strip */}
        <div className={`tier-strip ${tierStripClass(org.tier)}`} />

        <div className="p-5">
          {/* Top row: ScoreRing + Name + State */}
          <div className="flex items-start gap-3 mb-3">
            <ScoreRing
              score={org.composite_score ?? 0}
              tier={org.tier ?? "Stable"}
              size={52}
            />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground text-sm leading-tight truncate group-hover:text-moobu-blue transition-colors">
                {org.org_name || "Unknown Organization"}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <TierBadge tier={org.tier || "Stable"} />
                {org.state && (
                  <span className="text-xs text-muted bg-gray-100 px-1.5 py-0.5 rounded">
                    {org.state}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Mission snippet */}
          <p className="text-xs text-muted leading-relaxed mb-3 line-clamp-2">
            {truncateMission(org.mission_description, 130)}
          </p>

          {/* Bottom stats */}
          <div className="flex items-center justify-between text-xs pt-3 border-t border-border/60">
            <div>
              <span className="text-muted">Revenue </span>
              <span className="font-semibold text-foreground">
                {formatCurrency(org.latest_total_revenue)}
              </span>
            </div>
            <div>
              <span className="text-muted">Net Assets </span>
              <span className="font-semibold text-foreground">
                {formatCurrency(org.latest_net_assets)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
