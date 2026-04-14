"use client";

import { useEffect, useState } from "react";
import { fetchAtRisk } from "@/lib/api";
import type { AtRiskOrg } from "@/lib/types";
import Link from "next/link";
import ResilienceGauge from "@/components/ResilienceGauge";

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
      <div className="p-12 text-center text-ink-tertiary">
        <div
          className="inline-block w-5 h-5 border-2 border-status-attention/20 border-t-status-attention rounded-full mb-3"
          style={{ animation: "spin 0.8s linear infinite" }}
        />
        <p className="text-sm">Loading risk monitor...</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-status-urgent text-base">{error}</p>
      </div>
    );
  }

  const criticalCount = orgs.filter((o) => o.vulnerability_score > 0.7).length;
  const totalAtRisk = orgs.length;
  const criticalPct =
    totalAtRisk > 0 ? ((criticalCount / totalAtRisk) * 100).toFixed(1) : "0";

  return (
    <div className="px-6 py-5 max-w-[1440px] mx-auto">
      {/* Summary Strip */}
      <div
        className="flex items-center divide-x mb-5"
        style={{ borderColor: "var(--boundary)" }}
      >
        <div className="pr-5">
          <p className="text-xs text-ink-tertiary" style={{ letterSpacing: "0.02em" }}>Flagged</p>
          <p className="text-xl tabular-nums text-ink" style={{ fontWeight: 600 }}>
            {totalAtRisk}
          </p>
        </div>
        <div className="px-5">
          <p className="text-xs text-ink-tertiary" style={{ letterSpacing: "0.02em" }}>Critical</p>
          <p className="text-xl tabular-nums text-ink" style={{ fontWeight: 600 }}>
            {criticalCount}
          </p>
        </div>
        <div className="px-5">
          <p className="text-xs text-ink-tertiary" style={{ letterSpacing: "0.02em" }}>Critical Rate</p>
          <p className="text-xl tabular-nums text-ink" style={{ fontWeight: 600 }}>
            {criticalPct}%
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="card-flush">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>Rank</th>
                <th style={{ minWidth: 240 }}>Organization</th>
                <th style={{ width: 55 }}>State</th>
                <th style={{ minWidth: 140 }}>Resilience</th>
                <th className="col-right" style={{ width: 100 }}>Risk %</th>
                <th style={{ minWidth: 180 }}>Key Factor</th>
                <th style={{ minWidth: 200 }}>Action</th>
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
                      <span className="text-sm text-ink-muted tabular-nums" style={{ fontWeight: 600 }}>
                        #{i + 1}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/org/${org.ein}`}
                        className="text-sm hover:text-brand"
                        style={{ fontWeight: 500 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {org.org_name || "Unknown"}
                      </Link>
                      {isExpanded && org.factors.length > 1 && (
                        <div className="mt-2 space-y-1">
                          {org.factors.map((f, j) => (
                            <div
                              key={j}
                              className="flex items-center gap-1.5 text-xs text-ink-tertiary"
                            >
                              <span
                                className="inline-block w-1 h-1 rounded-full flex-shrink-0"
                                style={{
                                  backgroundColor: isCritical
                                    ? "var(--status-urgent)"
                                    : "var(--status-attention)",
                                }}
                              />
                              {f}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="text-xs text-ink-tertiary">
                        {org.state || "--"}
                      </span>
                    </td>
                    <td>
                      <ResilienceGauge
                        score={org.composite_score ?? 0}
                        tier={org.tier ?? "Urgent"}
                        size="sm"
                      />
                    </td>
                    <td className="col-right">
                      <span
                        className="text-xs tabular-nums"
                        style={{
                          fontWeight: 600,
                          color: isCritical
                            ? "var(--status-urgent)"
                            : "var(--status-attention)",
                        }}
                      >
                        {vulnPct}%
                      </span>
                    </td>
                    <td>
                      <span className="text-xs text-ink-secondary">
                        {org.factors[0] || "Multiple factors"}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs text-ink-tertiary leading-relaxed line-clamp-2">
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
        <div className="text-center py-16 text-ink-tertiary">
          <p className="text-base">No at-risk organizations detected.</p>
          <p className="text-sm mt-1">
            All organizations are showing healthy financial patterns.
          </p>
        </div>
      )}
    </div>
  );
}
