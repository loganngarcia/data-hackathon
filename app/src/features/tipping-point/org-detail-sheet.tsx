"use client";

import type { ReactNode, TransitionEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

const EXIT_MS = 300;
/** Pull-to-dismiss — matches `YouSettingsOverlay` / web.tsx settings sheet. */
const PULL_CLOSE_PX = 88;
/** Horizontal swipe commits to prev/next org (aligned with web.tsx job carousel). */
const SWIPE_NAV_PX = 72;

/** @deprecated Use `ORG_RAIL_DEFAULT_PX` from `./org-rail-context` — kept for imports that expect this name. */
export { ORG_RAIL_DEFAULT_PX as ORG_DETAIL_DESKTOP_PANEL_WIDTH_PX } from "./org-rail-context";

/** Inner scroll padding so content can clear the fixed chat composer (sheet is full viewport height). */
const MOBILE_SCROLL_CLEAR_CHAT_PX = 100;

type OrgDetailSheetProps = {
  open: boolean;
  onClose: () => void;
  /** Top-right actions (e.g. share + close), same rhythm as web.tsx `JobDetailPanel` toolbar. */
  toolbar: ReactNode;
  children: ReactNode;
  /** Swipe right / ArrowLeft — previous org in portfolio list (mobile + optional desktop trackpad). */
  onSwipePrev?: () => void;
  /** Swipe left / ArrowRight — next org. */
  onSwipeNext?: () => void;
  swipePrevEnabled?: boolean;
  swipeNextEnabled?: boolean;
};

/**
 * Org profile as a sheet / side panel — open/close + swipe-down dismiss on mobile
 * aligned with `YouSettingsOverlay` and web.tsx job detail motion.
 */
/** Mobile bottom sheet only — desktop uses `OrgDetailDesktopRail` + `--org-rail-width` push layout. */
export function OrgDetailSheet({
  open,
  onClose,
  toolbar,
  children,
  onSwipePrev,
  onSwipeNext,
  swipePrevEnabled = false,
  swipeNextEnabled = false,
}: OrgDetailSheetProps) {
  const [visible, setVisible] = useState(open);
  const [entered, setEntered] = useState(false);
  const [dragY, setDragY] = useState(0);
  const dragYRef = useRef(0);
  const sheetShellRef = useRef<HTMLDivElement>(null);
  const gestureAxisRef = useRef<null | "x" | "y">(null);

  useEffect(() => {
    if (open) {
      setVisible(true);
      setDragY(0);
      dragYRef.current = 0;
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)));
      return () => cancelAnimationFrame(id);
    }
    setEntered(false);
    setDragY(0);
    dragYRef.current = 0;
    const t = window.setTimeout(() => setVisible(false), EXIT_MS);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [visible]);

  useEffect(() => {
    if (!open || !entered) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, entered, onClose]);

  useEffect(() => {
    if (!visible || !entered) return;
    const sheet = sheetShellRef.current;
    if (!sheet) return;

    let lastY = 0;
    let lastX = 0;
    let startX = 0;
    let startY = 0;
    let pressed = false;
    let activePointerId = -1;
    let pullCaptureActive = false;
    const GESTURE_MIN = 10;
    const AXIS_RATIO = 1.35;

    const scrollEl = () => sheet.querySelector("[data-pull-scroll]") as HTMLElement | null;

    const releasePullCapture = () => {
      if (!pullCaptureActive || activePointerId < 0) return;
      try {
        if (sheet.hasPointerCapture(activePointerId)) {
          sheet.releasePointerCapture(activePointerId);
        }
      } catch {
        /* */
      }
      pullCaptureActive = false;
      activePointerId = -1;
    };

    const settle = () => {
      releasePullCapture();
      const axis = gestureAxisRef.current;
      gestureAxisRef.current = null;
      pressed = false;

      if (axis === "x" && (onSwipePrev || onSwipeNext)) {
        const dx = lastX - startX;
        if (dx > SWIPE_NAV_PX && swipePrevEnabled && onSwipePrev) {
          onSwipePrev();
          return;
        }
        if (dx < -SWIPE_NAV_PX && swipeNextEnabled && onSwipeNext) {
          onSwipeNext();
          return;
        }
        return;
      }

      if (axis !== "y") return;

      const py = dragYRef.current;
      if (py < PULL_CLOSE_PX) {
        dragYRef.current = 0;
        setDragY(0);
      } else {
        dragYRef.current = 0;
        setDragY(0);
        onClose();
      }
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      pressed = true;
      startX = e.clientX;
      startY = e.clientY;
      lastX = e.clientX;
      lastY = e.clientY;
      gestureAxisRef.current = null;
    };

    const onMove = (e: PointerEvent) => {
      if (!pressed) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      if (gestureAxisRef.current === null) {
        const ax = Math.abs(e.clientX - startX);
        const ay = Math.abs(e.clientY - startY);
        if (ax < GESTURE_MIN && ay < GESTURE_MIN) return;
        const sc = scrollEl();
        const scrolled = Boolean(sc && sc.scrollTop > 2);
        if (scrolled) {
          if (ax > ay * AXIS_RATIO) gestureAxisRef.current = "x";
        } else if (ay > ax * AXIS_RATIO) {
          gestureAxisRef.current = "y";
        } else {
          gestureAxisRef.current = "x";
        }
      }

      if (gestureAxisRef.current !== "y") {
        if (gestureAxisRef.current === "x" && e.pointerType === "touch" && e.cancelable) e.preventDefault();
        return;
      }

      const sc = scrollEl();
      if (sc && sc.scrollTop > 0 && dy < 0) return;

      if (dy > 0) {
        if (!pullCaptureActive && e.pointerId != null) {
          try {
            sheet.setPointerCapture(e.pointerId);
            pullCaptureActive = true;
            activePointerId = e.pointerId;
          } catch {
            /* */
          }
        }
        const py = dragYRef.current + dy;
        dragYRef.current = py;
        setDragY(py);
      }

      if (e.pointerType === "touch" && e.cancelable) e.preventDefault();
    };

    const onTouchMove = (e: TouchEvent) => {
      if (dragYRef.current > 2 && e.cancelable) e.preventDefault();
    };

    sheet.addEventListener("pointerdown", onDown);
    sheet.addEventListener("pointermove", onMove);
    sheet.addEventListener("pointerup", settle);
    sheet.addEventListener("pointercancel", settle);
    sheet.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      releasePullCapture();
      sheet.removeEventListener("pointerdown", onDown);
      sheet.removeEventListener("pointermove", onMove);
      sheet.removeEventListener("pointerup", settle);
      sheet.removeEventListener("pointercancel", settle);
      sheet.removeEventListener("touchmove", onTouchMove);
    };
  }, [
    visible,
    entered,
    onClose,
    onSwipePrev,
    onSwipeNext,
    swipePrevEnabled,
    swipeNextEnabled,
  ]);

  const onBackdropTransitionEnd = useCallback(
    (e: TransitionEvent<HTMLDivElement>) => {
      if (e.propertyName !== "opacity") return;
      if (!open) setVisible(false);
    },
    [open],
  );

  if (!visible) return null;

  const backdropOpacity = entered ? 1 : 0;

  const mobileTransform = entered ? `translateY(${dragY}px) scale(1)` : "translateY(100%) scale(0.99)";
  const mobileOpacity = entered ? 1 : 0;

  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 4500,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        pointerEvents: "auto",
        fontFamily: "var(--font-ui)",
        overscrollBehavior: "none",
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
        role="dialog"
        aria-modal
        aria-label="Organization details"
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          height: "100dvh",
          maxHeight: "100dvh",
          marginBottom: 0,
          flex: "none",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          transformOrigin: "bottom center",
          transform: mobileTransform,
          opacity: mobileOpacity,
          transition: "transform 0.25s ease-in-out, opacity 0.25s ease-in-out",
          boxSizing: "border-box",
          outline: "0.33px solid var(--border-subtle)",
          outlineOffset: -0.33,
          boxShadow: "0px 8px 32px hsla(0, 0%, 0%, 0.12)",
          borderRadius: "28px 28px 0 0",
          background: "var(--bg)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            right: 8,
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "flex-start",
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          <div style={{ pointerEvents: "auto" }}>{toolbar}</div>
        </div>
        <div
          data-pull-scroll
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            padding: `52px 16px calc(${MOBILE_SCROLL_CLEAR_CHAT_PX}px + env(safe-area-inset-bottom, 0px))`,
            WebkitOverflowScrolling: "touch",
            touchAction: "manipulation",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
