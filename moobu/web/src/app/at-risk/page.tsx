"use client";

import { useEffect, useState } from "react";
import { fetchAtRisk } from "@/lib/api";
import type { AtRiskOrg } from "@/lib/types";
import Link from "next/link";
import { formatCurrency, formatScore, tierClass } from "@/lib/utils";

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

  if (loading) return <div className="p-8 text-center text-muted">Loading...</div>;
  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-moobu-orange">Intervention Prioritization</h1>
        <p className="text-muted text-sm mt-1">
          {orgs.length} organizations ranked by early-warning vulnerability score.
          These nonprofits show financial patterns that match pre-crisis indicators.
        </p>
      </div>

      <div className="space-y-4">
        {orgs.map((org, i) => (
          <div
            key={org.ein}
            className="bg-card rounded-lg border border-border p-5 shadow-sm hover:border-moobu-orange/40 transition-colors"
          >
            <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
              <div className="flex items-start gap-4">
                <span className="text-2xl font-bold text-muted w-8">#{i + 1}</span>
                <div>
                  <Link href={`/org/${org.ein}`} className="text-lg font-semibold hover:text-moobu-blue">
                    {org.org_name || "Unknown"}
                  </Link>
                  <p className="text-sm text-muted">
                    EIN: {org.ein} &middot; {org.state}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-muted">Resilience</p>
                  <p className="font-mono font-semibold">{formatScore(org.composite_score)}</p>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs ${tierClass(org.tier)}`}>
                    {org.tier}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted">Vulnerability</p>
                  <p className="text-2xl font-bold text-moobu-orange">
                    {(org.vulnerability_score * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              {org.factors.map((factor, j) => (
                <span
                  key={j}
                  className="inline-block bg-moobu-orange-light text-sm px-2 py-0.5 rounded"
                >
                  {factor}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <div className="flex gap-4 text-muted">
                <span>Revenue: {formatCurrency(org.latest_total_revenue)}</span>
                <span>Net Assets: {formatCurrency(org.latest_net_assets)}</span>
              </div>
              <p className="text-moobu-blue font-medium">{org.recommendation}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
