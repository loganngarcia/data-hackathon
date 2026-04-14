import { NextResponse } from "next/server";
import { mapIrs990Rows, type Irs990BrowseRow } from "@/lib/irs990-browse-map";
import { getNonprofitWorkerBaseUrl } from "@/lib/nonprofit-worker-url";

/**
 * Fetch a single TEOS org by portfolio id (`irs990-…` / `irs990-ein-…`) for deep links
 * when the org is not in the random portfolio page.
 */
export async function GET(request: Request) {
  const orgId = new URL(request.url).searchParams.get("orgId")?.trim();
  if (!orgId) {
    return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
  }

  const base = getNonprofitWorkerBaseUrl();
  try {
    const res = await fetch(
      `${base}/api/irs990-row?orgId=${encodeURIComponent(orgId)}`,
      {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(20_000),
      },
    );
    const data = (await res.json().catch(() => ({}))) as { rows?: Irs990BrowseRow[]; error?: string };
    if (res.status === 404 || !data.rows?.length) {
      return NextResponse.json({ error: "Not found", screener: [], revenueByOrg: {} }, { status: 404 });
    }
    if (!res.ok) {
      return NextResponse.json(
        { error: data.error ?? "Worker error", screener: [], revenueByOrg: {} },
        { status: 502 },
      );
    }
    const mapped = mapIrs990Rows(data.rows);
    return NextResponse.json(mapped);
  } catch {
    return NextResponse.json({ error: "Upstream failed", screener: [], revenueByOrg: {} }, { status: 502 });
  }
}
