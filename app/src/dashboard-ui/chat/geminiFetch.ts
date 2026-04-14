import {
    parseNonprofitSearchCardsFromStreamArray,
    type NonprofitSearchCard,
} from "@/lib/nonprofit-chat-cards"
import { buildGeminiPromptWithYouContext } from "../profile/geminiYouContext"
import { loadYouProfile } from "../profile/youStorage"

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

function extractTextFromGeminiChunk(data: unknown): string {
    if (!data || typeof data !== "object") return ""
    const d = data as {
        candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> }
        }>
    }
    const parts = d.candidates?.[0]?.content?.parts
    if (!parts?.length) return ""
    return parts.map((p) => (typeof p?.text === "string" ? p.text : "")).join("")
}

function extractNonprofitSearchCards(data: unknown): NonprofitSearchCard[] | null {
    if (!data || typeof data !== "object") return null
    const raw = (data as { nonprofitSearchCards?: unknown }).nonprofitSearchCards
    return parseNonprofitSearchCardsFromStreamArray(raw)
}

/**
 * Stream a reply from Gemini via `POST /api/gemini` with `{ stream: true }`.
 * Invokes `onDelta` for each text fragment (typically token-sized increments).
 * Optional `onNonprofitCards` receives TEOS search rows as portfolio-style org links.
 */
export async function streamGeminiReply(
    transcript: string,
    onDelta: (delta: string) => void,
    onNonprofitCards?: (cards: NonprofitSearchCard[]) => void,
): Promise<void> {
    const message = buildGeminiPromptWithYouContext(transcript)
    const userProfile = loadYouProfile()
    const r = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, stream: true, userProfile }),
    })

    const ct = r.headers.get("content-type") ?? ""

    if (!r.ok) {
        const data = await parseJsonBody(r)
        throw new Error(data.error || "Request failed")
    }

    if (!ct.includes("text/event-stream") || !r.body) {
        const data = await parseJsonBody(r)
        throw new Error(data.error || "Expected streamed response from Gemini")
    }

    const reader = r.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    try {
        for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split("\n")
            buffer = lines.pop() ?? ""
            for (const line of lines) {
                const trimmed = line.replace(/\r$/, "").trim()
                if (!trimmed.startsWith("data:")) continue
                const payload = trimmed.slice(5).trim()
                if (payload === "[DONE]" || payload === "") continue
                let data: unknown
                try {
                    data = JSON.parse(payload)
                } catch {
                    continue
                }
                if (
                    data &&
                    typeof data === "object" &&
                    "error" in data &&
                    (data as { error?: { message?: string } }).error?.message
                ) {
                    throw new Error(
                        (data as { error: { message: string } }).error.message,
                    )
                }
                const cardBatch = extractNonprofitSearchCards(data)
                if (cardBatch?.length && onNonprofitCards) {
                    onNonprofitCards(cardBatch)
                }
                const piece = extractTextFromGeminiChunk(data)
                if (piece) onDelta(piece)
            }
        }

        const tail = buffer.replace(/\r$/, "").trim()
        if (tail.startsWith("data:")) {
            const payload = tail.slice(5).trim()
            if (payload && payload !== "[DONE]") {
                try {
                    const data = JSON.parse(payload) as unknown
                    const cardBatch = extractNonprofitSearchCards(data)
                    if (cardBatch?.length && onNonprofitCards) {
                        onNonprofitCards(cardBatch)
                    }
                    const piece = extractTextFromGeminiChunk(data)
                    if (piece) onDelta(piece)
                } catch {
                    /* ignore trailing partial */
                }
            }
        }
    } finally {
        reader.releaseLock()
    }
}

/** Non-streaming: collects streamed deltas into one string (same model path as UI streaming). */
export async function fetchGeminiReply(transcript: string): Promise<string> {
    let out = ""
    await streamGeminiReply(transcript, (d) => {
        out += d
    })
    return out
}
