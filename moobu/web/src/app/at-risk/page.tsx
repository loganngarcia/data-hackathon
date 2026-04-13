"use client";

import { useEffect, useState } from "react";
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

  const criticalCount = orgs.filter(
    (o) => o.vulnerability_score > 0.7
  ).length;

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">
          <span className="text-moobu-orange">Intervention</span> Prioritization
        </h1>
        <p className="text-muted text-sm mt-1">
          {orgs.length} organizations ranked by early-warning vulnerability
          score. These nonprofits show financial patterns that match pre-crisis
          indicators.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="glass-card p-5">
          <p className="text-xs text-muted uppercase tracking-wide mb-1">
            Total At Risk
          </p>
          <p className="text-2xl font-bold text-moobu-orange">
            {orgs.length}
          </p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs text-muted uppercase tracking-wide mb-1">
            Critical (70%+)
          </p>
          <p className="text-2xl font-bold text-urgent">{criticalCount}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs text-muted uppercase tracking-wide mb-1">
            Avg Vulnerability
          </p>
          <p className="text-2xl font-bold text-moobu-orange">
            {orgs.length > 0
              ? (
                  (orgs.reduce((s, o) => s + o.vulnerability_score, 0) /
                    orgs.length) *
                  100
                ).toFixed(0)
              : 0}
            %
          </p>
        </div>
      </div>

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
            <span className="text-2xl font-bold text-muted/40 w-8 flex-shrink-0">
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
                  {org.ein} {org.state ? `  ${org.state}` : ""}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Vulnerability Score */}
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-muted uppercase tracking-wide mb-1">
              Vulnerability
            </p>
            <p
              className="text-3xl font-bold"
              style={{
                color: isHighRisk ? "#DC2626" : "#F5A623",
              }}
            >
              {vulnPct}%
            </p>
          </div>
        </div>

        {/* Risk Factors as colored chips */}
        <div className="flex flex-wrap gap-2 mb-3">
          {org.factors.map((factor, j) => (
            <span
              key={j}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium"
              style={{
                background: isHighRisk ? "#FEE2E2" : "#FEF3E2",
                color: isHighRisk ? "#991B1B" : "#92400E",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
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
          <p className="text-sm text-foreground">{org.recommendation}</p>
        </div>

        {/* Bottom financials */}
        <div className="flex flex-wrap gap-6 text-xs text-muted pt-3 border-t border-border/60">
          <span>
            Revenue:{" "}
            <span className="font-medium text-foreground">
              {formatCurrency(org.latest_total_revenue)}
            </span>
          </span>
          <span>
            Net Assets:{" "}
            <span className="font-medium text-foreground">
              {formatCurrency(org.latest_net_assets)}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
