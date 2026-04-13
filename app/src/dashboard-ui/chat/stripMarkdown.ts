/** Plain text for copy — matches web.tsx `stripMarkdown`. */
export function stripMarkdown(text: string): string {
    if (!text) return ""
    return text
        .replace(/```[\s\S]*?```/g, (match) => {
            return match.replace(/^```.*\n?/, "").replace(/```$/, "")
        })
        .replace(/`([^`]+)`/g, "$1")
        .replace(/(\*\*|__)(.*?)\1/g, "$2")
        .replace(/(\*|_)(.*?)\1/g, "$2")
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/^>\s+/gm, "")
        .replace(/^[-*+]\s+/gm, "")
        .trim()
}
