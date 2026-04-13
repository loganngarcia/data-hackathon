"use client"

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import { usePathname, useRouter } from "next/navigation"
import {
    CHATS_CHANGED_EVENT,
    chatMatchesSidebarSearch,
    deleteChatSession,
    listSavedChats,
    renameChatSession,
    togglePinChatSession,
} from "../chat/persistChat"
import type { SavedChatSummary } from "../chat/types"
import { ReportChatModal } from "./ReportChatModal"

const LEFT_SIDEBAR_WIDTH = 260
const SIDEBAR_PAD_TOP = 190

type LeftSidebarProps = {
    isOpen: boolean
    onClose: () => void
    onOpenYou?: () => void
}

/** Matches web.tsx sidebar: hamburger, fixed top (close, search, new chat, you), chat list. */
export function LeftSidebar({
    isOpen,
    onClose,
    onOpenYou,
}: LeftSidebarProps) {
    const router = useRouter()
    const pathname = usePathname()
    /** Always start empty so SSR matches first client paint; `useEffect` syncs from localStorage. */
    const [savedChats, setSavedChats] = useState<SavedChatSummary[]>([])
    const [isMobile, setIsMobile] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [hoverClose, setHoverClose] = useState(false)
    const [hoverNewChat, setHoverNewChat] = useState(false)
    const [hoverYou, setHoverYou] = useState(false)
    /** Row hover (chat list) — matches web.tsx `hoveredChatId`. */
    const [hoveredRowChatId, setHoveredRowChatId] = useState<string | null>(null)
    const [isYourChatsExpanded, setIsYourChatsExpanded] = useState(true)
    const [isYourChatsHovered, setIsYourChatsHovered] = useState(false)
    const [menuOpenChatId, setMenuOpenChatId] = useState<string | null>(null)
    const [menuPosition, setMenuPosition] = useState<{
        top: number
        left: number
    } | null>(null)
    const [hoveredActionId, setHoveredActionId] = useState<string | null>(null)
    const [editingChatId, setEditingChatId] = useState<string | null>(null)
    const [editingTitle, setEditingTitle] = useState("")
    const [showReportModal, setShowReportModal] = useState(false)
    const renameInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        const mq = window.matchMedia("(max-width: 767px)")
        const update = () => setIsMobile(mq.matches)
        update()
        mq.addEventListener("change", update)
        return () => mq.removeEventListener("change", update)
    }, [])

    useEffect(() => {
        const sync = () => setSavedChats(listSavedChats())
        sync()
        window.addEventListener("storage", sync)
        window.addEventListener(CHATS_CHANGED_EVENT, sync)
        return () => {
            window.removeEventListener("storage", sync)
            window.removeEventListener(CHATS_CHANGED_EVENT, sync)
        }
    }, [])

    useEffect(() => {
        if (editingChatId && renameInputRef.current) {
            renameInputRef.current.focus()
            renameInputRef.current.select()
        }
    }, [editingChatId])

    const closeChatMenu = useCallback(() => {
        setMenuOpenChatId(null)
        setMenuPosition(null)
        setHoveredActionId(null)
    }, [])

    const handleShareChat = useCallback(
        async (chat: SavedChatSummary) => {
            try {
                if (
                    typeof navigator !== "undefined" &&
                    "share" in navigator &&
                    navigator.share
                ) {
                    await navigator.share({
                        title: chat.title,
                        text: `Check out this chat on Curastem: ${chat.title}`,
                        url: "https://curastem.org",
                    })
                } else if (
                    typeof navigator !== "undefined" &&
                    navigator.clipboard
                ) {
                    await navigator.clipboard.writeText("https://curastem.org")
                }
            } catch (e) {
                console.error("Share failed", e)
            }
            closeChatMenu()
        },
        [closeChatMenu]
    )

    const handleStartRename = useCallback(
        (chat: SavedChatSummary) => {
            setEditingChatId(chat.id)
            setEditingTitle(chat.title)
            closeChatMenu()
        },
        [closeChatMenu]
    )

    const handleFinishRename = useCallback(() => {
        if (editingChatId) {
            renameChatSession(editingChatId, editingTitle)
            setEditingChatId(null)
            setEditingTitle("")
        }
    }, [editingChatId, editingTitle])

    const visibleChats = useMemo(
        () =>
            savedChats.filter((c) =>
                chatMatchesSidebarSearch(c, searchQuery)
            ),
        [savedChats, searchQuery]
    )

    const activeChatMatch = pathname.match(/^\/c\/([^/]+)/)
    const activeChatId = activeChatMatch?.[1] ?? null

    const handleDeleteChat = useCallback(
        (chatId: string) => {
            deleteChatSession(chatId)
            if (activeChatId === chatId) router.push("/")
            closeChatMenu()
        },
        [activeChatId, router, closeChatMenu]
    )

    const canCollapseChats = visibleChats.length > 0

    return (
        <>
            {isMobile && isOpen && (
                <div
                    role="presentation"
                    aria-hidden
                    className="sidebar-overlay"
                    onClick={onClose}
                />
            )}
            <nav
                className="left-sidebar"
                data-layer="left sidebar"
                data-main-navigation="true"
                aria-label="Main navigation"
                style={{
                    transform: `translateX(${isOpen ? 0 : -LEFT_SIDEBAR_WIDTH}px)`,
                    pointerEvents: isOpen ? "auto" : "none",
                }}
            >
                <div
                    className="scrollable-sidebar-content"
                    onClick={(e) => e.stopPropagation()}
                >
                    {visibleChats.length > 0 && (
                        <section className="your-chats-flexbox">
                            <div
                                className="chat-title chat-title-toggle"
                                data-layer="Chat title"
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    if (canCollapseChats) {
                                        setIsYourChatsExpanded(!isYourChatsExpanded)
                                    }
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault()
                                        if (canCollapseChats) {
                                            setIsYourChatsExpanded(!isYourChatsExpanded)
                                        }
                                    }
                                }}
                                onMouseEnter={() => setIsYourChatsHovered(true)}
                                onMouseLeave={() => setIsYourChatsHovered(false)}
                                style={{
                                    cursor: canCollapseChats ? "pointer" : "default",
                                }}
                            >
                                <div className="section-label">Your chats</div>
                                {canCollapseChats &&
                                    !isYourChatsExpanded &&
                                    isYourChatsHovered && (
                                        <div
                                            className="sidebar-chevron"
                                            aria-hidden
                                            style={{ position: "relative", top: 2 }}
                                        >
                                            <svg
                                                width="6"
                                                height="10"
                                                viewBox="0 0 6 10"
                                                fill="none"
                                                xmlns="http://www.w3.org/2000/svg"
                                            >
                                                <path
                                                    d="M0.601562 8.60001L4.60156 4.60001L0.601562 0.600006"
                                                    stroke="var(--text-secondary)"
                                                    strokeOpacity="1"
                                                    strokeWidth="1.2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            </svg>
                                        </div>
                                    )}
                                {canCollapseChats &&
                                    isYourChatsExpanded &&
                                    isYourChatsHovered && (
                                        <div
                                            className="sidebar-chevron"
                                            aria-hidden
                                            style={{ position: "relative", top: 2 }}
                                        >
                                            <svg
                                                width="10"
                                                height="6"
                                                viewBox="0 0 10 6"
                                                fill="none"
                                                xmlns="http://www.w3.org/2000/svg"
                                            >
                                                <path
                                                    d="M0.601562 0.600006L4.60156 4.60001L8.60156 0.600006"
                                                    stroke="var(--text-secondary)"
                                                    strokeOpacity="1"
                                                    strokeWidth="1.2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            </svg>
                                        </div>
                                    )}
                            </div>
                            {visibleChats
                                .slice(
                                    0,
                                    isYourChatsExpanded ? undefined : 0
                                )
                                .map((chat) => {
                                    const id = chat.id
                                    const active = activeChatId === id
                                    const rowHover =
                                        hoveredRowChatId === id ||
                                        menuOpenChatId === id
                                    const showMenuTrigger =
                                        rowHover || isMobile
                                    const showPinnedGlyph =
                                        !!chat.isPinned &&
                                        (isMobile || !rowHover)

                                    return (
                                        <div
                                            key={id}
                                            role="button"
                                            tabIndex={0}
                                            data-layer="chat item"
                                            className="chat-item-row"
                                            aria-label={`Open chat: ${chat.title}`}
                                            onClick={() => {
                                                if (editingChatId === id) return
                                                router.push(`/c/${id}`)
                                                if (isMobile) onClose()
                                            }}
                                            onMouseEnter={() =>
                                                setHoveredRowChatId(id)
                                            }
                                            onMouseLeave={() =>
                                                setHoveredRowChatId(null)
                                            }
                                            onKeyDown={(e) => {
                                                if (editingChatId === id) return
                                                if (
                                                    e.key === "Enter" ||
                                                    e.key === " "
                                                ) {
                                                    e.preventDefault()
                                                    router.push(`/c/${id}`)
                                                    if (isMobile) onClose()
                                                }
                                            }}
                                            style={{
                                                background:
                                                    hoveredRowChatId === id ||
                                                    menuOpenChatId === id
                                                        ? "var(--hover-default)"
                                                        : active
                                                          ? "var(--hover-medium)"
                                                          : "transparent",
                                            }}
                                        >
                                            {editingChatId === id ? (
                                                <input
                                                    ref={renameInputRef}
                                                    className="chat-item-rename-input"
                                                    value={editingTitle}
                                                    onChange={(e) =>
                                                        setEditingTitle(
                                                            e.target.value
                                                        )
                                                    }
                                                    onBlur={handleFinishRename}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter")
                                                            handleFinishRename()
                                                        if (e.key === "Escape") {
                                                            setEditingChatId(
                                                                null
                                                            )
                                                            setEditingTitle("")
                                                        }
                                                    }}
                                                    onClick={(e) =>
                                                        e.stopPropagation()
                                                    }
                                                />
                                            ) : (
                                                <div className="chat-item-title ds-text-ellipsis">
                                                    {chat.title}
                                                </div>
                                            )}

                                            {!editingChatId && (
                                                <div className="chat-item-actions">
                                                    {showPinnedGlyph && (
                                                        <div
                                                            className="chat-pinned-glyph"
                                                            aria-hidden
                                                        >
                                                            <svg
                                                                width="16"
                                                                height="24"
                                                                viewBox="0 0 16 24"
                                                                fill="none"
                                                                xmlns="http://www.w3.org/2000/svg"
                                                            >
                                                                <path
                                                                    d="M9.5138 5.29789C9.96421 4.99953 10.7273 4.78652 11.3032 5.36244L14.6361 8.69604C15.2142 9.27268 15.0005 10.0358 14.7014 10.4855C14.5394 10.7293 14.3287 10.9369 14.0824 11.0951C13.8429 11.2479 13.5402 11.3633 13.2139 11.3461C13.056 11.3351 12.8986 11.3182 12.742 11.2952L12.6932 11.288C12.525 11.2637 12.3558 11.2463 12.1861 11.2357C11.8247 11.2178 11.6855 11.2787 11.6411 11.3217L9.8552 13.1083C9.79782 13.1657 9.7261 13.2934 9.67159 13.5386C9.61923 13.7753 9.59628 14.0665 9.59054 14.3893C9.58552 14.6991 9.59628 15.0161 9.60776 15.3216L9.60848 15.3553C9.61923 15.6587 9.62999 15.9686 9.61493 16.2117C9.56831 16.9511 8.99239 17.4955 8.42579 17.7472C7.8592 17.9983 7.0509 18.0607 6.48932 17.4984L4.8756 15.8846L1.93145 18.8288C1.8822 18.8816 1.82282 18.924 1.75683 18.9534C1.69085 18.9828 1.61962 18.9986 1.5474 18.9999C1.47517 19.0012 1.40343 18.9879 1.33645 18.9609C1.26947 18.9338 1.20863 18.8935 1.15755 18.8425C1.10647 18.7914 1.0662 18.7305 1.03915 18.6635C1.0121 18.5966 0.998809 18.5248 1.00008 18.4526C1.00136 18.3804 1.01717 18.3091 1.04657 18.2432C1.07597 18.1772 1.11836 18.1178 1.1712 18.0686L4.11464 15.1244L2.50091 13.5107C1.93934 12.9484 2.00102 12.1408 2.25276 11.5742C2.50378 11.0076 3.04886 10.4317 3.78759 10.3851C4.03144 10.37 4.34128 10.3808 4.64466 10.3915L4.67837 10.3922C4.9839 10.403 5.30091 10.4145 5.61074 10.4095C5.93349 10.4037 6.22467 10.3808 6.46135 10.3284C6.70664 10.2739 6.8343 10.2015 6.89168 10.1441L8.67754 8.35823C8.72129 8.31448 8.78225 8.17463 8.7636 7.81315C8.75301 7.64349 8.73555 7.47433 8.71124 7.30608L8.70479 7.25731C8.68175 7.10072 8.66476 6.94329 8.65387 6.78539C8.63594 6.45906 8.75141 6.15639 8.90346 5.91685C9.05837 5.67299 9.27282 5.45783 9.5138 5.29789Z"
                                                                    fill="var(--text-primary)"
                                                                    fillOpacity="0.45"
                                                                />
                                                            </svg>
                                                        </div>
                                                    )}
                                                    {showMenuTrigger && (
                                                        <div
                                                            className="chat-item-menu-hit"
                                                            aria-label={`Open menu for ${chat.title}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                if (
                                                                    menuOpenChatId ===
                                                                    id
                                                                ) {
                                                                    closeChatMenu()
                                                                } else {
                                                                    const el =
                                                                        e.currentTarget
                                                                    const rect =
                                                                        el.getBoundingClientRect()
                                                                    setMenuOpenChatId(
                                                                        id
                                                                    )
                                                                    setMenuPosition(
                                                                        {
                                                                            top:
                                                                                rect.bottom +
                                                                                4,
                                                                            left:
                                                                                rect.right -
                                                                                36,
                                                                        }
                                                                    )
                                                                }
                                                            }}
                                                        >
                                                            <svg
                                                                width="16"
                                                                height="24"
                                                                viewBox="0 0 16 24"
                                                                fill="none"
                                                                xmlns="http://www.w3.org/2000/svg"
                                                                aria-hidden
                                                            >
                                                                <path
                                                                    d="M13.498 10.5016C14.3254 10.5016 14.9959 11.1723 14.9961 11.9996C14.9961 12.8271 14.3256 13.4987 13.498 13.4987C12.6705 13.4987 12 12.8271 12 11.9996C12.0002 11.1723 12.6706 10.5016 13.498 10.5016Z"
                                                                    fill="var(--text-primary)"
                                                                    fillOpacity="0.95"
                                                                />
                                                                <path
                                                                    d="M2.49805 10.5016C3.32544 10.5016 3.99689 11.1723 3.99707 11.9996C3.99707 12.8271 3.32555 13.4987 2.49805 13.4987C1.67069 13.4985 1 12.827 1 11.9996C1.00018 11.1724 1.6708 10.5018 2.49805 10.5016Z"
                                                                    fill="var(--text-primary)"
                                                                    fillOpacity="0.95"
                                                                />
                                                                <path
                                                                    d="M8.0003 10.5016C8.8276 10.5018 9.4982 11.1724 9.4984 11.9996C9.4984 12.827 8.8277 13.4985 8.0003 13.4987C7.17283 13.4987 6.50131 12.8271 6.50131 11.9996C6.50149 11.1723 7.17294 10.5016 8.0003 10.5016Z"
                                                                    fill="var(--text-primary)"
                                                                    fillOpacity="0.95"
                                                                />
                                                            </svg>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                        </section>
                    )}
                </div>

                <div className="fixed-top-nav" data-layer="fixed top nav">
                    <div
                        className="sidebar-top-actions"
                        data-layer="sidebar top actions"
                    >
                        <button
                            type="button"
                            className="sidebar-icon-btn"
                            data-layer="close sidebar button (6% white fill on HOVER)"
                            aria-label="Close navigation sidebar"
                            onClick={(e) => {
                                e.stopPropagation()
                                onClose()
                            }}
                            onMouseEnter={() => setHoverClose(true)}
                            onMouseLeave={() => setHoverClose(false)}
                            style={{
                                background: hoverClose
                                    ? "var(--hover-default)"
                                    : "transparent",
                            }}
                        >
                            <svg
                                width="36"
                                height="36"
                                viewBox="0 0 36 36"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                aria-hidden
                            >
                                <path
                                    d="M10 14H26M10 22H20"
                                    stroke="var(--text-primary)"
                                    strokeOpacity="0.95"
                                    strokeWidth="1.2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </button>
                    </div>

                    <div className="search-bar" data-layer="search bar">
                        <div className="search-icon-wrap" data-svg-wrapper>
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 16 16"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                aria-hidden
                            >
                                <path
                                    d="M10.9289 10.8023L14.7616 14.6M12.6167 6.5224C12.6167 8.09311 11.9837 9.5995 10.8571 10.7102C9.73045 11.8208 8.20241 12.4448 6.60911 12.4448C5.01581 12.4448 3.48777 11.8208 2.36113 10.7102C1.2345 9.5995 0.601563 8.09311 0.601562 6.5224C0.601563 4.95168 1.2345 3.44529 2.36113 2.33463C3.48777 1.22396 5.01581 0.599998 6.60911 0.599998C8.20241 0.599998 9.73045 1.22396 10.8571 2.33463C11.9837 3.44529 12.6167 4.95168 12.6167 6.5224Z"
                                    stroke="var(--text-primary)"
                                    strokeOpacity="0.65"
                                    strokeWidth="1.2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </div>
                        <input
                            className="search-input"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search"
                            type="search"
                            autoComplete="off"
                            aria-label="Search chats and content"
                            role="searchbox"
                        />
                    </div>

                    <div
                        className="sidebar-new-chat-wrapper"
                        data-layer="sidebar-new-chat-wrapper"
                    >
                        <div
                            className="new-chat-row"
                            data-layer="new chat"
                            role="button"
                            tabIndex={0}
                            aria-label="Start new chat"
                            onClick={() => {
                                router.push("/")
                                if (isMobile) onClose()
                            }}
                            onMouseEnter={() => setHoverNewChat(true)}
                            onMouseLeave={() => setHoverNewChat(false)}
                            style={{
                                background: hoverNewChat
                                    ? "var(--hover-default)"
                                    : "transparent",
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault()
                                    router.push("/")
                                    if (isMobile) onClose()
                                }
                            }}
                        >
                            <div className="row-icon" data-layer="new chat icon">
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 16 16"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                    aria-hidden
                                >
                                    <path
                                        d="M14.9998 8.00011C14.9998 11.1823 14.9998 12.773 13.9747 13.7615C12.9496 14.75 11.2992 14.75 7.99988 14.75C4.69983 14.75 3.05019 14.75 2.02509 13.7615C1 12.773 1 11.1816 1 8.00011C1 4.81792 1 3.22719 2.02509 2.23871C3.05019 1.25023 4.7006 1.25023 7.99988 1.25023M6.08114 7.36262C5.81571 7.61895 5.66661 7.96637 5.66659 8.32861V10.2501H7.67167C8.04733 10.2501 8.40821 10.1061 8.6742 9.84958L14.5852 4.14668C14.7168 4.01979 14.8213 3.86913 14.8925 3.70332C14.9637 3.53751 15.0004 3.3598 15.0004 3.18032C15.0004 3.00084 14.9637 2.82313 14.8925 2.65732C14.8213 2.49151 14.7168 2.34085 14.5852 2.21396L14.0011 1.65072C13.8695 1.52369 13.7132 1.42291 13.5412 1.35415C13.3692 1.28539 13.1848 1.25 12.9986 1.25C12.8124 1.25 12.628 1.28539 12.4559 1.35415C12.2839 1.42291 12.1276 1.52369 11.996 1.65072L6.08114 7.36262Z"
                                        stroke="var(--text-primary)"
                                        strokeOpacity="0.95"
                                        strokeWidth="1.2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </div>
                            <div className="row-label">New chat</div>
                        </div>

                        <div
                            className="new-chat-row"
                            data-layer="you"
                            role="button"
                            tabIndex={0}
                            aria-label="Open your profile settings"
                            onClick={() => onOpenYou?.()}
                            onMouseEnter={() => setHoverYou(true)}
                            onMouseLeave={() => setHoverYou(false)}
                            style={{
                                background: hoverYou
                                    ? "var(--hover-default)"
                                    : "transparent",
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault()
                                    onOpenYou?.()
                                }
                            }}
                        >
                            <div className="row-icon" data-layer="you icon">
                                <svg
                                    width="16"
                                    height="18"
                                    viewBox="0 0 16 18"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                    aria-hidden
                                >
                                    <path
                                        d="M0.820312 16.6C1.07206 11.6536 5.31492 9.45122 9.12084 9.99276M6.88031 9.99276C10.6862 9.45122 14.9291 11.6536 15.1808 16.6M11.4487 4.0622C11.4487 2.17646 9.8722 0.600006 7.98646 0.600006C6.10072 0.600006 4.52427 2.17646 4.52427 4.0622C4.52427 5.94794 6.10072 7.52439 7.98646 7.52439C9.8722 7.52439 11.4487 5.94794 11.4487 4.0622Z"
                                        stroke="var(--text-primary)"
                                        strokeOpacity="0.95"
                                        strokeWidth="1.2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </div>
                            <div className="row-label">You</div>
                        </div>
                    </div>
                </div>
            </nav>

            <ReportChatModal
                isOpen={showReportModal}
                onClose={() => setShowReportModal(false)}
                onSubmit={(reason) => {
                    console.info("Report submitted:", reason)
                    setShowReportModal(false)
                }}
            />

            {menuOpenChatId &&
                menuPosition &&
                savedChats.find((c) => c.id === menuOpenChatId) &&
                createPortal(
                    <>
                        <div
                            role="presentation"
                            style={{
                                position: "fixed",
                                inset: 0,
                                zIndex: 20000,
                                cursor: "default",
                                background: isMobile
                                    ? "var(--overlay-black)"
                                    : "transparent",
                            }}
                            onClick={(e) => {
                                e.stopPropagation()
                                closeChatMenu()
                            }}
                        />
                        <div
                            data-layer="chat actions menu"
                            className="ChatActionsMenu"
                            onClick={(e) => e.stopPropagation()}
                            onMouseLeave={() =>
                                !isMobile && setHoveredActionId(null)
                            }
                            style={{
                                position: "fixed",
                                zIndex: 20001,
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "flex-start",
                                alignItems: "flex-start",
                                gap: 4,
                                ...(isMobile
                                    ? {
                                          bottom: 0,
                                          left: 0,
                                          right: 0,
                                          top: "auto",
                                          width: "100%",
                                          padding: 10,
                                          background: "var(--surface-menu)",
                                          borderRadius: "36px 36px 0px 0px",
                                          outline:
                                              "0.1px solid var(--border-subtle)",
                                          outlineOffset: "-0.1px",
                                      }
                                    : {
                                          left: menuPosition.left,
                                          top: menuPosition.top,
                                          width: 196,
                                          padding: 10,
                                          background: "var(--surface-menu)",
                                          boxShadow:
                                              "0px 4px 24px hsla(0, 0%, 0%, 0.08)",
                                          borderRadius: 28,
                                          outline:
                                              "0.1px solid var(--border-subtle)",
                                          outlineOffset: "-0.1px",
                                      }),
                            }}
                        >
                            {(() => {
                                const chat = savedChats.find(
                                    (c) => c.id === menuOpenChatId
                                )!

                                type Act =
                                    | {
                                          id: string
                                          label: string
                                          icon: ReactNode
                                          onClick: () => void
                                          isDestructive?: boolean
                                      }
                                    | { isSeparator: true }

                                const actions: Act[] = [
                                    {
                                        id: "share",
                                        label: "Share",
                                        icon: (
                                            <svg
                                                width="16"
                                                height="16"
                                                viewBox="0 0 16 16"
                                                fill="none"
                                                xmlns="http://www.w3.org/2000/svg"
                                            >
                                                <path
                                                    d="M0.796875 11.3786V12.275C0.796875 12.9911 1.08134 13.6778 1.58769 14.1842C2.09403 14.6905 2.78079 14.975 3.49687 14.975H12.4969C13.213 14.975 13.8997 14.6905 14.4061 14.1842C14.9124 13.6778 15.1969 12.9911 15.1969 12.275V11.375M7.99687 10.925V1.025M7.99687 1.025L11.1469 4.175M7.99687 1.025L4.84687 4.175"
                                                    stroke="var(--text-primary)"
                                                    strokeOpacity="0.95"
                                                    strokeWidth="1.2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            </svg>
                                        ),
                                        onClick: () => handleShareChat(chat),
                                    },
                                    {
                                        id: "rename",
                                        label: "Rename",
                                        icon: (
                                            <svg
                                                width="17"
                                                height="17"
                                                viewBox="0 0 17 17"
                                                fill="none"
                                                xmlns="http://www.w3.org/2000/svg"
                                            >
                                                <path
                                                    d="M13.7466 6.61748L5.43491 14.9325C5.00818 15.3595 4.42939 15.5995 3.82574 15.6H0.601562V12.3967C0.601562 11.7933 0.841563 11.2142 1.26823 10.7875L10.7766 1.2683C10.988 1.05651 11.2392 0.888481 11.5156 0.77381C11.7921 0.659139 12.0884 0.600076 12.3877 0.599999C12.687 0.599921 12.9833 0.65883 13.2598 0.773358C13.5363 0.887886 13.7875 1.05579 13.9991 1.26746L14.9374 2.20663C15.3645 2.63375 15.6045 3.21303 15.6045 3.81705C15.6045 4.42108 15.3645 5.00036 14.9374 5.42747L13.7466 6.61748ZM13.7466 6.61748L9.58742 2.4583"
                                                    stroke="var(--text-primary)"
                                                    strokeOpacity="0.95"
                                                    strokeWidth="1.2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            </svg>
                                        ),
                                        onClick: () => handleStartRename(chat),
                                    },
                                    {
                                        id: "pin",
                                        label: chat.isPinned ? "Unpin" : "Pin",
                                        icon: chat.isPinned ? (
                                            <svg
                                                width="18"
                                                height="18"
                                                viewBox="0 0 18 18"
                                                fill="none"
                                                xmlns="http://www.w3.org/2000/svg"
                                            >
                                                <path
                                                    d="M3.61219 6.66505C3.84674 6.66157 4.11171 6.66951 4.37683 6.67872L5.57408 7.90234C5.16225 7.90665 4.74889 7.89255 4.38855 7.87988C3.99177 7.86593 3.67685 7.85673 3.45106 7.87109C3.17446 7.88872 2.82596 8.14464 2.62684 8.59374C2.42793 9.04267 2.49466 9.40603 2.67274 9.58396L7.6141 14.5263C7.79323 14.7053 8.15755 14.7719 8.60628 14.5732C9.05537 14.3741 9.31132 14.0261 9.32893 13.749C9.34312 13.5229 9.33317 13.2073 9.31916 12.8105C9.30726 12.4734 9.29485 12.0901 9.2967 11.705L10.5233 12.957C10.5336 13.2703 10.5417 13.5762 10.5262 13.8242C10.4706 14.7067 9.78154 15.3655 9.0926 15.6708C8.44618 15.9572 7.55502 16.0351 6.89438 15.4921L6.76548 15.3749L4.71862 13.3281L1.02334 17.0243C0.789076 17.2586 0.410024 17.2585 0.175696 17.0243C-0.058565 16.79 -0.0585655 16.411 0.175696 16.1767L3.87 12.4794L1.82412 10.4326C1.15477 9.76359 1.22403 8.7962 1.5292 8.10742C1.83442 7.41895 2.49268 6.72947 3.37488 6.67384L3.61219 6.66505Z"
                                                    fill="var(--text-primary)"
                                                    fillOpacity="0.95"
                                                />
                                                <path
                                                    d="M0.314366 0.397528C0.511812 0.204725 0.828424 0.208084 1.02139 0.405341L6.98911 6.5127H6.99204L7.86703 7.40527L7.86312 7.40723L9.77228 9.36131C9.77342 9.35957 9.77505 9.35816 9.77619 9.35643L10.6639 10.2627C10.6629 10.2656 10.6619 10.2685 10.6609 10.2715L16.0369 15.7734C16.2298 15.9708 16.2263 16.2874 16.0291 16.4804C15.8316 16.6733 15.515 16.6699 15.322 16.4726L0.306554 1.10455C0.113661 0.907105 0.117057 0.59052 0.314366 0.397528Z"
                                                    fill="var(--text-primary)"
                                                    fillOpacity="0.95"
                                                />
                                                <path
                                                    d="M10.5047 0.35749C11.0516 -0.00459142 11.9578 -0.250724 12.6385 0.429755L16.7683 4.56057C17.451 5.24176 17.2044 6.14765 16.8416 6.69434C16.6484 6.98522 16.3879 7.24439 16.0945 7.43066C15.8414 7.59129 15.5327 7.71638 15.2009 7.73144H15.0574C14.8582 7.72095 14.6246 7.68762 14.4177 7.66015C14.1981 7.63099 13.9857 7.60485 13.783 7.59473C13.3896 7.57513 13.187 7.62869 13.0916 7.69336L13.0574 7.7207L11.2977 9.48045L10.4578 8.62304L12.2088 6.87208C12.6819 6.39988 13.3717 6.37294 13.8435 6.39649C14.1011 6.40938 14.3577 6.44173 14.5759 6.47071C14.807 6.50141 14.9816 6.5259 15.1209 6.53321L15.1785 6.52931C15.2452 6.51967 15.3393 6.48943 15.4519 6.41798C15.5975 6.32551 15.7378 6.18738 15.8416 6.03126C16.0724 5.68355 16.0031 5.49159 15.9216 5.41018L11.7908 1.27838C11.7098 1.19735 11.5164 1.12768 11.1678 1.35846C11.0113 1.46205 10.8732 1.60193 10.7811 1.74712C10.6865 1.89621 10.6633 2.01205 10.6668 2.07622V2.07915C10.6741 2.21844 10.6986 2.39309 10.7293 2.62407C10.7583 2.84224 10.7907 3.09894 10.8035 3.35648C10.8271 3.82819 10.8 4.51623 10.3279 4.98928L8.59554 6.72071L7.7557 5.8633L9.47932 4.14163L9.50666 4.10745C9.57136 4.012 9.62493 3.80929 9.60529 3.41605C9.59516 3.21358 9.56902 3.00171 9.53986 2.78227C9.51249 2.57622 9.47918 2.34335 9.46858 2.14458C9.44659 1.75729 9.58359 1.39439 9.7674 1.10455C9.95384 0.810629 10.2135 0.55033 10.5047 0.35749Z"
                                                    fill="var(--text-primary)"
                                                    fillOpacity="0.95"
                                                />
                                            </svg>
                                        ) : (
                                            <svg
                                                width="18"
                                                height="18"
                                                viewBox="0 0 18 18"
                                                fill="none"
                                                xmlns="http://www.w3.org/2000/svg"
                                            >
                                                <path
                                                    d="M0.601562 16.6008L4.71716 12.4843M2.25047 10.0088C1.40246 9.16164 2.2558 7.34562 3.41493 7.27273C4.46205 7.20606 6.88607 7.58562 7.69231 6.77939L9.90566 4.56603C10.4541 4.01669 10.1057 2.78824 10.0701 2.1109C10.0186 1.20778 11.455 0.0922083 12.2168 0.853994L16.3475 4.98559C17.112 5.74827 15.9919 7.18028 15.0915 7.13228C14.4142 7.09673 13.1848 6.74828 12.6355 7.29673L10.4221 9.51009C9.61677 10.3163 9.99544 12.7395 9.92966 13.7866C9.85677 14.9466 8.04075 15.7999 7.19185 14.951L2.25047 10.0088Z"
                                                    stroke="var(--text-primary)"
                                                    strokeOpacity="0.95"
                                                    strokeWidth="1.2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            </svg>
                                        ),
                                        onClick: () => {
                                            togglePinChatSession(chat.id)
                                            closeChatMenu()
                                        },
                                    },
                                    { isSeparator: true },
                                    {
                                        id: "report",
                                        label: "Report chat",
                                        icon: (
                                            <svg
                                                width="16"
                                                height="17"
                                                viewBox="0 0 16 17"
                                                fill="none"
                                                xmlns="http://www.w3.org/2000/svg"
                                            >
                                                <path
                                                    d="M1.33594 15.6V11.1726M1.33594 11.1726C6.18414 7.38101 9.82072 14.9641 14.6689 11.1726V1.69449C9.82072 5.48606 6.18414 -2.09708 1.33594 1.69449V11.1726Z"
                                                    stroke="var(--text-primary)"
                                                    strokeOpacity="0.95"
                                                    strokeWidth="1.2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            </svg>
                                        ),
                                        onClick: () => {
                                            setShowReportModal(true)
                                            closeChatMenu()
                                        },
                                    },
                                    {
                                        id: "delete",
                                        label: "Delete",
                                        isDestructive: true,
                                        icon: (
                                            <svg
                                                width="16"
                                                height="16"
                                                viewBox="0 0 16 16"
                                                fill="none"
                                                xmlns="http://www.w3.org/2000/svg"
                                            >
                                                <path
                                                    d="M13.3359 4.33333L12.5893 11.7982C12.4764 12.9298 12.4204 13.4951 12.1626 13.9227C11.9365 14.299 11.604 14.6 11.207 14.7876C10.7564 15 10.1893 15 9.05149 15H6.95371C5.81683 15 5.24883 15 4.79816 14.7867C4.40087 14.5992 4.06804 14.2983 3.84172 13.9218C3.58572 13.4951 3.52883 12.9298 3.41505 11.7982L2.66927 4.33333M9.33594 11.3111V6.86667M6.66927 11.3111V6.86667M1.33594 4.11111H5.43816M5.43816 4.11111L5.78127 1.736C5.88083 1.304 6.23994 1 6.65238 1H9.35283C9.76527 1 10.1235 1.304 10.2239 1.736L10.567 4.11111M5.43816 4.11111H10.567M10.567 4.11111H14.6693"
                                                    stroke="var(--destructive-light)"
                                                    strokeOpacity="0.95"
                                                    strokeWidth="1.2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            </svg>
                                        ),
                                        onClick: () =>
                                            handleDeleteChat(chat.id),
                                    },
                                ]

                                return actions.map((action, i) => {
                                    if ("isSeparator" in action && action.isSeparator) {
                                        return (
                                            <div
                                                key={`sep-${i}`}
                                                style={{
                                                    alignSelf: "stretch",
                                                    paddingLeft: 8,
                                                    paddingRight: 8,
                                                    paddingTop: 2,
                                                    paddingBottom: 2,
                                                    display: "flex",
                                                    flexDirection: "column",
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        alignSelf: "stretch",
                                                        marginLeft: 4,
                                                        marginRight: 4,
                                                        marginTop: 2,
                                                        marginBottom: 2,
                                                        height: 1,
                                                        background:
                                                            "var(--border-subtle)",
                                                        borderRadius: 4,
                                                    }}
                                                />
                                            </div>
                                        )
                                    }
                                    const a = action as Extract<
                                        Act,
                                        { id: string }
                                    >
                                    const isDestructive = !!a.isDestructive
                                    const isHovered = hoveredActionId === a.id
                                    const mh = isMobile ? 44 : 36
                                    return (
                                        <div
                                            key={a.id}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => a.onClick()}
                                            onKeyDown={(e) => {
                                                if (
                                                    e.key === "Enter" ||
                                                    e.key === " "
                                                ) {
                                                    e.preventDefault()
                                                    a.onClick()
                                                }
                                            }}
                                            style={{
                                                alignSelf: "stretch",
                                                height: mh,
                                                paddingLeft: 12,
                                                paddingRight: 12,
                                                borderRadius: 28,
                                                justifyContent: "flex-start",
                                                alignItems: "center",
                                                gap: 8,
                                                display: "flex",
                                                cursor: "pointer",
                                                transition: "none",
                                                background: isHovered
                                                    ? isDestructive
                                                        ? "var(--destructive-tint)"
                                                        : "var(--hover-default)"
                                                    : "transparent",
                                            }}
                                            onMouseEnter={() =>
                                                !isMobile &&
                                                setHoveredActionId(a.id)
                                            }
                                        >
                                            <div
                                                style={{
                                                    width: 15,
                                                    display: "flex",
                                                    justifyContent: "center",
                                                }}
                                            >
                                                {a.icon}
                                            </div>
                                            <div
                                                style={{
                                                    flex: "1 1 0",
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    justifyContent: "center",
                                                    color: isDestructive
                                                        ? "var(--destructive-light)"
                                                        : "var(--text-primary)",
                                                    fontSize: 14,
                                                    fontFamily: "var(--font-ui)",
                                                    fontWeight: 400,
                                                    lineHeight: "19.32px",
                                                }}
                                            >
                                                {a.label}
                                            </div>
                                        </div>
                                    )
                                })
                            })()}
                        </div>
                    </>,
                    document.body
                )}

            <style>{`
        .left-sidebar {
          width: ${LEFT_SIDEBAR_WIDTH}px;
          height: 100%;
          padding-top: ${SIDEBAR_PAD_TOP}px;
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          background: var(--bg);
          overflow: visible;
          display: inline-flex;
          flex-direction: column;
          justify-content: flex-start;
          align-items: flex-start;
          gap: 0;
          z-index: 10000;
          transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
          border-radius: ${isMobile ? "0 28px 28px 0" : "0"};
        }
        .scrollable-sidebar-content {
          align-self: stretch;
          flex: 1 1 0;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }
        .your-chats-flexbox {
          align-self: stretch;
          padding: 8px;
          padding-top: 0;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: flex-start;
        }
        .chat-title {
          align-self: stretch;
          padding: 8px 10px;
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: flex-start;
          gap: 6px;
        }
        .chat-title-toggle {
          cursor: pointer;
          user-select: none;
        }
        .sidebar-chevron {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .section-label {
          color: var(--text-secondary);
          font-size: 14px;
          font-family: var(--font-ui);
          font-weight: 400;
          line-height: 19.32px;
        }
        .chat-item-row {
          align-self: stretch;
          min-height: 36px;
          padding-left: 10px;
          padding-right: 10px;
          border-radius: 28px;
          margin: 0 0 2px 0;
          justify-content: flex-start;
          align-items: center;
          gap: 8px;
          display: flex;
          cursor: pointer;
          position: relative;
          font: inherit;
          text-align: left;
          color: var(--text-primary);
          transition: background 0.2s;
          box-sizing: border-box;
        }
        .chat-item-title {
          flex: 1 1 0;
          min-width: 0;
          font-size: 14px;
          font-family: var(--font-ui);
          font-weight: 400;
          line-height: 19.32px;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }
        .chat-item-rename-input {
          flex: 1 1 0;
          min-width: 0;
          background: transparent;
          border: none;
          color: var(--text-primary);
          font-size: 14px;
          font-family: var(--font-ui);
          font-weight: 400;
          line-height: 19.32px;
          outline: none;
          padding: 0;
        }
        .chat-item-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }
        .chat-item-menu-hit {
          width: 16px;
          height: 24px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
          cursor: pointer;
        }
        .fixed-top-nav {
          width: 100%;
          padding: 8px;
          left: 0;
          top: 0;
          position: absolute;
          background: var(--bg);
          border-radius: ${isMobile ? "0 28px 0 0" : "0"};
          display: inline-flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: flex-start;
          gap: 12px;
        }
        .sidebar-top-actions {
          align-self: stretch;
          display: inline-flex;
          justify-content: space-between;
          align-items: center;
        }
        .sidebar-icon-btn {
          width: 36px;
          height: 36px;
          display: flex;
          justify-content: center;
          align-items: center;
          cursor: ew-resize;
          border-radius: 28px;
          border: none;
          padding: 0;
          background: transparent;
          transition: background 0.2s;
        }
        .search-bar {
          align-self: stretch;
          height: 36px;
          padding-left: 12px;
          background: var(--hover-medium);
          overflow: hidden;
          border-radius: 50px;
          display: inline-flex;
          justify-content: flex-start;
          align-items: center;
          gap: 8px;
        }
        .search-icon-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .search-input {
          flex: 1 1 0;
          color: var(--text-primary);
          font-size: 14px;
          font-family: var(--font-ui);
          font-weight: 400;
          line-height: 19.6px;
          background: transparent;
          border: none;
          outline: none;
          padding: 0;
          height: 100%;
        }
        .search-input::placeholder {
          color: var(--text-secondary);
          opacity: 1;
        }
        .search-input::-webkit-search-cancel-button,
        .search-input::-webkit-search-decoration {
          -webkit-appearance: none;
          appearance: none;
          display: none;
        }
        .sidebar-new-chat-wrapper {
          align-self: stretch;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: flex-start;
          gap: 2px;
        }
        .new-chat-row {
          align-self: stretch;
          height: 36px;
          padding-left: 10px;
          padding-right: 10px;
          border-radius: 28px;
          display: inline-flex;
          justify-content: flex-start;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .row-icon {
          width: 16px;
          min-width: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .row-label {
          flex: 1 1 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          color: var(--text-primary);
          font-size: 14px;
          font-family: var(--font-ui);
          font-weight: 400;
          line-height: 19.32px;
        }
        .sidebar-overlay {
          position: fixed;
          inset: 0;
          background: var(--overlay-black);
          z-index: 9999;
        }
      `}</style>
        </>
    )
}

export const LEFT_SIDEBAR_W = LEFT_SIDEBAR_WIDTH
