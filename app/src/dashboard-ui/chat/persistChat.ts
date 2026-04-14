import {
    CHAT_STORAGE_PREFIX,
    chatStorageKey,
    type ChatMessage,
    type SavedChatSummary,
} from "./types"

const CHAT_INDEX_KEY = "curastem-hackathon-chat-index"

/** Same-tab + cross-tab listeners use this event (storage only fires in other tabs). */
export const CHATS_CHANGED_EVENT = "curastem-hackathon-chats-changed"

function notifyChatsChanged(): void {
    try {
        window.dispatchEvent(new Event(CHATS_CHANGED_EVENT))
    } catch {
        /* ignore */
    }
}

/** Pinned first (newest pin first), then by updatedAt. Matches web.tsx sidebar ordering. */
export function sortChatSummaries(
    entries: SavedChatSummary[]
): SavedChatSummary[] {
    return [...entries].sort((a, b) => {
        const ap = !!a.isPinned
        const bp = !!b.isPinned
        if (ap && !bp) return -1
        if (!ap && bp) return 1
        if (ap && bp) return (b.pinnedAt || 0) - (a.pinnedAt || 0)
        return b.updatedAt - a.updatedAt
    })
}

function persistSortedIndex(entries: SavedChatSummary[]): void {
    window.localStorage.setItem(
        CHAT_INDEX_KEY,
        JSON.stringify(sortChatSummaries(entries))
    )
}

function upsertChatIndex(chatId: string, _messages: ChatMessage[]): void {
    const prev = listSavedChatsRaw()
    const existing = prev.find((c) => c.id === chatId)
    const title =
        existing != null ? existing.title : "New chat"
    const updatedAt = Date.now()
    const next = prev.filter((c) => c.id !== chatId)
    next.push({
        id: chatId,
        title,
        updatedAt,
        isPinned: existing?.isPinned,
        pinnedAt: existing?.pinnedAt,
    })
    persistSortedIndex(next)
}

/** Unsorted array as stored (may omit pin fields on old rows). */
function listSavedChatsRaw(): SavedChatSummary[] {
    if (typeof window === "undefined") return []
    try {
        const raw = window.localStorage.getItem(CHAT_INDEX_KEY)
        if (!raw) return []
        const parsed = JSON.parse(raw) as unknown
        if (!Array.isArray(parsed)) return []
        return parsed.filter(
            (x): x is SavedChatSummary =>
                !!x &&
                typeof (x as SavedChatSummary).id === "string" &&
                typeof (x as SavedChatSummary).title === "string" &&
                typeof (x as SavedChatSummary).updatedAt === "number"
        )
    } catch {
        return []
    }
}

let sessionSweepDone = false

/** One-time copy of legacy sessionStorage-only threads so the sidebar and persistence match localStorage. */
function migrateAllSessionChatsToLocalOnce(): void {
    if (sessionSweepDone || typeof window === "undefined") return
    sessionSweepDone = true
    let any = false
    try {
        const keys: string[] = []
        for (let i = 0; i < window.sessionStorage.length; i++) {
            const k = window.sessionStorage.key(i)
            if (k?.startsWith(CHAT_STORAGE_PREFIX)) keys.push(k)
        }
        for (const key of keys) {
            const chatId = key.slice(CHAT_STORAGE_PREFIX.length)
            if (!chatId) continue
            const raw = window.sessionStorage.getItem(key)
            if (!raw) continue
            try {
                const parsed = JSON.parse(raw) as unknown
                if (!Array.isArray(parsed)) continue
                window.localStorage.setItem(key, raw)
                window.sessionStorage.removeItem(key)
                upsertChatIndex(chatId, parsed as ChatMessage[])
                any = true
            } catch {
                /* skip malformed */
            }
        }
    } catch {
        /* ignore */
    }
    if (any) notifyChatsChanged()
}

export function listSavedChats(): SavedChatSummary[] {
    migrateAllSessionChatsToLocalOnce()
    return sortChatSummaries(listSavedChatsRaw())
}

export function getSavedChatById(chatId: string): SavedChatSummary | undefined {
    migrateAllSessionChatsToLocalOnce()
    return listSavedChatsRaw().find((c) => c.id === chatId)
}

export function renameChatSession(chatId: string, newTitle: string): void {
    const t = newTitle.trim() || "Untitled Chat"
    const prev = listSavedChatsRaw()
    if (!prev.some((c) => c.id === chatId)) return
    const next = prev.map((c) =>
        c.id === chatId ? { ...c, title: t, updatedAt: Date.now() } : c
    )
    persistSortedIndex(next)
    notifyChatsChanged()
}

export function togglePinChatSession(chatId: string): void {
    const prev = listSavedChatsRaw()
    const next = prev.map((c) => {
        if (c.id !== chatId) return c
        const newPinned = !c.isPinned
        return {
            ...c,
            isPinned: newPinned,
            pinnedAt: newPinned ? Date.now() : undefined,
        }
    })
    persistSortedIndex(next)
    notifyChatsChanged()
}

export function deleteChatSession(chatId: string): void {
    try {
        window.localStorage.removeItem(chatStorageKey(chatId))
    } catch {
        /* ignore */
    }
    const prev = listSavedChatsRaw()
    const next = prev.filter((c) => c.id !== chatId)
    try {
        window.localStorage.setItem(CHAT_INDEX_KEY, JSON.stringify(next))
    } catch {
        /* ignore */
    }
    notifyChatsChanged()
}

export function chatMatchesSidebarSearch(
    chat: SavedChatSummary,
    query: string
): boolean {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (
        chat.title.toLowerCase().includes(q) ||
        chat.id.toLowerCase().includes(q)
    )
}

export function loadChatMessages(chatId: string): ChatMessage[] | null {
    try {
        const key = chatStorageKey(chatId)
        let raw = window.localStorage.getItem(key)
        if (!raw) {
            raw = window.sessionStorage.getItem(key)
            if (raw) {
                try {
                    window.localStorage.setItem(key, raw)
                    window.sessionStorage.removeItem(key)
                    const migrated = JSON.parse(raw) as unknown
                    if (Array.isArray(migrated)) {
                        upsertChatIndex(chatId, migrated as ChatMessage[])
                        notifyChatsChanged()
                    }
                } catch {
                    /* keep raw for parse below */
                }
            }
        }
        if (!raw) return null
        const parsed = JSON.parse(raw) as unknown
        if (!Array.isArray(parsed)) return null
        return parsed as ChatMessage[]
    } catch {
        return null
    }
}

export function saveChatMessages(chatId: string, messages: ChatMessage[]): void {
    try {
        window.localStorage.setItem(
            chatStorageKey(chatId),
            JSON.stringify(messages)
        )
        upsertChatIndex(chatId, messages)
        notifyChatsChanged()
    } catch {
        // quota / private mode
    }
}
