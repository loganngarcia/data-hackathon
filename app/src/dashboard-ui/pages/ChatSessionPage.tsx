"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { getOrgContextForOutgoingUserMessage } from "@/lib/org-context-for-message"
import { mergeNonprofitSearchCards } from "@/lib/nonprofit-chat-cards"
import type { ChatMessage } from "../chat/types"
import { isHoverCapable } from "../chat/hover"
import { formatAssistantError, streamGeminiReply } from "../chat/geminiFetch"
import { generateChatTitleFromFirstUserMessage } from "../chat/generateChatTitle"
import {
    getSavedChatById,
    loadChatMessages,
    renameChatSession,
    saveChatMessages,
} from "../chat/persistChat"
import { transcriptForGemini } from "../chat/transcript"
import { MessageBubble } from "../components/MessageBubble"
import { ChatBar, type ChatBarOnSend } from "../components/ChatBar"

/** Dedupes initial assistant reply when React Strict Mode runs effects twice. */
const pendingInitialAssistant = new Set<string>()

/** Dedupes AI sidebar title generation (`web.tsx` pattern). */
const generatingChatTitle = new Set<string>()

function newId(prefix: string): string {
    return `${prefix}-${crypto.randomUUID()}`
}

type Props = {
    leftInset: number
    isMobile: boolean
    /** Match home: pad composer when org detail rail is open (`?org=`). */
    rightInset?: number
}

export function ChatSessionPage({ leftInset, isMobile, rightInset = 0 }: Props) {
    const router = useRouter()
    const params = useParams()
    const chatId = typeof params.chatId === "string" ? params.chatId : ""
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [sending, setSending] = useState(false)
    const [copiedId, setCopiedId] = useState<string | null>(null)
    const [newChatTopRightHover, setNewChatTopRightHover] = useState(false)
    const copyTimer = useRef<number | null>(null)
    useEffect(() => {
        const loaded = loadChatMessages(chatId)
        setMessages(loaded ?? [])
    }, [chatId])

    /** Sidebar title: AI short label from first user message (same flow as `web.tsx` `generateChatTitle`). */
    useEffect(() => {
        if (!chatId) return
        const firstUser = messages.find((m) => m.role === "user" && m.text.trim())
        if (!firstUser) return

        const summary = getSavedChatById(chatId)
        if (!summary || summary.title !== "New chat") return
        if (generatingChatTitle.has(chatId)) return
        generatingChatTitle.add(chatId)

        void (async () => {
            try {
                const title = await generateChatTitleFromFirstUserMessage(firstUser.text)
                if (title.trim() && title.trim() !== "New chat") {
                    renameChatSession(chatId, title.trim())
                }
            } finally {
                generatingChatTitle.delete(chatId)
            }
        })()
    }, [chatId, messages])

    const onCopyMessage = useCallback((messageId: string) => {
        setCopiedId(messageId)
        if (copyTimer.current !== null) window.clearTimeout(copyTimer.current)
        copyTimer.current = window.setTimeout(() => {
            setCopiedId(null)
            copyTimer.current = null
        }, 2000)
    }, [])

    useEffect(() => {
        return () => {
            if (copyTimer.current !== null) window.clearTimeout(copyTimer.current)
        }
    }, [])

    /** First visit from home: one user message, no assistant yet. */
    useEffect(() => {
        if (messages.length !== 1) return
        if (messages[0].role !== "user") return
        if (messages.some((m) => m.role === "assistant")) return

        void (async () => {
            if (pendingInitialAssistant.has(chatId)) return
            pendingInitialAssistant.add(chatId)
            const transcript = transcriptForGemini(messages)
            const assistantId = newId("a")
            setSending(true)
            setMessages((prev) => [
                ...prev,
                { id: assistantId, role: "assistant", text: "" },
            ])
            try {
                await streamGeminiReply(
                    transcript,
                    (delta) => {
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === assistantId
                                    ? { ...m, text: m.text + delta }
                                    : m,
                            ),
                        )
                    },
                    (cards) => {
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === assistantId
                                    ? {
                                          ...m,
                                          nonprofitCards: mergeNonprofitSearchCards(
                                              m.nonprofitCards ?? [],
                                              cards,
                                          ),
                                      }
                                    : m,
                            ),
                        )
                    },
                )
                setMessages((prev) => {
                    saveChatMessages(chatId, prev)
                    return prev
                })
            } catch (e) {
                setMessages((prev) => {
                    const next = prev.map((m) =>
                        m.id === assistantId
                            ? { ...m, text: formatAssistantError(e) }
                            : m,
                    )
                    saveChatMessages(chatId, next)
                    return next
                })
            } finally {
                pendingInitialAssistant.delete(chatId)
                setSending(false)
            }
        })()
    }, [chatId, messages])

    const onSend: ChatBarOnSend = useCallback(
        async ({ text, files }) => {
            const attachmentNote =
                files.length > 0
                    ? `\n\n(Attached file names: ${files.map((f) => f.name).join(", ")})`
                    : ""
            const full = (text.trim() + attachmentNote).trim()
            if (!full) return

            const orgContext = getOrgContextForOutgoingUserMessage()
            const userMsg: ChatMessage = {
                id: newId("u"),
                role: "user",
                text: full,
                ...(orgContext ? { orgContext } : {}),
            }
            const withUser = [...messages, userMsg]
            setMessages(withUser)
            saveChatMessages(chatId, withUser)
            const assistantId = newId("a")
            setSending(true)
            setMessages((prev) => [
                ...prev,
                { id: assistantId, role: "assistant", text: "" },
            ])
            try {
                await streamGeminiReply(
                    transcriptForGemini(withUser),
                    (delta) => {
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === assistantId
                                    ? { ...m, text: m.text + delta }
                                    : m,
                            ),
                        )
                    },
                    (cards) => {
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === assistantId
                                    ? {
                                          ...m,
                                          nonprofitCards: mergeNonprofitSearchCards(
                                              m.nonprofitCards ?? [],
                                              cards,
                                          ),
                                      }
                                    : m,
                            ),
                        )
                    },
                )
                setMessages((prev) => {
                    saveChatMessages(chatId, prev)
                    return prev
                })
            } catch (e) {
                setMessages((prev) => {
                    const next = prev.map((m) =>
                        m.id === assistantId
                            ? { ...m, text: formatAssistantError(e) }
                            : m,
                    )
                    saveChatMessages(chatId, next)
                    return next
                })
            } finally {
                setSending(false)
            }
        },
        [chatId, messages]
    )

    const lastMsg = messages.at(-1)
    const streamingAssistantId =
        sending && lastMsg?.role === "assistant" ? lastMsg.id : null

    return (
        <>
            {/* New chat — top right of chat view (matches web.tsx when messages.length > 0) */}
            {messages.length > 0 && (
                <div
                    data-layer="new chat"
                    style={{
                        position: "fixed",
                        right: 8,
                        top: 8,
                        zIndex: 100,
                        width: 36,
                        height: 36,
                    }}
                    onMouseEnter={() => setNewChatTopRightHover(true)}
                    onMouseLeave={() => setNewChatTopRightHover(false)}
                >
                    {newChatTopRightHover && isHoverCapable() && (
                        <div
                            aria-hidden
                            style={{
                                position: "absolute",
                                right: "100%",
                                top: "50%",
                                transform: "translate(-8px, -50%)",
                                whiteSpace: "nowrap",
                                fontSize: 12,
                                fontFamily: "Inter, sans-serif",
                                color: "var(--text-secondary)",
                                pointerEvents: "none",
                            }}
                        >
                            New chat
                        </div>
                    )}
                    <button
                        type="button"
                        aria-label="Start new chat"
                        onClick={(e) => {
                            e.stopPropagation()
                            setNewChatTopRightHover(false)
                            router.push("/")
                        }}
                        style={{
                            width: 36,
                            height: 36,
                            padding: 0,
                            margin: 0,
                            border: "none",
                            borderRadius: "50%",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: newChatTopRightHover
                                ? "var(--hover-medium)"
                                : "transparent",
                            transition: "background 0.2s",
                            appearance: "none",
                            WebkitAppearance: "none",
                        }}
                    >
                        <svg
                            width="36"
                            height="36"
                            viewBox="0 0 36 36"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            aria-hidden
                            style={{ pointerEvents: "none", display: "block" }}
                        >
                            <path
                                d="M24.9998 18.0001C24.9998 21.1823 24.9998 22.773 23.9747 23.7615C22.9496 24.75 21.2992 24.75 17.9999 24.75C14.6998 24.75 13.0502 24.75 12.0251 23.7615C11 22.773 11 21.1816 11 18.0001C11 14.8179 11 13.2272 12.0251 12.2387C13.0502 11.2502 14.7006 11.2502 17.9999 11.2502M16.0811 17.3626C15.8157 17.619 15.6666 17.9664 15.6666 18.3286V20.2501H17.6717C18.0473 20.2501 18.4082 20.1061 18.6742 19.8496L24.5852 14.1467C24.7168 14.0198 24.8213 13.8691 24.8925 13.7033C24.9637 13.5375 25.0004 13.3598 25.0004 13.1803C25.0004 13.0008 24.9637 12.8231 24.8925 12.6573C24.8213 12.4915 24.7168 12.3409 24.5852 12.214L24.0011 11.6507C23.8695 11.5237 23.7132 11.4229 23.5412 11.3541C23.3692 11.2854 23.1848 11.25 22.9986 11.25C22.8124 11.25 22.628 11.2854 22.4559 11.3541C22.2839 11.4229 22.1276 11.5237 21.996 11.6507L16.0811 17.3626Z"
                                stroke="var(--text-primary)"
                                strokeOpacity="0.95"
                                strokeWidth="1.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </button>
                </div>
            )}

            <div
                className="chat-session-scroll"
                style={{
                    width: "100%",
                    maxWidth: 768,
                    marginLeft: "auto",
                    marginRight: "auto",
                    paddingLeft: isMobile ? 12 : 24,
                    paddingRight: isMobile ? 12 : 24,
                    paddingBottom: 24,
                    boxSizing: "border-box",
                }}
            >
                {messages.map((msg, i) => (
                    <MessageBubble
                        key={msg.id}
                        id={msg.id}
                        msg={msg}
                        previousMsg={i > 0 ? messages[i - 1] : undefined}
                        copiedMessageId={copiedId}
                        onCopy={onCopyMessage}
                        chatReturnPath={chatId ? `/c/${chatId}` : undefined}
                        isStreamingAssistant={
                            msg.role === "assistant" &&
                            streamingAssistantId !== null &&
                            msg.id === streamingAssistantId
                        }
                    />
                ))}
            </div>
            <ChatBar
                leftInset={leftInset}
                rightInset={rightInset}
                onSend={onSend}
                isSending={sending}
            />
        </>
    )
}
