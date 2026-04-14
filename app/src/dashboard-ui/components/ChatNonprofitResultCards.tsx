"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { OrgLogoAvatar } from "@/features/tipping-point/org-logo-avatar";
import { PortfolioOrgCardMeta } from "@/features/tipping-point/portfolio-org-card-meta";
import type { NonprofitSearchCard } from "@/lib/nonprofit-chat-cards";
import { websiteUrlToDomain } from "@/lib/website-url";

const PAGE_SIZE = 6;

function cardHasFullMeta(
  c: NonprofitSearchCard,
): c is NonprofitSearchCard & {
  city: string;
  state: string;
  reserveMonths: number;
  netAssetsEoy: number;
} {
  return (
    typeof c.reserveMonths === "number" &&
    typeof c.netAssetsEoy === "number" &&
    typeof c.city === "string" &&
    typeof c.state === "string"
  );
}

export function ChatNonprofitResultCards({
  cards,
  chatReturnPath,
}: {
  cards: NonprofitSearchCard[];
  /** When set (e.g. `/c/<chatId>`), org links preserve `returnChat` so Back returns to the session. */
  chatReturnPath?: string;
}) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const total = cards.length;
  const shown = useMemo(() => cards.slice(0, Math.min(visibleCount, total)), [cards, visibleCount, total]);
  const canShowMore = visibleCount < total;

  return (
    <div className="tp-portfolio-home-list chat-nonprofit-result-cards" style={{ alignSelf: "stretch", width: "100%" }}>
      {shown.map((c) => {
        const hasMeta = cardHasFullMeta(c);
        const orgHref =
          chatReturnPath != null && chatReturnPath.startsWith("/c/")
            ? `/?org=${encodeURIComponent(c.orgId)}&returnChat=${encodeURIComponent(chatReturnPath)}`
            : `/?org=${encodeURIComponent(c.orgId)}`;
        return (
          <Link key={c.orgId} href={orgHref} scroll={false} className="tp-portfolio-list-card">
            <OrgLogoAvatar
              organizationName={c.title}
              websiteDomain={websiteUrlToDomain(c.websiteUrl)}
              cachedLogoDomain={c.logoDomain}
              logoImageUrl={c.logoImageUrl}
            />
            <div className="tp-people-text tp-portfolio-list-text">
              <p className="tp-people-name">{c.title}</p>
              {c.missionSnippet ? (
                <p className="chat-nonprofit-mission-snippet" title={c.missionSnippet}>
                  {c.missionSnippet}
                </p>
              ) : null}
              {hasMeta ? (
                <PortfolioOrgCardMeta
                  row={{
                    city: c.city,
                    state: c.state,
                    reserveMonths: c.reserveMonths,
                    netAssetsEoy: c.netAssetsEoy,
                    boardMemberCount: c.boardMemberCount,
                  }}
                />
              ) : c.subtitle ? (
                <p className="tp-people-role">{c.subtitle}</p>
              ) : (
                <p className="tp-people-role">
                  {[c.city, c.state].filter(Boolean).join(", ") || "—"}
                </p>
              )}
            </div>
          </Link>
        );
      })}
      {canShowMore ? (
        <button
          type="button"
          className="chat-nonprofit-show-more"
          onClick={() => setVisibleCount((n) => Math.min(n + PAGE_SIZE, total))}
        >
          Show more
        </button>
      ) : null}
    </div>
  );
}
