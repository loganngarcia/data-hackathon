"use client";

import { tierColor } from "@/lib/utils";

interface ScoreRingProps {
  score: number;
  tier: string;
  size?: number;
}

export default function ScoreRing({ score, tier, size = 64 }: ScoreRingProps) {
  const strokeWidth = size < 80 ? 4 : 5;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(score, 0), 100) / 100;
  const dashOffset = circumference * (1 - progress);
  const color = tierColor(tier);
  const center = size / 2;
  const fontSize = size < 80 ? size * 0.28 : size * 0.24;
  const labelSize = size < 80 ? 0 : size * 0.11;

  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
        />
        {/* Colored arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
        />
        {/* Score number */}
        <text
          x={center}
          y={labelSize > 0 ? center - 2 : center}
          textAnchor="middle"
          dominantBaseline="central"
          fill={color}
          fontSize={fontSize}
          fontWeight="700"
          fontFamily="Inter, system-ui, sans-serif"
        >
          {score.toFixed(0)}
        </text>
        {/* Label below score for large rings */}
        {labelSize > 0 && (
          <text
            x={center}
            y={center + fontSize * 0.65}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#6B7280"
            fontSize={labelSize}
            fontFamily="Inter, system-ui, sans-serif"
          >
            / 100
          </text>
        )}
      </svg>
    </div>
  );
}
