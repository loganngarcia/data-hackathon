export function ensureProtocol(url: string): string {
    if (
        url.startsWith("mailto:") ||
        url.startsWith("tel:") ||
        url.startsWith("http://") ||
        url.startsWith("https://")
    ) {
        return url
    }
    if (url.includes(".") && !url.includes(" ") && !url.startsWith("/")) {
        if (/[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(url.split("/")[0])) {
            return "https://" + url
        }
    }
    return url
}

export function removeUtmParams(url: string): string {
    const parts = url.split("?")
    if (parts.length < 2) return url

    const baseUrl = parts[0]
    const query = parts[1]

    const newQuery = query
        .split("&")
        .filter((part) => !part.startsWith("utm_"))
        .join("&")

    return newQuery ? `${baseUrl}?${newQuery}` : baseUrl
}

export function cleanDisplayUrl(url: string): string {
    let clean = url.replace(/([?&])utm_source=curastem\.org(&|$)/gi, "$1")

    if (clean.endsWith("?") || clean.endsWith("&")) {
        clean = clean.slice(0, -1)
    }

    return clean
}
