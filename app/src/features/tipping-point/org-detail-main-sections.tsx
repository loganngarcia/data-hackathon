"use client";

import Link from "next/link";
import { Fragment } from "react";
import {
  formatBenchmarkValue,
  formatReserveCoverage,
  reserveCoverageIsLow,
  formatSignedPercent,
  formatUsdFull,
  screenScoreToneClasses,
} from "@/lib/format-display";
import type { OrgDetail, OrgPerson990, ScreenerRow } from "@/lib/types";
import { METRICS_COMPARE_MEDIAN, MetricsComparePeerPicker } from "./metrics-compare-peer-picker";
import { OrgLogoAvatar } from "./org-logo-avatar";
import { websiteUrlToDomain } from "@/lib/website-url";
import { OrgPeopleSection } from "./org-people-section";
import { OrgMissionSummary } from "./org-mission-summary";
import { OrgDetailMetaChips } from "./org-detail-meta-chips";
import { RevenueHistoryChart } from "./revenue-history-chart";
import { sanitizeScenarioNarrative } from "@/lib/org-recommendations-sanitize";
import type { OrgRecommendationsAiResponse } from "@/lib/org-recommendations-types";
import {
  PortfolioOrgCardMeta,
  type PortfolioCardMetaFilterContext,
} from "./portfolio-org-card-meta";

export type OrgDetailMainSectionsProps = {
  selectedRow: ScreenerRow;
  detail: OrgDetail;
  detailPeoplePrefetched: OrgPerson990[] | undefined;
  similarOrgRows: ScreenerRow[];
  buildOrgHref: (orgId: string) => string;
  portfolioCardMetaFilterContext: PortfolioCardMetaFilterContext;
  metricsCompareOptions: Array<{ id: string; label: string }>;
  metricsComparePeerId: string;
  onMetricsComparePeerId: (id: string) => void;
  visibleBenchmarkRows: Array<{
    label: string;
    format: import("@/lib/types").PeerBenchmarkMetricFormat;
    orgValue: number | null;
    peerMedian: number | null;
  }>;
  panelPeerBenchmarkValue: (label: string, peerMedianFallback: number | null) => number | null;
  panelComparePeerRow: ScreenerRow | null;
  orgRecommendations: OrgRecommendationsAiResponse | null;
  orgRecommendationsLoading: boolean;
  orgRecommendationsError: string | null;
  selectedEin9: string | null;
  peopleByEin: Record<string, OrgPerson990[]>;
};

/** Shared org profile body (Overview → People → Finances → …) — used in sheet and full-page layouts. */
export function OrgDetailMainSections({
  selectedRow,
  detail,
  detailPeoplePrefetched,
  similarOrgRows,
  buildOrgHref,
  portfolioCardMetaFilterContext,
  metricsCompareOptions,
  metricsComparePeerId,
  onMetricsComparePeerId,
  visibleBenchmarkRows,
  panelPeerBenchmarkValue,
  panelComparePeerRow,
  orgRecommendations,
  orgRecommendationsLoading,
  orgRecommendationsError,
  selectedEin9,
  peopleByEin,
}: OrgDetailMainSectionsProps) {
  return (
    <div className="tp-org-detail-sections">
      <section className="hp-sec tp-overview-sec" aria-labelledby="tp-org-overview-heading">
        <h2 id="tp-org-overview-heading" className="hp-sec-title">
          Overview
        </h2>
        <OrgDetailMetaChips
          ein={selectedRow.ein}
          initialWebsiteUrl={selectedRow.websiteUrl}
          orgPhone={selectedRow.orgPhone}
          orgEmail={selectedRow.orgEmail}
          foundedYear={selectedRow.foundedYear}
          employeeCount={selectedRow.employeeCount}
          volunteerCount={selectedRow.volunteerCount}
        />
        <div className="hp-mosaic tp-overview-mosaic">
          <div className="tp-card tp-card-big hp-mosaic-tall tp-mosaic-org-card">
            <div className="tp-mosaic-org-inner tp-mosaic-org-inner--detail">
              <div className="tp-mosaic-org-head">
                <div className="tp-mosaic-org-head-main">
                  <OrgLogoAvatar
                    organizationName={selectedRow.organizationName}
                    websiteDomain={websiteUrlToDomain(selectedRow.websiteUrl)}
                    cachedLogoDomain={selectedRow.logoDomain}
                    logoImageUrl={selectedRow.logoImageUrl}
                  />
                  <div className="tp-mosaic-org-titles">
                    <p className="tp-title tp-mosaic-org-title">{selectedRow.organizationName}</p>
                    <p className="tp-body tp-mosaic-org-location">
                      {selectedRow.city}, {selectedRow.state}
                    </p>
                  </div>
                </div>
              </div>
              <div className="tp-mosaic-org-mission">
                <OrgMissionSummary ein={selectedRow.ein} initialSummary={detail.summary} />
              </div>
              <p className="tp-body tp-org-ein tp-mosaic-org-ein">EIN {selectedRow.ein}</p>
            </div>
          </div>
        </div>
      </section>

      <OrgPeopleSection
        ein={selectedRow.ein}
        organizationName={selectedRow.organizationName}
        city={selectedRow.city}
        state={selectedRow.state}
        orgPhone={selectedRow.orgPhone}
        orgEmail={selectedRow.orgEmail}
        missionSummary={detail.summary}
        prefetchedPeople={detailPeoplePrefetched}
      />

      <section className="hp-sec tp-finances-sec" aria-labelledby="tp-org-finances-heading">
        <h2 id="tp-org-finances-heading" className="hp-sec-title">
          Finances
        </h2>
        <div className="tp-finances-metrics-row">
          <div className="tp-finances-chart-slot">
            <div className="tp-revenue-wide tp-revenue-wide--in-finances-row">
              <RevenueHistoryChart key={selectedRow.ein} ein={selectedRow.ein} />
            </div>
          </div>
          <div className="tp-finances-grid-slot">
            <div className="tp-mosaic-metrics-grid tp-mosaic-metrics-grid--finances">
              <div className="tp-card tp-card-stacked tp-mosaic-metric-tile">
                <p className="tp-kicker">Screener score</p>
                <p className={`tp-metric-value ${screenScoreToneClasses(selectedRow.screenScore)}`}>
                  {selectedRow.screenScore}
                </p>
              </div>
              <div className="tp-card tp-card-stacked tp-mosaic-metric-tile">
                <p className="tp-kicker">YoY revenue</p>
                <p className="tp-metric-value">{formatSignedPercent(selectedRow.growthRate)}</p>
              </div>
              <div className="tp-card tp-card-stacked tp-mosaic-metric-tile">
                <p className="tp-kicker">Reserve coverage</p>
                <p
                  className={`tp-metric-value${reserveCoverageIsLow(selectedRow.reserveMonths) ? " tp-screen-score--critical" : ""}`}
                >
                  {formatReserveCoverage(selectedRow.reserveMonths)}
                </p>
              </div>
              <div className="tp-card tp-card-stacked tp-mosaic-metric-tile">
                <p className="tp-kicker">Revenue</p>
                <p className="tp-metric-value">{formatUsdFull(selectedRow.revenue)}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="hp-sec" aria-label="Similar organizations">
        <h2 className="hp-sec-title">Similar organizations</h2>
        <div className="tp-portfolio-home-list">
          {similarOrgRows.length === 0 ? (
            <p className="tp-body tp-portfolio-home-empty">
              No other organizations are in your loaded list yet. Go back to the portfolio and load more rows to see
              peers ranked by similar reserve coverage, then similar revenue.
            </p>
          ) : (
            similarOrgRows.map((row) => (
              <Link
                key={row.id}
                href={buildOrgHref(row.id)}
                scroll={false}
                className="tp-portfolio-list-card"
              >
                <OrgLogoAvatar
                  organizationName={row.organizationName}
                  websiteDomain={websiteUrlToDomain(row.websiteUrl)}
                  cachedLogoDomain={row.logoDomain}
                  logoImageUrl={row.logoImageUrl}
                />
                <div className="tp-people-text tp-portfolio-list-text">
                  <p className="tp-people-name">{row.organizationName}</p>
                  <PortfolioOrgCardMeta row={row} filterContext={portfolioCardMetaFilterContext} />
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      <section className="hp-sec" aria-label="Metrics">
        <h2 className="hp-sec-title">Metrics</h2>
        <div className="tp-metrics-compare-grid">
          <p
            className="tp-panel-compare-heading tp-metrics-compare-head"
            title={selectedRow.organizationName}
          >
            This organization
          </p>
          <div className="tp-metrics-compare-head tp-metrics-compare-head-peer">
            <MetricsComparePeerPicker
              options={metricsCompareOptions}
              value={metricsComparePeerId}
              onChange={onMetricsComparePeerId}
            />
          </div>
          {visibleBenchmarkRows.map((row) => {
            const peerMetric = panelPeerBenchmarkValue(row.label, row.peerMedian);
            return (
              <Fragment key={row.label}>
                <div
                  className="tp-panel tp-metrics-compare-card tp-metrics-compare-card--org"
                  aria-label={`${row.label}: ${selectedRow.organizationName}`}
                >
                  <p className="tp-kicker">{row.label}</p>
                  <p
                    className={`tp-body tp-panel-compare-value${
                      row.format === "reserve_months" && reserveCoverageIsLow(row.orgValue)
                        ? " tp-reserve-coverage-low"
                        : ""
                    }`}
                  >
                    {formatBenchmarkValue(row.format, row.orgValue)}
                  </p>
                </div>
                <div
                  className="tp-panel tp-metrics-compare-card tp-metrics-compare-card--peer"
                  aria-label={`${row.label}: ${
                    metricsComparePeerId === METRICS_COMPARE_MEDIAN
                      ? "Portfolio median"
                      : (panelComparePeerRow?.organizationName ?? "Peer")
                  }`}
                >
                  <p className="tp-kicker">{row.label}</p>
                  <p
                    className={`tp-body tp-panel-compare-value${
                      row.format === "reserve_months" && reserveCoverageIsLow(peerMetric)
                        ? " tp-reserve-coverage-low"
                        : ""
                    }`}
                  >
                    {formatBenchmarkValue(row.format, peerMetric)}
                  </p>
                </div>
              </Fragment>
            );
          })}
        </div>
      </section>

      <section
        className="hp-sec"
        aria-label="Recommendations"
        aria-busy={orgRecommendationsLoading || Boolean(selectedEin9 && !Object.hasOwn(peopleByEin, selectedEin9))}
      >
        <h2 className="hp-sec-title">Recommendations</h2>
        {orgRecommendationsError ? (
          <p className="tp-body" role="alert" style={{ marginBottom: 10 }}>
            {orgRecommendationsError}
          </p>
        ) : null}
        {!orgRecommendationsError ? (
          <div className="hp-stack hp-highlights">
            {orgRecommendationsLoading || !orgRecommendations ? (
              <>
                <div className="tp-card tp-card-big hp-banner" aria-hidden>
                  <p className="tp-kicker">Scenario modeling</p>
                  <div className="tp-rec-skel">
                    <div className="hp-sk tp-rec-skel-line tp-rec-skel-line--title" />
                    <div className="hp-sk tp-rec-skel-line tp-rec-skel-line--body" />
                    <div className="hp-sk tp-rec-skel-line tp-rec-skel-line--body tp-rec-skel-line--short" />
                  </div>
                  <div className="tp-rec-skel-metrics">
                    <div className="tp-rec-skel-metric">
                      <div className="hp-sk tp-rec-skel-line" style={{ width: 72, marginBottom: 6 }} />
                      <div className="hp-sk tp-rec-skel-line" style={{ width: 96, height: 20 }} />
                    </div>
                    <div className="tp-rec-skel-metric">
                      <div className="hp-sk tp-rec-skel-line" style={{ width: 72, marginBottom: 6 }} />
                      <div className="hp-sk tp-rec-skel-line" style={{ width: 88, height: 20 }} />
                    </div>
                    <div className="tp-rec-skel-metric">
                      <div className="hp-sk tp-rec-skel-line" style={{ width: 64, marginBottom: 6 }} />
                      <div className="hp-sk tp-rec-skel-line" style={{ width: 120, height: 18 }} />
                    </div>
                  </div>
                </div>
                <div className="tp-card tp-card-big hp-banner" aria-hidden>
                  <p className="tp-kicker">Memo / talking points</p>
                  <div className="tp-rec-skel">
                    <div className="hp-sk tp-rec-skel-line tp-rec-skel-line--title" />
                    <div className="hp-sk tp-rec-skel-line tp-rec-skel-line--body" />
                    <div className="hp-sk tp-rec-skel-line tp-rec-skel-line--body tp-rec-skel-line--short" />
                    <div className="hp-sk tp-rec-skel-line tp-rec-skel-line--body" />
                  </div>
                </div>
                <div className="tp-card tp-card-big hp-banner" aria-hidden>
                  <p className="tp-kicker">Evidence beyond 990 extracts</p>
                  <div className="tp-rec-skel">
                    <div className="hp-sk tp-rec-skel-line tp-rec-skel-line--body" />
                    <div className="hp-sk tp-rec-skel-line tp-rec-skel-line--body tp-rec-skel-line--short" />
                    <div className="hp-sk tp-rec-skel-line tp-rec-skel-line--body" />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="tp-card tp-card-big hp-banner">
                  <p className="tp-kicker">Scenario modeling</p>
                  <p className="tp-title" style={{ fontSize: 17 }}>
                    {orgRecommendations.scenario.headline}
                  </p>
                  <p className="tp-body">
                    {sanitizeScenarioNarrative(orgRecommendations.scenario.narrative)}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: "auto" }}>
                    <div>
                      <p className="tp-kicker">Proj. reserve</p>
                      <p className="tp-metric-value" style={{ fontSize: 18 }}>
                        {orgRecommendations.scenario.projectedReserveLabel}
                      </p>
                    </div>
                    <div>
                      <p className="tp-kicker">Proj. growth</p>
                      <p className="tp-metric-value" style={{ fontSize: 18 }}>
                        {orgRecommendations.scenario.projectedGrowthLabel}
                      </p>
                    </div>
                    <div>
                      <p className="tp-kicker">Risk shift</p>
                      <p className="tp-metric-value" style={{ fontSize: 16 }}>
                        {orgRecommendations.scenario.riskShiftLabel}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="tp-card tp-card-big hp-banner">
                  <p className="tp-kicker">Memo / talking points</p>
                  <p className="tp-title" style={{ fontSize: 17 }}>
                    {orgRecommendations.memo.headline}
                  </p>
                  <div className="tp-rec-memo-bullets">
                    {orgRecommendations.memo.bullets.map((line, i) => (
                      <p key={`memo-${i}`} className="tp-body">
                        {line}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="tp-card tp-card-big hp-banner">
                  <p className="tp-kicker">Evidence beyond 990 extracts</p>
                  <p className="tp-body" style={{ color: "var(--text-primary)" }}>
                    {orgRecommendations.evidence.paragraph}
                  </p>
                </div>
              </>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}
