"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { fetchNonprofit, fetchPeers } from "@/lib/api";
import type { NonprofitProfile, PeerComparison } from "@/lib/types";
import Link from "next/link";
import { formatCurrency, formatScore, tierClass } from "@/lib/utils";

const METRIC_LABELS: Record<string, string> = {
  revenue_concentration_hhi: "Revenue Diversification",
  operating_reserve_ratio: "Operating Reserves",
  revenue_growth_trend: "Revenue Growth",
  expense_vs_revenue_growth: "Expense Control",
  program_expense_ratio: "Program Efficiency",
  revenue_volatility: "Revenue Stability",
  net_asset_trend: "Asset Growth",
  surplus_deficit_consistency: "Surplus Consistency",
};

export default function OrgDetailPage() {
  const params = useParams();
  const ein = params.ein as string;
  const [profile, setProfile] = useState<NonprofitProfile | null>(null);
  const [peers, setPeers] = useState<PeerComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [p, pe] = await Promise.all([
          fetchNonprofit(ein),
          fetchPeers(ein),
        ]);
        setProfile(p);
        setPeers(pe);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [ein]);

  if (loading) return <div className="p-8 text-center text-muted">Loading...</div>;
  if (error || !profile) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">{error || "Not found"}</p>
        <Link href="/" className="text-moobu-blue text-sm mt-2 inline-block">Back to Portfolio</Link>
      </div>
    );
  }

  const chartData = profile.financials.map((f) => ({
    year: f.tax_year,
    Revenue: f.total_revenue || 0,
    Expenses: f.total_expenses || 0,
    "Net Assets": f.net_assets_eoy || 0,
  }));

  const metricData = profile.metrics
    ? Object.entries(METRIC_LABELS).map(([key, label]) => ({
        metric: label,
        value: (profile.metrics as unknown as Record<string, number | null>)[key] ?? 0,
      }))
    : [];

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <Link href="/" className="text-sm text-moobu-blue hover:underline mb-4 inline-block">
        &larr; Back to Portfolio
      </Link>

      {/* Header */}
      <div className="bg-card rounded-lg border border-border p-6 mb-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{profile.org_name || "Unknown"}</h1>
            <p className="text-muted text-sm">
              EIN: {profile.ein} &middot; {profile.state} &middot; {profile.years_of_data} years of data
              ({profile.confidence} confidence)
            </p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold text-moobu-blue">{formatScore(profile.composite_score)}</p>
            <span className={`inline-block px-3 py-1 rounded text-sm font-medium mt-1 ${tierClass(profile.tier)}`}>
              {profile.tier}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <MiniStat label="Total Revenue" value={formatCurrency(profile.financials.at(-1)?.total_revenue)} />
          <MiniStat label="Total Expenses" value={formatCurrency(profile.financials.at(-1)?.total_expenses)} />
          <MiniStat label="Net Assets" value={formatCurrency(profile.financials.at(-1)?.net_assets_eoy)} />
          <MiniStat
            label="Vulnerability"
            value={
              profile.vulnerability_score != null
                ? `${(profile.vulnerability_score * 100).toFixed(0)}%`
                : "Low"
            }
            accent={profile.vulnerability_score != null && profile.vulnerability_score > 0.3}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Financial Trajectory */}
        <div className="bg-card rounded-lg border border-border p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Financial Trajectory</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="year" />
              <YAxis tickFormatter={(v: number) => `$${(v / 1e6).toFixed(1)}M`} />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value))}
                labelFormatter={(label) => `Tax Year ${label}`}
              />
              <Legend />
              <Line type="monotone" dataKey="Revenue" stroke="#3B69B7" strokeWidth={2} dot />
              <Line type="monotone" dataKey="Expenses" stroke="#F5A623" strokeWidth={2} dot />
              <Line type="monotone" dataKey="Net Assets" stroke="#16A34A" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Resilience Score Breakdown */}
        <div className="bg-card rounded-lg border border-border p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Resilience Score Breakdown</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={metricData} layout="vertical" margin={{ left: 120 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis type="number" domain={[0, 10]} />
              <YAxis type="category" dataKey="metric" width={110} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => Number(value).toFixed(2)} />
              <Bar dataKey="value" fill="#3B69B7" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Warning Factors */}
      {profile.warning_factors && profile.warning_factors.length > 0 && (
        <div className="bg-moobu-orange-light rounded-lg border border-moobu-orange/30 p-6 mb-6">
          <h2 className="text-lg font-semibold text-moobu-orange mb-3">Early Warning Signals</h2>
          <ul className="space-y-2">
            {profile.warning_factors.map((factor, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-moobu-orange mt-0.5">!</span>
                <span>{factor}</span>
              </li>
            ))}
          </ul>
          {profile.recommendation && (
            <div className="mt-4 pt-4 border-t border-moobu-orange/20">
              <p className="text-sm font-medium">Recommendation</p>
              <p className="text-sm text-muted mt-1">{profile.recommendation}</p>
            </div>
          )}
        </div>
      )}

      {/* Peer Comparison */}
      {peers && peers.peers.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-1">Peer Comparison</h2>
          <p className="text-sm text-muted mb-4">
            {peers.peers.length} similar organizations in {profile.state}
            {peers.peer_avg_score != null && ` (peer avg: ${formatScore(peers.peer_avg_score)})`}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="px-4 py-2">Organization</th>
                  <th className="px-4 py-2 text-right">Score</th>
                  <th className="px-4 py-2">Tier</th>
                  <th className="px-4 py-2 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {peers.peers.map((peer) => (
                  <tr key={peer.ein} className="border-b border-border hover:bg-moobu-blue-light/20">
                    <td className="px-4 py-2">
                      <Link href={`/org/${peer.ein}`} className="hover:text-moobu-blue">
                        {peer.org_name || "Unknown"}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right font-mono">{formatScore(peer.composite_score)}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs ${tierClass(peer.tier)}`}>
                        {peer.tier}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">{formatCurrency(peer.latest_total_revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-lg font-semibold ${accent ? "text-moobu-orange" : ""}`}>{value}</p>
    </div>
  );
}
