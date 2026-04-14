import type { ChangeEvent, CSSProperties, KeyboardEvent } from "react"
import {
    useCallback,
    useEffect,
    useId,
    useLayoutEffect,
    useRef,
    useState,
} from "react"

/** Aligns with web.tsx: outer chat wrapper is 816px; bottom controls use `calc(100% - 48px)`. */
const CHAT_INPUT_MAX_WIDTH = 768

/** Same as `App.tsx` `<main>` `padding-left` so fixed ChatBar stays aligned while the shell animates. */
const SIDEBAR_LAYOUT_TRANSITION =
    "left 0.35s cubic-bezier(0.22, 1, 0.36, 1)"

const MAX_FILES = 10
/** Matches web.tsx ChatInput overflow detection (single-line content height). */
const SINGLE_LINE_HEIGHT = 24
const MAX_TEXTAREA_HEIGHT = 148

type DashAttachment = {
    id: string
    file: File
    kind: "image" | "file"
    previewUrl?: string
}

function fileLabel(name: string, mime: string): string {
    const ext = name.split(".").pop()
    if (ext && ext !== name) return ext.toUpperCase()
    if (mime.includes("pdf")) return "PDF"
    if (mime.includes("word") || mime.includes("document")) return "DOC"
    if (mime.includes("sheet") || mime.includes("excel")) return "XLS"
    if (mime.includes("presentation")) return "PPT"
    return mime.split("/").pop()?.toUpperCase() || "FILE"
}

export type ChatBarOnSend = (payload: {
    text: string
    files: File[]
}) => void | Promise<void>

/** Bottom chat composer — light-mode visuals aligned with web.tsx ChatInputBar; + opens the file picker immediately. */
export function ChatBar({
    leftInset = 0,
    onSend,
    isSending = false,
    errorBanner = null,
}: {
    leftInset?: number
    onSend: ChatBarOnSend
    isSending?: boolean
    errorBanner?: string | null
}) {
    const inputId = useId()
    const attachmentsRef = useRef<DashAttachment[]>([])
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const [isMobile, setIsMobile] = useState(false)
    const [message, setMessage] = useState("")
    const [attachments, setAttachments] = useState<DashAttachment[]>([])
    const [plusHover, setPlusHover] = useState(false)
    const [hasExpandedToTwoRows, setHasExpandedToTwoRows] = useState(false)
    useEffect(() => {
        const mq = window.matchMedia("(max-width: 767px)")
        const q = () => setIsMobile(mq.matches)
        q()
        mq.addEventListener("change", q)
        return () => mq.removeEventListener("change", q)
    }, [])

    const revokePreview = useCallback((a: DashAttachment) => {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl)
    }, [])

    const removeAttachment = useCallback((id: string) => {
        setAttachments((prev) => {
            const att = prev.find((x) => x.id === id)
            if (att) revokePreview(att)
            return prev.filter((x) => x.id !== id)
        })
    }, [revokePreview])

    useEffect(() => {
        attachmentsRef.current = attachments
    }, [attachments])

    useEffect(() => {
        return () => {
            attachmentsRef.current.forEach(revokePreview)
        }
    }, [revokePreview])

    useEffect(() => {
        if (!message.trim()) setHasExpandedToTwoRows(false)
    }, [message])

    const syncTextareaHeight = useCallback(() => {
        const el = textareaRef.current
        if (!el) return
        el.style.height = "auto"
        const sh = el.scrollHeight
        const h = Math.min(sh, MAX_TEXTAREA_HEIGHT)
        el.style.height = `${h}px`
        el.style.overflowY = sh > MAX_TEXTAREA_HEIGHT ? "auto" : "hidden"
        if (message.trim() && sh > SINGLE_LINE_HEIGHT + 4) {
            setHasExpandedToTwoRows(true)
        }
    }, [message])

    useLayoutEffect(() => {
        syncTextareaHeight()
    }, [message, syncTextareaHeight, hasExpandedToTwoRows])

    const addFiles = useCallback((files: FileList | null) => {
        if (!files?.length) return
        setAttachments((prev) => {
            const next = [...prev]
            for (const file of Array.from(files)) {
                if (next.length >= MAX_FILES) break
                const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
                const isImg = file.type.startsWith("image/")
                const previewUrl = isImg ? URL.createObjectURL(file) : undefined
                next.push({
                    id,
                    file,
                    kind: isImg ? "image" : "file",
                    previewUrl,
                })
            }
            return next
        })
    }, [])

    const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        addFiles(e.target.files)
        e.target.value = ""
    }

    const submit = useCallback(async () => {
        if (isSending) return
        const text = message.trim()
        const files = attachments.map((a) => a.file)
        const attachmentNote =
            attachments.length > 0
                ? `\n\n(Attached file names: ${attachments.map((a) => a.file.name).join(", ")})`
                : ""
        const full = (text + attachmentNote).trim()
        if (!full) return

        const payload = { text, files }
        // Clear immediately — parent `onSend` often awaits streaming; do not tie composer to that.
        setMessage("")
        setAttachments((prev) => {
            prev.forEach(revokePreview)
            return []
        })

        try {
            await onSend(payload)
        } catch {
            // Parent shows errorBanner
        }
    }, [attachments, isSending, message, onSend, revokePreview])

    const onComposerKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key !== "Enter" || e.shiftKey) return
        const text = message.trim()
        if (!text && attachments.length === 0) return
        e.preventDefault()
        void submit()
    }

    const hasContent =
        message.trim().length > 0 || attachments.length > 0

    const useTwoRowLayout =
        message.trim().length > 0 && hasExpandedToTwoRows

    /** Horizontal inset from screen edges; 24px mobile + desktop (matches shell rhythm). */
    const marginX = 24
    const canAdd = attachments.length < MAX_FILES

    const textareaStyle: CSSProperties = {
        flex: "1 1 0",
        width: "100%",
        color: "var(--text-primary)",
        fontSize: 16,
        fontFamily: "var(--font-ui)",
        fontWeight: 400,
        lineHeight: "24px",
        background: "transparent",
        border: "none",
        outline: "none",
        minHeight: SINGLE_LINE_HEIGHT,
        maxHeight: MAX_TEXTAREA_HEIGHT,
        overflowY: "hidden",
        padding: 0,
        margin: 0,
        resize: "none",
        WebkitAppearance: "none" as unknown as undefined,
        boxSizing: "border-box",
    }

    const plusControl =
        canAdd ? (
            <label
                id="upload-trigger-btn"
                data-layer="upload-button"
                data-svg-wrapper
                htmlFor={inputId}
                title="Add files"
                onMouseEnter={() => setPlusHover(true)}
                onMouseLeave={() => setPlusHover(false)}
                style={{
                    cursor: "pointer",
                    width: 36,
                    height: 36,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 0,
                    position: "relative",
                    zIndex: 1,
                    borderRadius: "50%",
                    background: plusHover
                        ? "var(--hover-subtle)"
                        : "transparent",
                    opacity: 0.95,
                    flexShrink: 0,
                }}
            >
                <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden
                >
                    <path
                        d="M12 5V19M5 12H19"
                        stroke="var(--text-primary)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </label>
        ) : (
            <span
                data-layer="upload-button"
                aria-disabled
                title="Maximum 10 files"
                style={{
                    cursor: "not-allowed",
                    width: 36,
                    height: 36,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: 0.3,
                    flexShrink: 0,
                }}
            >
                <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden
                >
                    <path
                        d="M12 5V19M5 12H19"
                        stroke="var(--text-primary)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </span>
        )

    const sendButton = (
        <button
            type="button"
            data-layer="send-button"
            aria-label={isSending ? "Sending" : "Send message"}
            disabled={isSending}
            onClick={() => {
                if (!hasContent) return
                void submit()
            }}
            style={{
                cursor:
                    hasContent && !isSending ? "pointer" : "not-allowed",
                display: hasContent ? "block" : "none",
                opacity: isSending ? 0.65 : 1,
                width: 36,
                height: 36,
                padding: 0,
                border: "none",
                background: "none",
            }}
        >
            {isSending ? (
                <svg
                    width="36"
                    height="36"
                    viewBox="0 0 36 36"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden
                >
                    <rect
                        width="36"
                        height="36"
                        rx="18"
                        fill="var(--text-primary)"
                        fillOpacity="0.95"
                    />
                    <rect
                        x="12"
                        y="12"
                        width="12"
                        height="12"
                        rx="2"
                        fill="var(--bg)"
                        fillOpacity="0.95"
                    />
                </svg>
            ) : (
                <svg
                    width="36"
                    height="36"
                    viewBox="0 0 36 36"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden
                >
                    <rect
                        width="36"
                        height="36"
                        rx="18"
                        fill="var(--text-primary)"
                        fillOpacity="0.95"
                    />
                    <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M14.5611 18.1299L16.8709 15.8202V23.3716C16.8709 23.9948 17.3762 24.5 17.9994 24.5C18.6226 24.5 19.1278 23.9948 19.1278 23.3716V15.8202L21.4375 18.1299C21.8782 18.5706 22.5927 18.5706 23.0334 18.1299C23.4741 17.6893 23.4741 16.9748 23.0334 16.5341L17.9994 11.5L12.9653 16.5341C12.5246 16.9748 12.5246 17.6893 12.9653 18.1299C13.406 18.5706 14.1204 18.5706 14.5611 18.1299Z"
                        fill="var(--bg)"
                        fillOpacity="0.95"
                    />
                </svg>
            )}
        </button>
    )

    const messageInput = (
        <textarea
            ref={textareaRef}
            className="chat-bar-textarea"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={onComposerKeyDown}
            placeholder="Ask anything"
            rows={1}
            style={{
                ...textareaStyle,
                ...(useTwoRowLayout
                    ? { flex: "0 1 auto", alignSelf: "stretch" as const }
                    : {}),
            }}
        />
    )

    return (
        <>
            <div
                data-layer="chat-input-wrapper"
                className="chat-bar-root"
                onPointerDown={(e) => e.stopPropagation()}
                style={{
                    position: "fixed",
                    left: leftInset,
                    right: 0,
                    bottom: 0,
                    transition: SIDEBAR_LAYOUT_TRANSITION,
                    zIndex: 5000,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                    alignItems: "center",
                    pointerEvents: "none",
                }}
            >
            <input
                id={inputId}
                type="file"
                multiple
                style={{
                    position: "absolute",
                    width: 1,
                    height: 1,
                    padding: 0,
                    margin: -1,
                    overflow: "hidden",
                    clip: "rect(0,0,0,0)",
                    whiteSpace: "nowrap",
                    border: 0,
                    opacity: 0,
                    pointerEvents: "none",
                }}
                onChange={onFileChange}
                aria-hidden
                tabIndex={-1}
            />

            {errorBanner ? (
                <div
                    style={{
                        width: isMobile
                            ? `calc(100% - ${marginX * 2}px)`
                            : "calc(100% - 48px)",
                        maxWidth: CHAT_INPUT_MAX_WIDTH,
                        marginLeft: marginX,
                        marginRight: marginX,
                        marginBottom: 8,
                        padding: "10px 12px",
                        borderRadius: 14,
                        boxSizing: "border-box",
                        background: "var(--bg)",
                        border: "0.33px solid var(--border-subtle)",
                        pointerEvents: "auto",
                        maxHeight: 168,
                        overflow: "auto",
                        position: "relative",
                        zIndex: 1,
                    }}
                >
                    <div
                        style={{
                            fontSize: 13,
                            color: "var(--destructive-bright)",
                            fontFamily: "var(--font-ui)",
                        }}
                    >
                        {errorBanner}
                    </div>
                </div>
            ) : null}

            <div
                className="chat-bar-controls-shell"
                data-layer="bottom-controls-container"
                style={{
                    position: "relative",
                    width: isMobile
                        ? `calc(100% - ${marginX * 2}px)`
                        : "calc(100% - 48px)",
                    maxWidth: CHAT_INPUT_MAX_WIDTH,
                    padding: "10px 0 16px 0",
                    paddingBottom: `max(16px, env(safe-area-inset-bottom, 0px))`,
                    marginLeft: marginX,
                    marginRight: marginX,
                    boxSizing: "border-box",
                    pointerEvents: "auto",
                }}
            >
                {/* Full-viewport-width fade; composer stays narrow (child below). Breakout: centered 100vw strip. */}
                <div
                    aria-hidden
                    style={{
                        position: "absolute",
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: "100vw",
                        top: 0,
                        bottom: 0,
                        zIndex: 0,
                        pointerEvents: "none",
                        background:
                            "linear-gradient(180deg, var(--overlay-gradient) 0%, var(--bg) 35%)",
                    }}
                />
                <div
                    className="chat-bar-controls"
                    style={{
                        position: "relative",
                        zIndex: 1,
                        width: "100%",
                        justifyContent: "center",
                        alignItems: "flex-end",
                        gap: 10,
                        display: "flex",
                        pointerEvents: "auto",
                    }}
                >
                <div
                    data-layer="chat-input-bar"
                    className="chat-input-bar"
                    style={{
                        flex: "1 1 0",
                        minWidth: 0,
                        width: "100%",
                        minHeight: 56,
                        maxHeight: 384,
                        padding: 0,
                        background: "var(--bg)",
                        border: "0.33px solid var(--border-subtle)",
                        boxShadow: "0px 8px 24px hsla(0, 0%, 0%, 0.04)",
                        outline: "none",
                        overflow: "visible",
                        borderRadius: 28,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "flex-end",
                        gap: 16,
                        pointerEvents: "auto",
                    }}
                >
                    {attachments.length > 0 && (
                        <div
                            className="uploaded-file-container"
                            style={{
                                display: "flex",
                                flexDirection: "row",
                                flexWrap: "nowrap",
                                gap: 8,
                                width: "100%",
                                overflowX: "auto",
                                overflowY: "hidden",
                                padding: "10px 10px 0 10px",
                                scrollbarWidth: "none",
                                msOverflowStyle: "none",
                            }}
                        >
                            <style>{`
                .uploaded-file-container::-webkit-scrollbar { display: none; }
              `}</style>
                            {attachments.map((att) =>
                                att.kind === "image" && att.previewUrl ? (
                                    <div
                                        key={att.id}
                                        data-layer="uploaded file"
                                        style={{
                                            width: 86,
                                            height: 86,
                                            flexShrink: 0,
                                            position: "relative",
                                            background: "var(--bg)",
                                            border:
                                                "0.33px solid var(--border-subtle)",
                                            overflow: "hidden",
                                            borderRadius: 16,
                                            display: "inline-flex",
                                        }}
                                    >
                                        <button
                                            type="button"
                                            aria-label={`Remove ${att.file.name}`}
                                            onClick={() =>
                                                removeAttachment(att.id)
                                            }
                                            style={{
                                                position: "absolute",
                                                right: 6,
                                                top: 6,
                                                cursor: "pointer",
                                                zIndex: 10,
                                                padding: 0,
                                                border: "none",
                                                background: "none",
                                            }}
                                        >
                                            <svg
                                                width="16"
                                                height="16"
                                                viewBox="0 0 16 16"
                                                fill="none"
                                                xmlns="http://www.w3.org/2000/svg"
                                            >
                                                <rect
                                                    width="16"
                                                    height="16"
                                                    rx="8"
                                                    fill="var(--surface-highlight)"
                                                />
                                                <path
                                                    d="M11 5L5 11M5 5L11 11"
                                                    stroke="var(--text-primary)"
                                                    strokeWidth="1.2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            </svg>
                                        </button>
                                        <img
                                            src={att.previewUrl}
                                            alt={att.file.name}
                                            style={{
                                                width: "100%",
                                                height: "100%",
                                                objectFit: "cover",
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <div
                                        key={att.id}
                                        data-layer="uploaded file"
                                        style={{
                                            width: 86,
                                            height: 86,
                                            flexShrink: 0,
                                            padding: 8,
                                            position: "relative",
                                            background: "var(--bg)",
                                            border:
                                                "0.33px solid var(--border-subtle)",
                                            overflow: "hidden",
                                            borderRadius: 16,
                                            display: "inline-flex",
                                            flexDirection: "column",
                                            justifyContent: "space-between",
                                            alignItems: "flex-start",
                                        }}
                                    >
                                        <button
                                            type="button"
                                            aria-label={`Remove ${att.file.name}`}
                                            onClick={() =>
                                                removeAttachment(att.id)
                                            }
                                            style={{
                                                position: "absolute",
                                                right: 6,
                                                top: 6,
                                                cursor: "pointer",
                                                zIndex: 10,
                                                padding: 0,
                                                border: "none",
                                                background: "none",
                                            }}
                                        >
                                            <svg
                                                width="16"
                                                height="16"
                                                viewBox="0 0 16 16"
                                                fill="none"
                                            >
                                                <rect
                                                    width="16"
                                                    height="16"
                                                    rx="8"
                                                    fill="var(--surface-highlight)"
                                                />
                                                <path
                                                    d="M11 5L5 11M5 5L11 11"
                                                    stroke="var(--text-primary)"
                                                    strokeWidth="1.2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            </svg>
                                        </button>
                                        <div
                                            style={{
                                                color: "var(--text-secondary)",
                                                fontSize: 12,
                                                fontFamily: "var(--font-ui)",
                                                lineHeight: "18px",
                                            }}
                                        >
                                            {fileLabel(
                                                att.file.name,
                                                att.file.type
                                            )}
                                        </div>
                                        <div
                                            style={{
                                                display: "-webkit-box",
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: "vertical",
                                                color: "var(--text-primary)",
                                                fontSize: 14,
                                                fontFamily: "var(--font-ui)",
                                                lineHeight: "18px",
                                                overflow: "hidden",
                                                width: "100%",
                                            }}
                                        >
                                            {att.file.name}
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    )}

                    {useTwoRowLayout ? (
                        <>
                            <div
                                data-layer="textarea-wrapper"
                                className="TextAreaWrapper"
                                style={{
                                    width: "100%",
                                    display: "flex",
                                    alignItems: "center",
                                    padding: "16px 16px 0px 16px",
                                    position: "relative",
                                }}
                            >
                                {messageInput}
                            </div>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "flex-end",
                                    justifyContent: "space-between",
                                    gap: 8,
                                    width: "100%",
                                    padding: "0 10px 10px 10px",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "row",
                                        flexWrap: "wrap",
                                        alignItems: "center",
                                        gap: 4,
                                        flex: "1 1 0",
                                        minWidth: 0,
                                    }}
                                >
                                    {plusControl}
                                </div>
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        flexShrink: 0,
                                    }}
                                >
                                    {sendButton}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div
                            style={{
                                display: "flex",
                                alignItems: "flex-end",
                                gap: 8,
                                width: "100%",
                                padding: "0 10px 10px 10px",
                            }}
                        >
                            {plusControl}
                            <div
                                data-layer="textarea-wrapper"
                                className="TextAreaWrapper"
                                style={{
                                    flex: "1 1 0",
                                    alignSelf: "stretch",
                                    display: "flex",
                                    alignItems: "center",
                                    paddingTop: 6,
                                    paddingBottom: 6,
                                    minWidth: 0,
                                }}
                            >
                                {messageInput}
                            </div>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    flexShrink: 0,
                                }}
                            >
                                {sendButton}
                            </div>
                        </div>
                    )}
                </div>
                </div>
            </div>
            <style>{`
        .chat-bar-textarea::placeholder {
          color: var(--text-secondary);
          opacity: 1;
        }
      `}</style>
            </div>
        </>
    )
}
