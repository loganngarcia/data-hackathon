"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PortfolioBucket, PortfolioBucketCounts } from "@/lib/portfolio-buckets";
import type { ScreenerRow } from "@/lib/types";
import {
  clampPortfolioFloatingMenuRect,
  estimatePortfolioMenuHeight,
} from "./portfolio-floating-menu-rect";

type Props = {
  rows: ScreenerRow[];
  value: PortfolioBucket;
  onChange: (bucket: PortfolioBucket) => void;
  /** Reserved for API compatibility; counts are not shown in the UI. */
  aggregateCounts?: PortfolioBucketCounts | null;
};

const BUCKETS: PortfolioBucket[] = ["all", "at_risk", "thriving"];

function optionLabel(id: PortfolioBucket): string {
  if (id === "all") return "All";
  if (id === "at_risk") return "At risk";
  return "Thriving";
}

/** Same chevron as `MetricsComparePeerPicker` / `web.tsx` menus (static; open state is via `aria-expanded`). */
function ChevronDown() {
  return (
    <span
      aria-hidden
      className="tp-panel-compare-peer-chevron"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M0.601562 0.600006L4.60156 4.60001L8.60156 0.600006"
          stroke="var(--text-secondary)"
          strokeOpacity="1"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/** Trailing check from `web.tsx` ConversationActions (`trailingCheck`). */
function WebTrailingCheck() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <path
        d="M1 6L4.5 9.5L11 2"
        stroke="var(--semantic-accent)"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Portfolio segment filter — same floating menu pattern as `web.tsx` ConversationActions
 * (surface menu, row hover, accent + trailing check for the active option).
 */
export function PortfolioHomeFilter(props: Props) {
  const { value, onChange } = props;

  const options = useMemo(() => BUCKETS.map((id) => ({ id, label: optionLabel(id) })), []);

  const selectedLabel = options.find((o) => o.id === value)?.label ?? options[0]?.label ?? "";
  /** When showing the whole portfolio (`all`), the chip reads "Risk level" so it matches the toolbar category; dropdown still lists "All". */
  const triggerLabel = value === "all" ? "Risk level" : selectedLabel;

  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const chipRef = useRef<HTMLButtonElement>(null);
  const [fixedPos, setFixedPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const measureChip = useCallback(() => {
    const el = chipRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const rawW = Math.max(r.width, 248);
    const estH = estimatePortfolioMenuHeight(options.length, undefined);
    setFixedPos(clampPortfolioFloatingMenuRect(r, rawW, estH));
  }, [options.length]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const q = () => setIsMobile(mq.matches);
    q();
    mq.addEventListener("change", q);
    return () => mq.removeEventListener("change", q);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    measureChip();
    window.addEventListener("scroll", measureChip, true);
    window.addEventListener("resize", measureChip);
    return () => {
      window.removeEventListener("scroll", measureChip, true);
      window.removeEventListener("resize", measureChip);
    };
  }, [open, measureChip]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const pick = useCallback(
    (id: PortfolioBucket) => {
      onChange(id);
      setOpen(false);
    },
    [onChange],
  );

  const menu =
    open && (isMobile || fixedPos) && options.length > 0 ? (
      <>
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 20000,
            cursor: "default",
            background: isMobile ? "var(--overlay-black)" : "transparent",
          }}
          onClick={() => setOpen(false)}
        />
        <div
          data-layer="portfolio bucket menu"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            zIndex: 20001,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            alignItems: "stretch",
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
                  borderRadius: "36px 36px 0 0",
                  outline: "0.1px solid var(--border-subtle)",
                  outlineOffset: "-0.1px",
                  maxHeight: "min(70vh, 360px)",
                  overflowY: "auto",
                }
              : fixedPos
                ? {
                    left: fixedPos.left,
                    top: fixedPos.top,
                    width: fixedPos.width,
                    padding: 10,
                    background: "var(--surface-menu)",
                    boxShadow: "0px 4px 24px hsla(0, 0%, 0%, 0.08)",
                    borderRadius: 28,
                    outline: "0.1px solid var(--border-subtle)",
                    outlineOffset: "-0.1px",
                  }
                : {}),
          }}
        >
          {options.map((opt) => {
            const isSel = opt.id === value;
            return (
              <div
                key={opt.id}
                role="button"
                tabIndex={0}
                onClick={() => pick(opt.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    pick(opt.id);
                  }
                }}
                style={{
                  alignSelf: "stretch",
                  minHeight: isMobile ? 44 : 36,
                  paddingLeft: 12,
                  paddingRight: 12,
                  borderRadius: 28,
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  display: "flex",
                  cursor: "pointer",
                  transition: "background 0.15s ease",
                  background: "transparent",
                }}
                onMouseEnter={(e) => {
                  if (!isMobile) (e.currentTarget as HTMLDivElement).style.background = "var(--hover-default)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "transparent";
                }}
              >
                <span
                  style={{
                    flex: "1 1 0",
                    minWidth: 0,
                    fontSize: 14,
                    fontFamily: "var(--font-ui)",
                    fontWeight: 400,
                    lineHeight: "19.32px",
                    color: isSel ? "var(--semantic-accent)" : "var(--text-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {opt.label}
                </span>
                <div
                  style={{
                    width: 22,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    flexShrink: 0,
                  }}
                >
                  {isSel ? <WebTrailingCheck /> : null}
                </div>
              </div>
            );
          })}
        </div>
      </>
    ) : null;

  return (
    <div className="tp-portfolio-bucket-select-wrap">
      <div className="tp-portfolio-bucket-picker tp-panel-compare-peer-picker">
        <button
          ref={chipRef}
          type="button"
          className="tp-panel-compare-peer-trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Portfolio filter: ${triggerLabel}. Open menu.`}
          onClick={() => {
            if (open) {
              setOpen(false);
              return;
            }
            if (!chipRef.current || options.length === 0) return;
            measureChip();
            setOpen(true);
          }}
        >
          <span className="tp-panel-compare-peer-trigger-label">{triggerLabel}</span>
          <ChevronDown />
        </button>
      </div>
      {typeof document !== "undefined" && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
