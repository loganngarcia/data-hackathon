import { NextResponse } from "next/server";

/**
 * Gemini HTTP API (AI Studio key): POST
 * `generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` with header
 * `x-goog-api-key` — same pattern as the official “Text generation” REST examples
 * (https://ai.google.dev/gemini-api/docs/text-generation). Preview models use `v1beta`.
 *
 * Default model id matches the model catalog:
 * https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite-preview
 *
 * Env (first match wins): GEMINI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY (common with Vercel AI SDK),
 * GOOGLE_API_KEY. Optional: GEMINI_MODEL.
 *
 * If Google returns "blocked" for generativelanguage.googleapis.com, the key or project
 * is not allowed to call the API: enable Generative Language API, and use a key whose
 * Application restrictions allow server-side use (not HTTP referrers only — Vercel has no browser referrer).
 */
function augmentGeminiErrorMessage(msg: string): string {
  if (!/blocked|PERMISSION_DENIED|API_KEY_INVALID/i.test(msg)) return msg;
  return `${msg}

How to fix (Google Cloud / AI Studio):
• Project: enable the "Generative Language API" (APIs & Services → Library).
• API key: Application restrictions must not be "HTTP referrers only" for this server route — use "None" or create a separate key at https://aistudio.google.com/apikey for backend use.
• API key: under API restrictions, allow "Generative Language API" (or no restriction).`;
}

export async function POST(req: Request) {
  let body: { message?: string; model?: string };
  try {
    body = (await req.json()) as { message?: string; model?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const apiKey =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Missing API key. Set GEMINI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, or GOOGLE_API_KEY in Vercel → Settings → Environment Variables (then redeploy).",
      },
      { status: 503 },
    );
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const model =
    typeof body.model === "string" && body.model.trim()
      ? body.model.trim()
      : process.env.GEMINI_MODEL?.trim() || "gemini-3.1-flash-lite-preview";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const geminiRes = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: message }] }],
    }),
  });

  const raw = await geminiRes.text();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON from Gemini", raw: raw.slice(0, 400) },
      { status: 502 },
    );
  }

  if (!geminiRes.ok) {
    const rawMsg =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof (data as { error?: { message?: string } }).error?.message === "string"
        ? (data as { error: { message: string } }).error.message
        : "Gemini request failed";
    const msg = augmentGeminiErrorMessage(rawMsg);
    return NextResponse.json({ error: msg, details: data }, { status: 502 });
  }

  const d = data as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text =
    d.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";

  return NextResponse.json({ text, model });
}
