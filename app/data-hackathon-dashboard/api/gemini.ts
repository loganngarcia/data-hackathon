import type { VercelRequest, VercelResponse } from "@vercel/node"

/**
 * Server-side Gemini proxy — set GEMINI_API_KEY in Vercel (or `.env.local` for `vercel dev`).
 * Optional: GEMINI_MODEL (default gemini-2.0-flash).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" })
        return
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey?.trim()) {
        res.status(503).json({
            error:
                "Missing GEMINI_API_KEY. Add it in Vercel → Project → Settings → Environment Variables.",
        })
        return
    }

    let body: { message?: string; model?: string }
    try {
        body =
            typeof req.body === "string"
                ? (JSON.parse(req.body) as { message?: string; model?: string })
                : (req.body as { message?: string; model?: string })
    } catch {
        res.status(400).json({ error: "Invalid JSON body" })
        return
    }

    const message = typeof body.message === "string" ? body.message.trim() : ""
    if (!message) {
        res.status(400).json({ error: "message is required" })
        return
    }

    const model =
        typeof body.model === "string" && body.model.trim()
            ? body.model.trim()
            : process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash"

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`

    const geminiRes = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
            contents: [{ parts: [{ text: message }] }],
        }),
    })

    const raw = await geminiRes.text()
    let data: unknown
    try {
        data = JSON.parse(raw)
    } catch {
        res.status(502).json({
            error: "Invalid JSON from Gemini",
            raw: raw.slice(0, 400),
        })
        return
    }

    if (!geminiRes.ok) {
        const msg =
            typeof data === "object" &&
            data !== null &&
            "error" in data &&
            typeof (data as { error?: { message?: string } }).error?.message ===
                "string"
                ? (data as { error: { message: string } }).error.message
                : "Gemini request failed"
        res.status(502).json({ error: msg, details: data })
        return
    }

    const d = data as {
        candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    const text =
        d.candidates?.[0]?.content?.parts
            ?.map((p) => p.text ?? "")
            .join("") ?? ""

    res.status(200).json({ text, model })
}
