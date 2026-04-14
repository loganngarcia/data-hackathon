"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { fetchAtRisk } from "@/lib/api";
import type { AtRiskOrg } from "@/lib/types";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import ScoreRing from "@/components/ScoreRing";
import TierBadge from "@/components/TierBadge";

export default function AtRiskPage() {
  const [orgs, setOrgs] = useState<AtRiskOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchAtRisk(100);
        setOrgs(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="p-12 text-center text-muted">
        <div className="inline-block w-6 h-6 border-2 border-moobu-orange/20 border-t-moobu-orange rounded-full animate-spin mb-3" />
        <p>Loading at-risk organizations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 text-lg">{error}</p>
      </div>
    );
  }

  const criticalCount = orgs.filter((o) => o.vulnerability_score > 0.7).length;
  const avgVuln =
    orgs.length > 0
      ? (
          (orgs.reduce((s, o) => s + o.vulnerability_score, 0) / orgs.length) *
          100
        ).toFixed(0)
      : "0";

  // Top 20 for bar chart
  const barData = orgs.slice(0, 20).map((o) => ({
    name: (o.org_name || "Unknown").slice(0, 24),
    vulnerability: Math.round(o.vulnerability_score * 100),
    ein: o.ein,
    isCritical: o.vulnerability_score > 0.7,
  }));

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="mb-6 animate-card-in">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">
          <span className="text-moobu-orange">Intervention</span> Prioritization
        </h1>
        <p className="text-muted text-sm mt-1">
          {orgs.length} organizations ranked by early-warning vulnerability
          score. These nonprofits show financial patterns that match pre-crisis
          indicators.
        </p>
      </div>

      {/* Summary Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div
          className="widget widget-orange animate-card-in"
          style={{ animationDelay: "0ms" }}
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
            <span className="kpi-label">Total At Risk</span>
          </div>
          <p className="kpi-number text-[#F5A623]">{orgs.length}</p>
        </div>

        <div
          className="widget widget-rose animate-card-in"
          style={{ animationDelay: "60ms" }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-[#EF4444]/10 flex items-center justify-center">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#EF4444"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <span className="kpi-label">Critical (70%+)</span>
          </div>
          <p className="kpi-number text-[#EF4444]">{criticalCount}</p>
        </div>

        <div
          className="widget widget-purple animate-card-in"
          style={{ animationDelay: "120ms" }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#8B5CF6"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="20" x2="12" y2="10" />
                <line x1="18" y1="20" x2="18" y2="4" />
                <line x1="6" y1="20" x2="6" y2="16" />
              </svg>
            </div>
            <span className="kpi-label">Avg Vulnerability</span>
          </div>
          <p className="kpi-number text-[#8B5CF6]">{avgVuln}%</p>
        </div>
      </div>

      {/* Top 20 Vulnerability Bar Chart */}
      {barData.length > 0 && (
        <div
          className="widget-chart p-6 mb-6 animate-card-in"
          style={{ animationDelay: "180ms" }}
        >
          <h3 className="text-base font-semibold text-foreground mb-1">
            Top 20 by Vulnerability Score
          </h3>
          <p className="text-xs text-muted mb-4">
            Organizations most in need of intervention
          </p>
          <ResponsiveContainer width="100%" height={Math.max(barData.length * 28, 200)}>
            <BarChart
              data={barData}
              layout="vertical"
              margin={{ left: 8, right: 24, top: 4, bottom: 4 }}
            >
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11 }}
                width={160}
              />
              <Tooltip
                formatter={(value) => [`${value}%`, "Vulnerability"]}
              />
              <Bar dataKey="vulnerability" radius={[0, 6, 6, 0]} barSize={16}>
                {barData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.isCritical ? "#EF4444" : "#F5A623"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Org Cards */}
      <div className="space-y-4">
        {orgs.map((org, i) => (
          <AtRiskCard key={org.ein} org={org} rank={i + 1} index={i} />
        ))}
      </div>

      {orgs.length === 0 && (
        <div className="text-center py-16 text-muted">
          <p className="text-lg">No at-risk organizations found.</p>
        </div>
      )}
    </div>
  );
}

function AtRiskCard({
  org,
  rank,
  index,
}: {
  org: AtRiskOrg;
  rank: number;
  index: number;
}) {
  const isHighRisk = org.vulnerability_score > 0.7;
  const vulnPct = (org.vulnerability_score * 100).toFixed(0);

  return (
    <div
      className={`glass-card overflow-hidden animate-card-in ${
        isHighRisk ? "risk-border-high" : ""
      }`}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
          {/* Left: Rank + ScoreRing + Name */}
          <div className="flex items-start gap-4">
            <span className="text-2xl font-bold text-muted/30 w-8 flex-shrink-0 tabular-nums">
              #{rank}
            </span>
            <ScoreRing
              score={org.composite_score ?? 0}
              tier={org.tier ?? "Urgent"}
              size={56}
            />
            <div>
              <Link
                href={`/org/${org.ein}`}
                className="text-lg font-semibold hover:text-moobu-blue transition-colors"
              >
                {org.org_name || "Unknown"}
              </Link>
              <div className="flex items-center gap-2 mt-1">
                <TierBadge tier={org.tier || "Urgent"} />
                <span className="text-xs text-muted">
                  {org.ein} {org.state ? ` ${org.state}` : ""}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Vulnerability */}
          <div className="text-right flex-shrink-0">
            <p className="text-[10px] text-muted uppercase tracking-wider mb-1">
              Vulnerability
            </p>
            <p
              className="text-3xl font-bold tabular-nums"
              style={{ color: isHighRisk ? "#EF4444" : "#F5A623" }}
            >
              {vulnPct}%
            </p>
            {/* Mini vulnerability bar */}
            <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1.5 ml-auto">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${vulnPct}%`,
                  background: isHighRisk
                    ? "linear-gradient(90deg, #EF4444, #F87171)"
                    : "linear-gradient(90deg, #F5A623, #FBBF24)",
                }}
              />
            </div>
          </div>
        </div>

        {/* Risk Factors */}
        <div className="flex flex-wrap gap-2 mb-3">
          {org.factors.map((factor, j) => (
            <span
              key={j}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium"
              style={{
                background: isHighRisk ? "#FEE2E2" : "#FEF3E2",
                color: isHighRisk ? "#991B1B" : "#92400E",
              }}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              </svg>
              {factor}
            </span>
          ))}
        </div>

        {/* Recommendation callout */}
        <div className="callout-box mb-3">
          <p className="text-xs font-semibold text-moobu-blue mb-0.5">
            Recommendation
          </p>
          <p className="text-sm text-foreground leading-relaxed">
            {org.recommendation}
          </p>
        </div>

        {/* Bottom financials */}
        <div className="flex flex-wrap gap-6 text-xs text-muted pt-3 border-t border-border/60">
          <span>
            Revenue:{" "}
            <span className="font-semibold text-foreground">
              {formatCurrency(org.latest_total_revenue)}
            </span>
          </span>
          <span>
            Net Assets:{" "}
            <span className="font-semibold text-foreground">
              {formatCurrency(org.latest_net_assets)}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
