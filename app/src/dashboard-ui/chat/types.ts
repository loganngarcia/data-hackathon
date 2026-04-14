import type { NonprofitSearchCard } from "@/lib/nonprofit-chat-cards"

export type ChatRole = "user" | "assistant"

/** User sent this message while a nonprofit org profile was open (chip + AI context). */
export type ChatOrgContext = {
    orgId: string
    name: string
    city: string
    state: string
    ein: string
    websiteDomain: string
    logoDomain?: string
    logoImageUrl?: string
}

export type ChatMessage = {
    id: string
    role: ChatRole
    text: string
    /** TEOS search hits — same links as Tipping Point portfolio (`/?org=irs990-…`). */
    nonprofitCards?: NonprofitSearchCard[]
    /** Mosaic org detail was open when the user sent this message (see `web.tsx` job chip pattern). */
    orgContext?: ChatOrgContext
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
