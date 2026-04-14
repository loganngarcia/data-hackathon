import { NextResponse } from "next/server";
import { formatOrgMissionDescription } from "@/lib/mission-text";
import { getNonprofitWorkerBaseUrl } from "@/lib/nonprofit-worker-url";

function normalizeEinParam(raw: string | null): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  return d.length === 9 ? d : null;
}

/**
 * TEOS mission / activity text from Worker D1, formatted for display.
 */
export async function GET(request: Request) {
  const ein = normalizeEinParam(new URL(request.url).searchParams.get("ein"));
  if (!ein) {
    return NextResponse.json({ error: "Provide a 9-digit EIN, e.g. ?ein=33-0103012" }, { status: 400 });
  }

  const base = getNonprofitWorkerBaseUrl();

  try {
    const res = await fetch(`${base}/api/irs990-mission?ein=${ein}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      return NextResponse.json({ mission: null as string | null });
    }
    const data = (await res.json()) as { mission_raw?: string | null; error?: string };
    const mission = formatOrgMissionDescription(data.mission_raw ?? undefined);
    return NextResponse.json({ mission: mission ?? null });
  } catch {
    return NextResponse.json({ mission: null as string | null });
  }
}
