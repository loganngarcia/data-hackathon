import OpenAI from "openai";
import { NextResponse } from "next/server";
import { DEFAULT_OPENAI_CHAT_MODEL } from "@/lib/openai-chat-model";
import { sanitizeScenarioNarrative } from "@/lib/org-recommendations-sanitize";
import type {
  OrgRecommendationsAiResponse,
  OrgRecommendationsRequestPayload,
} from "@/lib/org-recommendations-types";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function parseRecommendations(raw: unknown): OrgRecommendationsAiResponse | null {
  if (!isRecord(raw)) return null;
  const scenario = raw.scenario;
  const memo = raw.memo;
  const evidence = raw.evidence;
  if (!isRecord(scenario) || !isRecord(memo) || !isRecord(evidence)) return null;
  const bullets = memo.bullets;
  if (
    typeof scenario.headline !== "string" ||
    typeof scenario.narrative !== "string" ||
    typeof scenario.projectedReserveLabel !== "string" ||
    typeof scenario.projectedGrowthLabel !== "string" ||
    typeof scenario.riskShiftLabel !== "string" ||
    typeof memo.headline !== "string" ||
    !isStringArray(bullets) ||
    typeof evidence.paragraph !== "string"
  ) {
    return null;
  }
  return {
    scenario: {
      headline: scenario.headline.trim(),
      narrative: sanitizeScenarioNarrative(scenario.narrative),
      projectedReserveLabel: scenario.projectedReserveLabel.trim(),
      projectedGrowthLabel: scenario.projectedGrowthLabel.trim(),
      riskShiftLabel: scenario.riskShiftLabel.trim(),
    },
    memo: {
      headline: memo.headline.trim(),
      bullets: bullets.map((b) => b.trim()).filter(Boolean),
    },
    evidence: {
      paragraph: evidence.paragraph.trim(),
    },
  };
}

/**
 * POST `/api/org-recommendations` — OpenAI-generated scenario sketch, memo bullets, and diligence ideas.
 * Body: {@link OrgRecommendationsRequestPayload}
 */
export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing OPENAI_API_KEY for recommendation generation." },
      { status: 503 },
    );
  }

  let body: OrgRecommendationsRequestPayload;
  try {
    body = (await req.json()) as OrgRecommendationsRequestPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.organizationId !== "string" || !body.organizationId.trim()) {
    return NextResponse.json({ error: "organizationId is required." }, { status: 400 });
  }

  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_CHAT_MODEL;

  const userPrompt = `You are assisting a nonprofit program officer reviewing one organization in a portfolio triage dashboard.

Data is derived from Form 990 extracts and internal dashboard calculations (not live ProPublica API). Use the numbers as context only — do not claim they are audited forecasts.

Aggregate JSON:
${JSON.stringify(body, null, 2)}

Return JSON only, exactly this shape (all strings; bullets is a non-empty array of 3–5 short strings):
{
  "scenario": {
    "headline": "One concise line (max ~90 chars): forward-looking scenario angle for THIS org",
    "narrative": "Exactly 1–2 short sentences (under ~320 characters total): quick read tying reserve runway, revenue trend, and risk. Tight and skimmable. Do not add any sentence about assumptions being illustrative, \"not a prediction\", or dashboard methodology / extracted figures / peer comparison disclaimers.",
    "projectedReserveLabel": "Very short label, e.g. range or qualitative runway under a mild stress (not fake precision)",
    "projectedGrowthLabel": "Very short label for plausible revenue trajectory vs recent YoY / peers",
    "riskShiftLabel": "Very short label: how liquidity or operating risk might move if costs or revenue shift modestly"
  },
  "memo": {
    "headline": "One line: conversation opener for internal memo",
    "bullets": ["3–5 short bullets: specific talking points referencing metrics or leadership when possible"]
  },
  "evidence": {
    "paragraph": "One short paragraph (4–6 sentences max): what to verify beyond 990 extracts (e.g. audited financials, board minutes, grants). No fake citations."
  }

Tone: professional, concise, neutral. No markdown. No emojis.`;

  const openai = new OpenAI({ apiKey });

  try {
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.42,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You output only valid JSON matching the user schema. Be specific to the organization data provided; avoid generic filler. Scenario narrative: brief only; never include disclaimers about illustrative assumptions, predictions, or how dashboard figures were extracted.",
        },
        { role: "user", content: userPrompt },
      ],
    });

    const rawText = completion.choices[0]?.message?.content;
    if (!rawText?.trim()) {
      return NextResponse.json({ error: "Empty model response" }, { status: 502 });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText) as unknown;
    } catch {
      return NextResponse.json({ error: "Invalid JSON from model" }, { status: 502 });
    }

    const data = parseRecommendations(parsed);
    if (!data || data.memo.bullets.length === 0) {
      return NextResponse.json({ error: "Malformed recommendation payload" }, { status: 502 });
    }

    return NextResponse.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "OpenAI request failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
