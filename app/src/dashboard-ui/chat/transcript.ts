import type { ChatMessage } from "./types"

function formatEinForTranscript(ein: string): string {
    const d = ein.replace(/\D/g, "").slice(0, 9)
    return d.length === 9 ? `${d.slice(0, 2)}-${d.slice(2)}` : ein.trim()
}

function userLineWithOrgContext(m: ChatMessage): string {
    const base = m.text
    const o = m.orgContext
    if (!o) return `User: ${base}`
    const loc = [o.city, o.state].filter(Boolean).join(", ")
    const ein = o.ein ? formatEinForTranscript(o.ein) : ""
    const focus = `[Sent while nonprofit profile was open: "${o.name}"${loc ? ` · ${loc}` : ""}${ein ? ` · EIN ${ein}` : ""} · org id ${o.orgId}]`
    return `User: ${focus}\n${base}`
}

/** Single prompt string for the Gemini proxy (multi-turn as labeled lines). */
export function transcriptForGemini(messages: ChatMessage[]): string {
    return messages
        .map((m) => {
            if (m.role !== "user") return `Assistant: ${m.text}`
            return userLineWithOrgContext(m)
        })
        .join("\n\n")
}
