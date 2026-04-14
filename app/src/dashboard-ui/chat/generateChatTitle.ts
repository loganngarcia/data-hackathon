/**
 * Matches `web.tsx` `generateChatTitle`: short AI title from the first user message,
 * with fallbacks if `/api/gemini` fails (same idea as Gemini lite fallback there).
 */

function stripAttachmentNote(t: string): string {
    const attachIdx = t.indexOf("\n\n(Attached file names:")
    return attachIdx >= 0 ? t.slice(0, attachIdx).trim() : t.trim()
}

/** First-line preview when the model is unavailable (aligned with former `deriveChatTitle`). */
export function fallbackTitleFromUserText(text: string): string {
    const t = stripAttachmentNote(text)
    const line = t.split("\n")[0]?.trim() ?? ""
    if (!line) return "New chat"
    if (line.length > 56) return `${line.slice(0, 53)}...`
    return line
}

/** First ~4 words, matching `web.tsx` when the summarizer returns RECITATION/SAFETY/empty. */
function webStyleWordFallback(text: string): string {
    const t = stripAttachmentNote(text)
    const words = t.split(/\s+/).filter(Boolean).slice(0, 4).join(" ")
    return words || fallbackTitleFromUserText(text)
}

/**
 * Calls OpenAI via `POST /api/gemini` (no tools, non-streaming) to produce a 3–5 word title.
 */
export async function generateChatTitleFromFirstUserMessage(
    firstMessageText: string,
): Promise<string> {
    const stripped = stripAttachmentNote(firstMessageText)
    if (!stripped) return "New chat"

    const prompt = `Summarize this message into a short title (3-5 words). Just the title, no quotes: ${JSON.stringify(stripped)}`

    try {
        const r = await fetch("/api/gemini", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: prompt,
                stream: false,
                useNonprofitSearchTools: false,
            }),
        })
        const data = (await r.json()) as { text?: string; error?: string }
        if (!r.ok || data.error || !data.text?.trim()) {
            return webStyleWordFallback(stripped)
        }
        let t = data.text.trim().replace(/^["']|["']$/g, "")
        if (t.length > 80) t = `${t.slice(0, 77)}...`
        return t || webStyleWordFallback(stripped)
    } catch {
        return webStyleWordFallback(stripped)
    }
}
