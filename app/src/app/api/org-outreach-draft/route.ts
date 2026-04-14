import OpenAI from "openai";
import { NextResponse } from "next/server";
import { normalizeOutreachEmailBody } from "@/lib/org-outreach-fallback";
import { formatOrgMissionDescription } from "@/lib/mission-text";
import { getNonprofitWorkerBaseUrl } from "@/lib/nonprofit-worker-url";
import { DEFAULT_OPENAI_CHAT_MODEL } from "@/lib/openai-chat-model";
import type { OrgOutreachDraftResponse } from "@/lib/org-outreach-types";

const EM_DASH = "\u2014";

function normalizeEin(raw: string | null): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  return d.length === 9 ? d : null;
}

async function fetchMissionForEin(ein9: string): Promise<string | null> {
  const base = getNonprofitWorkerBaseUrl();
  try {
    const res = await fetch(`${base}/api/irs990-mission?ein=${ein9}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { mission_raw?: string | null };
    return formatOrgMissionDescription(data.mission_raw ?? undefined) ?? null;
  } catch {
    return null;
  }
}

/**
 * POST `/api/org-outreach-draft` — OpenAI-generated plausible work emails, phone numbers, and mail drafts per contact.
 * Body: `{ ein, organizationName, city, state, missionSummary?, people: { name, title }[] }`
 */
export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing OPENAI_API_KEY for outreach draft generation." },
      { status: 503 },
    );
  }

  let body: {
    ein?: string;
    organizationName?: string;
    city?: string;
    state?: string;
    missionSummary?: string;
    people?: { name: string; title?: string | null }[];
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ein9 = normalizeEin(typeof body.ein === "string" ? body.ein : null);
  const organizationName = typeof body.organizationName === "string" ? body.organizationName.trim() : "";
  const city = typeof body.city === "string" ? body.city.trim() : "";
  const state = typeof body.state === "string" ? body.state.trim() : "";
  const peopleIn = Array.isArray(body.people) ? body.people : [];

  if (!ein9 || !organizationName || peopleIn.length === 0) {
    return NextResponse.json(
      { error: "Provide ein, organizationName, and a non-empty people array." },
      { status: 400 },
    );
  }

  let mission =
    typeof body.missionSummary === "string" && body.missionSummary.trim() && body.missionSummary.trim() !== EM_DASH
      ? body.missionSummary.trim()
      : null;
  if (!mission || mission.length < 20) {
    mission = (await fetchMissionForEin(ein9)) ?? mission ?? "General community nonprofit work.";
  }

  const peoplePayload = peopleIn.map((p) => ({
    name: String(p.name ?? "").trim() || "Contact",
    title: p.title != null && String(p.title).trim() ? String(p.title).trim() : null,
  }));

  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_CHAT_MODEL;

  const domainHint = organizationName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .replace(/^(the|a|an)+/g, "")
    .slice(0, 42);

  const userPrompt = `Nonprofit: "${organizationName}"
Location: ${city}, ${state}
Mission (for context): ${mission}
Suggested email domain stem (use or adapt for realistic .org addresses): "${domainHint || "nonprofit"}"

Contacts (in order):
${JSON.stringify(peoplePayload, null, 0)}

Return JSON only, matching schema:
{
  "people": [
    {
      "contactEmail": "Professional-looking work email: firstname.lastname, flast, or first_last @ a domain that plausibly matches this organization (prefer .org). Must be valid email format.",
      "phoneTel": "US number as E.164 starting +1; area code plausible for ${city}, ${state}; format like a direct office or mobile line (not obviously placeholder patterns).",
      "emailSubject": "Concise, professional subject line for reaching this specific person",
      "emailBody": "Plain text 3–6 short paragraphs, personalized by their title; reference mission briefly; respectful partnership tone. Put real newline characters between paragraphs inside the JSON string. No bracket placeholders."
    }
  ]
}

There must be exactly ${peoplePayload.length} entries in "people", same order as input.`;

  const openai = new OpenAI({ apiKey });

  try {
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.65,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You output only valid JSON. Invent realistic-looking synthetic contact details and message text suitable for a nonprofit CRM UI prototype — plausible formats only, not real individuals' actual emails or phone numbers.",
        },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw?.trim()) {
      return NextResponse.json({ error: "Empty model response" }, { status: 502 });
    }

    const parsed = JSON.parse(raw) as { people?: OrgOutreachDraftResponse["people"] };
    const out = parsed.people;
    if (!Array.isArray(out) || out.length !== peoplePayload.length) {
      return NextResponse.json({ error: "Model returned wrong people count" }, { status: 502 });
    }

    const fallbackDomain = `${domainHint || "organization"}.org`;

    const sanitized: OrgOutreachDraftResponse["people"] = out.map((row, i) => {
      const r = row as unknown as { contactEmail?: string; fakeEmail?: string };
      const rawEmail =
        typeof r.contactEmail === "string"
          ? r.contactEmail
          : typeof r.fakeEmail === "string"
            ? r.fakeEmail
            : "";
      const email =
        rawEmail.includes("@") && rawEmail.includes(".")
          ? rawEmail.trim()
          : `contact${i + 1}@${fallbackDomain}`;
      const rawTel = typeof row.phoneTel === "string" ? row.phoneTel : "";
      const digits = rawTel.replace(/\D/g, "");
      const tel =
        digits.length >= 10
          ? `+1${digits.slice(-10)}`
          : `+1212555${String(1000 + i).padStart(4, "0")}`;
      return {
        contactEmail: email,
        phoneTel: tel,
        emailSubject: typeof row.emailSubject === "string" ? row.emailSubject : `Hello — ${organizationName}`,
        emailBody: normalizeOutreachEmailBody(
          typeof row.emailBody === "string"
            ? row.emailBody
            : `I admire the work ${organizationName} does in ${city}.\n\nI'd love to connect regarding ${peoplePayload[i]!.title ?? "your team"}.`,
        ),
      };
    });

    return NextResponse.json({ people: sanitized } satisfies OrgOutreachDraftResponse);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
