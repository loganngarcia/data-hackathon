"use client";

interface ResilienceGaugeProps {
  score: number;
  tier: string;
  size?: "sm" | "md" | "lg";
}

function statusColor(tier: string): string {
  switch (tier) {
    case "Thriving":
      return "var(--status-healthy)";
    case "Stable":
      return "var(--status-stable)";
    case "Needs Support":
      return "var(--status-attention)";
    case "Urgent":
      return "var(--status-urgent)";
    default:
      return "var(--ink-muted)";
  }
}

const SIZE_CONFIG = {
  sm: { width: 100, height: 6, showScore: true, showLabel: false, showMax: false, fontSize: 12 },
  md: { width: 160, height: 6, showScore: true, showLabel: false, showMax: false, fontSize: 13 },
  lg: { width: 240, height: 6, showScore: true, showLabel: true, showMax: true, fontSize: 16 },
} as const;

export default function ResilienceGauge({ score, tier, size = "md" }: ResilienceGaugeProps) {
  const config = SIZE_CONFIG[size];
  const color = statusColor(tier);
  const pct = Math.min(Math.max(score, 0), 100);

  return (
    <div className="inline-flex flex-col gap-1" style={{ minWidth: config.width }}>
      <div className="flex items-center gap-2">
        {/* Track */}
        <div
          className="rounded-full flex-1"
          style={{
            width: config.width,
            height: config.height,
            background: "var(--paper-inset)",
          }}
        >
          <div
            className="rounded-full h-full"
            style={{
              width: `${pct}%`,
              backgroundColor: color,
            }}
          />
        </div>
        {/* Score number */}
        {config.showScore && (
          <span
            className="tabular-nums"
            style={{
              fontSize: config.fontSize,
              fontWeight: 600,
              color: color,
              whiteSpace: "nowrap",
            }}
          >
            {score.toFixed(0)}
            {config.showMax && (
              <span style={{ color: "var(--ink-muted)", fontWeight: 400, fontSize: config.fontSize - 2 }}>
                {" "}/ 100
              </span>
            )}
          </span>
        )}
      </div>
      {/* Tier label (lg only) */}
      {config.showLabel && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: color,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {tier}
        </span>
      )}
    </div>
  );
}
