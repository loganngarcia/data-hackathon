"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { formatCompactCurrency, formatUsdFull } from "@/lib/format-display";

type FilingPoint = { year: number; revenue: number };

type FilingsPayload = {
  ein: string;
  organizationName: string;
  sourceName: string;
  sourceUrl: string;
  points: FilingPoint[];
  error?: string;
};

type Projected = FilingPoint & { x: number; y: number };

function layoutSeries(
  points: FilingPoint[],
  width: number,
  height: number,
  pad: { t: number; r: number; b: number; l: number },
): { path: string; projected: Projected[]; vbW: number; vbH: number; pad: typeof pad } {
  const vbW = width;
  const vbH = height;
  const innerW = vbW - pad.l - pad.r;
  const innerH = vbH - pad.t - pad.b;
  const revs = points.map((p) => p.revenue);
  const minR = Math.min(...revs);
  const maxR = Math.max(...revs);
  const span = maxR - minR || 1;
  const years = points.map((p) => p.year);
  const minY = Math.min(...years);
  const maxY = Math.max(...years);
  const ySpan = maxY - minY || 1;

  const projected: Projected[] = points.map((p) => {
    const x = pad.l + ((p.year - minY) / ySpan) * innerW;
    const y = pad.t + innerH - ((p.revenue - minR) / span) * innerH;
    return { ...p, x, y };
  });

  const path = projected
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  return { path, projected, vbW, vbH, pad };
}

type TooltipState = {
  left: number;
  top: number;
  year: number;
  revenue: number;
  yoyVsPrior: number | null;
} | null;

const PLOT_PAD = { t: 16, r: 16, b: 28, l: 16 } as const;

function truncateStatusMessage(message: string, max = 96) {
  const t = message.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function RevenueHistoryChart({ ein }: { ein: string }) {
  const gradId = useId().replace(/:/g, "");
  const [data, setData] = useState<FilingsPayload | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [plotWidth, setPlotWidth] = useState(640);
  const plotRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<TooltipState>(null);

  useEffect(() => {
    let cancelled = false;
    const q = encodeURIComponent(ein);
    setLoading(true);
    setLoadedAt(null);
    fetch(`/api/nonprofit-filings?ein=${q}`)
      .then(async (res) => {
        const text = await res.text();
        let body: FilingsPayload & { error?: string };
        try {
          body = text ? (JSON.parse(text) as FilingsPayload & { error?: string }) : ({} as FilingsPayload);
        } catch {
          const snippet = text.replace(/\s+/g, " ").slice(0, 120);
          throw new Error(
            res.ok
              ? "Server returned invalid JSON."
              : `HTTP ${res.status}${snippet ? `: ${snippet}` : ""}`,
          );
        }
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        return body;
      })
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setLoadedAt(new Date());
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setLoadedAt(new Date());
          setData({
            ein,
            organizationName: "",
            sourceName: "",
            sourceUrl: "",
            points: [],
            error: e.message,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ein]);

  useLayoutEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w > 0) setPlotWidth(Math.max(280, w));
    });
    ro.observe(el);
    const w = el.clientWidth;
    if (w > 0) setPlotWidth(Math.max(280, w));
    return () => ro.disconnect();
  }, []);

  const plotHeight = 168;

  const geometry = useMemo(() => {
    if (!data?.points.length) return null;
    return layoutSeries(data.points, plotWidth, plotHeight, PLOT_PAD);
  }, [data?.points, plotWidth, plotHeight]);

  const showTip = (index: number, el: SVGCircleElement) => {
    const wrap = plotRef.current;
    if (!wrap || !geometry) return;
    const projected = geometry.projected[index];
    const prev = index > 0 ? geometry.projected[index - 1] : null;
    const yoyVsPrior = prev
      ? ((projected.revenue - prev.revenue) / Math.max(Math.abs(prev.revenue), 1e-9)) * 100
      : null;

    const rect = el.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const cx = rect.left + rect.width / 2 - wrapRect.left;
    const cy = rect.top + rect.height / 2 - wrapRect.top;

    setTip({
      left: cx,
      top: cy,
      year: projected.year,
      revenue: projected.revenue,
      yoyVsPrior,
    });
  };

  const hideTip = () => setTip(null);

  const timeLoaded =
    loadedAt !== null
      ? loadedAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" })
      : null;

  if (loading) {
    return (
      <div className="tp-revenue-chart-shell tp-revenue-chart-shell--empty">
        <div className="tp-revenue-chart-status tp-revenue-chart-status--pending" role="status" aria-live="polite">
          <span className="tp-revenue-status-indicator tp-revenue-status-indicator--pending" aria-hidden />
          <span className="tp-revenue-status-text">
            Requesting IRS filings… If this stays here after an edit, the dev client may be reconnecting — check the
            terminal for compile errors.
          </span>
        </div>
        <p className="tp-body tp-revenue-chart-state">Loading IRS filing history…</p>
      </div>
    );
  }

  if (data?.error || !data || data.points.length === 0) {
    const msg = data?.error ?? "No revenue filings returned for this EIN.";
    return (
      <div className="tp-revenue-chart-shell tp-revenue-chart-shell--empty" role="alert">
        <div className="tp-revenue-chart-status tp-revenue-chart-status--bad">
          <span className="tp-revenue-status-indicator tp-revenue-status-indicator--bad" aria-hidden />
          <span className="tp-revenue-status-text">
            <strong className="tp-revenue-status-title">Chart data unavailable</strong>
            {truncateStatusMessage(msg, 400)}
            {timeLoaded ? <span className="tp-revenue-status-sub">Last attempt: {timeLoaded}</span> : null}
          </span>
        </div>
      </div>
    );
  }

  const pts = data.points;
  const last = pts[pts.length - 1];
  const prior = pts.length >= 2 ? pts[pts.length - 2] : null;
  const latestYoyPct =
    prior !== null ? ((last.revenue - prior.revenue) / Math.max(Math.abs(prior.revenue), 1e-9)) * 100 : null;
  const trendClass =
    latestYoyPct === null
      ? "tp-revenue-chart-trend--neutral"
      : latestYoyPct > 0
        ? "tp-revenue-chart-trend--up"
        : latestYoyPct < 0
          ? "tp-revenue-chart-trend--down"
          : "tp-revenue-chart-trend--neutral";

  const { vbW, vbH, pad } = geometry!;

  return (
    <div className="tp-revenue-chart-shell">
      <div className="tp-revenue-chart-head">
        <p className="tp-kicker">Revenue</p>
        <p className="tp-metric-value tp-revenue-chart-figure">{formatUsdFull(last.revenue)}</p>
      </div>

      <div className="tp-revenue-chart-plot" ref={plotRef} onMouseLeave={hideTip}>
        {tip ? (
          <div
            className="tp-revenue-tooltip"
            style={{
              left: tip.left,
              top: tip.top,
            }}
            role="tooltip"
          >
            <span className="tp-revenue-tooltip-year">{tip.year}</span>
            <span className="tp-revenue-tooltip-rev">{formatCompactCurrency(tip.revenue)}</span>
            {tip.yoyVsPrior !== null ? (
              <span className="tp-revenue-tooltip-yoy">{`${tip.yoyVsPrior.toFixed(1)}% YoY change`}</span>
            ) : null}
          </div>
        ) : null}

        <svg
          className={`tp-revenue-chart-svg ${trendClass}`}
          viewBox={`0 0 ${vbW} ${vbH}`}
          width="100%"
          height={plotHeight}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--revenue-chart-accent)" stopOpacity="0.14" />
              <stop offset="100%" stopColor="var(--revenue-chart-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {geometry?.projected.length ? (
            <>
              <path
                d={(() => {
                  const b = vbH - pad.b;
                  const pr = geometry.projected;
                  let area = `M ${pr[0].x} ${b}`;
                  pr.forEach((p) => {
                    area += ` L ${p.x} ${p.y}`;
                  });
                  area += ` L ${pr[pr.length - 1].x} ${b} Z`;
                  return area;
                })()}
                fill={`url(#${gradId})`}
                opacity={0.95}
              />
              <path
                d={geometry.path}
                fill="none"
                stroke="var(--revenue-chart-accent)"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </>
          ) : null}
          {geometry?.projected.map((p, i) => (
            <circle
              key={p.year}
              cx={p.x}
              cy={p.y}
              r={18}
              fill="transparent"
              style={{ cursor: "pointer" }}
              onMouseEnter={(e) => showTip(i, e.currentTarget)}
              onMouseLeave={hideTip}
              onFocus={(e) => showTip(i, e.currentTarget)}
              onBlur={hideTip}
            />
          ))}
          {geometry?.projected.map((p) => (
            <circle
              key={`dot-${p.year}`}
              cx={p.x}
              cy={p.y}
              r={4}
              fill="var(--revenue-chart-accent)"
              pointerEvents="none"
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
