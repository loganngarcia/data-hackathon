"use client";

import { OrgDetailShareButton } from "./org-detail-share-button";

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type OrgDetailPanelToolbarProps = {
  shareTitle: string;
  onClose: () => void;
};

/** Share + close — matches web.tsx `JobDetailPanel` / `HeaderActions` cluster. */
export function OrgDetailPanelToolbar({ shareTitle, onClose }: OrgDetailPanelToolbarProps) {
  return (
    <div className="tp-org-panel-tool-row" role="toolbar" aria-label="Organization actions">
      <OrgDetailShareButton shareTitle={shareTitle} mode="icon" />
      <button type="button" className="tp-org-panel-icon-btn" aria-label="Close" title="Close" onClick={onClose}>
        <CloseIcon />
      </button>
    </div>
  );
}
