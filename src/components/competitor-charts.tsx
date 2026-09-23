// Competitor Visualizations — Recharts Radar, Brand Tone Scatter Quadrants, and Typography Matrix
// Strictly adheres to 0px border-radius sumi-ink design language.

import {
  ResponsiveContainer,
  RadarChart as ReRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip as ReTooltip,
  ReferenceLine,
} from "recharts";
import {
  SERIES_INK,
  type KitColorProfile,
  type KitTypeProfile,
  type KitVoiceProfile,
} from "@/lib/intelligence";

const HAIR = "rgba(10,10,10,0.15)";
const MONO = "font-mono text-[10px] uppercase tracking-[0.14em]";

export interface CompetitorKitProfile {
  id: string;
  name: string;
  colorProfile: KitColorProfile;
  typeProfile: KitTypeProfile;
  voiceProfile: KitVoiceProfile;
  rawFonts: Array<{ family?: string | null; role?: string | null; weights?: unknown }>;
}

// ============================================================================
// 1. Recharts Competitor Radar Chart
// ============================================================================

export function CompetitorRadarChart({ competitors }: { competitors: CompetitorKitProfile[] }) {
  const axes = [
    { key: "vibrancy", label: "Color Vibrancy" },
    { key: "warmth", label: "Warmth / Energy" },
    { key: "typeVariety", label: "Type Richness" },
    { key: "contrast", label: "Hierarchy Contrast" },
    { key: "signal", label: "Voice Extremity" },
  ];

  // Transform into Recharts radar data: array of { axis, [competitorId]: value }
  const data = axes.map((a) => {
    const row: Record<string, string | number> = { axis: a.label };
    competitors.forEach((c) => {
      let val = 0.5;
      if (a.key === "vibrancy") val = Math.min(1, c.colorProfile.vibrancy);
      else if (a.key === "warmth") val = Math.min(1, c.colorProfile.warmRatio);
      else if (a.key === "typeVariety")
        val = Math.min(1, (c.typeProfile.weightCount + c.typeProfile.count) / 8);
      else if (a.key === "contrast")
        val = Math.min(1, c.colorProfile.coolRatio * 0.5 + c.colorProfile.warmRatio * 0.5);
      else if (a.key === "signal") val = Math.min(1, c.voiceProfile.signal / 2);
      row[c.id] = Math.round(val * 100);
    });
    return row;
  });

  return (
    <div className="border bg-card p-6" style={{ borderColor: HAIR }}>
      <div className="mb-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {"// Multi-Series Radar"}
        </span>
        <h3 className="mt-1 text-sm font-semibold tracking-tight text-foreground">
          5-Dimensional Competitive Capability Surface
        </h3>
      </div>

      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ReRadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
            <PolarGrid stroke="rgba(10,10,10,0.12)" strokeDasharray="3 3" />
            <PolarAngleAxis
              dataKey="axis"
              tick={{ fill: "#0A0A0A", fontSize: 10, fontFamily: "monospace" }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 100]}
              stroke="rgba(10,10,10,0.15)"
              tick={false}
            />
            {competitors.map((c, idx) => {
              const color = SERIES_INK[idx % SERIES_INK.length];
              return (
                <Radar
                  key={c.id}
                  name={c.name}
                  dataKey={c.id}
                  stroke={color}
                  fill={color}
                  fillOpacity={0.12}
                  strokeWidth={2}
                />
              );
            })}
          </ReRadarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1">
        {competitors.map((c, idx) => (
          <span key={c.id} className={`${MONO} inline-flex items-center gap-1.5 text-foreground`}>
            <span
              className="inline-block h-2 w-3"
              style={{ background: SERIES_INK[idx % SERIES_INK.length] }}
            />
            {c.name}
          </span>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 2. Recharts Brand Tone Quadrant Scatter Plot
// ============================================================================

export function BrandToneScatterQuadrant({ competitors }: { competitors: CompetitorKitProfile[] }) {
  // Scatter points: x = Playful (-1) to Serious (1), y = Modern (-1) to Traditional (1), z = Luxury (1) to Budget (-1)
  const scatterData = competitors.map((c, idx) => ({
    id: c.id,
    name: c.name,
    x: Math.round(c.voiceProfile.playfulSerious * 100),
    y: Math.round(c.voiceProfile.modernTraditional * 100),
    z: Math.round((c.voiceProfile.budgetLuxury + 1) * 50) + 20, // size 20 to 120
    luxuryLabel: c.voiceProfile.budgetLuxuryLabel,
    playfulLabel: c.voiceProfile.playfulSeriousLabel,
    modernLabel: c.voiceProfile.modernTraditionalLabel,
    color: SERIES_INK[idx % SERIES_INK.length],
  }));

  return (
    <div className="border bg-card p-6" style={{ borderColor: HAIR }}>
      <div className="mb-2 flex items-baseline justify-between">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {"// Brand Tone Quadrant"}
          </span>
          <h3 className="mt-1 text-sm font-semibold tracking-tight text-foreground">
            Perceptual Positioning Matrix (Playful vs. Serious &amp; Modern vs. Traditional)
          </h3>
        </div>
      </div>

      {/* Quadrant Legend Labels */}
      <div className="relative mb-2 grid grid-cols-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <div className="text-left font-mono">← Playful · Traditional ↑</div>
        <div className="text-right font-mono">↑ Traditional · Serious →</div>
        <div className="mt-4 text-left font-mono">← Playful · Modern ↓</div>
        <div className="mt-4 text-right font-mono">↓ Modern · Serious →</div>
      </div>

      <div
        className="relative h-[320px] w-full border bg-neutral-50/50 dark:bg-neutral-900/20"
        style={{ borderColor: HAIR }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            {/* Center Crosshair Axes */}
            <ReferenceLine x={0} stroke="rgba(10,10,10,0.25)" strokeWidth={1.5} />
            <ReferenceLine y={0} stroke="rgba(10,10,10,0.25)" strokeWidth={1.5} />

            <XAxis type="number" dataKey="x" domain={[-100, 100]} tick={false} axisLine={false} />
            <YAxis type="number" dataKey="y" domain={[-100, 100]} tick={false} axisLine={false} />
            <ZAxis type="number" dataKey="z" range={[80, 240]} />

            <ReTooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div
                    className="border bg-neutral-950 p-2 text-white shadow-xl"
                    style={{ borderRadius: "0px", borderColor: "rgba(255,255,255,0.15)" }}
                  >
                    <div className="flex items-center gap-1.5 font-mono text-[10px]">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: d.color }}
                      />
                      <span className="font-bold">{d.name}</span>
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-neutral-300">
                      Tone: {d.playfulLabel} · {d.modernLabel}
                    </div>
                    <div className="font-mono text-[10px] text-emerald-400">
                      Tier: {d.luxuryLabel}
                    </div>
                  </div>
                );
              }}
            />

            {scatterData.map((d) => (
              <Scatter
                key={d.id}
                name={d.name}
                data={[d]}
                fill={d.color}
                shape={(props: any) => {
                  const { cx, cy } = props;
                  return (
                    <g className="cursor-pointer">
                      <circle cx={cx} cy={cy} r={9} fill={d.color} opacity={0.9} />
                      <circle
                        cx={cx}
                        cy={cy}
                        r={13}
                        fill="none"
                        stroke={d.color}
                        strokeWidth={1}
                        strokeDasharray="2 2"
                      />
                      <text
                        x={cx}
                        y={cy - 16}
                        textAnchor="middle"
                        className="font-mono text-[9px] font-bold uppercase fill-foreground"
                      >
                        {d.name}
                      </text>
                    </g>
                  );
                }}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1">
        {scatterData.map((d) => (
          <span key={d.id} className={`${MONO} inline-flex items-center gap-1.5 text-foreground`}>
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: d.color }} />
            {d.name} ({d.playfulLabel} / {d.modernLabel})
          </span>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 3. Typography Classification Grid (Serif, Sans, Mono, Display)
// ============================================================================

export function TypographyClassificationGrid({
  competitors,
}: {
  competitors: CompetitorKitProfile[];
}) {
  const pct = (n: number) => `${Math.round(n * 100)}%`;

  return (
    <div className="border bg-card p-6" style={{ borderColor: HAIR }}>
      <div className="mb-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {"// Type DNA Classification"}
        </span>
        <h3 className="mt-1 text-sm font-semibold tracking-tight text-foreground">
          Typographic Distribution: Serif vs. Sans vs. Mono vs. Display
        </h3>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {competitors.map((c, idx) => {
          const color = SERIES_INK[idx % SERIES_INK.length];
          const type = c.typeProfile;

          return (
            <div key={c.id} className="border p-4 bg-muted/20" style={{ borderColor: HAIR }}>
              <div
                className="flex items-center justify-between border-b pb-2 mb-3"
                style={{ borderColor: HAIR }}
              >
                <span className="font-mono text-xs font-bold truncate text-foreground flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                  {c.name}
                </span>
                <span
                  className="font-mono text-[9px] uppercase px-1.5 py-0.5 border"
                  style={{ borderColor: HAIR }}
                >
                  {type.dominant}
                </span>
              </div>

              {/* Stacked Share Bar */}
              <div
                className="flex h-3 w-full overflow-hidden border mb-3"
                style={{ borderColor: HAIR }}
              >
                {type.serif > 0 && (
                  <span
                    style={{ width: pct(type.serif), background: "#0A0A0A" }}
                    title={`Serif ${pct(type.serif)}`}
                  />
                )}
                {type.sans > 0 && (
                  <span
                    style={{ width: pct(type.sans), background: "#94A3B8" }}
                    title={`Sans ${pct(type.sans)}`}
                  />
                )}
                {type.mono > 0 && (
                  <span
                    style={{ width: pct(type.mono), background: "#8B1A1A" }}
                    title={`Mono ${pct(type.mono)}`}
                  />
                )}
                {type.display > 0 && (
                  <span
                    style={{ width: pct(type.display), background: "#D97706" }}
                    title={`Display ${pct(type.display)}`}
                  />
                )}
              </div>

              {/* Shares Breakdown */}
              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono mb-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <span className="h-1.5 w-1.5 bg-[#0A0A0A]" /> Serif:
                  </span>
                  <span className="font-bold">{pct(type.serif)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <span className="h-1.5 w-1.5 bg-[#94A3B8]" /> Sans:
                  </span>
                  <span className="font-bold">{pct(type.sans)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <span className="h-1.5 w-1.5 bg-[#8B1A1A]" /> Mono:
                  </span>
                  <span className="font-bold">{pct(type.mono)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <span className="h-1.5 w-1.5 bg-[#D97706]" /> Display:
                  </span>
                  <span className="font-bold">{pct(type.display)}</span>
                </div>
              </div>

              {/* Fonts List */}
              <div className="border-t pt-2" style={{ borderColor: HAIR }}>
                <span className="font-mono text-[9px] text-muted-foreground uppercase block mb-1">
                  Active Font Families:
                </span>
                <div className="flex flex-wrap gap-1">
                  {c.rawFonts
                    .filter((f) => f.family)
                    .map((f, fIdx) => (
                      <span
                        key={fIdx}
                        className="font-mono text-[10px] border px-1.5 py-0.5 bg-background"
                        style={{ borderColor: HAIR }}
                      >
                        {f.family}
                      </span>
                    ))}
                  {c.rawFonts.length === 0 && (
                    <span className="font-mono text-[10px] text-muted-foreground italic">
                      None extracted
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
