"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PortfolioBucket } from "@/lib/portfolio-buckets";
import { portfolioBucketCounts } from "@/lib/portfolio-buckets";
import type { ScreenerRow } from "@/lib/types";

function ChevronDown({ open }: { open: boolean }) {
  return (
    <span
      className="tp-org-chip-chevron"
      aria-hidden
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        transform: open ? "rotate(180deg)" : "none",
        transition: "transform 0.15s ease",
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

function CheckEnd() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <path
        d="M3.5 8.5L6.5 11.5L12.5 4.5"
        stroke="var(--text-primary)"
        strokeOpacity="0.85"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const OPTIONS: { id: PortfolioBucket; label: (counts: ReturnType<typeof portfolioBucketCounts>) => string }[] =
  [
    { id: "all", label: (c) => `All (${c.total})` },
    { id: "at_risk", label: (c) => `At risk (${c.atRisk})` },
    { id: "thriving", label: (c) => `Thriving (${c.thriving})` },
  ];

type Props = {
  rows: ScreenerRow[];
  value: PortfolioBucket;
  onChange: (bucket: PortfolioBucket) => void;
};

export function PortfolioHomeFilter({ rows, value, onChange }: Props) {
  const counts = portfolioBucketCounts(rows);
  const selectedLabel = OPTIONS.find((o) => o.id === value)?.label(counts) ?? OPTIONS[0].label(counts);

  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const chipRef = useRef<HTMLButtonElement>(null);
  const [fixedPos, setFixedPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const measureChip = useCallback(() => {
    const el = chipRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setFixedPos({
      top: r.bottom + 4,
      left: r.left,
      width: Math.max(r.width, 248),
    });
  }, []);

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
    (bucket: PortfolioBucket) => {
      onChange(bucket);
      setOpen(false);
    },
    [onChange],
  );

  const menu =
    open && (isMobile || fixedPos) ? (
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
          data-layer="portfolio home filter menu"
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
          {OPTIONS.map((opt) => {
            const isSel = opt.id === value;
            const rowLabel = opt.label(counts);
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
                    color: "var(--text-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {rowLabel}
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
                  {isSel ? <CheckEnd /> : null}
                </div>
              </div>
            );
          })}
        </div>
      </>
    ) : null;

  return (
    <div className="tp-org-chip-wrap tp-portfolio-home-filter">
      <button
        ref={chipRef}
        type="button"
        className="tp-org-chip-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Portfolio filter: ${selectedLabel}. Open menu.`}
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          if (!chipRef.current) return;
          measureChip();
          setOpen(true);
        }}
      >
        <span className="tp-org-chip-label">{selectedLabel}</span>
        <ChevronDown open={open} />
      </button>
      {typeof document !== "undefined" && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
