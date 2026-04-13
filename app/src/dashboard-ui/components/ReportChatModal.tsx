"use client"

import { useEffect, useState } from "react"

type ReportChatModalProps = {
    isOpen: boolean
    onClose: () => void
    onSubmit: (reason: string) => void
}

/** Mirrors web.tsx `ReportModal` for `reportType="chat"` (reason list + Submit). */
export function ReportChatModal({
    isOpen,
    onClose,
    onSubmit,
}: ReportChatModalProps) {
    const [selected, setSelected] = useState<string | null>(null)
    const [hoveredRow, setHoveredRow] = useState<string | null>(null)
    const [isCloseHovered, setIsCloseHovered] = useState(false)

    const reasons = [
        "Violence & self-harm",
        "Sexual exploitation & abuse",
        "Child/teen exploitation",
        "Bullying & harassment",
        "Spam, fraud & deception",
        "Privacy violation",
        "Intellectual property",
        "Age-inappropriate content",
        "Something else",
    ]

    useEffect(() => {
        if (!isOpen) setSelected(null)
    }, [isOpen])

    if (!isOpen) return null

    const isMobileLayout =
        typeof window !== "undefined" && window.innerWidth < 768

    return (
        <div
            role="presentation"
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 20010,
                display: "flex",
                alignItems: isMobileLayout ? "flex-end" : "center",
                justifyContent: "center",
                padding: isMobileLayout ? 0 : 16,
                background: "var(--overlay-black)",
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose()
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="report-chat-title"
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: isMobileLayout ? "100%" : 400,
                    maxWidth: "100%",
                    maxHeight: isMobileLayout ? "calc(100% - 16px)" : 600,
                    paddingTop: 24,
                    paddingBottom: 28,
                    paddingLeft: isMobileLayout ? 16 : 28,
                    paddingRight: isMobileLayout ? 16 : 28,
                    boxShadow: "0px 4px 24px hsla(0, 0%, 0%, 0.04)",
                    borderRadius: isMobileLayout ? "24px 24px 0 0" : 48,
                    outline: "0.33px solid var(--hover-strong)",
                    outlineOffset: "-0.33px",
                    background: "var(--bg)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 24,
                    position: "relative",
                }}
            >
                <div
                    style={{
                        alignSelf: "stretch",
                        position: "relative",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                    }}
                >
                    <div
                        id="report-chat-title"
                        style={{
                            color: "var(--text-primary)",
                            fontSize: 16,
                            fontFamily: "var(--font-ui)",
                            fontWeight: 400,
                            lineHeight: "18px",
                        }}
                    >
                        Report chat
                    </div>
                    <div
                        style={{
                            color: "var(--text-secondary)",
                            fontSize: 12,
                            fontFamily: "var(--font-ui)",
                            fontWeight: 400,
                            lineHeight: "17px",
                        }}
                    >
                        Why are you reporting this chat?
                    </div>
                    <button
                        type="button"
                        aria-label="Close"
                        onClick={onClose}
                        onMouseEnter={() =>
                            !isMobileLayout && setIsCloseHovered(true)
                        }
                        onMouseLeave={() => setIsCloseHovered(false)}
                        style={{
                            position: "absolute",
                            right: isMobileLayout ? 0 : -12,
                            top: -12,
                            width: 36,
                            height: 36,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: "none",
                            borderRadius: "50%",
                            cursor: "pointer",
                            background: isCloseHovered
                                ? "var(--hover-strong)"
                                : "transparent",
                            padding: 0,
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
                                d="M23.25 12.75L12.75 23.25M12.75 12.75L23.25 23.25"
                                stroke="var(--text-primary)"
                                strokeOpacity="0.95"
                                strokeWidth="1.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column" }}>
                    {reasons.map((reason) => (
                        <div
                            key={reason}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelected(reason)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault()
                                    setSelected(reason)
                                }
                            }}
                            onMouseEnter={() => setHoveredRow(reason)}
                            onMouseLeave={() => setHoveredRow(null)}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "8px 0",
                                cursor: "pointer",
                            }}
                        >
                            <div
                                style={{
                                    width: 16,
                                    height: 16,
                                    borderRadius: "50%",
                                    border: `0.33px solid ${
                                        selected === reason
                                            ? "var(--text-primary)"
                                            : "var(--text-secondary)"
                                    }`,
                                    background:
                                        hoveredRow === reason
                                            ? "var(--border-subtle)"
                                            : "transparent",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    boxSizing: "border-box",
                                }}
                            >
                                {selected === reason && (
                                    <div
                                        style={{
                                            width: 7,
                                            height: 7,
                                            borderRadius: "50%",
                                            background: "var(--text-primary)",
                                        }}
                                    />
                                )}
                            </div>
                            <div
                                style={{
                                    color: "var(--text-primary)",
                                    fontSize: 15,
                                    fontFamily: "var(--font-ui)",
                                    fontWeight: 400,
                                    opacity: 0.95,
                                }}
                            >
                                {reason}
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                        type="button"
                        disabled={!selected}
                        onClick={() => selected && onSubmit(selected)}
                        style={{
                            padding: "10px 12px",
                            borderRadius: 28,
                            background: selected
                                ? "var(--text-primary)"
                                : "var(--surface)",
                            color: selected
                                ? "var(--surface-black)"
                                : "var(--text-tertiary)",
                            border: "none",
                            fontSize: 14,
                            fontFamily: "var(--font-ui)",
                            fontWeight: 500,
                            cursor: selected ? "pointer" : "default",
                            boxSizing: "border-box",
                        }}
                    >
                        Submit
                    </button>
                </div>
            </div>
        </div>
    )
}
