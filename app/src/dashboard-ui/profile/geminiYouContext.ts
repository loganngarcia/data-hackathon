import { getFavoriteThingLines, loadYouProfile } from "./youStorage"

/**
 * Prepends system date + user profile + favorite things (same sections as web.tsx
 * `getSystemPromptWithContext` / first-turn hidden context), then the chat transcript.
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

    const { name, jobTitle } = loadYouProfile()
    if (name.trim() || jobTitle.trim()) {
        prompt += `\n\n[User profile]`
        if (name.trim()) prompt += `\nName: ${name.trim()}`
        if (jobTitle.trim()) prompt += `\nJob title: ${jobTitle.trim()}`
    }

    const favorites = getFavoriteThingLines()
    if (favorites.length > 0) {
        prompt += `\n\n[User's Favorite Things & Personal Facts]\n${favorites.join("\n")}`
    }

    prompt += `\n\n---\n\n${transcript}`
    return prompt.trim()
}
