import { useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { saveChatMessages } from "../chat/persistChat"
import type { ChatMessage } from "../chat/types"
import { ChatBar, type ChatBarOnSend } from "../components/ChatBar"
import { DashboardMain } from "../components/DashboardMain"

type Props = {
    leftInset: number
}

export function HomePage({ leftInset }: Props) {
    const navigate = useNavigate()

    const onSend: ChatBarOnSend = useCallback(
        async ({ text, files }) => {
            const attachmentNote =
                files.length > 0
                    ? `\n\n(Attached file names: ${files.map((f) => f.name).join(", ")})`
                    : ""
            const full = (text.trim() + attachmentNote).trim()
            if (!full) return

            const chatId = crypto.randomUUID()
            const userMsg: ChatMessage = {
                id: `u-${Date.now()}`,
                role: "user",
                text: full,
            }
            saveChatMessages(chatId, [userMsg])
            navigate(`/c/${chatId}`)
        },
        [navigate]
    )

    return (
        <>
            <DashboardMain />
            <ChatBar leftInset={leftInset} onSend={onSend} />
        </>
    )
}
