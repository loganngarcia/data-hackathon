export type ChatRole = "user" | "assistant"

export type ChatMessage = {
    id: string
    role: ChatRole
    text: string
}

export const CHAT_STORAGE_PREFIX = "curastem-hackathon-chat-"

export function chatStorageKey(chatId: string): string {
    return `${CHAT_STORAGE_PREFIX}${chatId}`
}

/** Sidebar list entry; persisted in localStorage (see persistChat). */
export type SavedChatSummary = {
    id: string
    title: string
    updatedAt: number
    isPinned?: boolean
    pinnedAt?: number
}
