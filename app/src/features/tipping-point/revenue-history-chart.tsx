"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { formatCompactCurrency, formatSignedPercent, formatUsdFull } from "@/lib/format-display";

type FilingPoint = { year: number; revenue: number; expenses: number; netAssets: number };

type FilingsPayload = {
  ein: string;
  organizationName: string;
  sourceName: string;
  sourceUrl: string;
  points: FilingPoint[];
  error?: string;
};

type ProjectedPoint = FilingPoint & { x: number; yNetAssets: number };

function layoutNetAssetsSeries(
  points: FilingPoint[],
  width: number,
  height: number,
  pad: { t: number; r: number; b: number; l: number },
): {
  pathNetAssets: string;
  areaPathNetAssets: string;
  projected: ProjectedPoint[];
  vbW: number;
  vbH: number;
  pad: typeof pad;
} {
  const vbW = width;
  const vbH = height;
  const innerW = vbW - pad.l - pad.r;
  const innerH = vbH - pad.t - pad.b;
  const vals = points.map((p) => p.netAssets);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const span = maxV - minV || 1;
  const years = points.map((p) => p.year);
  const minY = Math.min(...years);
  const maxY = Math.max(...years);
  const ySpan = maxY - minY || 1;

  const projected: ProjectedPoint[] = points.map((p) => {
    const x = pad.l + ((p.year - minY) / ySpan) * innerW;
    const yNetAssets = pad.t + innerH - ((p.netAssets - minV) / span) * innerH;
    return { ...p, x, yNetAssets };
  });

  const pathNetAssets = projected
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.yNetAssets.toFixed(1)}`)
    .join(" ");

  const b = vbH - pad.b;
  const pr = projected;
  let areaPathNetAssets = `M ${pr[0].x} ${b}`;
  pr.forEach((p) => {
    areaPathNetAssets += ` L ${p.x} ${p.yNetAssets}`;
  });
  areaPathNetAssets += ` L ${pr[pr.length - 1].x} ${b} Z`;

  return { pathNetAssets, areaPathNetAssets, projected, vbW, vbH, pad };
}

type TooltipState = {
  left: number;
  top: number;
  year: number;
  revenue: number;
  expenses: number;
  netAssets: number;
  marginPct: number | null;
} | null;

const PLOT_PAD = { t: 16, r: 16, b: 28, l: 16 } as const;

export function RevenueHistoryChart({ ein }: { ein: string }) {
  const gradId = useId().replace(/:/g, "");
  const [data, setData] = useState<FilingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [plotWidth, setPlotWidth] = useState(640);
  const plotRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<TooltipState>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const q = encodeURIComponent(ein);
    setLoading(true);
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
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
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
    return layoutNetAssetsSeries(data.points, plotWidth, plotHeight, PLOT_PAD);
  }, [data?.points, plotWidth, plotHeight]);

  const showTip = (index: number, el: SVGCircleElement) => {
    const wrap = plotRef.current;
    if (!wrap || !geometry) return;
    const projected = geometry.projected[index];
    const marginPct =
      projected.revenue > 0
        ? ((projected.revenue - projected.expenses) / projected.revenue) * 100
        : null;

    const rect = el.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const cx = rect.left + rect.width / 2 - wrapRect.left;
    const cy = rect.top + rect.height / 2 - wrapRect.top;

    setHoveredIndex(index);
    setTip({
      left: cx,
      top: cy,
      year: projected.year,
      revenue: projected.revenue,
      expenses: projected.expenses,
      netAssets: projected.netAssets,
      marginPct,
    });
  };

  const hideTip = () => {
    setTip(null);
    setHoveredIndex(null);
  };

  if (loading) {
    return (
      <div className="tp-revenue-chart-shell tp-revenue-chart-shell--loading" role="status" aria-live="polite">
        <p className="tp-body tp-revenue-chart-state">Loading IRS filing history…</p>
      </div>
    );
  }

  if (data?.error || !data || data.points.length === 0) {
    return null;
  }

  const pts = data.points;
  const last = pts[pts.length - 1];
  const positiveNetAssets = last.netAssets >= 0;
  const modeClass = positiveNetAssets ? "tp-revenue-chart-mode--surplus" : "tp-revenue-chart-mode--deficit";

  const netAssetsClass =
    last.netAssets === 0
      ? "tp-revenue-chart-profit--neutral"
      : last.netAssets > 0
        ? "tp-revenue-chart-profit--positive"
        : "tp-revenue-chart-profit--negative";

  const { vbW, vbH } = geometry!;

  return (
    <div className="tp-revenue-chart-shell">
      <div className="tp-revenue-chart-head">
        <p className="tp-kicker">Net assets</p>
        <p className={`tp-metric-value tp-revenue-chart-figure tp-revenue-chart-profit ${netAssetsClass}`}>
          {formatUsdFull(last.netAssets)}
        </p>
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
            <span className="tp-revenue-tooltip-margin">{formatUsdFull(tip.netAssets)}</span>
            <span className="tp-revenue-tooltip-detail">Revenue {formatCompactCurrency(tip.revenue)}</span>
            <span className="tp-revenue-tooltip-detail">Expenses {formatCompactCurrency(tip.expenses)}</span>
            <span className="tp-revenue-tooltip-detail">
              {tip.marginPct !== null ? `${formatSignedPercent(tip.marginPct)} margin` : "—"}
            </span>
          </div>
        ) : null}

        <svg
          className={`tp-revenue-chart-svg ${modeClass}`}
          viewBox={`0 0 ${vbW} ${vbH}`}
          width="100%"
          height={plotHeight}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--revenue-chart-rev)" stopOpacity={0.14} />
              <stop offset="100%" stopColor="var(--revenue-chart-rev)" stopOpacity={0} />
            </linearGradient>
          </defs>
          {geometry?.projected.length ? (
            <>
              <path d={geometry.areaPathNetAssets} fill={`url(#${gradId})`} opacity={0.95} />
              <path
                d={geometry.pathNetAssets}
                fill="none"
                className="tp-revenue-chart-line tp-revenue-chart-line--net-assets"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </>
          ) : null}
          {geometry?.projected.map((p, i) => (
            <circle
              key={`hit-${p.year}`}
              cx={p.x}
              cy={p.yNetAssets}
              r={22}
              fill="transparent"
              style={{ cursor: "pointer" }}
              onMouseEnter={(e) => showTip(i, e.currentTarget)}
              onMouseLeave={hideTip}
              onFocus={(e) => showTip(i, e.currentTarget)}
              onBlur={hideTip}
            />
          ))}
          {hoveredIndex !== null && geometry?.projected[hoveredIndex] ? (
            <g pointerEvents="none">
              <circle
                cx={geometry.projected[hoveredIndex].x}
                cy={geometry.projected[hoveredIndex].yNetAssets}
                r={4}
                className="tp-revenue-chart-dot tp-revenue-chart-dot--net-assets"
              />
            </g>
          ) : null}
        </svg>
      </div>
    </div>
  );
}
