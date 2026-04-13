import type { ChatMessage } from "./types"

/** Single prompt string for the Gemini proxy (multi-turn as labeled lines). */
export function transcriptForGemini(messages: ChatMessage[]): string {
    return messages
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`)
        .join("\n\n")
}
