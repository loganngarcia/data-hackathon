"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LEFT_SIDEBAR_W, LeftSidebar } from "./components/LeftSidebar";
import { YouSettingsOverlay } from "./components/YouSettingsOverlay";
import { DashboardShellContext } from "./shell-context";

const LEFT_SIDEBAR_OPEN_KEY = "dashboard-left-sidebar-open";

function readSidebarPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = localStorage.getItem(LEFT_SIDEBAR_OPEN_KEY);
    if (v === "true") return true;
    if (v === "false") return false;
  } catch {
    /* ignore */
  }
  return false;
}

function persistSidebarPreference(open: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (window.matchMedia("(max-width: 767px)").matches) return;
    localStorage.setItem(LEFT_SIDEBAR_OPEN_KEY, open ? "true" : "false");
  } catch {
    /* ignore */
  }
}

function ShellChrome({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const youSettingsOpen = searchParams.has("settings");
  const openYouSettings = useCallback(() => {
    const n = new URLSearchParams(searchParams.toString());
    n.set("settings", "");
    const q = n.toString();
    router.push(q ? `${pathname}?${q}` : `${pathname}?`);
  }, [pathname, router, searchParams]);

  const closeYouSettings = useCallback(() => {
    const n = new URLSearchParams(searchParams.toString());
    n.delete("settings");
    const q = n.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [openBtnHover, setOpenBtnHover] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => {
      const m = mq.matches;
      setIsMobile(m);
      if (m) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(readSidebarPreference());
      }
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const openSidebar = useCallback(() => {
    setIsSidebarOpen(true);
    persistSidebarPreference(true);
  }, []);

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false);
    persistSidebarPreference(false);
  }, []);

  const padLeft = !isMobile && isSidebarOpen ? LEFT_SIDEBAR_W : 0;

  return (
    <DashboardShellContext.Provider value={{ padLeft, isMobile }}>
      <div
        className="dashboard-app-root app-shell"
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
              e.stopPropagation();
              openSidebar();
            }}
            onMouseEnter={() => setOpenBtnHover(true)}
            onMouseLeave={() => setOpenBtnHover(false)}
            style={{
              background: openBtnHover ? "var(--hover-medium)" : "transparent",
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
            openYouSettings();
            if (isMobile) closeSidebar();
          }}
        />

        <YouSettingsOverlay open={youSettingsOpen} isMobile={isMobile} onClose={closeYouSettings} />

        <main
          className="main-content-layout"
          data-layer="main-content-layout"
          aria-label="Main content area"
          style={{
            paddingLeft: padLeft,
            transition: "padding-left 0.35s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
          onClick={() => {
            if (isMobile && isSidebarOpen) closeSidebar();
          }}
        >
          <div className="main-scroll">{children}</div>
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
    </DashboardShellContext.Provider>
  );
}

export function DashboardAppShell({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div
          className="dashboard-app-root app-shell"
          style={{ background: "var(--bg)", minHeight: "100%", width: "100%" }}
        />
      }
    >
      <ShellChrome>{children}</ShellChrome>
    </Suspense>
  );
}
