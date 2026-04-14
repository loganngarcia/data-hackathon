"use client";

import { useEffect, useState, useCallback } from "react";
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
  reserveMonthsRaw,
} from "@/lib/utils";
import ResilienceGauge from "@/components/ResilienceGauge";

const PAGE_SIZE = 50;

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
        <p className="text-status-urgent text-base mb-2">Failed to load data</p>
        <p className="text-ink-tertiary text-sm">{error}</p>
        <p className="text-ink-tertiary text-sm mt-2">
          Make sure the API is running:{" "}
          <code className="bg-paper-inset px-1.5 py-0.5 rounded text-xs">
            cd moobu/api && uvicorn moobu_api.main:app
          </code>
        </p>
      </div>
    );
  }

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;
  const thrivingCount = stats?.score_distribution["Thriving"] || 0;
  const needsAttentionCount =
    (stats?.score_distribution["Needs Support"] || 0) +
    (stats?.score_distribution["Urgent"] || 0);

  const sortArrow = (col: string) => {
    if (sortBy !== col) return "";
    return sortDir === "asc" ? " \u25B2" : " \u25BC";
  };

  const startItem = (page - 1) * PAGE_SIZE + 1;
  const endItem = data ? Math.min(page * PAGE_SIZE, data.total) : 0;

  return (
    <div className="px-6 py-5 max-w-[1440px] mx-auto">
      {/* Summary Strip */}
      {stats && (
        <div
          className="flex items-center divide-x mb-5"
          style={{ borderColor: "var(--boundary)" }}
        >
          <SummaryStat
            label="Organizations"
            value={stats.scored_orgs.toLocaleString()}
          />
          <SummaryStat
            label="Avg Score"
            value={`${formatScore(stats.avg_score)} / 100`}
          />
          <SummaryStat
            label="Need Attention"
            value={needsAttentionCount.toLocaleString()}
          />
          <SummaryStat
            label="Thriving"
            value={thrivingCount.toLocaleString()}
          />
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-wrap gap-3 items-center mb-5">
        <div className="relative flex-1 min-w-[220px]">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
            width="15"
            height="15"
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
            placeholder="Search organizations..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-md pl-9 pr-3 text-sm bg-paper-inset text-ink placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-brand/30"
            style={{
              height: 36,
              border: "1px solid transparent",
            }}
          />
        </div>
        <select
          value={stateFilter}
          onChange={(e) => {
            setStateFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-md px-3 text-sm bg-paper-inset text-ink focus:outline-none focus:ring-1 focus:ring-brand/30"
          style={{ height: 36, border: "1px solid transparent" }}
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
          className="rounded-md px-3 text-sm bg-paper-inset text-ink focus:outline-none focus:ring-1 focus:ring-brand/30"
          style={{ height: 36, border: "1px solid transparent" }}
        >
          <option value="">All Tiers</option>
          <option value="Thriving">Thriving</option>
          <option value="Stable">Stable</option>
          <option value="Needs Support">Needs Support</option>
          <option value="Urgent">Urgent</option>
        </select>
        {/* Sort controls */}
        <div className="flex items-center gap-1 text-xs text-ink-tertiary ml-auto">
          <span>Sort:</span>
          <SortButton
            label="Score"
            col="composite_score"
            sortBy={sortBy}
            sortDir={sortDir}
            onSort={handleSort}
          />
          <SortButton
            label="Revenue"
            col="latest_total_revenue"
            sortBy={sortBy}
            sortDir={sortDir}
            onSort={handleSort}
          />
          <SortButton
            label="Name"
            col="org_name"
            sortBy={sortBy}
            sortDir={sortDir}
            onSort={handleSort}
          />
        </div>
      </div>

      {/* Data Table */}
      {loading ? (
        <div className="p-12 text-center text-ink-tertiary">
          <div
            className="inline-block w-5 h-5 border-2 border-brand/20 border-t-brand rounded-full mb-3"
            style={{ animation: "spin 0.8s linear infinite" }}
          />
          <p className="text-sm">Loading organizations...</p>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : data ? (
        <>
          <div className="card-flush mb-4">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th
                      onClick={() => handleSort("org_name")}
                      style={{ minWidth: 240 }}
                    >
                      Organization
                      <span
                        className={`sort-indicator ${sortBy === "org_name" ? "sort-indicator-active" : ""}`}
                      >
                        {sortArrow("org_name") || " \u25B4\u25BE"}
                      </span>
                    </th>
                    <th style={{ width: 55 }}>State</th>
                    <th
                      onClick={() => handleSort("composite_score")}
                      style={{ minWidth: 160 }}
                    >
                      Resilience
                      <span
                        className={`sort-indicator ${sortBy === "composite_score" ? "sort-indicator-active" : ""}`}
                      >
                        {sortArrow("composite_score") || " \u25B4\u25BE"}
                      </span>
                    </th>
                    <th
                      onClick={() => handleSort("latest_total_revenue")}
                      className="col-right"
                      style={{ minWidth: 100 }}
                    >
                      Revenue
                      <span
                        className={`sort-indicator ${sortBy === "latest_total_revenue" ? "sort-indicator-active" : ""}`}
                      >
                        {sortArrow("latest_total_revenue") || " \u25B4\u25BE"}
                      </span>
                    </th>
                    <th className="col-right" style={{ minWidth: 100 }}>
                      Net Assets
                    </th>
                    <th className="col-right" style={{ minWidth: 90 }}>
                      Reserve
                    </th>
                    <th className="col-right" style={{ width: 80 }}>
                      Risk
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((org) => (
                    <OrgRow key={org.ein} org={org} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {data.items.length === 0 && (
            <div className="text-center py-16 text-ink-tertiary">
              <p className="text-base mb-1">No organizations found</p>
              <p className="text-sm">
                Try adjusting your filters or search terms.
              </p>
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm text-ink-tertiary">
            <span>
              Showing {startItem}--{endItem} of{" "}
              {data.total.toLocaleString()}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-sm text-ink-secondary disabled:text-ink-muted hover:text-ink"
              >
                Prev
              </button>
              <span className="text-ink tabular-nums" style={{ fontWeight: 500 }}>
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-sm text-ink-secondary disabled:text-ink-muted hover:text-ink"
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

/* ========== Summary Stat ========== */
function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 first:pl-0">
      <p className="text-xs text-ink-tertiary" style={{ letterSpacing: "0.02em" }}>
        {label}
      </p>
      <p
        className="text-xl tabular-nums text-ink"
        style={{ fontWeight: 600 }}
      >
        {value}
      </p>
    </div>
  );
}

/* ========== Sort Button ========== */
function SortButton({
  label,
  col,
  sortBy,
  sortDir,
  onSort,
}: {
  label: string;
  col: string;
  sortBy: string;
  sortDir: string;
  onSort: (col: string) => void;
}) {
  const active = sortBy === col;
  const arrow = active ? (sortDir === "asc" ? " \u2191" : " \u2193") : "";
  return (
    <button
      onClick={() => onSort(col)}
      className={`px-2 py-1 rounded text-xs ${
        active ? "text-brand" : "text-ink-tertiary hover:text-ink-secondary"
      }`}
      style={{ fontWeight: active ? 600 : 400 }}
    >
      {label}
      {arrow}
    </button>
  );
}

/* ========== Organization Table Row ========== */
function OrgRow({ org }: { org: NonprofitSummary }) {
  const reserveText = formatReserveMonths(
    org.latest_net_assets,
    org.latest_total_expenses
  );
  const reserveMonths = reserveMonthsRaw(
    org.latest_net_assets,
    org.latest_total_expenses
  );

  // Reserve dot color
  const reserveDotColor =
    reserveMonths != null
      ? reserveMonths > 6
        ? "var(--status-healthy)"
        : reserveMonths >= 3
        ? "var(--status-attention)"
        : "var(--status-urgent)"
      : "var(--ink-muted)";

  // Risk: only show if vulnerability > 0.3
  const showRisk =
    org.vulnerability_score != null && org.vulnerability_score > 0.3;
  const riskPct =
    org.vulnerability_score != null
      ? `${(org.vulnerability_score * 100).toFixed(0)}%`
      : "--";
  const riskColor =
    org.vulnerability_score != null && org.vulnerability_score > 0.7
      ? "var(--status-urgent)"
      : "var(--status-attention)";

  return (
    <tr className={`${rowTierClass(org.tier)} cursor-pointer`}>
      <td>
        <Link
          href={`/org/${org.ein}`}
          className="block hover:text-brand"
        >
          <span className="text-sm text-ink" style={{ fontWeight: 500 }}>
            {org.org_name || "Unknown Organization"}
          </span>
          <span className="block text-xs text-ink-muted tabular-nums mt-0.5">
            {org.ein}
          </span>
        </Link>
      </td>
      <td>
        <span className="text-xs text-ink-tertiary">
          {org.state || "--"}
        </span>
      </td>
      <td>
        <ResilienceGauge
          score={org.composite_score ?? 0}
          tier={org.tier ?? "Stable"}
          size="sm"
        />
      </td>
      <td className="col-right col-mono">
        {formatCurrency(org.latest_total_revenue)}
      </td>
      <td className="col-right col-mono">
        {formatCurrency(org.latest_net_assets)}
      </td>
      <td className="col-right">
        <span className="inline-flex items-center gap-1.5 text-xs tabular-nums text-ink-secondary">
          <span
            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: reserveDotColor }}
          />
          {reserveText}
        </span>
      </td>
      <td className="col-right">
        {showRisk ? (
          <span
            className="text-xs tabular-nums"
            style={{ fontWeight: 600, color: riskColor }}
          >
            {riskPct}
          </span>
        ) : (
          <span className="text-xs text-ink-muted">--</span>
        )}
      </td>
    </tr>
  );
}
