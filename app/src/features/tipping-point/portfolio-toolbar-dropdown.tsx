"use client";

import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  clampPortfolioFloatingMenuRect,
  estimatePortfolioMenuHeight,
} from "./portfolio-floating-menu-rect";

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

type ToolbarDropdownProps<T extends string> = {
  /** e.g. `tp-portfolio-toolbar-picker tp-portfolio-employee-select-wrap` */
  wrapClassName: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  /** Visible button text */
  triggerLabel: string;
  /** `Employees filter: …` */
  ariaLabelPrefix: string;
  /** Spoken detail when menu closed, e.g. "all ranges" or "California" */
  ariaFilterDetail: string;
  /** When set, menu panel scrolls (state list). */
  menuMaxHeight?: string;
};

export function PortfolioToolbarDropdown<T extends string>(props: ToolbarDropdownProps<T>) {
  const {
    wrapClassName,
    options,
    value,
    onChange,
    triggerLabel,
    ariaLabelPrefix,
    ariaFilterDetail,
    menuMaxHeight,
  } = props;

  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const chipRef = useRef<HTMLButtonElement>(null);
  const [fixedPos, setFixedPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const measureChip = useCallback(() => {
    const el = chipRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const rawW = Math.max(r.width, menuMaxHeight ? 260 : 248);
    const estH = estimatePortfolioMenuHeight(options.length, menuMaxHeight);
    setFixedPos(clampPortfolioFloatingMenuRect(r, rawW, estH));
  }, [menuMaxHeight, options.length]);

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
    (id: T) => {
      onChange(id);
      setOpen(false);
    },
    [onChange],
  );

  const menuInnerStyle = useMemo(() => {
    const base: CSSProperties = {
      position: "fixed",
      zIndex: 20001,
      display: "flex",
      flexDirection: "column",
      justifyContent: "flex-start",
      alignItems: "stretch",
      gap: 4,
    };
    if (isMobile) {
      return {
        ...base,
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
        overflowY: "auto" as const,
      };
    }
    if (fixedPos) {
      const desktop: CSSProperties = {
        ...base,
        left: fixedPos.left,
        top: fixedPos.top,
        width: fixedPos.width,
        padding: 10,
        background: "var(--surface-menu)",
        boxShadow: "0px 4px 24px hsla(0, 0%, 0%, 0.08)",
        borderRadius: 28,
        outline: "0.1px solid var(--border-subtle)",
        outlineOffset: "-0.1px",
      };
      if (menuMaxHeight) {
        desktop.maxHeight = menuMaxHeight;
        desktop.overflowY = "auto";
        desktop.WebkitOverflowScrolling = "touch";
      }
      return desktop;
    }
    return base;
  }, [isMobile, fixedPos, menuMaxHeight]);

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
        <div data-layer="portfolio toolbar menu" onClick={(e) => e.stopPropagation()} style={menuInnerStyle}>
          {options.map((opt) => {
            const isSel = opt.id === value;
            return (
              <div
                key={String(opt.id)}
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
                  flexShrink: 0,
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
    <div className={wrapClassName}>
      <div className="tp-portfolio-toolbar-picker tp-panel-compare-peer-picker">
        <button
          ref={chipRef}
          type="button"
          className="tp-panel-compare-peer-trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`${ariaLabelPrefix}: ${ariaFilterDetail}. Open menu.`}
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

type ToolbarMultiDropdownProps<T extends string> = {
  wrapClassName: string;
  options: { id: T; label: string }[];
  /** Selected option ids (excluding `all`). Empty = “All” / no filter. */
  selectedIds: T[];
  onPick: (id: T) => void;
  triggerLabel: string;
  ariaLabelPrefix: string;
  ariaFilterDetail: string;
  menuMaxHeight?: string;
};

/** Multi-select: stays open until backdrop click; `all` id clears selection. */
export function PortfolioToolbarMultiDropdown<T extends string>(props: ToolbarMultiDropdownProps<T>) {
  const {
    wrapClassName,
    options,
    selectedIds,
    onPick,
    triggerLabel,
    ariaLabelPrefix,
    ariaFilterDetail,
    menuMaxHeight,
  } = props;

  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const chipRef = useRef<HTMLButtonElement>(null);
  const [fixedPos, setFixedPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const measureChip = useCallback(() => {
    const el = chipRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const rawW = Math.max(r.width, menuMaxHeight ? 260 : 248);
    const estH = estimatePortfolioMenuHeight(options.length, menuMaxHeight);
    setFixedPos(clampPortfolioFloatingMenuRect(r, rawW, estH));
  }, [menuMaxHeight, options.length]);

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

  const isAllMode = selectedIds.length === 0;

  const menuInnerStyle = useMemo(() => {
    const base: CSSProperties = {
      position: "fixed",
      zIndex: 20001,
      display: "flex",
      flexDirection: "column",
      justifyContent: "flex-start",
      alignItems: "stretch",
      gap: 4,
    };
    if (isMobile) {
      return {
        ...base,
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
        overflowY: "auto" as const,
      };
    }
    if (fixedPos) {
      const desktop: CSSProperties = {
        ...base,
        left: fixedPos.left,
        top: fixedPos.top,
        width: fixedPos.width,
        padding: 10,
        background: "var(--surface-menu)",
        boxShadow: "0px 4px 24px hsla(0, 0, 0%, 0.08)",
        borderRadius: 28,
        outline: "0.1px solid var(--border-subtle)",
        outlineOffset: "-0.1px",
      };
      if (menuMaxHeight) {
        desktop.maxHeight = menuMaxHeight;
        desktop.overflowY = "auto";
        desktop.WebkitOverflowScrolling = "touch";
      }
      return desktop;
    }
    return base;
  }, [isMobile, fixedPos, menuMaxHeight]);

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
        <div data-layer="portfolio toolbar menu" onClick={(e) => e.stopPropagation()} style={menuInnerStyle}>
          {options.map((opt) => {
            const isSel =
              String(opt.id) === "all" ? isAllMode : selectedIds.includes(opt.id);
            return (
              <div
                key={String(opt.id)}
                role="button"
                tabIndex={0}
                onClick={() => {
                  onPick(opt.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onPick(opt.id);
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
                  flexShrink: 0,
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
    <div className={wrapClassName}>
      <div className="tp-portfolio-toolbar-picker tp-panel-compare-peer-picker">
        <button
          ref={chipRef}
          type="button"
          className="tp-panel-compare-peer-trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`${ariaLabelPrefix}: ${ariaFilterDetail}. Open menu.`}
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
