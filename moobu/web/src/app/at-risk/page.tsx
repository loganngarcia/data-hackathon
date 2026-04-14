"use client";

import { useEffect, useState } from "react";
import { fetchAtRisk } from "@/lib/api";
import type { AtRiskOrg } from "@/lib/types";
import Link from "next/link";
import TierBadge from "@/components/TierBadge";

export default function RiskMonitorPage() {
  const [orgs, setOrgs] = useState<AtRiskOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedEin, setExpandedEin] = useState<string | null>(null);

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
        <p>Loading risk monitor...</p>
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
  const totalAtRisk = orgs.length;
  const portfolioAtRiskPct =
    totalAtRisk > 0 ? ((criticalCount / totalAtRisk) * 100).toFixed(1) : "0";

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="mb-6 animate-card-in">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">
          <span className="text-moobu-orange">Risk</span> Monitor
        </h1>
        <p className="text-muted text-sm mt-1">
          Early-warning system for organizations showing pre-crisis financial
          patterns. Ranked by risk probability score.
        </p>
      </div>

      {/* Summary KPI Row */}
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
            <span className="kpi-label">Total Flagged</span>
          </div>
          <p className="kpi-number text-[#F5A623]">{totalAtRisk}</p>
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
            <span className="kpi-label">Critical ({">"}70% Risk)</span>
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
            <span className="kpi-label">Critical % of Flagged</span>
          </div>
          <p className="kpi-number text-[#8B5CF6]">{portfolioAtRiskPct}%</p>
        </div>
      </div>

      {/* Priority List Table */}
      <div className="widget-chart p-0 overflow-hidden animate-card-in" style={{ animationDelay: "180ms" }}>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>Rank</th>
                <th style={{ minWidth: 240 }}>Organization</th>
                <th style={{ width: 60 }}>State</th>
                <th className="col-right" style={{ width: 100 }}>
                  Resilience
                </th>
                <th className="col-right" style={{ width: 110 }}>
                  Risk Probability
                </th>
                <th style={{ minWidth: 180 }}>Key Risk Factor</th>
                <th style={{ minWidth: 200 }}>Recommended Action</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((org, i) => {
                const isCritical = org.vulnerability_score > 0.7;
                const vulnPct = (org.vulnerability_score * 100).toFixed(0);
                const isExpanded = expandedEin === org.ein;

                return (
                  <tr
                    key={org.ein}
                    className={`cursor-pointer ${
                      isCritical ? "risk-row-critical" : "risk-row-moderate"
                    }`}
                    onClick={() =>
                      setExpandedEin(isExpanded ? null : org.ein)
                    }
                  >
                    <td>
                      <span className="text-sm font-bold text-muted/40 tabular-nums">
                        #{i + 1}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/org/${org.ein}`}
                        className="font-semibold text-sm hover:text-moobu-blue transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {org.org_name || "Unknown"}
                      </Link>
                      {isExpanded && org.factors.length > 1 && (
                        <div className="mt-2 space-y-1">
                          {org.factors.map((f, j) => (
                            <div
                              key={j}
                              className="flex items-center gap-1.5 text-[11px] text-muted"
                            >
                              <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke={isCritical ? "#EF4444" : "#F5A623"}
                                strokeWidth="2.5"
                              >
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                              </svg>
                              {f}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="text-xs text-muted bg-gray-100 px-1.5 py-0.5 rounded">
                        {org.state || "--"}
                      </span>
                    </td>
                    <td className="col-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs font-mono font-semibold tabular-nums">
                          {org.composite_score != null
                            ? org.composite_score.toFixed(1)
                            : "--"}
                        </span>
                        <TierBadge tier={org.tier || "Urgent"} />
                      </div>
                    </td>
                    <td className="col-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${vulnPct}%`,
                              background: isCritical
                                ? "linear-gradient(90deg, #EF4444, #F87171)"
                                : "linear-gradient(90deg, #F5A623, #FBBF24)",
                            }}
                          />
                        </div>
                        <span
                          className="text-xs font-semibold tabular-nums"
                          style={{
                            color: isCritical ? "#EF4444" : "#F5A623",
                          }}
                        >
                          {vulnPct}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{
                          background: isCritical ? "#FEE2E2" : "#FEF3E2",
                          color: isCritical ? "#991B1B" : "#92400E",
                        }}
                      >
                        {org.factors[0] || "Multiple factors"}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs text-muted leading-relaxed line-clamp-2">
                        {org.recommendation}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {orgs.length === 0 && (
        <div className="text-center py-16 text-muted">
          <p className="text-lg">No at-risk organizations detected.</p>
          <p className="text-sm mt-1">
            All organizations in the portfolio are showing healthy financial
            patterns.
          </p>
        </div>
      )}
    </div>
  );
}
