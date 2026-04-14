import { buildDashboardChatContextPromptSection } from "../chat/dashboardChatContext"

/**
 * Builds the **user** message sent to `/api/gemini`: session date/time, dashboard UI context,
 * then the chat transcript. "You" profile (name, job, favorites) is sent separately as
 * `userProfile` in the JSON body and merged into the **system** prompt on the server.
 */
export function buildGeminiPromptWithYouContext(transcript: string): string {
    const now = new Date()
    let prompt = `[System Context]\nCurrent Date: ${now.toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    })}\nCurrent Time: ${now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
    })}`

    const dashboardCtx = buildDashboardChatContextPromptSection()
    if (dashboardCtx.trim()) {
        prompt += `\n\n${dashboardCtx}`
    }

    prompt += `\n\n---\n\n${transcript}`
    return prompt.trim()
}
