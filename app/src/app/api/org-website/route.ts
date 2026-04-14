import { NextResponse } from "next/server";
import { getNonprofitWorkerBaseUrl } from "@/lib/nonprofit-worker-url";

function normalizeEinParam(raw: string | null): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  return d.length === 9 ? d : null;
}

/**
 * Resolve organization website from Cloudflare Worker D1 (`irs990_xml_returns.website_txt`, latest filing per EIN).
 */
export async function GET(request: Request) {
  const ein = normalizeEinParam(new URL(request.url).searchParams.get("ein"));
  if (!ein) {
    return NextResponse.json({ error: "Provide a 9-digit EIN, e.g. ?ein=33-0103012" }, { status: 400 });
  }

  const base = getNonprofitWorkerBaseUrl();

  try {
    const res = await fetch(`${base}/api/irs990-website?ein=${ein}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return NextResponse.json({ website: null as string | null });
    }
    const data = (await res.json()) as { website?: string | null };
    return NextResponse.json({ website: data.website ?? null });
  } catch {
    return NextResponse.json({ website: null as string | null });
  }
}
