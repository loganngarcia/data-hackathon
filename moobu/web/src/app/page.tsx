"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchNonprofits, fetchOverview } from "@/lib/api";
import type { NonprofitSummary, OverviewStats, PaginatedNonprofits } from "@/lib/types";
import Link from "next/link";
import { formatCurrency, formatScore, tierClass } from "@/lib/utils";

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
          page_size: 50,
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
          Make sure the API is running: <code className="bg-gray-100 px-1 rounded">cd moobu/api && uvicorn moobu_api.main:app</code>
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-moobu-blue">Portfolio Overview</h1>
        <p className="text-muted text-sm mt-1">
          Financial resilience scores for {stats?.scored_orgs.toLocaleString() || "..."} nonprofits
        </p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Organizations" value={stats.scored_orgs.toLocaleString()} />
          <StatCard label="Average Score" value={formatScore(stats.avg_score)} />
          <StatCard label="At Risk (>50%)" value={stats.at_risk_orgs.toLocaleString()} accent />
          <StatCard
            label="Thriving"
            value={(stats.score_distribution["Thriving"] || 0).toLocaleString()}
          />
        </div>
      )}

      <div className="bg-card rounded-lg border border-border shadow-sm">
        <div className="p-4 border-b border-border flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Search by name or EIN..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="border border-border rounded-md px-3 py-1.5 text-sm flex-1 min-w-[200px] bg-background"
          />
          <select
            value={stateFilter}
            onChange={(e) => { setStateFilter(e.target.value); setPage(1); }}
            className="border border-border rounded-md px-3 py-1.5 text-sm bg-background"
          >
            <option value="">All States</option>
            {["CA","NY","TX","FL","PA","OH","IL","VA","MA","MI","NC","MN","NJ","DC","WA"].map(
              (s) => <option key={s} value={s}>{s}</option>
            )}
          </select>
          <select
            value={tierFilter}
            onChange={(e) => { setTierFilter(e.target.value); setPage(1); }}
            className="border border-border rounded-md px-3 py-1.5 text-sm bg-background"
          >
            <option value="">All Tiers</option>
            <option value="Thriving">Thriving</option>
            <option value="Stable">Stable</option>
            <option value="Needs Support">Needs Support</option>
            <option value="Urgent">Urgent</option>
          </select>
        </div>

        {loading ? (
          <div className="p-12 text-center text-muted">Loading...</div>
        ) : data && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted">
                    <th className="px-4 py-3 cursor-pointer hover:text-foreground" onClick={() => handleSort("org_name")}>
                      Organization {sortBy === "org_name" ? (sortDir === "asc" ? " ^" : " v") : ""}
                    </th>
                    <th className="px-4 py-3">State</th>
                    <th className="px-4 py-3 cursor-pointer hover:text-foreground text-right" onClick={() => handleSort("composite_score")}>
                      Score{sortBy === "composite_score" ? (sortDir === "asc" ? " ^" : " v") : ""}
                    </th>
                    <th className="px-4 py-3">Tier</th>
                    <th className="px-4 py-3 cursor-pointer hover:text-foreground text-right" onClick={() => handleSort("latest_total_revenue")}>
                      Revenue{sortBy === "latest_total_revenue" ? (sortDir === "asc" ? " ^" : " v") : ""}
                    </th>
                    <th className="px-4 py-3 text-right">Net Assets</th>
                    <th className="px-4 py-3 text-right">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((org) => (
                    <OrgRow key={org.ein} org={org} />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-border flex items-center justify-between text-sm text-muted">
              <span>{data.total.toLocaleString()} organizations</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 border border-border rounded disabled:opacity-50 hover:bg-background"
                >
                  Prev
                </button>
                <span className="px-3 py-1">Page {page} of {Math.ceil(data.total / 50)}</span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= Math.ceil(data.total / 50)}
                  className="px-3 py-1 border border-border rounded disabled:opacity-50 hover:bg-background"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-card rounded-lg border border-border p-4 shadow-sm">
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${accent ? "text-moobu-orange" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

function OrgRow({ org }: { org: NonprofitSummary }) {
  return (
    <tr className="border-b border-border hover:bg-moobu-blue-light/30 transition-colors">
      <td className="px-4 py-3">
        <Link href={`/org/${org.ein}`} className="hover:text-moobu-blue block">
          <p className="font-medium">{org.org_name || "Unknown"}</p>
          <p className="text-xs text-muted">{org.ein}</p>
        </Link>
      </td>
      <td className="px-4 py-3">{org.state || "-"}</td>
      <td className="px-4 py-3 text-right font-mono font-semibold">
        {formatScore(org.composite_score)}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${tierClass(org.tier)}`}>
          {org.tier}
        </span>
      </td>
      <td className="px-4 py-3 text-right">{formatCurrency(org.latest_total_revenue)}</td>
      <td className="px-4 py-3 text-right">{formatCurrency(org.latest_net_assets)}</td>
      <td className="px-4 py-3 text-right">
        {org.vulnerability_score != null && org.vulnerability_score > 0.3 ? (
          <span className="text-moobu-orange font-medium">
            {(org.vulnerability_score * 100).toFixed(0)}%
          </span>
        ) : (
          <span className="text-muted">-</span>
        )}
      </td>
    </tr>
  );
}
