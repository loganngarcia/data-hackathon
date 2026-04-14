"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  startTransition,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { buildPeerBenchmarks, staffPerMillion } from "@/lib/peer-benchmarks";
import {
  formatBenchmarkValue,
  formatReserveCoverage,
  reserveCoverageIsLow,
  formatSignedPercent,
  formatUsdFull,
  screenScoreToneClasses,
} from "@/lib/format-display";
import type { OrgDetail, ScreenerRow } from "@/lib/types";
import {
  METRICS_COMPARE_MEDIAN,
  MetricsComparePeerPicker,
} from "./metrics-compare-peer-picker";
import { OrgLogoAvatar } from "./org-logo-avatar";
import { websiteUrlToDomain } from "@/lib/website-url";
import { OrgPeopleSection } from "./org-people-section";
import { OrgMissionSummary } from "./org-mission-summary";
import { OrgDetailMetaChips } from "./org-detail-meta-chips";
import type { AssetsBandId } from "@/lib/assets-band";
import type { RevenueBandId } from "@/lib/revenue-band";
import type { ReserveBandId } from "@/lib/reserve-band";
import type { BoardBandId } from "@/lib/board-band";
import type { CountBandId } from "@/lib/portfolio-toolbar-bands";
import {
  PortfolioBoardFilter,
  PortfolioEmployeesFilter,
  PortfolioStateFilter,
  PortfolioVolunteerFilter,
} from "./portfolio-extra-filters";
import { PortfolioAssetsFilter } from "./portfolio-assets-filter";
import { PortfolioRevenueFilter } from "./portfolio-revenue-filter";
import { PortfolioReserveFilter } from "./portfolio-reserve-filter";
import { RevenueHistoryChart } from "./revenue-history-chart";
import { buildLiveOrgDetail, EM_DASH } from "./tipping-point-live-detail";
import { pickSimilarOrganizationRows } from "@/lib/similar-orgs";
import { OrgDetailShareButton } from "./org-detail-share-button";

const MOSAIC_GAP_PX = 12;
/** Desktop: fixed size for each metric cell in the 2×2 block. */
const METRIC_TILE_PX = 136;
/** Outer side of the metrics square (two tiles + one gap per axis). */
const MOSAIC_METRICS_GRID_SIDE_PX = METRIC_TILE_PX * 2 + MOSAIC_GAP_PX;
const MOBILE_MQ = "(max-width: 767px)";
const SIMILAR_ORG_MAX = 6;
const PORTFOLIO_PAGE_SIZE = 20;
const PORTFOLIO_HOME_SKELETON_ROWS = 10;
const SHARE_FALLBACK_TITLE = "Tipping Point";

function ein9FromRow(row: ScreenerRow): string | null {
  const d = row.ein.replace(/\D/g, "").slice(0, 9);
  return d.length === 9 ? d : null;
}

function PortfolioRowSkeleton() {
  return (
    <div className="tp-portfolio-list-skeleton" aria-hidden>
      <div className="hp-sk tp-portfolio-list-skeleton-avatar" />
      <div className="tp-portfolio-list-skeleton-text">
        <div className="hp-sk tp-portfolio-list-skeleton-line tp-portfolio-list-skeleton-line--lg" />
        <div className="hp-sk tp-portfolio-list-skeleton-line tp-portfolio-list-skeleton-line--sm" />
      </div>
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

function TippingPointDashboardFallback({ embedded = false }: { embedded?: boolean }) {
  return (
    <div className="tp-dashboard-shell">
      {!embedded ? (
        <header className="tp-dash-top">
          <div className="tp-dash-brand">
            <h1>Tipping Point</h1>
            <p>Aggies Data Hackathon 2026 · nonprofit resilience triage</p>
          </div>
        </header>
      ) : null}
      <div className="hp-dash" data-layer="tipping-point-dashboard">
        <p className="tp-body tp-portfolio-home-empty">Loading…</p>
      </div>
    </div>
  );
}

function TippingPointDashboardInner({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();

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
  const [assetsBand, setAssetsBand] = useState<AssetsBandId>("all");
  const [revenueBand, setRevenueBand] = useState<RevenueBandId>("all");
  const [reserveBand, setReserveBand] = useState<ReserveBandId>("all");
  const [employeeBand, setEmployeeBand] = useState<CountBandId>("all");
  const [volunteerBand, setVolunteerBand] = useState<CountBandId>("all");
  const [boardBand, setBoardBand] = useState<BoardBandId>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const mosaicRef = useRef<HTMLDivElement>(null);
  /** Desktop: fixed metrics block side (px); main org card height matches in CSS. */
  const [mosaicLayout, setMosaicLayout] = useState<{ metricsSide: number } | undefined>(undefined);
  const [metricsComparePeerId, setMetricsComparePeerId] = useState<string>(METRICS_COMPARE_MEDIAN);
  const metricsCompareInitRef = useRef(false);
  const portfolioPageRef = useRef(1);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMoreInFlightRef = useRef(false);
  const portfolioRowsRef = useRef<ScreenerRow[]>([]);
  portfolioRowsRef.current = portfolioRows;

  const orgParamRaw = searchParams.get("org");
  const orgParamDecoded = useMemo(() => {
    if (!orgParamRaw) return null;
    try {
      return decodeURIComponent(orgParamRaw);
    } catch {
      return orgParamRaw;
    }
  }, [orgParamRaw]);

  const buildOrgHref = useCallback(
    (orgId: string) => {
      const q = new URLSearchParams(searchParams.toString());
      q.set("org", orgId);
      const s = q.toString();
      return s ? `${pathname}?${s}` : pathname;
    },
    [pathname, searchParams],
  );

  const buildPortfolioHomeHref = useCallback(() => {
    const q = new URLSearchParams(searchParams.toString());
    q.delete("org");
    const s = q.toString();
    return s ? `${pathname}?${s}` : pathname;
  }, [pathname, searchParams]);

  useEffect(() => {
    portfolioPageRef.current = portfolioPage;
  }, [portfolioPage]);

  const portfolioApiFilterQuery = useMemo(() => {
    const parts: string[] = [];
    if (assetsBand !== "all") parts.push(`assetsBand=${encodeURIComponent(assetsBand)}`);
    if (revenueBand !== "all") parts.push(`revenueBand=${encodeURIComponent(revenueBand)}`);
    if (reserveBand !== "all") parts.push(`reserveBand=${encodeURIComponent(reserveBand)}`);
    if (employeeBand !== "all") parts.push(`employeeBand=${encodeURIComponent(employeeBand)}`);
    if (volunteerBand !== "all") parts.push(`volunteerBand=${encodeURIComponent(volunteerBand)}`);
    if (boardBand !== "all") parts.push(`boardBand=${encodeURIComponent(boardBand)}`);
    if (stateFilter !== "all") parts.push(`state=${encodeURIComponent(stateFilter)}`);
    return parts.length ? `&${parts.join("&")}` : "";
  }, [assetsBand, revenueBand, reserveBand, employeeBand, volunteerBand, boardBand, stateFilter]);

  useEffect(() => {
    let cancelled = false;
    setPortfolioError(null);
    setPortfolioReady(false);
    setPortfolioHasMore(false);
    setLoadingMore(false);
    loadMoreInFlightRef.current = false;
    setPortfolioPage(1);
    portfolioPageRef.current = 1;
    setPortfolioRows([]);
    setRevenueByOrg(null);

    fetch(`/api/portfolio-data?page=1&pageSize=${PORTFOLIO_PAGE_SIZE}${portfolioApiFilterQuery}`)
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
  }, [portfolioApiFilterQuery]);

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
        const excludeEins = portfolioRowsRef.current
          .map((r) => ein9FromRow(r))
          .filter((e): e is string => e !== null);
        const excludeQ =
          excludeEins.length > 0
            ? `&excludeEins=${encodeURIComponent(excludeEins.join(","))}`
            : "";
        fetch(
          `/api/portfolio-data?page=${nextPage}&pageSize=${PORTFOLIO_PAGE_SIZE}${excludeQ}${portfolioApiFilterQuery}`,
        )
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
  }, [portfolioReady, portfolioHasMore, loadingMore, portfolioRows.length, portfolioApiFilterQuery]);

  useEffect(() => {
    if (view === "detail" && portfolioReady && portfolioRows.length === 0) {
      router.replace(buildPortfolioHomeHref());
      startTransition(() => setView("home"));
    }
  }, [view, portfolioReady, portfolioRows.length, router, buildPortfolioHomeHref]);

  /** Sync `view` / selection from `?org=` (including browser back/forward). */
  useEffect(() => {
    if (!portfolioReady) return;

    if (!orgParamDecoded) {
      startTransition(() => {
        setView("home");
        if (portfolioRows.length > 0) {
          setSelectedOrgId((prev) => {
            if (prev && portfolioRows.some((r) => r.id === prev)) return prev;
            return portfolioRows[0]!.id;
          });
        }
      });
      return;
    }

    startTransition(() => {
      setSelectedOrgId(orgParamDecoded);
      setView("detail");
    });
  }, [portfolioReady, orgParamDecoded, portfolioRows]);

  /** Deep link: load more portfolio pages until `org` appears (or none left). */
  useEffect(() => {
    if (!portfolioReady || !orgParamDecoded) return;
    if (portfolioRows.some((r) => r.id === orgParamDecoded)) return;
    if (!portfolioHasMore || loadingMore) return;
    if (loadMoreInFlightRef.current) return;

    const nextPage = portfolioPageRef.current + 1;
    loadMoreInFlightRef.current = true;
    setLoadingMore(true);
    const excludeEins = portfolioRowsRef.current
      .map((r) => ein9FromRow(r))
      .filter((e): e is string => e !== null);
    const excludeQ =
      excludeEins.length > 0 ? `&excludeEins=${encodeURIComponent(excludeEins.join(","))}` : "";
    fetch(
      `/api/portfolio-data?page=${nextPage}&pageSize=${PORTFOLIO_PAGE_SIZE}${excludeQ}${portfolioApiFilterQuery}`,
    )
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
  }, [portfolioReady, orgParamDecoded, portfolioRows, portfolioHasMore, loadingMore, portfolioApiFilterQuery]);

  /** Unknown `org` after loading all pages — clear the param and return home. */
  useEffect(() => {
    if (!portfolioReady || !orgParamDecoded) return;
    if (portfolioRows.some((r) => r.id === orgParamDecoded)) return;
    if (portfolioHasMore || loadingMore) return;

    router.replace(buildPortfolioHomeHref());
    startTransition(() => {
      setView("home");
      if (portfolioRows.length > 0) {
        setSelectedOrgId(portfolioRows[0]!.id);
      }
    });
  }, [
    portfolioReady,
    orgParamDecoded,
    portfolioRows,
    portfolioHasMore,
    loadingMore,
    router,
    buildPortfolioHomeHref,
  ]);

  const selectedRow = useMemo((): ScreenerRow | undefined => {
    if (portfolioRows.length === 0) return undefined;
    if (view === "detail" && selectedOrgId) {
      return portfolioRows.find((r) => r.id === selectedOrgId);
    }
    if (selectedOrgId) {
      return portfolioRows.find((r) => r.id === selectedOrgId) ?? portfolioRows[0];
    }
    return portfolioRows[0];
  }, [view, selectedOrgId, portfolioRows]);

  const detail: OrgDetail | undefined = useMemo(() => {
    if (!selectedRow) return undefined;
    return buildLiveOrgDetail(selectedRow, portfolioRows, revenueByOrg);
  }, [selectedRow, portfolioRows, revenueByOrg]);

  const benchmarkRows = useMemo(() => detail?.peerBenchmarks.slice(0, 4) ?? [], [detail]);

  const similarOrgRows = useMemo(() => {
    if (!selectedRow) return [];
    return pickSimilarOrganizationRows(portfolioRows, selectedRow, SIMILAR_ORG_MAX);
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

  useLayoutEffect(() => {
    if (view !== "detail") {
      setMosaicLayout(undefined);
      return;
    }
    const mq = window.matchMedia(MOBILE_MQ);

    const sync = () => {
      if (mq.matches) {
        setMosaicLayout(undefined);
        return;
      }
      setMosaicLayout({ metricsSide: MOSAIC_METRICS_GRID_SIDE_PX });
    };

    sync();
    mq.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
    };
  }, [view, selectedOrgId]);

  return (
    <div className="tp-dashboard-shell">
      {!embedded ? (
        <header className="tp-dash-top">
          <div className="tp-dash-brand">
            <h1>Tipping Point</h1>
            <p>Aggies Data Hackathon 2026 · nonprofit resilience triage</p>
          </div>
        </header>
      ) : null}

      <div className="hp-dash" data-layer="tipping-point-dashboard">
        {view === "home" ? (
          <section className="hp-sec" aria-label="Organizations">
            <div className="tp-portfolio-home-hero">
              <h2 className="tp-portfolio-home-question">What nonprofit can we help?</h2>
            </div>
            <div className="tp-portfolio-home-toolbar">
              <div className="tp-portfolio-home-toolbar-inner">
                <PortfolioReserveFilter value={reserveBand} onChange={setReserveBand} />
                <PortfolioAssetsFilter value={assetsBand} onChange={setAssetsBand} />
                <PortfolioRevenueFilter value={revenueBand} onChange={setRevenueBand} />
                <PortfolioBoardFilter value={boardBand} onChange={setBoardBand} />
                <PortfolioEmployeesFilter value={employeeBand} onChange={setEmployeeBand} />
                <PortfolioVolunteerFilter value={volunteerBand} onChange={setVolunteerBand} />
                <PortfolioStateFilter value={stateFilter} onChange={setStateFilter} />
              </div>
            </div>
            <div className="tp-portfolio-home-list" aria-busy={!portfolioReady}>
              {!portfolioReady ? (
                <>
                  <p className="tp-visually-hidden">Loading portfolio…</p>
                  {Array.from({ length: PORTFOLIO_HOME_SKELETON_ROWS }, (_, i) => (
                    <PortfolioRowSkeleton key={`portfolio-skel-${i}`} />
                  ))}
                </>
              ) : portfolioRows.length === 0 ? (
                <p className="tp-body tp-portfolio-home-empty">
                  {portfolioError ?? EM_DASH}
                </p>
              ) : (
                <>
                  {portfolioRows.map((row) => (
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
                        <p className="tp-people-role">
                          {row.city}, {row.state}
                        </p>
                      </div>
                    </Link>
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
        ) : view === "detail" && orgParamDecoded && (!selectedRow || !detail) ? (
          <section className="hp-sec" aria-label="Organization">
            <div className="tp-org-detail-stack">
              <div className="tp-org-detail-toolbar">
                <Link
                  href={buildPortfolioHomeHref()}
                  scroll={false}
                  className="tp-back-button"
                  aria-label="Back to portfolio"
                >
                  <ChevronLeftIcon />
                  Back
                </Link>
                <OrgDetailShareButton shareTitle={SHARE_FALLBACK_TITLE} />
              </div>
              <p className="tp-body tp-portfolio-home-empty">
                {portfolioHasMore || loadingMore
                  ? "Loading organization…"
                  : "Organization not found in portfolio."}
              </p>
            </div>
          </section>
        ) : selectedRow && detail ? (
          <>
            <div className="tp-org-detail-stack">
              <div className="tp-org-detail-toolbar">
                <Link
                  href={buildPortfolioHomeHref()}
                  scroll={false}
                  className="tp-back-button"
                  aria-label="Back to portfolio"
                >
                  <ChevronLeftIcon />
                  Back
                </Link>
                <OrgDetailShareButton shareTitle={selectedRow.organizationName} />
              </div>

              <section className="hp-sec tp-overview-sec" aria-label="Organization overview">
              <div className="hp-mosaic" ref={mosaicRef}>
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
                <p className="tp-kicker">YoY revenue</p>
                <p className="tp-metric-value">{formatSignedPercent(selectedRow.growthRate)}</p>
              </div>
              <div className="tp-card tp-card-stacked tp-mosaic-metric-tile">
                <p className="tp-kicker">Reserve coverage</p>
                <p
                  className={`tp-metric-value${reserveCoverageIsLow(selectedRow.reserveMonths) ? " tp-screen-score--critical" : ""}`}
                  style={{ fontSize: 18 }}
                >
                  {formatReserveCoverage(selectedRow.reserveMonths)}
                </p>
              </div>
              <div className="tp-card tp-card-stacked tp-mosaic-metric-tile">
                <p className="tp-kicker">Revenue</p>
                <p className="tp-metric-value" style={{ fontSize: 18 }}>
                  {formatUsdFull(selectedRow.revenue)}
                </p>
              </div>
            </div>
          </div>

              <div className="tp-revenue-wide">
                <RevenueHistoryChart ein={selectedRow.ein} />
                <OrgDetailMetaChips
                  ein={selectedRow.ein}
                  initialWebsiteUrl={selectedRow.websiteUrl}
                  foundedYear={selectedRow.foundedYear}
                  employeeCount={selectedRow.employeeCount}
                  volunteerCount={selectedRow.volunteerCount}
                />
              </div>
            </section>
            </div>

                <OrgPeopleSection ein={selectedRow.ein} />

                <section className="hp-sec" aria-label="Similar organizations">
              <h2 className="hp-sec-title">Similar organizations</h2>
              <div className="tp-portfolio-home-list">
                {similarOrgRows.length === 0 ? (
                  <p className="tp-body tp-portfolio-home-empty">
                    No other organizations are in your loaded list yet. Go back to the portfolio and load more
                    rows to see peers ranked by similar reserve coverage, then similar revenue.
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
                        <p className="tp-people-role">
                          {row.city}, {row.state}
                        </p>
                      </div>
                      <span
                        className={`tp-metric-value tp-portfolio-list-metric ${screenScoreToneClasses(row.screenScore)}`}
                        aria-label={`Screener score ${row.screenScore}`}
                      >
                        {row.screenScore}
                      </span>
                    </Link>
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
                  <p
                    className={`tp-body tp-panel-compare-value${
                      row.label === "Reserve months" && reserveCoverageIsLow(row.orgValue)
                        ? " tp-reserve-coverage-low"
                        : ""
                    }`}
                  >
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
              {benchmarkRows.map((row) => {
                const peerMetric = panelPeerBenchmarkValue(row.label, row.peerMedian);
                return (
                  <div key={`peer-${row.label}`} className="tp-panel-compare-row">
                    <p className="tp-kicker">{row.label}</p>
                    <p
                      className={`tp-body tp-panel-compare-value${
                        row.label === "Reserve months" && reserveCoverageIsLow(peerMetric)
                          ? " tp-reserve-coverage-low"
                          : ""
                      }`}
                    >
                      {formatBenchmarkValue(row.label, peerMetric)}
                    </p>
                  </div>
                );
              })}
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
      </div>
    </div>
  );
}

export function TippingPointDashboard(props: { embedded?: boolean }) {
  return (
    <Suspense fallback={<TippingPointDashboardFallback embedded={props.embedded} />}>
      <TippingPointDashboardInner {...props} />
    </Suspense>
  );
}
