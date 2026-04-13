"use client";

import Link from "next/link";
import {
  startTransition,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { filterPortfolioByBucket, type PortfolioBucket } from "@/lib/portfolio-buckets";
import { buildPeerBenchmarks, staffPerMillion } from "@/lib/peer-benchmarks";
import {
  formatBenchmarkValue,
  formatReserveCoverage,
  formatSignedPercent,
  screenScoreToneClasses,
} from "@/lib/format-display";
import type { OrgDetail, ScreenerRow } from "@/lib/types";
import {
  METRICS_COMPARE_MEDIAN,
  MetricsComparePeerPicker,
} from "./metrics-compare-peer-picker";
import { OrgLogoAvatar } from "./org-logo-avatar";
import { PortfolioHomeFilter } from "./portfolio-home-filter";
import { RevenueHistoryChart } from "./revenue-history-chart";
import { buildLiveOrgDetail, EM_DASH } from "./tipping-point-live-detail";

const MOSAIC_GAP_PX = 12;
/** Each metric tile is at least this on desktop when the 2×2 block fits. */
const METRIC_TILE_MIN_PX = 128;
/** Minimum outer side of the 2×2 metrics square (two tiles + one gap per axis). */
const METRICS_BLOCK_MIN_SIDE_PX = METRIC_TILE_MIN_PX * 2 + MOSAIC_GAP_PX;
/** Reserve at least this width for the org card; metrics block sits in the `auto` column. */
const MOSAIC_MIN_MAIN_COL_PX = 260;
const MOBILE_MQ = "(max-width: 767px)";
const SIMILAR_ORG_MAX = 6;
const PORTFOLIO_PAGE_SIZE = 20;

function PortfolioRowSkeleton() {
  return (
    <div className="tp-portfolio-list-skeleton" aria-hidden>
      <div className="hp-sk tp-portfolio-list-skeleton-avatar" />
      <div className="tp-portfolio-list-skeleton-text">
        <div className="hp-sk tp-portfolio-list-skeleton-line tp-portfolio-list-skeleton-line--lg" />
        <div className="hp-sk tp-portfolio-list-skeleton-line tp-portfolio-list-skeleton-line--sm" />
      </div>
      <div className="hp-sk tp-portfolio-list-skeleton-score" />
    </div>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M14 6L8 12L14 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TippingPointDashboard({ embedded = false }: { embedded?: boolean }) {
  /** `home` = org list; `detail` = full org view (former single-page dashboard). */
  const [view, setView] = useState<"home" | "detail">("home");
  const [portfolioRows, setPortfolioRows] = useState<ScreenerRow[]>([]);
  const [portfolioReady, setPortfolioReady] = useState(false);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [portfolioHasMore, setPortfolioHasMore] = useState(false);
  const [portfolioPage, setPortfolioPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [revenueByOrg, setRevenueByOrg] = useState<
    Record<string, { currentYearRevenue: number; priorYearRevenue: number }> | null
  >(null);
  const [portfolioBucket, setPortfolioBucket] = useState<PortfolioBucket>("all");

  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const mosaicRef = useRef<HTMLDivElement>(null);
  const orgCardRef = useRef<HTMLDivElement>(null);
  const orgInnerRef = useRef<HTMLDivElement>(null);
  /** Desktop: 2×2 metrics square side + row min-height (main column uses `1fr`). */
  const [mosaicLayout, setMosaicLayout] = useState<
    { metricsSide: number; rowMinHeight: number } | undefined
  >(undefined);
  const [metricsComparePeerId, setMetricsComparePeerId] = useState<string>(METRICS_COMPARE_MEDIAN);
  const metricsCompareInitRef = useRef(false);
  const portfolioPageRef = useRef(1);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMoreInFlightRef = useRef(false);

  useEffect(() => {
    portfolioPageRef.current = portfolioPage;
  }, [portfolioPage]);

  useEffect(() => {
    let cancelled = false;
    setPortfolioError(null);
    fetch(`/api/portfolio-data?page=1&pageSize=${PORTFOLIO_PAGE_SIZE}`)
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as {
          screener?: ScreenerRow[];
          revenueByOrg?: Record<string, { currentYearRevenue: number; priorYearRevenue: number }>;
          hasMore?: boolean;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(typeof body.error === "string" ? body.error : `HTTP ${res.status}`);
        }
        return body;
      })
      .then((data) => {
        if (cancelled) return;
        setPortfolioReady(true);
        setPortfolioPage(1);
        portfolioPageRef.current = 1;
        setPortfolioHasMore(Boolean(data.hasMore));
        if (data.screener?.length) {
          setPortfolioRows(data.screener);
          setRevenueByOrg(data.revenueByOrg ?? {});
          setPortfolioError(null);
        } else {
          setPortfolioRows([]);
          setRevenueByOrg(null);
          setPortfolioError("No organizations returned from the data API.");
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setPortfolioReady(true);
          setPortfolioHasMore(false);
          setPortfolioRows([]);
          setRevenueByOrg(null);
          setPortfolioError(e instanceof Error ? e.message : "Could not load portfolio.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!portfolioReady || !portfolioHasMore || loadingMore) return;
    const el = loadMoreSentinelRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries[0]?.isIntersecting;
        if (!hit || loadMoreInFlightRef.current) return;
        const nextPage = portfolioPageRef.current + 1;
        loadMoreInFlightRef.current = true;
        setLoadingMore(true);
        fetch(`/api/portfolio-data?page=${nextPage}&pageSize=${PORTFOLIO_PAGE_SIZE}`)
          .then(async (res) => {
            const body = (await res.json().catch(() => ({}))) as {
              screener?: ScreenerRow[];
              revenueByOrg?: Record<string, { currentYearRevenue: number; priorYearRevenue: number }>;
              hasMore?: boolean;
            };
            if (!res.ok) return;
            return body;
          })
          .then((data) => {
            if (!data) return;
            setPortfolioRows((prev) => {
              const seen = new Set(prev.map((r) => r.id));
              const add = (data.screener ?? []).filter((r) => !seen.has(r.id));
              return [...prev, ...add];
            });
            setRevenueByOrg((prev) => ({ ...(prev ?? {}), ...(data.revenueByOrg ?? {}) }));
            setPortfolioHasMore(Boolean(data.hasMore));
            setPortfolioPage(nextPage);
            portfolioPageRef.current = nextPage;
          })
          .finally(() => {
            loadMoreInFlightRef.current = false;
            setLoadingMore(false);
          });
      },
      { root: null, rootMargin: "320px", threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [portfolioReady, portfolioHasMore, loadingMore, portfolioRows.length]);

  useEffect(() => {
    if (view === "detail" && portfolioReady && portfolioRows.length === 0) {
      startTransition(() => setView("home"));
    }
  }, [view, portfolioReady, portfolioRows.length]);

  const homeListRows = useMemo(
    () => filterPortfolioByBucket(portfolioRows, portfolioBucket),
    [portfolioRows, portfolioBucket],
  );

  const selectedRow = useMemo((): ScreenerRow | undefined => {
    if (portfolioRows.length === 0) return undefined;
    return portfolioRows.find((r) => r.id === selectedOrgId) ?? portfolioRows[0];
  }, [selectedOrgId, portfolioRows]);

  const detail: OrgDetail | undefined = useMemo(() => {
    if (!selectedRow) return undefined;
    return buildLiveOrgDetail(selectedRow, portfolioRows, revenueByOrg);
  }, [selectedRow, portfolioRows, revenueByOrg]);

  useEffect(() => {
    if (portfolioRows.length === 0) return;
    if (!selectedOrgId || !portfolioRows.some((r) => r.id === selectedOrgId)) {
      startTransition(() => setSelectedOrgId(portfolioRows[0]!.id));
    }
  }, [portfolioRows, selectedOrgId]);

  const benchmarkRows = useMemo(() => detail?.peerBenchmarks.slice(0, 4) ?? [], [detail]);

  const similarOrgRows = useMemo(() => {
    if (!selectedRow) return [];
    const state = selectedRow.state;
    return portfolioRows
      .filter((r) => r.id !== selectedRow.id && r.state === state)
      .slice(0, SIMILAR_ORG_MAX);
  }, [portfolioRows, selectedRow]);

  useEffect(() => {
    if (!selectedRow) return;
    const others = portfolioRows.filter((r) => r.id !== selectedRow.id);
    if (others.length === 0) {
      setMetricsComparePeerId(METRICS_COMPARE_MEDIAN);
      return;
    }
    setMetricsComparePeerId((prev) => {
      if (!metricsCompareInitRef.current) {
        metricsCompareInitRef.current = true;
        return others[0]!.id;
      }
      if (prev === METRICS_COMPARE_MEDIAN) return prev;
      if (others.some((o) => o.id === prev)) return prev;
      return others[0]!.id;
    });
  }, [portfolioRows, selectedRow]);

  const metricsCompareOptions = useMemo(() => {
    const out: Array<{ id: string; label: string }> = [
      { id: METRICS_COMPARE_MEDIAN, label: "Portfolio median" },
    ];
    if (!selectedRow) return out;
    for (const r of portfolioRows) {
      if (r.id === selectedRow.id) continue;
      out.push({ id: r.id, label: r.organizationName });
    }
    return out;
  }, [portfolioRows, selectedRow]);

  const panelComparePeerRow = useMemo(() => {
    if (metricsComparePeerId === METRICS_COMPARE_MEDIAN) return null;
    return portfolioRows.find((r) => r.id === metricsComparePeerId) ?? null;
  }, [metricsComparePeerId, portfolioRows]);

  function panelPeerBenchmarkValue(label: string, peerMedianFallback: number): number {
    if (!panelComparePeerRow) return peerMedianFallback;
    if (label === "Reserve months") return panelComparePeerRow.reserveMonths;
    if (label === "Revenue growth %") return panelComparePeerRow.growthRate;
    if (label === "Staff per $1M") return staffPerMillion(panelComparePeerRow);
    return peerMedianFallback;
  }

  function openOrgDetail(id: string) {
    startTransition(() => {
      setSelectedOrgId(id);
      setView("detail");
    });
  }

  function backToPortfolio() {
    startTransition(() => setView("home"));
  }

  useLayoutEffect(() => {
    if (view !== "detail") {
      setMosaicLayout(undefined);
      return;
    }
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
  }, [view, selectedOrgId, detail?.summary]);

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
        {view === "home" ? (
          <section className="hp-sec" aria-label="Organizations">
            <div className="tp-portfolio-home-toolbar">
              <PortfolioHomeFilter rows={portfolioRows} value={portfolioBucket} onChange={setPortfolioBucket} />
            </div>
            <div className="tp-portfolio-home-list">
              {!portfolioReady ? (
                <p className="tp-body tp-portfolio-home-empty">Loading portfolio…</p>
              ) : portfolioRows.length === 0 ? (
                <p className="tp-body tp-portfolio-home-empty">
                  {portfolioError ?? EM_DASH}
                </p>
              ) : homeListRows.length === 0 ? (
                <p className="tp-body tp-portfolio-home-empty">No organizations match this filter.</p>
              ) : (
                <>
                  {homeListRows.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      className="tp-portfolio-list-card"
                      onClick={() => openOrgDetail(row.id)}
                    >
                      <OrgLogoAvatar organizationName={row.organizationName} websiteDomain="" />
                      <div className="tp-people-text tp-portfolio-list-text">
                        <p className="tp-people-name">{row.organizationName}</p>
                        <p className="tp-people-role">
                          {row.city}, {row.state}
                        </p>
                      </div>
                      <p
                        className={`tp-metric-value tp-portfolio-list-score ${screenScoreToneClasses(row.screenScore)}`}
                      >
                        {row.screenScore}
                      </p>
                    </button>
                  ))}
                  {loadingMore ? (
                    <>
                      <PortfolioRowSkeleton />
                      <PortfolioRowSkeleton />
                      <PortfolioRowSkeleton />
                    </>
                  ) : null}
                  {portfolioHasMore && portfolioRows.length > 0 ? (
                    <div ref={loadMoreSentinelRef} className="tp-portfolio-load-sentinel" aria-hidden />
                  ) : null}
                </>
              )}
            </div>
          </section>
        ) : selectedRow && detail ? (
          <>
            <div className="tp-org-detail-stack">
              <div className="tp-org-detail-toolbar">
                <button type="button" className="tp-back-button" onClick={backToPortfolio} aria-label="Back to portfolio">
                  <ChevronLeftIcon />
                  Back
                </button>
              </div>

              <section className="hp-sec tp-overview-sec" aria-label="Organization overview">
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
                <p className={`tp-metric-value ${screenScoreToneClasses(selectedRow.screenScore)}`}>
                  {selectedRow.screenScore}
                </p>
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
                  {formatReserveCoverage(selectedRow.reserveMonths)}
                </p>
              </div>
            </div>
          </div>

              <div className="tp-revenue-wide">
                <RevenueHistoryChart ein={selectedRow.ein} />
              </div>
            </section>
            </div>

                <section className="hp-sec" aria-label="People">
              <h2 className="hp-sec-title">People</h2>
              <p className="tp-people-lede">
                Leadership and staff contacts are not in the ProPublica 990 extract; connect a CRM or manual
                directory if you need names here.
              </p>
              <div className="hp-map-grid">
                <article className="tp-people-card">
                  <div className="tp-people-avatar" aria-hidden />
                  <div className="tp-people-text">
                    <p className="tp-people-name">{EM_DASH}</p>
                    <p className="tp-people-role">{EM_DASH}</p>
                  </div>
                </article>
              </div>
            </section>

                <section className="hp-sec" aria-label="Similar organizations">
              <h2 className="hp-sec-title">Similar organizations</h2>
              <div className="tp-portfolio-home-list">
                {similarOrgRows.length === 0 ? (
                  <p className="tp-body tp-portfolio-home-empty">
                    No other organizations in this state in the portfolio.
                  </p>
                ) : (
                  similarOrgRows.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      className="tp-portfolio-list-card"
                      onClick={() => openOrgDetail(row.id)}
                    >
                      <OrgLogoAvatar organizationName={row.organizationName} websiteDomain="" />
                      <div className="tp-people-text tp-portfolio-list-text">
                        <p className="tp-people-name">{row.organizationName}</p>
                        <p className="tp-people-role">
                          {row.city}, {row.state}
                        </p>
                      </div>
                      <p
                      className={`tp-metric-value tp-portfolio-list-score ${screenScoreToneClasses(row.screenScore)}`}
                    >
                      {row.screenScore}
                    </p>
                    </button>
                  ))
                )}
              </div>
            </section>

                <section className="hp-sec" aria-label="Metrics">
              <h2 className="hp-sec-title">Metrics</h2>
              <div className="tp-panel-compare">
            <div
              className="tp-panel tp-panel-compare-col"
              aria-label={`${selectedRow.organizationName} benchmarks`}
            >
              <p className="tp-panel-compare-heading">{selectedRow.organizationName}</p>
              {benchmarkRows.map((row) => (
                <div key={`org-${row.label}`} className="tp-panel-compare-row">
                  <p className="tp-kicker">{row.label}</p>
                  <p className="tp-body tp-panel-compare-value">
                    {formatBenchmarkValue(row.label, row.orgValue)}
                  </p>
                </div>
              ))}
            </div>
            <div
              className="tp-panel tp-panel-compare-col"
              aria-label={
                metricsComparePeerId === METRICS_COMPARE_MEDIAN
                  ? "Portfolio median benchmarks"
                  : `${panelComparePeerRow?.organizationName ?? "Peer"} benchmarks`
              }
            >
              <MetricsComparePeerPicker
                options={metricsCompareOptions}
                value={metricsComparePeerId}
                onChange={setMetricsComparePeerId}
              />
              {benchmarkRows.map((row) => (
                <div key={`peer-${row.label}`} className="tp-panel-compare-row">
                  <p className="tp-kicker">{row.label}</p>
                  <p className="tp-body tp-panel-compare-value">
                    {formatBenchmarkValue(
                      row.label,
                      panelPeerBenchmarkValue(row.label, row.peerMedian),
                    )}
                  </p>
                </div>
              ))}
              </div>
              </div>
            </section>

                <section className="hp-sec" aria-label="Recommendations">
              <h2 className="hp-sec-title">Recommendations</h2>
              <div className="hp-stack hp-highlights">
                <div className="tp-card tp-card-big hp-banner">
                  <p className="tp-kicker">Scenario modeling</p>
                  <p className="tp-title" style={{ fontSize: 17 }}>
                    {EM_DASH}
                  </p>
                  <p className="tp-body">
                    Not generated from ProPublica data. Add your own assumptions outside this dashboard if you need a
                    forward scenario.
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: "auto" }}>
                    <div>
                      <p className="tp-kicker">Proj. reserve</p>
                      <p className="tp-metric-value" style={{ fontSize: 18 }}>
                        {EM_DASH}
                      </p>
                    </div>
                    <div>
                      <p className="tp-kicker">Proj. growth</p>
                      <p className="tp-metric-value" style={{ fontSize: 18 }}>
                        {EM_DASH}
                      </p>
                    </div>
                    <div>
                      <p className="tp-kicker">Risk shift</p>
                      <p className="tp-metric-value" style={{ fontSize: 16 }}>
                        {EM_DASH}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="tp-card tp-card-big hp-banner">
                  <p className="tp-kicker">Memo / talking points</p>
                  <p className="tp-title" style={{ fontSize: 17 }}>
                    {EM_DASH}
                  </p>
                  <p className="tp-body">{EM_DASH}</p>
                </div>

                <div className="tp-card tp-card-big hp-banner">
                  <p className="tp-kicker">Evidence beyond 990 extracts</p>
                  <p className="tp-body" style={{ color: "var(--text-primary)" }}>
                    {EM_DASH}
                  </p>
                </div>
              </div>
            </section>
          </>
        ) : null}

        {embedded ? (
          <p className="tp-embedded-footer">
            <Link href="/legacy">Open legacy three-screen deck (backup)</Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
