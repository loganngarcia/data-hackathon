import type { OrgDetail, ScreenerRow } from "@/lib/types";

function median(nums: number[]): number {
  const s = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (s.length === 0) return 0;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export function staffPerMillion(row: ScreenerRow): number {
  /** Floor avoids absurd ratios when annual revenue is very small in 990 extracts. */
  const revM = Math.max(row.revenue / 1_000_000, 0.05);
  return row.staffCount / revM;
}

/** Peer medians from the current portfolio (same orgs as Moobu-style peer frame). */
export function buildPeerBenchmarks(selected: ScreenerRow, all: ScreenerRow[]): OrgDetail["peerBenchmarks"] {
  const others = all.filter((r) => r.id !== selected.id);
  if (others.length === 0) {
    return selected.id === all[0]?.id
      ? [
          { label: "Reserve months", orgValue: selected.reserveMonths, peerMedian: selected.reserveMonths },
          { label: "Revenue growth %", orgValue: selected.growthRate, peerMedian: selected.growthRate },
          { label: "Staff per $1M", orgValue: staffPerMillion(selected), peerMedian: staffPerMillion(selected) },
        ]
      : [];
  }
  return [
    {
      label: "Reserve months",
      orgValue: Math.round(selected.reserveMonths * 10) / 10,
      peerMedian: Math.round(median(others.map((o) => o.reserveMonths)) * 10) / 10,
    },
    {
      label: "Revenue growth %",
      orgValue: Math.round(selected.growthRate * 10) / 10,
      peerMedian: Math.round(median(others.map((o) => o.growthRate)) * 10) / 10,
    },
    {
      label: "Staff per $1M",
      orgValue: Math.round(staffPerMillion(selected) * 10) / 10,
      peerMedian: Math.round(median(others.map(staffPerMillion)) * 10) / 10,
    },
  ];
}
