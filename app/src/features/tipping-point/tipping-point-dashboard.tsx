"use client";

import Link from "next/link";
import { startTransition, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  memoContext,
  orgDetails,
  peoplePlaceholders,
  scenarioResults,
  screenerRows,
  screens,
} from "@/lib/mock-data";
import { formatBenchmarkValue, formatSignedPercent } from "@/lib/format-display";
import type { OrgDetail } from "@/lib/types";
import { OrgLogoAvatar } from "./org-logo-avatar";
import { PortfolioOrgChip } from "./portfolio-org-chip";
import { RevenueHistoryChart } from "./revenue-history-chart";

const MOSAIC_GAP_PX = 12;
/** Each metric tile is at least this on desktop when the 2×2 block fits. */
const METRIC_TILE_MIN_PX = 128;
/** Minimum outer side of the 2×2 metrics square (two tiles + one gap per axis). */
const METRICS_BLOCK_MIN_SIDE_PX = METRIC_TILE_MIN_PX * 2 + MOSAIC_GAP_PX;
/** Reserve at least this width for the org card; metrics block sits in the `auto` column. */
const MOSAIC_MIN_MAIN_COL_PX = 260;
const MOBILE_MQ = "(max-width: 767px)";

export function TippingPointDashboard({ embedded = false }: { embedded?: boolean }) {
  const [selectedOrgId, setSelectedOrgId] = useState(screenerRows[0].id);
  const mosaicRef = useRef<HTMLDivElement>(null);
  const orgCardRef = useRef<HTMLDivElement>(null);
  const orgInnerRef = useRef<HTMLDivElement>(null);
  /** Desktop: 2×2 metrics square side + row min-height (main column uses `1fr`). */
  const [mosaicLayout, setMosaicLayout] = useState<
    { metricsSide: number; rowMinHeight: number } | undefined
  >(undefined);

  const selectedRow = useMemo(
    () => screenerRows.find((r) => r.id === selectedOrgId) ?? screenerRows[0],
    [selectedOrgId],
  );
  const detail: OrgDetail = orgDetails[selectedRow.id] ?? orgDetails["ocean-bridge"];
  const scenario = scenarioResults[selectedRow.id] ?? scenarioResults["ocean-bridge"];

  const benchmarkRows = useMemo(() => detail.peerBenchmarks.slice(0, 4), [detail]);

  function selectOrg(id: string) {
    startTransition(() => setSelectedOrgId(id));
  }

  useLayoutEffect(() => {
    const mosaic = mosaicRef.current;
    const card = orgCardRef.current;
    const inner = orgInnerRef.current;
    if (!mosaic || !card || !inner) return;

    const mq = window.matchMedia(MOBILE_MQ);

    const sync = () => {
      if (mq.matches) {
        setMosaicLayout(undefined);
        return;
      }
      const padY =
        parseFloat(getComputedStyle(card).paddingTop) + parseFloat(getComputedStyle(card).paddingBottom);
      const orgNaturalH = inner.getBoundingClientRect().height + padY;
      const totalW = mosaic.getBoundingClientRect().width;
      const maxMetricsSide = Math.max(
        METRICS_BLOCK_MIN_SIDE_PX,
        totalW - MOSAIC_GAP_PX - MOSAIC_MIN_MAIN_COL_PX,
      );
      const metricsSide = Math.min(
        maxMetricsSide,
        Math.max(orgNaturalH, METRICS_BLOCK_MIN_SIDE_PX),
      );
      const rowMinHeight = Math.max(orgNaturalH, metricsSide);
      setMosaicLayout({
        metricsSide: Math.floor(metricsSide * 100) / 100,
        rowMinHeight: Math.floor(rowMinHeight * 100) / 100,
      });
    };

    sync();
    const roInner = new ResizeObserver(sync);
    const roMosaic = new ResizeObserver(sync);
    roInner.observe(inner);
    roMosaic.observe(mosaic);
    mq.addEventListener("change", sync);
    return () => {
      roInner.disconnect();
      roMosaic.disconnect();
      mq.removeEventListener("change", sync);
    };
  }, [selectedOrgId, detail.summary]);

  return (
    <div className="tp-dashboard-shell">
      {!embedded ? (
        <header className="tp-dash-top">
          <div className="tp-dash-brand">
            <h1>Tipping Point</h1>
            <p>Aggies Data Hackathon 2026 · nonprofit resilience triage</p>
          </div>
          <nav className="tp-dash-nav" aria-label="Demo versions">
            <Link href="/legacy">Open legacy deck UI (backup)</Link>
          </nav>
        </header>
      ) : null}

      <div className="hp-dash" data-layer="tipping-point-dashboard">
        <section className="hp-sec tp-overview-sec" aria-label="Portfolio">
          <div className="tp-overview-head">
            <PortfolioOrgChip
              variant="inline"
              rows={screenerRows}
              selectedId={selectedOrgId}
              onSelect={selectOrg}
            />
          </div>
          <div className="hp-mosaic" ref={mosaicRef}>
            <div
              className="tp-card tp-card-big hp-mosaic-tall"
              ref={orgCardRef}
              style={
                mosaicLayout !== undefined ? { minHeight: mosaicLayout.rowMinHeight } : undefined
              }
            >
              <div
                ref={orgInnerRef}
                className="tp-mosaic-org-inner"
                style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", gap: 16 }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 12,
                  }}
                >
                  <OrgLogoAvatar organizationName={selectedRow.organizationName} websiteDomain={detail.website} />
                  <div style={{ minWidth: 0, alignSelf: "stretch" }}>
                    <p className="tp-title" style={{ fontSize: 21 }}>
                      {selectedRow.organizationName}
                    </p>
                    <p className="tp-body" style={{ marginTop: 4 }}>
                      {selectedRow.city}, {selectedRow.state}
                    </p>
                  </div>
                </div>
                <p className="tp-body" style={{ color: "var(--text-primary)" }}>
                  {detail.summary}
                </p>
                <p className="tp-body tp-org-ein">EIN {selectedRow.ein}</p>
              </div>
            </div>

            <div
              className="tp-mosaic-metrics-grid"
              style={
                mosaicLayout !== undefined
                  ? { width: mosaicLayout.metricsSide, height: mosaicLayout.metricsSide }
                  : undefined
              }
            >
              <div className="tp-card tp-card-stacked tp-mosaic-metric-tile">
                <p className="tp-kicker">Screener score</p>
                <p className="tp-metric-value">{selectedRow.screenScore}</p>
              </div>
              <div className="tp-card tp-card-stacked tp-mosaic-metric-tile">
                <p className="tp-kicker">Risk band</p>
                <p className="tp-metric-value" style={{ fontSize: 18 }}>
                  {selectedRow.riskBand}
                </p>
              </div>
              <div className="tp-card tp-card-stacked tp-mosaic-metric-tile">
                <p className="tp-kicker">YoY growth</p>
                <p className="tp-metric-value">{formatSignedPercent(selectedRow.growthRate)}</p>
              </div>
              <div className="tp-card tp-card-stacked tp-mosaic-metric-tile">
                <p className="tp-kicker">Reserve coverage</p>
                <p className="tp-metric-value" style={{ fontSize: 18 }}>
                  {selectedRow.reserveMonths.toFixed(1)} mo
                </p>
              </div>
            </div>
          </div>

          <div className="tp-revenue-wide">
            <RevenueHistoryChart ein={selectedRow.ein} />
          </div>
        </section>

        <section className="hp-sec" aria-label="People">
          <h2 className="hp-sec-title">People</h2>
          <p className="tp-people-lede">
            Demo contacts in the same panel style as below—swap for your CRM or directory.
          </p>
          <div className="hp-map-grid">
            {peoplePlaceholders.map((person) => (
              <article key={person.id} className="tp-people-card">
                <div className="tp-people-avatar" aria-hidden />
                <div className="tp-people-text">
                  <p className="tp-people-name">{person.name}</p>
                  <p className="tp-people-role">{person.title}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="hp-sec" aria-label="Panels">
          <h2 className="hp-sec-title">Panels</h2>
          <div className="tp-panel-compare">
            <div className="tp-panel tp-panel-compare-col" aria-label="Organization benchmarks">
              <p className="tp-panel-compare-heading">Organization</p>
              {benchmarkRows.map((row) => (
                <div key={`org-${row.label}`} className="tp-panel-compare-row">
                  <p className="tp-kicker">{row.label}</p>
                  <p className="tp-body tp-panel-compare-value">
                    {formatBenchmarkValue(row.label, row.orgValue)}
                  </p>
                </div>
              ))}
            </div>
            <div className="tp-panel tp-panel-compare-col" aria-label="Peer median benchmarks">
              <p className="tp-panel-compare-heading">Peer median</p>
              {benchmarkRows.map((row) => (
                <div key={`peer-${row.label}`} className="tp-panel-compare-row">
                  <p className="tp-kicker">{row.label}</p>
                  <p className="tp-body tp-panel-compare-value">
                    {formatBenchmarkValue(row.label, row.peerMedian)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="hp-sec" aria-label="Highlights">
          <h2 className="hp-sec-title">Highlights</h2>
          <div className="hp-stack hp-highlights">
            <div className="tp-card tp-card-big hp-banner">
              <p className="tp-kicker">Scenario · {scenario.title}</p>
              <p className="tp-title" style={{ fontSize: 17 }}>
                {scenario.recommendation}
              </p>
              <p className="tp-body">{scenario.assumption}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: "auto" }}>
                <div>
                  <p className="tp-kicker">Proj. reserve</p>
                  <p className="tp-metric-value" style={{ fontSize: 18 }}>
                    {scenario.projectedReserveMonths.toFixed(1)} mo
                  </p>
                </div>
                <div>
                  <p className="tp-kicker">Proj. growth</p>
                  <p className="tp-metric-value" style={{ fontSize: 18 }}>
                    {formatSignedPercent(scenario.projectedGrowth)}
                  </p>
                </div>
                <div>
                  <p className="tp-kicker">Risk shift</p>
                  <p className="tp-metric-value" style={{ fontSize: 16 }}>
                    {scenario.riskShift}
                  </p>
                </div>
              </div>
            </div>

            <div className="tp-card tp-card-big hp-banner">
              <p className="tp-kicker">Memo brief ({memoContext.timeHorizon})</p>
              <p className="tp-title" style={{ fontSize: 17 }}>
                Audience: {memoContext.audience}
              </p>
              <p className="tp-body">{memoContext.ask}</p>
              <ul className="tp-body" style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                {memoContext.constraints.map((c) => (
                  <li key={c} style={{ marginBottom: 4 }}>
                    {c}
                  </li>
                ))}
              </ul>
            </div>

            <div className="tp-card tp-card-big hp-banner">
              <p className="tp-kicker">Screen map</p>
              <p className="tp-body" style={{ color: "var(--text-primary)" }}>
                {screens.map((s) => (
                  <span key={s.key} style={{ display: "block", marginBottom: 8 }}>
                    <strong>{s.label}</strong> — {s.blurb}
                  </span>
                ))}
              </p>
              <p className="tp-kicker" style={{ marginTop: 12 }}>
                Evidence anchors
              </p>
              <ul className="tp-body" style={{ margin: 0, paddingLeft: 18, color: "var(--text-primary)" }}>
                {scenario.evidence.map((e) => (
                  <li key={e} style={{ marginBottom: 4 }}>
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {embedded ? (
          <p className="tp-embedded-footer">
            <Link href="/legacy">Open legacy three-screen deck (backup)</Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
