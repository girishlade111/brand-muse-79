// 360-Degree Color Chromaticity & Hue Wheel
// Plots color distributions by polar angle (hue 0°-360°) and radius (saturation).
// Highlights unoccupied white-space arcs across competing brands.

import { useState } from "react";
import {
  calculateColorWheelCoordinates,
  SERIES_INK,
  type ColorWheelPoint,
  type KitColorLike,
} from "@/lib/intelligence";

const INK = "#0A0A0A";
const HAIR = "rgba(10,10,10,0.15)";
const FAINT = "rgba(10,10,10,0.06)";
const MONO = "font-mono text-[10px] uppercase tracking-[0.14em]";

export interface ColorWheelSeries {
  id: string;
  name: string;
  colors: KitColorLike[];
}

export function ColorWheelChart({ series }: { series: ColorWheelSeries[] }) {
  const [hoveredPoint, setHoveredPoint] = useState<{
    point: ColorWheelPoint;
    kitName: string;
    kitColor: string;
    screenX: number;
    screenY: number;
  } | null>(null);

  const size = 380;
  const cx = size / 2;
  const cy = size / 2;
  const R = 145; // Max radius for 100% saturation

  // Combine all colors to find competitive white-space arcs
  const allColors = series.flatMap((s) => s.colors);
  const combined = calculateColorWheelCoordinates(allColors);

  // Per-series points
  const seriesData = series.map((s, idx) => ({
    series: s,
    color: SERIES_INK[idx % SERIES_INK.length],
    wheel: calculateColorWheelCoordinates(s.colors),
  }));

  // Polar to cartesian conversion (0 deg at top, clockwise)
  const polarToXY = (hueDeg: number, sat: number): [number, number] => {
    // 0 deg = Red at Top (-90 deg from standard trigonometric axis)
    const angleRad = ((hueDeg - 90) * Math.PI) / 180;
    const r = sat * R;
    return [cx + r * Math.cos(angleRad), cy + r * Math.sin(angleRad)];
  };

  // Helper for white space arc path
  const describeArc = (
    startAngle: number,
    endAngle: number,
    innerR: number,
    outerR: number,
  ): string => {
    const [x1, y1] = [
      cx + outerR * Math.cos(((startAngle - 90) * Math.PI) / 180),
      cy + outerR * Math.sin(((startAngle - 90) * Math.PI) / 180),
    ];
    const [x2, y2] = [
      cx + outerR * Math.cos(((endAngle - 90) * Math.PI) / 180),
      cy + outerR * Math.sin(((endAngle - 90) * Math.PI) / 180),
    ];
    const [x3, y3] = [
      cx + innerR * Math.cos(((endAngle - 90) * Math.PI) / 180),
      cy + innerR * Math.sin(((endAngle - 90) * Math.PI) / 180),
    ];
    const [x4, y4] = [
      cx + innerR * Math.cos(((startAngle - 90) * Math.PI) / 180),
      cy + innerR * Math.sin(((startAngle - 90) * Math.PI) / 180),
    ];
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4} Z`;
  };

  return (
    <div className="relative border p-6 bg-card" style={{ borderColor: HAIR }}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {"// 360° Chromaticity Wheel"}
          </span>
          <h3 className="mt-1 text-sm font-semibold tracking-tight text-foreground">
            Hue Distribution &amp; Unoccupied Color Territory
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {seriesData.map(({ series: s, color }) => (
            <span key={s.id} className={`${MONO} inline-flex items-center gap-1.5 text-foreground`}>
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
              {s.name}
            </span>
          ))}
          {combined.whiteSpaceArcs.length > 0 && (
            <span className={`${MONO} inline-flex items-center gap-1.5 text-emerald-600`}>
              <span className="inline-block h-2 w-2 border border-emerald-500 bg-emerald-500/20" />
              White Space ({combined.whiteSpaceArcs.length})
            </span>
          )}
        </div>
      </div>

      <div className="relative mx-auto max-w-[420px]">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="mx-auto block w-full overflow-visible"
          role="img"
          aria-label="360 degree color chromaticity wheel"
        >
          <defs>
            {/* 360-degree rainbow conical / sweep ring */}
            <linearGradient id="wheel-spectrum" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#EF4444" />
              <stop offset="20%" stopColor="#F59E0B" />
              <stop offset="40%" stopColor="#10B981" />
              <stop offset="60%" stopColor="#06B6D4" />
              <stop offset="80%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#EC4899" />
            </linearGradient>

            {/* Diagonal stripe pattern for whitespace gaps */}
            <pattern
              id="whitespace-stripes"
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="6"
                stroke="#10B981"
                strokeWidth="1.5"
                strokeOpacity="0.4"
              />
            </pattern>
          </defs>

          {/* Concentric Saturation Rings */}
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <circle
              key={f}
              cx={cx}
              cy={cy}
              r={R * f}
              fill="none"
              stroke={f === 1 ? HAIR : FAINT}
              strokeWidth={1}
              strokeDasharray={f < 1 ? "3 3" : undefined}
            />
          ))}

          {/* Hue Angle Spokes */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
            const [x, y] = polarToXY(deg, 1.03);
            return <line key={deg} x1={cx} y1={cy} x2={x} y2={y} stroke={FAINT} strokeWidth={1} />;
          })}

          {/* Outer Spectrum Ring */}
          <circle
            cx={cx}
            cy={cy}
            r={R + 8}
            fill="none"
            stroke="url(#wheel-spectrum)"
            strokeWidth={3}
            opacity={0.8}
          />

          {/* Unoccupied White-Space Arc Overlays */}
          {combined.whiteSpaceArcs.map((arc, idx) => (
            <g key={idx}>
              <path
                d={describeArc(arc.startAngle, arc.endAngle, R * 0.25, R + 4)}
                fill="url(#whitespace-stripes)"
                stroke="#10B981"
                strokeWidth={0.5}
                strokeOpacity={0.6}
              />
              {/* Arc label */}
              {arc.spanDegrees >= 40 && (
                <text
                  x={
                    cx +
                    R *
                      0.65 *
                      Math.cos((((arc.startAngle + arc.endAngle) / 2 - 90) * Math.PI) / 180)
                  }
                  y={
                    cy +
                    R *
                      0.65 *
                      Math.sin((((arc.startAngle + arc.endAngle) / 2 - 90) * Math.PI) / 180)
                  }
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="font-mono text-[9px] font-bold uppercase tracking-wider fill-emerald-600 dark:fill-emerald-400"
                  style={{ pointerEvents: "none" }}
                >
                  Gap {Math.round(arc.spanDegrees)}°
                </text>
              )}
            </g>
          ))}

          {/* Cardinal Hue Markers */}
          {[
            { label: "0° RED", deg: 0 },
            { label: "90° GREEN", deg: 90 },
            { label: "180° CYAN", deg: 180 },
            { label: "270° BLUE", deg: 270 },
          ].map(({ label, deg }) => {
            const [lx, ly] = polarToXY(deg, 1.15);
            return (
              <text
                key={deg}
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={8}
                fill={INK}
                opacity={0.6}
                className="font-mono uppercase tracking-[0.1em] dark:fill-white"
              >
                {label}
              </text>
            );
          })}

          {/* Center Neutral Hub */}
          <circle cx={cx} cy={cy} r={6} fill="#F4EFE6" stroke={INK} strokeWidth={1} />
          <text
            x={cx}
            y={cy + 1}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={6}
            className="font-mono font-bold fill-neutral-600"
          >
            0
          </text>

          {/* Plotted Color Nodes per Series */}
          {seriesData.map(({ series: s, color: seriesColor, wheel }) =>
            wheel.points.map((pt, pIdx) => {
              const [px, py] = polarToXY(pt.hue, pt.saturation);
              return (
                <g
                  key={`${s.id}-${pIdx}`}
                  className="cursor-pointer transition-transform hover:scale-125"
                  onMouseEnter={(e) => {
                    const rect = (e.target as SVGElement).getBoundingClientRect();
                    setHoveredPoint({
                      point: pt,
                      kitName: s.name,
                      kitColor: seriesColor,
                      screenX: rect.left + rect.width / 2,
                      screenY: rect.top,
                    });
                  }}
                  onMouseLeave={() => setHoveredPoint(null)}
                >
                  {/* Series ring outline */}
                  <circle
                    cx={px}
                    cy={py}
                    r={6.5}
                    fill="none"
                    stroke={seriesColor}
                    strokeWidth={1.5}
                    opacity={0.9}
                  />
                  {/* Actual Color Swatch */}
                  <circle
                    cx={px}
                    cy={py}
                    r={4.5}
                    fill={pt.hex}
                    stroke="#FFFFFF"
                    strokeWidth={0.75}
                  />
                </g>
              );
            }),
          )}
        </svg>

        {/* Hover Tooltip */}
        {hoveredPoint && (
          <div
            className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full border bg-neutral-950 p-2 text-white shadow-xl"
            style={{
              left: `${hoveredPoint.screenX}px`,
              top: `${hoveredPoint.screenY - 8}px`,
              borderColor: "rgba(255,255,255,0.15)",
              borderRadius: "0px",
            }}
          >
            <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: hoveredPoint.kitColor }}
              />
              <span>{hoveredPoint.kitName}</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span
                className="inline-block h-3.5 w-3.5 border border-white/20"
                style={{ background: hoveredPoint.point.hex }}
              />
              <span className="font-mono text-xs font-bold">{hoveredPoint.point.hex}</span>
              {hoveredPoint.point.role && (
                <span className="font-mono text-[10px] uppercase text-emerald-400">
                  [{hoveredPoint.point.role}]
                </span>
              )}
            </div>
            <div className="mt-1 font-mono text-[9px] text-neutral-400">
              Hue: {hoveredPoint.point.hue}° · Saturation:{" "}
              {Math.round(hoveredPoint.point.saturation * 100)}%
            </div>
          </div>
        )}
      </div>

      {/* White-Space Territory Insights */}
      {combined.whiteSpaceArcs.length > 0 && (
        <div className="mt-4 border-t pt-4" style={{ borderColor: HAIR }}>
          <span className={`${MONO} text-muted-foreground`}>Unclaimed Market Hue Angles:</span>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {combined.whiteSpaceArcs.map((arc, i) => (
              <div
                key={i}
                className="flex items-center justify-between border bg-muted/30 px-3 py-2 text-xs"
                style={{ borderColor: HAIR }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 border"
                    style={{ background: arc.exemplarHex, borderColor: HAIR }}
                  />
                  <span className="font-medium text-foreground">{arc.label}</span>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {Math.round(arc.startAngle)}° - {Math.round(arc.endAngle)}° (
                  {Math.round(arc.spanDegrees)}°)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
