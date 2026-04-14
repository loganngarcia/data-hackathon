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
};

export function OrgDetailShareButton({ shareTitle }: Props) {
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
    timeoutRef.current = setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleClick = useCallback(async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    const payload: ShareData = {
      title: shareTitle,
      text: `${shareTitle}`,
      url,
    };

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share(payload);
        return;
      } catch (e) {
        const name = (e as { name?: string }).name;
        if (name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      showCopied();
    } catch {
      /* ignore */
    }
  }, [shareTitle, showCopied]);

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
