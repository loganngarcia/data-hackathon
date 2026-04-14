import type { OrgDetail, PeerBenchmarkMetric, ScreenerRow } from "@/lib/types";

function median(nums: number[]): number {
  const s = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (s.length === 0) return 0;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** Median of defined numeric values; null if none. */
function medianNullable(values: (number | null | undefined)[]): number | null {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (nums.length === 0) return null;
  return median(nums);
}

export function staffPerMillion(row: ScreenerRow): number {
  /** Floor avoids absurd ratios when annual revenue is very small in 990 extracts. */
  const revM = Math.max(row.revenue / 1_000_000, 0.05);
  return row.staffCount / revM;
}

function programExpenses(row: ScreenerRow): number | null {
  const v = row.programServiceExpensesUsd;
  if (v === undefined) return null;
  return Number.isFinite(v) ? v : null;
}

function adminExpenses(row: ScreenerRow): number | null {
  const v = row.managementGeneralExpensesUsd;
  if (v === undefined) return null;
  return Number.isFinite(v) ? v : null;
}

function fundraisingExpenses(row: ScreenerRow): number | null {
  const v = row.fundraisingExpensesUsd;
  if (v === undefined) return null;
  return Number.isFinite(v) ? v : null;
}

/** Peer medians from the current portfolio (same orgs as Moobu-style peer frame). */
export function buildPeerBenchmarks(selected: ScreenerRow, all: ScreenerRow[]): OrgDetail["peerBenchmarks"] {
  const others = all.filter((r) => r.id !== selected.id);
  if (others.length === 0) {
    return selected.id === all[0]?.id
      ? ([
          {
            label: "Reserve months",
            format: "reserve_months",
            orgValue: selected.reserveMonths,
            peerMedian: selected.reserveMonths,
          },
          {
            label: "Revenue growth %",
            format: "percent",
            orgValue: selected.growthRate,
            peerMedian: selected.growthRate,
          },
          {
            label: "Staff per $1M",
            format: "ratio",
            orgValue: staffPerMillion(selected),
            peerMedian: staffPerMillion(selected),
          },
          {
            label: "Program expenses",
            format: "usd",
            orgValue: programExpenses(selected),
            peerMedian: programExpenses(selected),
          },
          {
            label: "Admin expenses",
            format: "usd",
            orgValue: adminExpenses(selected),
            peerMedian: adminExpenses(selected),
          },
          {
            label: "Fundraising expenses",
            format: "usd",
            orgValue: fundraisingExpenses(selected),
            peerMedian: fundraisingExpenses(selected),
          },
        ] satisfies PeerBenchmarkMetric[])
      : [];
  }

  const reservePeer = Math.round(median(others.map((o) => o.reserveMonths)) * 10) / 10;
  const growthPeer = Math.round(median(others.map((o) => o.growthRate)) * 10) / 10;
  const staffPeer = Math.round(median(others.map(staffPerMillion)) * 10) / 10;

  const out: PeerBenchmarkMetric[] = [
    {
      label: "Reserve months",
      format: "reserve_months",
      orgValue: Math.round(selected.reserveMonths * 10) / 10,
      peerMedian: reservePeer,
    },
    {
      label: "Revenue growth %",
      format: "percent",
      orgValue: Math.round(selected.growthRate * 10) / 10,
      peerMedian: growthPeer,
    },
    {
      label: "Staff per $1M",
      format: "ratio",
      orgValue: Math.round(staffPerMillion(selected) * 10) / 10,
      peerMedian: staffPeer,
    },
    {
      label: "Program expenses",
      format: "usd",
      orgValue: programExpenses(selected),
      peerMedian: medianNullable(others.map(programExpenses)),
    },
    {
      label: "Admin expenses",
      format: "usd",
      orgValue: adminExpenses(selected),
      peerMedian: medianNullable(others.map(adminExpenses)),
    },
    {
      label: "Fundraising expenses",
      format: "usd",
      orgValue: fundraisingExpenses(selected),
      peerMedian: medianNullable(others.map(fundraisingExpenses)),
    },
  ];

  return out;
}
