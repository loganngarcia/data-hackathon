import { NextResponse } from "next/server";
import { getNonprofitWorkerBaseUrl } from "@/lib/nonprofit-worker-url";
import type { OrgPerson990 } from "@/lib/types";

function normalizeEinParam(raw: string | null): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  return d.length === 9 ? d : null;
}

/**
 * Officers / directors from TEOS Form 990 Part VII (latest filing per EIN), via Worker D1.
 */
export async function GET(request: Request) {
  const ein = normalizeEinParam(new URL(request.url).searchParams.get("ein"));
  if (!ein) {
    return NextResponse.json({ error: "Provide a 9-digit EIN, e.g. ?ein=33-0103012" }, { status: 400 });
  }

  const base = getNonprofitWorkerBaseUrl();

  try {
    const res = await fetch(`${base}/api/irs990-people?ein=${ein}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return NextResponse.json({ people: [] as OrgPerson990[] });
    }
    const data = (await res.json()) as { people?: OrgPerson990[]; error?: string };
    const people = Array.isArray(data.people) ? data.people : [];
    return NextResponse.json({ people });
  } catch {
    return NextResponse.json({ people: [] as OrgPerson990[] });
  }
}
