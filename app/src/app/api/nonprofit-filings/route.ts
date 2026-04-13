import { NextResponse } from "next/server";

const PROPUBLICA_ORG = "https://projects.propublica.org/nonprofits/api/v2/organizations";

type ProPublicaFiling = {
  tax_prd_yr: number;
  totrevenue: number | null;
};

type ProPublicaOrgPayload = {
  organization?: { name?: string; ein?: number };
  filings_with_data?: ProPublicaFiling[];
};

function normalizeEin(raw: string | null): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  return d.length === 9 ? d : null;
}

/**
 * IRS Form 990 filing history for a nonprofit (public data) via
 * [ProPublica Nonprofit Explorer](https://projects.propublica.org/nonprofits/api/).
 */
export async function GET(request: Request) {
  try {
    const ein = normalizeEin(new URL(request.url).searchParams.get("ein"));
    if (!ein) {
      return NextResponse.json({ error: "Provide a 9-digit EIN, e.g. ?ein=33-0103012" }, { status: 400 });
    }

    let payload: ProPublicaOrgPayload;
    try {
      const res = await fetch(`${PROPUBLICA_ORG}/${ein}.json`, {
        next: { revalidate: 86_400 },
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        return NextResponse.json(
          { error: `ProPublica API returned ${res.status}` },
          { status: res.status === 404 ? 404 : 502 },
        );
      }
      const raw = await res.text();
      try {
        payload = JSON.parse(raw) as ProPublicaOrgPayload;
      } catch {
        return NextResponse.json(
          { error: "ProPublica returned a non-JSON response" },
          { status: 502 },
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "fetch failed";
      return NextResponse.json(
        { error: `Could not reach ProPublica API (${msg})` },
        { status: 502 },
      );
    }

    const org = payload.organization;
    const filings = payload.filings_with_data ?? [];
    const points: { year: number; revenue: number }[] = filings
      .filter((f) => typeof f.tax_prd_yr === "number" && f.totrevenue != null && !Number.isNaN(f.totrevenue))
      .map((f) => ({ year: f.tax_prd_yr, revenue: f.totrevenue as number }))
      .sort((a, b) => a.year - b.year);

    return NextResponse.json({
      ein,
      organizationName: org?.name ?? "Unknown organization",
      sourceName: "ProPublica Nonprofit Explorer (IRS Form 990 extracts)",
      sourceUrl: "https://projects.propublica.org/nonprofits/",
      points,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
