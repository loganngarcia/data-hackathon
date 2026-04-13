import { NextResponse } from "next/server";

/**
 * Gemini proxy — same contract as data-hackathon-dashboard/api/gemini.ts.
 * Set GEMINI_API_KEY (and optionally GEMINI_MODEL) in Vercel or `.env.local`.
 */
export async function POST(req: Request) {
  let body: { message?: string; model?: string };
  try {
    body = (await req.json()) as { message?: string; model?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey?.trim()) {
    return NextResponse.json(
      {
        error:
          "Missing GEMINI_API_KEY. Add it in Vercel → Project → Settings → Environment Variables.",
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
      : process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const geminiRes = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: message }] }],
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
    const msg =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof (data as { error?: { message?: string } }).error?.message === "string"
        ? (data as { error: { message: string } }).error.message
        : "Gemini request failed";
    return NextResponse.json({ error: msg, details: data }, { status: 502 });
  }

  const d = data as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text =
    d.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";

  return NextResponse.json({ text, model });
}
