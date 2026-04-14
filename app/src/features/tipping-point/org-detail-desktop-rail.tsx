"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ORG_RAIL_DEFAULT_PX,
  ORG_RAIL_MAX_PX,
  ORG_RAIL_MIN_PX,
  persistOrgRailWidth,
  useOrgRailOptional,
} from "./org-rail-context";

type Props = {
  open: boolean;
  onClose: () => void;
  toolbar: React.ReactNode;
  children: React.ReactNode;
};

/**
 * Fixed right rail (no dimming overlay) — main column is padded via `--org-rail-width`.
 * Left edge drag resizes width; matches web.tsx job-detail panel mechanics.
 */
export function OrgDetailDesktopRail({ open, onClose, toolbar, children }: Props) {
  const rail = useOrgRailOptional();
  const [entered, setEntered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, w: ORG_RAIL_DEFAULT_PX });

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)));
    return () => cancelAnimationFrame(id);
  }, [open]);

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

  const endDrag = useCallback(() => {
    if (!rail) return;
    setDragging(false);
    rail.setIsResizing(false);
    persistOrgRailWidth(rail.widthPx);
  }, [rail]);

  useEffect(() => {
    if (!dragging || !rail) return;
    const onMove = (e: PointerEvent) => {
      const dw = dragStart.current.x - e.clientX;
      const next = Math.min(ORG_RAIL_MAX_PX, Math.max(ORG_RAIL_MIN_PX, dragStart.current.w + dw));
      rail.setWidthPx(next);
    };
    const onUp = () => {
      endDrag();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging, rail, endDrag]);

  const onHandlePointerDown = (e: React.PointerEvent) => {
    if (!rail) return;
    e.preventDefault();
    dragStart.current = { x: e.clientX, w: rail.widthPx };
    setDragging(true);
    rail.setIsResizing(true);
  };

  if (!open || !rail) return null;

  const w = rail.widthPx;
  const panelTransform = entered ? "translateX(0)" : "translateX(100%)";

  return (
    <>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(w)}
        aria-valuemin={ORG_RAIL_MIN_PX}
        aria-valuemax={ORG_RAIL_MAX_PX}
        onPointerDown={onHandlePointerDown}
        className="tp-org-rail-resize-handle"
        style={{
          position: "fixed",
          right: w,
          top: 0,
          bottom: 0,
          width: 14,
          marginRight: -7,
          zIndex: 4600,
          cursor: "ew-resize",
          touchAction: "none",
        }}
      />
      <aside
        className="tp-org-detail-rail"
        aria-label="Organization details"
        style={{
          position: "fixed",
          right: 0,
          top: 0,
          bottom: 0,
          width: w,
          zIndex: 4599,
          display: "flex",
          flexDirection: "column",
          background: "var(--bg)",
          boxShadow: "-2px 0 24px 2px rgba(0,0,0,0.04)",
          boxSizing: "border-box",
          transform: panelTransform,
          transition: dragging ? "none" : "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
          willChange: dragging ? "width" : undefined,
        }}
      >
        <div
          style={{
            flexShrink: 0,
            padding: "12px 12px 0",
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "flex-start",
          }}
        >
          {toolbar}
        </div>
        <div
          data-pull-scroll
          className="tp-org-detail-rail-scroll"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "8px 20px 32px",
            WebkitOverflowScrolling: "touch",
            touchAction: "manipulation",
          }}
        >
          {children}
        </div>
      </aside>
    </>
  );
}
