"use client";

import { useEffect, useState } from "react";
import { fetchHiddenGems } from "@/lib/api";
import type { HiddenGem } from "@/lib/types";
import Link from "next/link";
import { formatCurrency, formatScore, truncateMission } from "@/lib/utils";
import StatusBadge from "@/components/StatusBadge";

export default function HiddenGemsPage() {
  const [gems, setGems] = useState<HiddenGem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchHiddenGems(100);
        setGems(data);
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
          className="inline-block w-5 h-5 border-2 border-status-healthy/20 border-t-status-healthy rounded-full mb-3"
          style={{ animation: "spin 0.8s linear infinite" }}
        />
        <p className="text-sm">Discovering hidden gems...</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-status-urgent text-base mb-2">{error}</p>
        <p className="text-ink-tertiary text-sm mt-2">
          Make sure the API is running:{" "}
          <code className="bg-paper-inset px-1.5 py-0.5 rounded text-xs">
            cd moobu/api && uvicorn moobu_api.main:app
          </code>
        </p>
      </div>
    );
  }

  const avgGemScore =
    gems.length > 0
      ? gems.reduce((sum, g) => sum + g.gem_score, 0) / gems.length
      : 0;
  const avgRevenue =
    gems.length > 0
      ? gems.reduce((sum, g) => sum + (g.latest_total_revenue || 0), 0) / gems.length
      : 0;

  return (
    <div className="px-6 py-5 max-w-[1440px] mx-auto">
      {/* Summary Strip */}
      <div
        className="flex items-center divide-x mb-5"
        style={{ borderColor: "var(--boundary)" }}
      >
        <div className="pr-5">
          <p className="text-xs text-ink-tertiary" style={{ letterSpacing: "0.02em" }}>Gems Identified</p>
          <p className="text-xl tabular-nums text-ink" style={{ fontWeight: 600 }}>
            {gems.length}
          </p>
        </div>
        <div className="px-5">
          <p className="text-xs text-ink-tertiary" style={{ letterSpacing: "0.02em" }}>Avg Gem Score</p>
          <p className="text-xl tabular-nums text-ink" style={{ fontWeight: 600 }}>
            {(avgGemScore * 100).toFixed(0)} / 100
          </p>
        </div>
        <div className="px-5">
          <p className="text-xs text-ink-tertiary" style={{ letterSpacing: "0.02em" }}>Avg Revenue</p>
          <p className="text-xl tabular-nums text-ink" style={{ fontWeight: 600 }}>
            {formatCurrency(avgRevenue)}
          </p>
        </div>
      </div>

      {/* Gem Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {gems.map((gem) => {
          const gemPct = Math.min(gem.gem_score * 100, 100);

          return (
            <div
              key={gem.ein}
              className="card overflow-hidden"
              style={{ padding: 0 }}
            >
              {/* Status accent strip */}
              <div
                className="tier-strip"
                style={{
                  background:
                    gemPct >= 70
                      ? "var(--status-healthy)"
                      : gemPct >= 50
                      ? "var(--status-stable)"
                      : "var(--status-attention)",
                }}
              />

              <div className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0 mr-3">
                    <Link
                      href={`/org/${gem.ein}`}
                      className="text-sm text-ink hover:text-brand line-clamp-1"
                      style={{ fontWeight: 500 }}
                    >
                      {gem.org_name || "Unknown Organization"}
                    </Link>
                    <div className="flex items-center gap-2 mt-1">
                      {gem.state && (
                        <span className="text-xs text-ink-tertiary">
                          {gem.state}
                        </span>
                      )}
                      {gem.tier && <StatusBadge tier={gem.tier} />}
                    </div>
                  </div>

                  {/* Gem Score */}
                  <div className="flex-shrink-0 text-right">
                    <span
                      className="text-lg tabular-nums"
                      style={{
                        fontWeight: 600,
                        color: gemPct >= 70
                          ? "var(--status-healthy)"
                          : gemPct >= 50
                          ? "var(--status-stable)"
                          : "var(--status-attention)",
                      }}
                    >
                      {gemPct.toFixed(0)}
                    </span>
                    <span className="text-xs text-ink-muted"> /100</span>
                  </div>
                </div>

                {/* Mission */}
                <p className="text-xs text-ink-tertiary leading-relaxed mb-3 line-clamp-1">
                  {truncateMission(gem.mission_description, 120)}
                </p>

                {/* Why */}
                <p className="text-xs text-ink-secondary leading-relaxed mb-3">
                  {gem.gem_reason}
                </p>

                {/* Gem score bar */}
                <div className="mb-3">
                  <div
                    className="rounded-full overflow-hidden"
                    style={{ height: 4, background: "var(--paper-inset)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${gemPct}%`,
                        backgroundColor: gemPct >= 70
                          ? "var(--status-healthy)"
                          : gemPct >= 50
                          ? "var(--status-stable)"
                          : "var(--status-attention)",
                      }}
                    />
                  </div>
                </div>

                {/* Metrics row */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[10px] text-ink-muted" style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Revenue
                    </p>
                    <p className="text-sm text-ink tabular-nums" style={{ fontWeight: 500 }}>
                      {formatCurrency(gem.latest_total_revenue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-ink-muted" style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Resilience
                    </p>
                    <p className="text-sm text-ink tabular-nums" style={{ fontWeight: 500 }}>
                      {gem.composite_score != null
                        ? formatScore(gem.composite_score)
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-ink-muted" style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Program %
                    </p>
                    <p className="text-sm text-ink tabular-nums" style={{ fontWeight: 500 }}>
                      {gem.program_efficiency != null
                        ? `${gem.program_efficiency.toFixed(0)}%`
                        : "N/A"}
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div
                  className="flex items-center justify-between pt-3 mt-3"
                  style={{ borderTop: "1px solid var(--boundary-soft)" }}
                >
                  {gem.employee_count != null && gem.employee_count > 0 ? (
                    <span className="text-xs text-ink-muted">
                      {gem.employee_count.toLocaleString()} employees
                    </span>
                  ) : (
                    <span />
                  )}
                  <Link
                    href={`/org/${gem.ein}`}
                    className="text-xs text-brand hover:underline"
                    style={{ fontWeight: 500 }}
                  >
                    View Report
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {gems.length === 0 && (
        <div className="text-center py-16 text-ink-tertiary">
          <p className="text-base mb-1">No hidden gems found</p>
          <p className="text-sm">
            Try adjusting scoring parameters or ensure data has been ingested.
          </p>
        </div>
      )}
    </div>
  );
}
