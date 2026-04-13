/** Same keys as web.tsx — interoperable with Framer component. */
export const YOU_NAME_KEY = "you_name"
export const YOU_WORK_KEY = "you_work"
export const YOU_INTERESTS_KEY = "you_interests"

export type YouProfileSnapshot = {
    name: string
    jobTitle: string
    favoriteThings: string
}

export function loadYouProfile(): YouProfileSnapshot {
    try {
        return {
            name: localStorage.getItem(YOU_NAME_KEY) ?? "",
            jobTitle: localStorage.getItem(YOU_WORK_KEY) ?? "",
            favoriteThings: localStorage.getItem(YOU_INTERESTS_KEY) ?? "",
        }
    } catch {
        return { name: "", jobTitle: "", favoriteThings: "" }
    }
}

export function saveYouProfile(p: YouProfileSnapshot): void {
    try {
        localStorage.setItem(YOU_NAME_KEY, p.name)
        localStorage.setItem(YOU_WORK_KEY, p.jobTitle)
        localStorage.setItem(YOU_INTERESTS_KEY, p.favoriteThings)
    } catch {
        // quota / private mode
    }
}

/** Non-empty bullet lines — mirrors web.tsx `getMemories`. */
export function getFavoriteThingLines(): string[] {
    try {
        const raw = localStorage.getItem(YOU_INTERESTS_KEY) || ""
        return raw
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)
    } catch {
        return []
    }
}
