"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** SF-style square.and.arrow.up — stroke matches `ChevronLeftIcon` in the org toolbar. */
function AppleShareIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M12 3v12M7 8l5-5 5 5"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M5 12l4 4L19 7"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Props = {
  /** Used as `title` for the native share sheet. */
  shareTitle: string;
  /** `icon` — compact circle control (web.tsx job detail toolbar). */
  mode?: "pill" | "icon";
};

/** Web Share on desktop often resolves without a visible sheet (or does nothing useful). Prefer clipboard there. */
function shouldOfferNativeShare(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const ch = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  if (ch && typeof ch.mobile === "boolean") return ch.mobile;
  if (/Android|iPhone|iPod/i.test(ua)) return true;
  if (/iPad|Tablet/i.test(ua)) return true;
  // iPadOS “desktop” Safari
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) return true;
  return false;
}

async function writeUrlToClipboard(url: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      /* fall through */
    }
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = url;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function OrgDetailShareButton({ shareTitle, mode = "pill" }: Props) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== undefined) clearTimeout(timeoutRef.current);
    };
  }, []);

  const showCopied = useCallback(() => {
    setCopied(true);
    if (timeoutRef.current !== undefined) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), 2200);
  }, []);

  const handleClick = useCallback(async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    const payload: ShareData = {
      title: shareTitle,
      text: `${shareTitle}`,
      url,
    };

    const tryCopy = async () => {
      const ok = await writeUrlToClipboard(url);
      if (ok) showCopied();
    };

    const canNativeShare =
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      shouldOfferNativeShare() &&
      (typeof navigator.canShare !== "function" || navigator.canShare(payload));

    if (canNativeShare) {
      try {
        await navigator.share(payload);
        return;
      } catch (e) {
        const name = (e as { name?: string }).name;
        if (name === "AbortError") return;
      }
    }

    await tryCopy();
  }, [shareTitle, showCopied]);

  if (mode === "icon") {
    return (
      <button
        type="button"
        className={`tp-org-panel-icon-btn${copied ? " tp-org-panel-icon-btn--success" : ""}`}
        onClick={() => void handleClick()}
        aria-label={copied ? "Link copied" : "Share"}
        aria-live="polite"
        dir="ltr"
        title="Share"
      >
        {copied ? <CheckIcon /> : <AppleShareIcon />}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`tp-detail-share-button${copied ? " tp-detail-share-button--copied" : ""}`}
      onClick={() => void handleClick()}
      aria-label={copied ? "Link copied" : "Share this page"}
      aria-live="polite"
      dir="ltr"
    >
      <span className="tp-detail-share-button-content">
        {copied ? (
          <>
            <span className="tp-detail-share-button-label">Copied</span>
            <span className="tp-detail-share-button-icon" aria-hidden>
              <CheckIcon />
            </span>
          </>
        ) : (
          <>
            <span className="tp-detail-share-button-label">Share</span>
            <span className="tp-detail-share-button-icon" aria-hidden>
              <AppleShareIcon />
            </span>
          </>
        )}
      </span>
    </button>
  );
}
