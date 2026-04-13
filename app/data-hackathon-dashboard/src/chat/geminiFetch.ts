import { buildGeminiPromptWithYouContext } from "../profile/geminiYouContext"

/** User-visible copy when the model or proxy fails (shown as an assistant bubble). */
export function formatAssistantError(err: unknown): string {
    const msg =
        err instanceof Error ? err.message : "Something went wrong"
    return `Couldn't get a reply.\n\n${msg}`
}

async function parseJsonBody(r: Response): Promise<{
    text?: string
    error?: string
}> {
    const raw = await r.text()
    if (!raw.trim()) {
        let hint = "Empty response from server."
        if (r.status === 404) {
            hint =
                "No /api/gemini route. Run `vercel dev` (Vite proxies /api to it) or use the deployed app."
        } else if (r.status === 502 || r.status === 503) {
            hint =
                "The API returned an empty body. Check GEMINI_API_KEY and that serverless functions are running."
        }
        throw new Error(`${hint} (HTTP ${r.status || "?"})`)
    }
    try {
        return JSON.parse(raw) as { text?: string; error?: string }
    } catch {
        const preview = raw.replace(/\s+/g, " ").slice(0, 180)
        throw new Error(
            `Not JSON (HTTP ${r.status}): ${preview}${raw.length > 180 ? "…" : ""}`
        )
    }
}

export async function fetchGeminiReply(transcript: string): Promise<string> {
    const message = buildGeminiPromptWithYouContext(transcript)
    const r = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
    })
    const data = await parseJsonBody(r)
    if (!r.ok) throw new Error(data.error || "Request failed")
    return data.text ?? ""
}
