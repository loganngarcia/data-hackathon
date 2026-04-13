import { useCallback, useEffect, useState } from "react"
import { BrowserRouter, Route, Routes, useSearchParams } from "react-router-dom"
import { LEFT_SIDEBAR_W, LeftSidebar } from "./components/LeftSidebar"
import { YouSettingsOverlay } from "./components/YouSettingsOverlay"
import { ChatSessionPage } from "./pages/ChatSessionPage"
import { HomePage } from "./pages/HomePage"

function AppRoutes() {
    const [searchParams, setSearchParams] = useSearchParams()
    const youSettingsOpen = searchParams.has("settings")
    const openYouSettings = useCallback(() => {
        setSearchParams(
            (prev) => {
                const n = new URLSearchParams(prev)
                n.set("settings", "")
                return n
            },
            { replace: false }
        )
    }, [setSearchParams])
    const closeYouSettings = useCallback(() => {
        setSearchParams(
            (prev) => {
                const n = new URLSearchParams(prev)
                n.delete("settings")
                return n
            },
            { replace: true }
        )
    }, [setSearchParams])

    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const [isMobile, setIsMobile] = useState(false)
    const [openBtnHover, setOpenBtnHover] = useState(false)

    useEffect(() => {
        const mq = window.matchMedia("(max-width: 767px)")
        const update = () => {
            const m = mq.matches
            setIsMobile(m)
            if (m) setIsSidebarOpen(false)
        }
        update()
        mq.addEventListener("change", update)
        return () => mq.removeEventListener("change", update)
    }, [])

    const openSidebar = useCallback(() => setIsSidebarOpen(true), [])
    const closeSidebar = useCallback(() => setIsSidebarOpen(false), [])

    const padLeft = !isMobile && isSidebarOpen ? LEFT_SIDEBAR_W : 0

    return (
            <div
                className="app-shell"
                data-layer="main-app-container"
                style={{
                    background: "var(--bg)",
                    color: "var(--text-primary)",
                    transition: "var(--transition-theme)",
                }}
            >
                {!isSidebarOpen && (
                    <button
                        type="button"
                        data-layer="open sidebar (6% white fill on hover)"
                        className="open-sidebar-fab"
                        aria-label="Open navigation menu"
                        onClick={(e) => {
                            e.stopPropagation()
                            openSidebar()
                        }}
                        onMouseEnter={() => setOpenBtnHover(true)}
                        onMouseLeave={() => setOpenBtnHover(false)}
                        style={{
                            background: openBtnHover
                                ? "var(--hover-medium)"
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
                )}

                <LeftSidebar
                    isOpen={isSidebarOpen}
                    onClose={closeSidebar}
                    onOpenYou={() => {
                        openYouSettings()
                        if (isMobile) closeSidebar()
                    }}
                />

                <YouSettingsOverlay
                    open={youSettingsOpen}
                    isMobile={isMobile}
                    onClose={closeYouSettings}
                />

                <main
                    className="main-content-layout"
                    data-layer="main-content-layout"
                    aria-label="Main content area"
                    style={{
                        paddingLeft: padLeft,
                        transition:
                            "padding-left 0.35s cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                    onClick={() => {
                        if (isMobile && isSidebarOpen) closeSidebar()
                    }}
                >
                    <div className="main-scroll">
                        <Routes>
                            <Route
                                path="/"
                                element={<HomePage leftInset={padLeft} />}
                            />
                            <Route
                                path="/c/:chatId"
                                element={
                                    <ChatSessionPage
                                        leftInset={padLeft}
                                        isMobile={isMobile}
                                    />
                                }
                            />
                        </Routes>
                    </div>
                </main>

                <style>{`
        .app-shell {
          width: 100%;
          height: 100%;
          position: fixed;
          inset: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          font-family: var(--font-ui);
        }
        .open-sidebar-fab {
          left: 8px;
          top: 8px;
          position: absolute;
          z-index: 100;
          cursor: ew-resize;
          background: transparent;
          border-radius: 50%;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          padding: 0;
          transition: background 0.2s;
        }
        .main-content-layout {
          display: flex;
          width: 100%;
          height: 100%;
          overflow: hidden;
          overscroll-behavior: none;
        }
        .main-scroll {
          flex: 1;
          overflow: auto;
          overscroll-behavior: contain;
          padding-top: 24px;
          padding-bottom: calc(120px + env(safe-area-inset-bottom, 0px));
        }
        @media (max-width: 767px) {
          .main-scroll {
            padding-top: 48px;
          }
        }
      `}</style>
            </div>
    )
}

export default function App() {
    return (
        <BrowserRouter>
            <AppRoutes />
        </BrowserRouter>
    )
}
