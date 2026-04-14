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
import { staffPerMillion } from "@/lib/peer-benchmarks";
import type { OrgDetail, OrgPerson990, ScreenerRow } from "@/lib/types";
import { METRICS_COMPARE_MEDIAN } from "./metrics-compare-peer-picker";
import { OrgLogoAvatar } from "./org-logo-avatar";
import { websiteUrlToDomain } from "@/lib/website-url";
import type { AssetsBandSelection } from "@/lib/assets-band";
import type { RevenueBandSelection } from "@/lib/revenue-band";
import type { ReserveBandSelection } from "@/lib/reserve-band";
import type { BoardBandSelection } from "@/lib/board-band";
import type { CountBandSelection, StateAbbrevSelection } from "@/lib/portfolio-toolbar-bands";
import {
  PortfolioBoardFilter,
  PortfolioEmployeesFilter,
  PortfolioStateFilter,
  PortfolioVolunteerFilter,
} from "./portfolio-extra-filters";
import { PortfolioAssetsFilter } from "./portfolio-assets-filter";
import { PortfolioRevenueFilter } from "./portfolio-revenue-filter";
import { PortfolioReserveFilter } from "./portfolio-reserve-filter";
import { buildOrgRecommendationsPayload } from "@/lib/build-org-recommendations-payload";
import type { OrgRecommendationsAiResponse } from "@/lib/org-recommendations-types";
import { useDashboardShell } from "@/dashboard-ui/shell-context";
import { buildLiveOrgDetail, EM_DASH } from "./tipping-point-live-detail";
import { pickSimilarOrganizationRows } from "@/lib/similar-orgs";
import { getCachedOrgRecommendations, setCachedOrgRecommendations } from "./org-detail-fetch-cache";
import { OrgDetailDesktopRail } from "./org-detail-desktop-rail";
import { OrgDetailMainSections } from "./org-detail-main-sections";
import { OrgDetailPanelToolbar } from "./org-detail-panel-toolbar";
import { OrgDetailSheet } from "./org-detail-sheet";
import {
  PortfolioOrgCardMeta,
  type PortfolioCardMetaFilterContext,
} from "./portfolio-org-card-meta";
import { rowsMatchDeepLink, sanitizeReturnChatParam } from "@/lib/teos-org-id";
import { syncTeosOrgSnapshotForChat } from "@/lib/teos-org-chat-snapshot";
import {
  DEFAULT_PORTFOLIO_FILTERS,
  readPersistedPortfolioFilters,
  writePersistedPortfolioFilters,
} from "@/lib/portfolio-filters-storage";

const MOBILE_MQ = "(max-width: 767px)";
const SIMILAR_ORG_MAX = 6;
const PORTFOLIO_PAGE_SIZE = 20;
const PORTFOLIO_HOME_SKELETON_ROWS = 10;
const SHARE_FALLBACK_TITLE = "Tipping Point";
const PORTFOLIO_EMPTY_LIST_MESSAGE = "Sorry! No organizations match this search.";

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

function TippingPointDashboardInner({
  embedded = false,
  railOnly = false,
}: {
  embedded?: boolean;
  /** When true with `embedded`, hide the portfolio list — org rail/sheet only (e.g. chat route with `?org=`). */
  railOnly?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const { isMobile: shellIsMobile } = useDashboardShell();
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
  const [assetsBands, setAssetsBands] = useState<AssetsBandSelection>(DEFAULT_PORTFOLIO_FILTERS.assetsBands);
  const [revenueBands, setRevenueBands] = useState<RevenueBandSelection>(DEFAULT_PORTFOLIO_FILTERS.revenueBands);
  const [reserveBands, setReserveBands] = useState<ReserveBandSelection>(DEFAULT_PORTFOLIO_FILTERS.reserveBands);
  const [employeeBands, setEmployeeBands] = useState<CountBandSelection>(DEFAULT_PORTFOLIO_FILTERS.employeeBands);
  const [volunteerBands, setVolunteerBands] = useState<CountBandSelection>(DEFAULT_PORTFOLIO_FILTERS.volunteerBands);
  const [boardBands, setBoardBands] = useState<BoardBandSelection>(DEFAULT_PORTFOLIO_FILTERS.boardBands);
  const [stateAbbrevs, setStateAbbrevs] = useState<StateAbbrevSelection>(DEFAULT_PORTFOLIO_FILTERS.stateAbbrevs);
  const [portfolioFiltersLoaded, setPortfolioFiltersLoaded] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [metricsComparePeerId, setMetricsComparePeerId] = useState<string>(METRICS_COMPARE_MEDIAN);
  const metricsCompareInitRef = useRef(false);
  const portfolioPageRef = useRef(1);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMoreInFlightRef = useRef(false);
  const portfolioRowsRef = useRef<ScreenerRow[]>([]);
  portfolioRowsRef.current = portfolioRows;
  /** Part VII people keyed by 9-digit EIN — prefetched for every org on the loaded portfolio list. */
  const [peopleByEin, setPeopleByEin] = useState<Record<string, OrgPerson990[]>>({});
  const peopleByEinRef = useRef<Record<string, OrgPerson990[]>>({});
  peopleByEinRef.current = peopleByEin;

  /** After automatic retries, single-org fetch still failed (show Try again). */
  const [deepLinkHydrateFailed, setDeepLinkHydrateFailed] = useState(false);
  const [hydrateRetryNonce, setHydrateRetryNonce] = useState(0);

  const [orgRecommendations, setOrgRecommendations] = useState<OrgRecommendationsAiResponse | null>(null);
  const [orgRecommendationsLoading, setOrgRecommendationsLoading] = useState(false);
  const [orgRecommendationsError, setOrgRecommendationsError] = useState<string | null>(null);
  const orgRecommendationsAbortRef = useRef<AbortController | null>(null);

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

  const returnChatPath = useMemo(
    () => sanitizeReturnChatParam(searchParams.get("returnChat")),
    [searchParams],
  );

  /** Back from org detail: return to chat session when opened from chat cards. */
  const buildDetailBackHref = useCallback(() => {
    if (returnChatPath) return returnChatPath;
    return buildPortfolioHomeHref();
  }, [returnChatPath, buildPortfolioHomeHref]);

  const closeOrgPanel = useCallback(() => {
    if (returnChatPath) {
      router.push(returnChatPath);
      return;
    }
    router.replace(buildPortfolioHomeHref());
  }, [router, returnChatPath, buildPortfolioHomeHref]);

  useEffect(() => {
    portfolioPageRef.current = portfolioPage;
  }, [portfolioPage]);

  useLayoutEffect(() => {
    const f = readPersistedPortfolioFilters();
    setAssetsBands(f.assetsBands);
    setRevenueBands(f.revenueBands);
    setReserveBands(f.reserveBands);
    setEmployeeBands(f.employeeBands);
    setVolunteerBands(f.volunteerBands);
    setBoardBands(f.boardBands);
    setStateAbbrevs(f.stateAbbrevs);
    setPortfolioFiltersLoaded(true);
  }, []);

  useEffect(() => {
    if (!portfolioFiltersLoaded) return;
    writePersistedPortfolioFilters({
      assetsBands,
      revenueBands,
      reserveBands,
      employeeBands,
      volunteerBands,
      boardBands,
      stateAbbrevs,
    });
  }, [
    portfolioFiltersLoaded,
    assetsBands,
    revenueBands,
    reserveBands,
    employeeBands,
    volunteerBands,
    boardBands,
    stateAbbrevs,
  ]);

  const portfolioApiFilterQuery = useMemo(() => {
    const parts: string[] = [];
    if (assetsBands.length > 0) parts.push(`assetsBands=${encodeURIComponent(assetsBands.join(","))}`);
    if (revenueBands.length > 0) parts.push(`revenueBands=${encodeURIComponent(revenueBands.join(","))}`);
    if (reserveBands.length > 0) parts.push(`reserveBands=${encodeURIComponent(reserveBands.join(","))}`);
    if (employeeBands.length > 0) parts.push(`employeeBands=${encodeURIComponent(employeeBands.join(","))}`);
    if (volunteerBands.length > 0) parts.push(`volunteerBands=${encodeURIComponent(volunteerBands.join(","))}`);
    if (boardBands.length > 0) parts.push(`boardBands=${encodeURIComponent(boardBands.join(","))}`);
    if (stateAbbrevs.length > 0) parts.push(`states=${encodeURIComponent(stateAbbrevs.join(","))}`);
    return parts.length ? `&${parts.join("&")}` : "";
  }, [
    assetsBands,
    revenueBands,
    reserveBands,
    employeeBands,
    volunteerBands,
    boardBands,
    stateAbbrevs,
  ]);

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
    setPeopleByEin({});

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
          setPortfolioError(null);
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

  /** Prefetch Part VII people for every org currently in the portfolio list (detail view reuses cache). */
  useEffect(() => {
    if (!portfolioReady || portfolioRows.length === 0) return;
    const eins = [
      ...new Set(
        portfolioRows.map((r) => ein9FromRow(r)).filter((e): e is string => e !== null),
      ),
    ];
    const toFetch = eins.filter((ein) => !Object.hasOwn(peopleByEinRef.current, ein));
    if (toFetch.length === 0) return;
    let cancelled = false;
    void (async () => {
      const results = await Promise.all(
        toFetch.map(async (ein) => {
          try {
            const res = await fetch(`/api/org-people?ein=${encodeURIComponent(ein)}`);
            const body = (await res.json()) as { people?: OrgPerson990[] };
            return [ein, Array.isArray(body.people) ? body.people : []] as const;
          } catch {
            return [ein, []] as const;
          }
        }),
      );
      if (cancelled) return;
      setPeopleByEin((prev) => {
        const next = { ...prev };
        for (const [ein, list] of results) {
          if (!Object.hasOwn(next, ein)) next[ein] = [...list];
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [portfolioReady, portfolioRows]);

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
      if (orgParamDecoded) return;
      router.replace(buildPortfolioHomeHref());
      startTransition(() => setView("home"));
    }
  }, [view, portfolioReady, portfolioRows.length, router, buildPortfolioHomeHref, orgParamDecoded]);

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
      setView(embedded ? "home" : "detail");
    });
  }, [portfolioReady, orgParamDecoded, portfolioRows, embedded]);

  /** Deep link: load more portfolio pages until `org` appears (or none left). */
  useEffect(() => {
    if (!portfolioReady || !orgParamDecoded) return;
    if (portfolioRows.some((r) => rowsMatchDeepLink(r, orgParamDecoded))) return;
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

  useEffect(() => {
    setDeepLinkHydrateFailed(false);
  }, [orgParamDecoded]);

  /**
   * Deep link from chat/search: org may never appear in the random portfolio.
   * Fetch the single TEOS row via `/api/portfolio-org` with automatic retries.
   */
  useEffect(() => {
    if (!orgParamDecoded || !portfolioReady) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    let attempt = 0;
    let cancelled = false;

    const clearTimers = () => {
      for (const t of timers) clearTimeout(t);
      timers.length = 0;
    };

    const schedule = (fn: () => void, ms: number) => {
      const t = setTimeout(fn, ms);
      timers.push(t);
    };

    const run = async () => {
      if (cancelled) return;
      if (portfolioRowsRef.current.some((r) => rowsMatchDeepLink(r, orgParamDecoded))) {
        setDeepLinkHydrateFailed(false);
        return;
      }
      try {
        const res = await fetch(
          `/api/portfolio-org?orgId=${encodeURIComponent(orgParamDecoded)}`,
          { cache: "no-store" },
        );
        const data = (await res.json().catch(() => ({}))) as {
          screener?: ScreenerRow[];
          revenueByOrg?: Record<string, { currentYearRevenue: number; priorYearRevenue: number }>;
        };
        if (!res.ok || !data.screener?.[0]) throw new Error("missing");
        const row = data.screener[0];
        if (cancelled) return;
        setPortfolioRows((prev) => {
          if (prev.some((p) => rowsMatchDeepLink(p, orgParamDecoded))) return prev;
          if (prev.some((p) => p.id === row.id)) return prev;
          return [row, ...prev];
        });
        setRevenueByOrg((prev) => ({ ...(prev ?? {}), ...(data.revenueByOrg ?? {}) }));
        setDeepLinkHydrateFailed(false);
        if (row.id !== orgParamDecoded) {
          const q = new URLSearchParams(searchParams.toString());
          q.set("org", row.id);
          const s = q.toString();
          router.replace(s ? `${pathname}?${s}` : pathname);
        }
      } catch {
        if (cancelled) return;
        attempt += 1;
        if (attempt >= 28) {
          setDeepLinkHydrateFailed(true);
          return;
        }
        schedule(() => void run(), Math.min(8000, 900 + attempt * 350));
      }
    };

    void run();

    return () => {
      cancelled = true;
      clearTimers();
    };
  }, [orgParamDecoded, portfolioReady, pathname, router, searchParams, hydrateRetryNonce]);

  const selectedRow = useMemo((): ScreenerRow | undefined => {
    if (portfolioRows.length === 0) return undefined;
    const fromOrgUrl = Boolean(orgParamDecoded) && (embedded || view === "detail");
    if (fromOrgUrl && orgParamDecoded) {
      const byLink = portfolioRows.find((r) => rowsMatchDeepLink(r, orgParamDecoded));
      if (byLink) return byLink;
    }
    if (view === "detail" && selectedOrgId) {
      return portfolioRows.find((r) => r.id === selectedOrgId);
    }
    if (selectedOrgId) {
      return portfolioRows.find((r) => r.id === selectedOrgId) ?? portfolioRows[0];
    }
    return portfolioRows[0];
  }, [view, selectedOrgId, portfolioRows, orgParamDecoded, embedded]);

  /** Lets the chat composer name the org the user is viewing (`?org=`) without re-fetching. */
  useEffect(() => {
    if (!orgParamDecoded) {
      syncTeosOrgSnapshotForChat(undefined);
      return;
    }
    if (!selectedRow) return;
    syncTeosOrgSnapshotForChat({
      orgId: selectedRow.id,
      name: selectedRow.organizationName,
      city: selectedRow.city,
      state: selectedRow.state,
      ein: selectedRow.ein,
      websiteDomain: websiteUrlToDomain(selectedRow.websiteUrl) ?? "",
      logoDomain: selectedRow.logoDomain,
      logoImageUrl: selectedRow.logoImageUrl,
    });
  }, [orgParamDecoded, selectedRow]);

  const detail: OrgDetail | undefined = useMemo(() => {
    if (!selectedRow) return undefined;
    return buildLiveOrgDetail(selectedRow, portfolioRows, revenueByOrg);
  }, [selectedRow, portfolioRows, revenueByOrg]);

  const similarOrgRows = useMemo(() => {
    if (!selectedRow) return [];
    return pickSimilarOrganizationRows(portfolioRows, selectedRow, SIMILAR_ORG_MAX);
  }, [portfolioRows, selectedRow]);

  /** Portfolio list order — prev/next org in mosaic (web.tsx-style horizontal nav). */
  const orgDeckIndex = useMemo(() => {
    if (!selectedRow) return -1;
    return portfolioRows.findIndex((r) => r.id === selectedRow.id);
  }, [portfolioRows, selectedRow]);

  const goPrevOrg = useCallback(() => {
    if (orgDeckIndex <= 0) return;
    const row = portfolioRows[orgDeckIndex - 1];
    if (!row) return;
    startTransition(() => {
      router.replace(buildOrgHref(row.id));
    });
  }, [orgDeckIndex, portfolioRows, router, buildOrgHref]);

  const goNextOrg = useCallback(() => {
    if (orgDeckIndex < 0 || orgDeckIndex >= portfolioRows.length - 1) return;
    const row = portfolioRows[orgDeckIndex + 1];
    if (!row) return;
    startTransition(() => {
      router.replace(buildOrgHref(row.id));
    });
  }, [orgDeckIndex, portfolioRows, router, buildOrgHref]);

  useEffect(() => {
    if (!orgParamDecoded || orgDeckIndex < 0) return;
    if (!embedded && view !== "detail") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, [contenteditable=true]")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      if (e.key === "ArrowLeft") goPrevOrg();
      else goNextOrg();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [orgParamDecoded, orgDeckIndex, embedded, view, goPrevOrg, goNextOrg]);

  const selectedEin9 = useMemo(
    () => (selectedRow ? ein9FromRow(selectedRow) : null),
    [selectedRow],
  );

  const detailPeoplePrefetched = useMemo((): OrgPerson990[] | undefined => {
    if (selectedEin9 == null) return undefined;
    return Object.hasOwn(peopleByEin, selectedEin9) ? peopleByEin[selectedEin9] : undefined;
  }, [selectedEin9, peopleByEin]);

  const orgDetailRouteActive =
    (embedded && Boolean(orgParamDecoded)) || (!embedded && view === "detail");

  /** OpenAI: scenario / memo / evidence from aggregated org + peer + people context. */
  useEffect(() => {
    if (!orgDetailRouteActive || !selectedRow || !detail) {
      orgRecommendationsAbortRef.current?.abort();
      setOrgRecommendations(null);
      setOrgRecommendationsError(null);
      setOrgRecommendationsLoading(false);
      return;
    }

    const cachedRec = getCachedOrgRecommendations(selectedRow.id);
    if (cachedRec) {
      setOrgRecommendations(cachedRec);
      setOrgRecommendationsError(null);
      setOrgRecommendationsLoading(false);
      return;
    }

    if (selectedEin9 != null && !Object.hasOwn(peopleByEin, selectedEin9)) {
      setOrgRecommendations(null);
      setOrgRecommendationsError(null);
      setOrgRecommendationsLoading(true);
      return;
    }

    const people: OrgPerson990[] =
      selectedEin9 != null && Object.hasOwn(peopleByEin, selectedEin9)
        ? peopleByEin[selectedEin9]!
        : [];

    const ac = new AbortController();
    orgRecommendationsAbortRef.current?.abort();
    orgRecommendationsAbortRef.current = ac;

    setOrgRecommendationsLoading(true);
    setOrgRecommendationsError(null);
    setOrgRecommendations(null);

    const payload = buildOrgRecommendationsPayload(
      selectedRow,
      detail,
      portfolioRows,
      similarOrgRows,
      people,
    );

    fetch("/api/org-recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ac.signal,
      cache: "no-store",
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as OrgRecommendationsAiResponse & { error?: string };
        if (!res.ok) {
          throw new Error(typeof body.error === "string" ? body.error : `HTTP ${res.status}`);
        }
        return body as OrgRecommendationsAiResponse;
      })
      .then((data) => {
        if (!data.scenario || !data.memo?.bullets?.length || !data.evidence) {
          throw new Error("Incomplete recommendations response");
        }
        setCachedOrgRecommendations(selectedRow.id, data);
        setOrgRecommendations(data);
        setOrgRecommendationsError(null);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setOrgRecommendations(null);
        setOrgRecommendationsError(e instanceof Error ? e.message : "Could not load recommendations.");
      })
      .finally(() => {
        if (!ac.signal.aborted) setOrgRecommendationsLoading(false);
      });

    return () => ac.abort();
  }, [
    orgDetailRouteActive,
    selectedRow,
    detail,
    portfolioRows,
    similarOrgRows,
    selectedEin9,
    peopleByEin,
  ]);

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

  const panelPeerBenchmarkValue = useCallback(
    (label: string, peerMedianFallback: number | null): number | null => {
      if (!panelComparePeerRow) return peerMedianFallback;
      if (label === "Reserve months") return panelComparePeerRow.reserveMonths;
      if (label === "Revenue growth %") return panelComparePeerRow.growthRate;
      if (label === "Staff per $1M") return staffPerMillion(panelComparePeerRow);
      if (label === "Program expenses") return panelComparePeerRow.programServiceExpensesUsd ?? null;
      if (label === "Admin expenses") return panelComparePeerRow.managementGeneralExpensesUsd ?? null;
      if (label === "Fundraising expenses") return panelComparePeerRow.fundraisingExpensesUsd ?? null;
      return peerMedianFallback;
    },
    [panelComparePeerRow],
  );

  const visibleBenchmarkRows = useMemo(() => {
    const rows = detail?.peerBenchmarks ?? [];
    return rows.filter((row) => {
      const peerV = panelPeerBenchmarkValue(row.label, row.peerMedian);
      return !(row.orgValue === null && peerV === null);
    });
  }, [detail, panelPeerBenchmarkValue]);

  const portfolioCardMetaFilterContext = useMemo((): PortfolioCardMetaFilterContext => {
    return { stateAbbrevs, volunteerBands, employeeBands };
  }, [stateAbbrevs, volunteerBands, employeeBands]);

  const orgDetailToolbar = (
    <OrgDetailPanelToolbar
      shareTitle={selectedRow?.organizationName ?? SHARE_FALLBACK_TITLE}
      onClose={closeOrgPanel}
    />
  );

  const orgDetailInner =
    orgParamDecoded && (!selectedRow || !detail) ? (
      <div className="tp-org-detail-stack" style={{ paddingTop: 4 }}>
        <p className="tp-body tp-portfolio-home-empty">
          {deepLinkHydrateFailed
            ? "Still having trouble loading this organization."
            : portfolioHasMore || loadingMore || (orgParamDecoded && !selectedRow)
              ? "Loading organization…"
              : "Organization not found."}
        </p>
        {deepLinkHydrateFailed ? (
          <p className="tp-body" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="tp-panel-compare-peer-trigger"
              style={{ cursor: "pointer" }}
              onClick={() => {
                setDeepLinkHydrateFailed(false);
                setHydrateRetryNonce((n) => n + 1);
              }}
            >
              Try again
            </button>
          </p>
        ) : null}
      </div>
    ) : selectedRow && detail ? (
      <OrgDetailMainSections
        selectedRow={selectedRow}
        detail={detail}
        detailPeoplePrefetched={detailPeoplePrefetched}
        similarOrgRows={similarOrgRows}
        buildOrgHref={buildOrgHref}
        portfolioCardMetaFilterContext={portfolioCardMetaFilterContext}
        metricsCompareOptions={metricsCompareOptions}
        metricsComparePeerId={metricsComparePeerId}
        onMetricsComparePeerId={setMetricsComparePeerId}
        visibleBenchmarkRows={visibleBenchmarkRows}
        panelPeerBenchmarkValue={panelPeerBenchmarkValue}
        panelComparePeerRow={panelComparePeerRow}
        orgRecommendations={orgRecommendations}
        orgRecommendationsLoading={orgRecommendationsLoading}
        orgRecommendationsError={orgRecommendationsError}
        selectedEin9={selectedEin9}
        peopleByEin={peopleByEin}
      />
    ) : null;

  const showPortfolioList = (embedded && !railOnly) || (!embedded && view === "home");

  return (
    <div className={`tp-dashboard-shell${railOnly ? " tp-dashboard-shell--rail-only" : ""}`}>
      {!embedded ? (
        <header className="tp-dash-top">
          <div className="tp-dash-brand">
            <h1>Tipping Point</h1>
            <p>Aggies Data Hackathon 2026 · nonprofit resilience triage</p>
          </div>
        </header>
      ) : null}

      <div className="hp-dash" data-layer="tipping-point-dashboard">
        {showPortfolioList ? (
          <section className="hp-sec" aria-label="Organizations">
            <div className="tp-portfolio-home-hero">
              <h2 className="tp-portfolio-home-question">What nonprofit can we help?</h2>
            </div>
            <div className="tp-portfolio-home-toolbar">
              <div className="tp-portfolio-home-toolbar-inner">
                <PortfolioReserveFilter value={reserveBands} onChange={setReserveBands} />
                <PortfolioAssetsFilter value={assetsBands} onChange={setAssetsBands} />
                <PortfolioRevenueFilter value={revenueBands} onChange={setRevenueBands} />
                <PortfolioEmployeesFilter value={employeeBands} onChange={setEmployeeBands} />
                <PortfolioVolunteerFilter value={volunteerBands} onChange={setVolunteerBands} />
                <PortfolioBoardFilter value={boardBands} onChange={setBoardBands} />
                <PortfolioStateFilter value={stateAbbrevs} onChange={setStateAbbrevs} />
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
                  {!portfolioError || portfolioError === "No portfolio data"
                    ? PORTFOLIO_EMPTY_LIST_MESSAGE
                    : portfolioError}
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
                        <PortfolioOrgCardMeta row={row} filterContext={portfolioCardMetaFilterContext} />
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
        ) : null}

        {embedded && orgParamDecoded ? (
          shellIsMobile ? (
            <OrgDetailSheet
              open={Boolean(orgParamDecoded)}
              onClose={closeOrgPanel}
              onSwipePrev={goPrevOrg}
              onSwipeNext={goNextOrg}
              swipePrevEnabled={orgDeckIndex > 0}
              swipeNextEnabled={orgDeckIndex >= 0 && orgDeckIndex < portfolioRows.length - 1}
              toolbar={orgDetailToolbar}
            >
              {orgDetailInner}
            </OrgDetailSheet>
          ) : (
            <OrgDetailDesktopRail open={Boolean(orgParamDecoded)} onClose={closeOrgPanel} toolbar={orgDetailToolbar}>
              {orgDetailInner}
            </OrgDetailDesktopRail>
          )
        ) : null}

        {!embedded && view === "detail" && orgParamDecoded && (!selectedRow || !detail) ? (
          <section className="hp-sec" aria-label="Organization">
            <div className="tp-org-detail-stack">
              <div className="tp-org-detail-toolbar tp-org-detail-toolbar--page">
                <OrgDetailPanelToolbar shareTitle={SHARE_FALLBACK_TITLE} onClose={closeOrgPanel} />
              </div>
              <p className="tp-body tp-portfolio-home-empty">
                {deepLinkHydrateFailed
                  ? "Still having trouble loading this organization."
                  : portfolioHasMore || loadingMore || (orgParamDecoded && !selectedRow)
                    ? "Loading organization…"
                    : "Organization not found."}
              </p>
              {deepLinkHydrateFailed ? (
                <p className="tp-body" style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    className="tp-panel-compare-peer-trigger"
                    style={{ cursor: "pointer" }}
                    onClick={() => {
                      setDeepLinkHydrateFailed(false);
                      setHydrateRetryNonce((n) => n + 1);
                    }}
                  >
                    Try again
                  </button>
                </p>
              ) : null}
            </div>
          </section>
        ) : !embedded && selectedRow && detail && view === "detail" ? (
          <>
            <div className="tp-org-detail-toolbar tp-org-detail-toolbar--page">
              <OrgDetailPanelToolbar shareTitle={selectedRow.organizationName} onClose={closeOrgPanel} />
            </div>
            <OrgDetailMainSections
              selectedRow={selectedRow}
              detail={detail}
              detailPeoplePrefetched={detailPeoplePrefetched}
              similarOrgRows={similarOrgRows}
              buildOrgHref={buildOrgHref}
              portfolioCardMetaFilterContext={portfolioCardMetaFilterContext}
              metricsCompareOptions={metricsCompareOptions}
              metricsComparePeerId={metricsComparePeerId}
              onMetricsComparePeerId={setMetricsComparePeerId}
              visibleBenchmarkRows={visibleBenchmarkRows}
              panelPeerBenchmarkValue={panelPeerBenchmarkValue}
              panelComparePeerRow={panelComparePeerRow}
              orgRecommendations={orgRecommendations}
              orgRecommendationsLoading={orgRecommendationsLoading}
              orgRecommendationsError={orgRecommendationsError}
              selectedEin9={selectedEin9}
              peopleByEin={peopleByEin}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

export function TippingPointDashboard(props: { embedded?: boolean; railOnly?: boolean }) {
  return (
    <Suspense fallback={<TippingPointDashboardFallback embedded={props.embedded} />}>
      <TippingPointDashboardInner {...props} />
    </Suspense>
  );
}
