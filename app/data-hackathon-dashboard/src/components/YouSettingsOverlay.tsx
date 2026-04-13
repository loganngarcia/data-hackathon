import type { ChangeEvent, ReactNode, TransitionEvent } from "react"
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react"
import {
    loadYouProfile,
    saveYouProfile,
    type YouProfileSnapshot,
} from "../profile/youStorage"
import { iosSafariInputFontPx } from "../utils/iosSafariInputFont"

const JOB_TITLE_MAX_PX = 132
/** Exit delay matches ModalSheet timings (max 0.25s mobile sheet motion). */
const EXIT_MS = 300
/** Pull-to-dismiss threshold — matches web.tsx settings sheet. */
const PULL_CLOSE_PX = 88

type Props = {
    open: boolean
    isMobile: boolean
    onClose: () => void
}

/** Subset of web.tsx “Your profile” sheet — ModalSheet timings, URL ?settings in App, pull-dismiss on mobile. */
export function YouSettingsOverlay({ open, isMobile, onClose }: Props) {
    const [profile, setProfile] = useState<YouProfileSnapshot>(() =>
        loadYouProfile()
    )
    const [closeHover, setCloseHover] = useState(false)
    const jobTitleRef = useRef<HTMLTextAreaElement>(null)

    const [visible, setVisible] = useState(open)
    const [entered, setEntered] = useState(false)
    const [dragY, setDragY] = useState(0)
    const dragYRef = useRef(0)
    const sheetShellRef = useRef<HTMLDivElement>(null)
    const gestureAxisRef = useRef<null | "x" | "y">(null)

    useEffect(() => {
        if (open) {
            setVisible(true)
            setDragY(0)
            dragYRef.current = 0
            const id = requestAnimationFrame(() =>
                requestAnimationFrame(() => setEntered(true))
            )
            return () => cancelAnimationFrame(id)
        }
        setEntered(false)
        setDragY(0)
        dragYRef.current = 0
        const t = window.setTimeout(() => setVisible(false), EXIT_MS)
        return () => clearTimeout(t)
    }, [open])

    useEffect(() => {
        if (!open) return
        setProfile(loadYouProfile())
    }, [open])

    useEffect(() => {
        if (!open) return
        saveYouProfile(profile)
    }, [open, profile])

    useEffect(() => {
        if (!visible) return
        const prev = document.body.style.overflow
        document.body.style.overflow = "hidden"
        return () => {
            document.body.style.overflow = prev
        }
    }, [visible])

    useEffect(() => {
        if (!open || !entered) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault()
                onClose()
            }
        }
        document.addEventListener("keydown", onKey)
        return () => document.removeEventListener("keydown", onKey)
    }, [open, entered, onClose])

    const inputFontPx = iosSafariInputFontPx()

    useLayoutEffect(() => {
        const el = jobTitleRef.current
        if (!el || !entered) return
        el.style.height = "auto"
        const sh = el.scrollHeight
        el.style.height = `${Math.min(sh, JOB_TITLE_MAX_PX)}px`
        el.style.overflowY = sh > JOB_TITLE_MAX_PX ? "auto" : "hidden"
    }, [entered, profile.jobTitle, inputFontPx])

    const onInterestsChange = useCallback(
        (e: ChangeEvent<HTMLTextAreaElement>) => {
            const raw = e.target.value
            if (raw === "") {
                setProfile((p) => ({ ...p, favoriteThings: "" }))
                return
            }
            const cursor = e.target.selectionStart ?? raw.length
            let charPos = 0
            let added = 0
            const fixed = raw.split("\n").map((line) => {
                const needs =
                    line !== "-" &&
                    line !== "- " &&
                    !line.startsWith("- ")
                const result = needs
                    ? `- ${line.replace(/^-\s*/, "")}`
                    : line
                if (needs && cursor >= charPos) added += 2
                charPos += line.length + 1
                return result
            })
            const next = fixed.join("\n")
            setProfile((p) => ({ ...p, favoriteThings: next }))
            if (added > 0) {
                requestAnimationFrame(() => {
                    const ta = e.target
                    const p = cursor + added
                    ta.selectionStart = p
                    ta.selectionEnd = p
                })
            }
        },
        []
    )

    useEffect(() => {
        if (!isMobile || !visible || !entered) return
        const sheet = sheetShellRef.current
        if (!sheet) return

        let lastY = 0
        let lastX = 0
        let startX = 0
        let startY = 0
        let pressed = false
        let activePointerId = -1
        let pullCaptureActive = false
        const GESTURE_MIN = 10
        const AXIS_RATIO = 1.35

        const scrollEl = () =>
            sheet.querySelector(
                "[data-pull-scroll]"
            ) as HTMLElement | null

        const releasePullCapture = () => {
            if (!pullCaptureActive || activePointerId < 0) return
            try {
                if (sheet.hasPointerCapture(activePointerId)) {
                    sheet.releasePointerCapture(activePointerId)
                }
            } catch {
                /* */
            }
            pullCaptureActive = false
            activePointerId = -1
        }

        const settle = () => {
            releasePullCapture()
            pressed = false
            gestureAxisRef.current = null
            const py = dragYRef.current
            if (py < PULL_CLOSE_PX) {
                dragYRef.current = 0
                setDragY(0)
            } else {
                dragYRef.current = 0
                setDragY(0)
                onClose()
            }
        }

        const onDown = (e: PointerEvent) => {
            if (e.pointerType === "mouse" && e.button !== 0) return
            pressed = true
            pullCaptureActive = false
            activePointerId = e.pointerId
            gestureAxisRef.current = null
            startX = e.clientX
            startY = e.clientY
            lastY = e.clientY
            lastX = e.clientX
        }

        const onMove = (e: PointerEvent) => {
            if (!pressed) return
            let axis = gestureAxisRef.current
            if (axis === "x") return

            const totalDx = e.clientX - startX
            const totalDy = e.clientY - startY
            const adx = Math.abs(totalDx)
            const ady = Math.abs(totalDy)

            if (axis === null) {
                if (adx < GESTURE_MIN && ady < GESTURE_MIN) return
                if (adx > ady * AXIS_RATIO) {
                    gestureAxisRef.current = "x"
                    return
                }
                if (ady > adx * AXIS_RATIO) {
                    gestureAxisRef.current = "y"
                } else if (Math.max(adx, ady) >= 22) {
                    gestureAxisRef.current = adx >= ady ? "x" : "y"
                } else {
                    return
                }
                axis = gestureAxisRef.current
                if (axis === "x") return
            }

            const dy = e.clientY - lastY
            const dx = e.clientX - lastX
            lastY = e.clientY
            lastX = e.clientX

            setDragY((py) => {
                const sc = scrollEl()
                const atTop = sc != null && sc.scrollTop <= 1
                const pulling =
                    py > 0 || (atTop && dy > 0 && dy >= Math.abs(dx))
                if (!pulling) return py
                if (!pullCaptureActive) {
                    try {
                        sheet.setPointerCapture(e.pointerId)
                        pullCaptureActive = true
                        activePointerId = e.pointerId
                    } catch {
                        /* */
                    }
                }
                const next = Math.max(0, py + dy)
                dragYRef.current = next
                return next
            })

            if (e.pointerType === "touch" && e.cancelable) e.preventDefault()
        }

        const onTouchMove = (e: TouchEvent) => {
            if (dragYRef.current > 2 && e.cancelable) e.preventDefault()
        }

        sheet.addEventListener("pointerdown", onDown)
        sheet.addEventListener("pointermove", onMove)
        sheet.addEventListener("pointerup", settle)
        sheet.addEventListener("pointercancel", settle)
        sheet.addEventListener("touchmove", onTouchMove, { passive: false })
        return () => {
            releasePullCapture()
            sheet.removeEventListener("pointerdown", onDown)
            sheet.removeEventListener("pointermove", onMove)
            sheet.removeEventListener("pointerup", settle)
            sheet.removeEventListener("pointercancel", settle)
            sheet.removeEventListener("touchmove", onTouchMove)
        }
    }, [isMobile, visible, entered, onClose])

    const onBackdropTransitionEnd = useCallback(
        (e: TransitionEvent<HTMLDivElement>) => {
            if (e.propertyName !== "opacity") return
            if (!open) setVisible(false)
        },
        [open]
    )

    if (!visible) return null

    const backdropOpacity = entered ? 1 : 0
    const mobileTransform = entered
        ? `translateY(${dragY}px) scale(1)`
        : "translateY(100%) scale(0)"
    const desktopTransform = entered
        ? "scale(1)"
        : "scale(0.95)"
    const desktopOpacity = entered ? 1 : 0
    const mobileOpacity = entered ? 1 : 0

    return (
        <div
            role="presentation"
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 30000,
                display: "flex",
                alignItems: isMobile ? "flex-end" : "center",
                justifyContent: "center",
                pointerEvents: "auto",
                fontFamily: "var(--font-ui)",
                ...(isMobile ? { overscrollBehavior: "none" as const } : {}),
            }}
        >
            <div
                aria-hidden
                style={{
                    position: "absolute",
                    inset: 0,
                    background: "var(--overlay-black)",
                    opacity: backdropOpacity,
                    transition: "opacity 0.2s ease",
                }}
                onClick={onClose}
                onTransitionEnd={onBackdropTransitionEnd}
            />
            <div
                ref={sheetShellRef}
                className="SettingsOverlay"
                role="dialog"
                aria-modal
                aria-labelledby="you-settings-title"
                style={{
                    position: "relative",
                    zIndex: 1,
                    /* Sheet box matches web.tsx SETTINGS OVERLAY → ModalSheet `sheetStyle`:
                     * flex / width / height / maxWidth / maxHeight (desktop: height 100%, maxHeight 600, maxWidth 400, flex 1 1 0; mobile: height calc(100%-16px), width 100%, flex none). */
                    width: isMobile ? "100%" : undefined,
                    maxWidth: isMobile ? "none" : 400,
                    height: isMobile ? "calc(100% - 16px)" : "100%",
                    maxHeight: isMobile ? "none" : 600,
                    flex: isMobile ? "none" : "1 1 0",
                    /* Lets flex children shrink so overflow scroll matches ModalSheet inner column */
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    transformOrigin: isMobile ? "bottom center" : "center",
                    transform: isMobile ? mobileTransform : desktopTransform,
                    opacity: isMobile ? mobileOpacity : desktopOpacity,
                    transition: isMobile
                        ? "transform 0.25s ease-in-out, opacity 0.25s ease-in-out"
                        : "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    boxSizing: "border-box",
                    outline: "0.33px solid var(--hover-strong)",
                    outlineOffset: -0.33,
                    boxShadow: "0px 4px 24px hsla(0, 0%, 0%, 0.04)",
                    borderRadius: isMobile ? "24px 24px 0 0" : 48,
                    justifyContent: "flex-start",
                    alignItems: "flex-start",
                    background: "var(--bg)",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div
                    data-layer="settings header"
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        padding: isMobile ? 16 : 28,
                        paddingBottom: 32,
                        background:
                            "linear-gradient(180deg, var(--bg) 72%, transparent 100%)",
                        flexDirection: "column",
                        justifyContent: "center",
                        alignItems: "flex-start",
                        gap: 8,
                        display: "flex",
                        zIndex: 2,
                        pointerEvents: "none",
                    }}
                >
                    <h2
                        id="you-settings-title"
                        style={{
                            margin: 0,
                            padding: 0,
                            alignSelf: "stretch",
                            color: "var(--text-primary)",
                            fontSize: 16,
                            fontFamily: "Inter, sans-serif",
                            fontWeight: 400,
                            lineHeight: "16px",
                            wordWrap: "break-word",
                        }}
                    >
                        Your profile
                    </h2>
                    <div
                        style={{
                            alignSelf: "stretch",
                            color: "var(--text-secondary)",
                            fontSize: 12,
                            fontFamily: "Inter, sans-serif",
                            fontWeight: 400,
                            lineHeight: "16.8px",
                            wordWrap: "break-word",
                        }}
                    >
                        Share information about yourself to make chats more
                        relevant and personal.
                    </div>
                    <div
                        role="button"
                        tabIndex={0}
                        aria-label="Close settings"
                        onClick={onClose}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                onClose()
                            }
                        }}
                        onMouseEnter={() =>
                            !isMobile && setCloseHover(true)
                        }
                        onMouseLeave={() => setCloseHover(false)}
                        style={{
                            position: "absolute",
                            top: 14,
                            right: isMobile ? 8 : 16,
                            cursor: "pointer",
                            width: 36,
                            height: 36,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: closeHover
                                ? "var(--hover-default)"
                                : "transparent",
                            borderRadius: "50%",
                            transition: "background 0.2s",
                            pointerEvents: "auto",
                        }}
                    >
                        <svg
                            width="36"
                            height="36"
                            viewBox="0 0 36 36"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            aria-hidden
                            style={{
                                display: "block",
                                flexShrink: 0,
                            }}
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
                    </div>
                </div>

                <div
                    className="you-settings-scroll"
                    data-pull-scroll={isMobile ? "1" : undefined}
                    style={{
                        width: "100%",
                        flex: "1 1 0",
                        minHeight: 0,
                        overflowY: "auto",
                        overflowX: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        gap: 24,
                        paddingTop: 112,
                        paddingBottom: 28,
                        paddingLeft: isMobile ? 16 : 28,
                        paddingRight: isMobile ? 16 : 28,
                        boxSizing: "border-box",
                    }}
                >
                    <style>{`
            .you-settings-scroll::-webkit-scrollbar { display: none; }
            .you-settings-input::placeholder { color: var(--text-secondary); opacity: 1; }
          `}</style>

                    <Field label="Name">
                        <div
                            style={{
                                height: 44,
                                padding: "0 16px",
                                background: "var(--bg)",
                                border: "0.33px solid var(--border-subtle)",
                                borderRadius: 28,
                                display: "flex",
                                alignItems: "center",
                            }}
                        >
                            <input
                                className="you-settings-input"
                                type="text"
                                aria-label="Your name or nickname"
                                placeholder="Add a nickname"
                                value={profile.name}
                                onChange={(e) =>
                                    setProfile((p) => ({
                                        ...p,
                                        name: e.target.value,
                                    }))
                                }
                                style={{
                                    width: "100%",
                                    border: "none",
                                    background: "transparent",
                                    color: "var(--text-primary)",
                                    fontSize: inputFontPx,
                                    outline: "none",
                                    fontFamily: "Inter, sans-serif",
                                }}
                            />
                        </div>
                    </Field>

                    <Field label="Job title">
                        <div
                            style={{
                                minHeight: 44,
                                maxHeight: JOB_TITLE_MAX_PX,
                                background: "var(--bg)",
                                border: "0.33px solid var(--border-subtle)",
                                borderRadius: 28,
                                overflow: "hidden",
                                display: "flex",
                                alignItems: "flex-start",
                            }}
                        >
                            <textarea
                                ref={jobTitleRef}
                                className="you-settings-input"
                                aria-label="Your job title"
                                placeholder="Add your role"
                                rows={1}
                                value={profile.jobTitle}
                                onChange={(e) =>
                                    setProfile((p) => ({
                                        ...p,
                                        jobTitle: e.target.value,
                                    }))
                                }
                                style={{
                                    width: "100%",
                                    minHeight: 44,
                                    maxHeight: JOB_TITLE_MAX_PX,
                                    padding: "12px 16px",
                                    border: "none",
                                    background: "transparent",
                                    color: "var(--text-primary)",
                                    fontSize: inputFontPx,
                                    lineHeight: 1.35,
                                    outline: "none",
                                    resize: "none",
                                    fontFamily: "Inter, sans-serif",
                                    boxSizing: "border-box",
                                    margin: 0,
                                    verticalAlign: "top",
                                }}
                            />
                        </div>
                    </Field>

                    <Field label="Your favorite things">
                        <div
                            style={{
                                minHeight: 128,
                                maxHeight: 172,
                                background: "var(--bg)",
                                border: "0.33px solid var(--border-subtle)",
                                borderRadius: 28,
                                overflow: "hidden",
                            }}
                        >
                            <textarea
                                className="you-settings-input"
                                aria-label="Your skills and interests"
                                placeholder="Add skills, interests, and hobbies"
                                value={profile.favoriteThings}
                                onChange={onInterestsChange}
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    minHeight: 128,
                                    maxHeight: 172,
                                    padding: "12px 16px",
                                    boxSizing: "border-box",
                                    border: "none",
                                    background: "transparent",
                                    color: "var(--text-primary)",
                                    fontSize: inputFontPx,
                                    outline: "none",
                                    resize: "none",
                                    fontFamily: "Inter, sans-serif",
                                }}
                            />
                        </div>
                    </Field>
                </div>
            </div>
        </div>
    )
}

function Field({
    label,
    children,
}: {
    label: string
    children: ReactNode
}) {
    return (
        <div
            style={{
                alignSelf: "stretch",
                display: "flex",
                flexDirection: "column",
                gap: 8,
            }}
        >
            <div
                style={{
                    color: "var(--text-primary)",
                    fontSize: 14,
                    fontFamily: "Inter, sans-serif",
                    fontWeight: 400,
                }}
            >
                {label}
            </div>
            {children}
        </div>
    )
}
