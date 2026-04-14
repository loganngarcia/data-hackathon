"use client";

import { useEffect, useState } from "react";
import { fetchHiddenGems } from "@/lib/api";
import type { HiddenGem } from "@/lib/types";
import Link from "next/link";
import { formatCurrency, formatScore, truncateMission } from "@/lib/utils";
import TierBadge from "@/components/TierBadge";

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
      <div className="p-12 text-center text-muted">
        <div className="inline-block w-6 h-6 border-2 border-moobu-purple/20 border-t-moobu-purple rounded-full animate-spin mb-3" />
        <p>Discovering hidden gems...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 text-lg mb-2">{error}</p>
        <p className="text-muted text-sm mt-2">
          Make sure the API is running:{" "}
          <code className="bg-gray-100 px-1 rounded">
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
      ? gems.reduce((sum, g) => sum + (g.latest_total_revenue || 0), 0) /
        gems.length
      : 0;
  const topTierCount = gems.filter(
    (g) => g.tier === "Thriving" || g.tier === "Stable"
  ).length;

  // Gem score color: purple/gold gradient
  function gemScoreColor(score: number): string {
    if (score >= 0.7) return "#7C3AED";
    if (score >= 0.5) return "#8B5CF6";
    if (score >= 0.3) return "#A78BFA";
    return "#C4B5FD";
  }

  function gemScoreLabel(score: number): string {
    if (score >= 0.7) return "Exceptional";
    if (score >= 0.5) return "Strong";
    if (score >= 0.3) return "Promising";
    return "Emerging";
  }

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="mb-6 animate-card-in">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">
          <span className="text-moobu-purple">Hidden Gems</span> — High-Impact
          Discovery
        </h1>
        <p className="text-muted text-sm mt-1 max-w-[800px]">
          Nonprofits delivering disproportionate community value relative to
          their budget. These organizations merit greater funder attention based
          on strong mission spending, financial resilience, and efficient
          operations despite limited resources.
        </p>
      </div>

      {/* Summary KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div
          className="widget widget-purple animate-card-in"
          style={{ animationDelay: "0ms" }}
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
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
            <span className="kpi-label">Gems Identified</span>
          </div>
          <p className="kpi-number text-[#8B5CF6]">{gems.length}</p>
          <p className="text-xs text-muted mt-1">High-impact organizations</p>
        </div>

        <div
          className="widget widget-purple animate-card-in"
          style={{ animationDelay: "60ms" }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-[#7C3AED]/10 flex items-center justify-center">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#7C3AED"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 20V10" />
                <path d="M18 20V4" />
                <path d="M6 20v-4" />
              </svg>
            </div>
            <span className="kpi-label">Avg Gem Score</span>
          </div>
          <p className="kpi-number text-[#7C3AED]">
            {(avgGemScore * 100).toFixed(0)}
            <span className="text-sm font-normal text-muted"> /100</span>
          </p>
        </div>

        <div
          className="widget widget-blue animate-card-in"
          style={{ animationDelay: "120ms" }}
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
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <span className="kpi-label">Avg Revenue</span>
          </div>
          <p className="kpi-number text-[#3B69B7]">
            {formatCurrency(avgRevenue)}
          </p>
          <p className="text-xs text-muted mt-1">Among identified gems</p>
        </div>

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
            <span className="kpi-label">Resilient Gems</span>
          </div>
          <p className="kpi-number text-[#10B981]">{topTierCount}</p>
          <p className="text-xs text-muted mt-1">Thriving or Stable tier</p>
        </div>
      </div>

      {/* Methodology Note */}
      <div
        className="advisory-note mb-6 animate-card-in"
        style={{
          animationDelay: "200ms",
          borderLeftColor: "#8B5CF6",
          background:
            "linear-gradient(135deg, #FAF5FF 0%, #F3EEFF 100%)",
          borderColor: "rgba(139, 92, 246, 0.2)",
        }}
      >
        <p
          className="advisory-note-title"
          style={{ color: "#7C3AED" }}
        >
          How We Identify Hidden Gems
        </p>
        <p className="text-sm text-foreground leading-relaxed">
          Our gem score combines five factors: program expense efficiency (30%),
          surplus consistency (20%), revenue diversification (20%), growth
          trajectory (15%), and a small-organization bonus (15%) that
          rewards nonprofits achieving strong metrics despite limited budgets.
          This surfaces organizations that deliver outsized community impact
          per dollar spent -- exactly the nonprofits that merit greater funder
          attention.
        </p>
      </div>

      {/* Gem Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {gems.map((gem, i) => {
          const scoreColor = gemScoreColor(gem.gem_score);
          const scoreLabel = gemScoreLabel(gem.gem_score);
          const gemPct = Math.min(gem.gem_score * 100, 100);

          return (
            <div
              key={gem.ein}
              className="glass-card overflow-hidden animate-card-in"
              style={{ animationDelay: `${220 + i * 30}ms` }}
            >
              {/* Purple gradient strip */}
              <div
                className="h-1"
                style={{
                  background:
                    "linear-gradient(90deg, #7C3AED, #A78BFA, #C4B5FD)",
                }}
              />

              <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0 mr-3">
                    <Link
                      href={`/org/${gem.ein}`}
                      className="text-sm font-bold text-foreground hover:text-moobu-purple transition-colors line-clamp-1"
                    >
                      {gem.org_name || "Unknown Organization"}
                    </Link>
                    <div className="flex items-center gap-2 mt-1">
                      {gem.state && (
                        <span className="text-[11px] text-muted bg-gray-100 px-1.5 py-0.5 rounded">
                          {gem.state}
                        </span>
                      )}
                      {gem.tier && <TierBadge tier={gem.tier} />}
                    </div>
                  </div>

                  {/* Gem Score Badge */}
                  <div
                    className="flex-shrink-0 flex flex-col items-center rounded-xl px-3 py-2"
                    style={{
                      background:
                        "linear-gradient(135deg, #FAF5FF, #F3EEFF)",
                      border: "1px solid rgba(139, 92, 246, 0.15)",
                    }}
                  >
                    <span
                      className="text-lg font-extrabold tabular-nums"
                      style={{ color: scoreColor }}
                    >
                      {gemPct.toFixed(0)}
                    </span>
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-muted">
                      {scoreLabel}
                    </span>
                  </div>
                </div>

                {/* Mission */}
                <p className="text-xs text-muted leading-relaxed mb-3 line-clamp-2">
                  {truncateMission(gem.mission_description, 150)}
                </p>

                {/* Why it is a gem */}
                <div
                  className="rounded-lg p-2.5 mb-3"
                  style={{
                    background: "rgba(139, 92, 246, 0.04)",
                    border: "1px solid rgba(139, 92, 246, 0.1)",
                  }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#7C3AED] mb-1">
                    Why this is a gem
                  </p>
                  <p className="text-xs text-foreground leading-relaxed">
                    {gem.gem_reason}
                  </p>
                </div>

                {/* Metrics row */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="text-center">
                    <p className="text-[10px] text-muted uppercase tracking-wider">
                      Revenue
                    </p>
                    <p className="text-sm font-semibold text-foreground tabular-nums">
                      {formatCurrency(gem.latest_total_revenue)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-muted uppercase tracking-wider">
                      Resilience
                    </p>
                    <p className="text-sm font-semibold text-foreground tabular-nums">
                      {gem.composite_score != null
                        ? formatScore(gem.composite_score)
                        : "N/A"}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-muted uppercase tracking-wider">
                      Program %
                    </p>
                    <p className="text-sm font-semibold text-foreground tabular-nums">
                      {gem.program_efficiency != null
                        ? `${gem.program_efficiency.toFixed(0)}%`
                        : "N/A"}
                    </p>
                  </div>
                </div>

                {/* Gem score bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-muted uppercase tracking-wider">
                      Gem Score
                    </span>
                    <span
                      className="text-[11px] font-bold tabular-nums"
                      style={{ color: scoreColor }}
                    >
                      {gemPct.toFixed(0)}/100
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full animate-bar-grow"
                      style={{
                        width: `${gemPct}%`,
                        background: `linear-gradient(90deg, #7C3AED, ${scoreColor})`,
                        animationDelay: `${220 + i * 30 + 200}ms`,
                      }}
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  {gem.employee_count != null && gem.employee_count > 0 && (
                    <span className="text-[11px] text-muted">
                      {gem.employee_count.toLocaleString()} employees
                    </span>
                  )}
                  {(!gem.employee_count || gem.employee_count <= 0) && (
                    <span />
                  )}
                  <Link
                    href={`/org/${gem.ein}`}
                    className="text-[11px] font-semibold text-moobu-purple hover:underline transition-colors"
                  >
                    Full X-Ray Report
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {gems.length === 0 && (
        <div className="text-center py-16 text-muted">
          <p className="text-lg mb-1">No hidden gems found</p>
          <p className="text-sm">
            Try adjusting scoring parameters or ensure data has been ingested.
          </p>
        </div>
      )}
    </div>
  );
}
