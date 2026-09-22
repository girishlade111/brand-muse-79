// Competitive intelligence charts — lightweight SVG in the sumi ink
// editorial aesthetic. Sharp corners, mono badges, ink/paper/accent only.

import { BUCKET_EXEMPLARS, HUE_BUCKETS, SERIES_INK } from "@/lib/intelligence";

const INK = "#0A0A0A";
const ACCENT = "#8B1A1A";
const HAIR = "rgba(10,10,10,0.20)";
const FAINT = "rgba(10,10,10,0.08)";

const MONO = "font-mono text-[10px] uppercase tracking-[0.14em]";

// ---------- radar ----------

export function RadarChart({
  axes,
  series,
}: {
  axes: string[];
  series: Array<{ id: string; name: string; values: number[] }>;
}) {
  const size = 340;
  const cx = size / 2;
  const cy = size / 2 + 6;
  const R = 108;
  const n = axes.length;
  const pt = (i: number, v: number): [number, number] => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const r = R * Math.max(0, Math.min(1, v));
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  };
  const poly = (values: number[]) =>
    values
      .map((v, i) => pt(i, v).join(","))
      .join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto block w-full max-w-85" role="img">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon
            key={f}
            points={poly(axes.map(() => f))}
            fill="none"
            stroke={f === 1 ? HAIR : FAINT}
            strokeWidth={1}
          />
        ))}
        {axes.map((a, i) => {
          const [x, y] = pt(i, 1);
          const [lx, ly] = pt(i, 1.28);
          return (
            <g key={a}>
              <line x1={cx} y1={cy} x2={x} y2={y} stroke={FAINT} strokeWidth={1} />
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={9}
                fill={INK}
                opacity={0.7}
                style={{ fontFamily: "'Courier Prime', monospace", textTransform: "uppercase" }}
              >
                {a}
              </text>
            </g>
          );
        })}
        {series.map((s, si) => {
          const color = SERIES_INK[si % SERIES_INK.length];
          return (
            <g key={s.id}>
              <polygon points={poly(s.values)} fill={color} opacity={si === 0 ? 0.1 : 0.07} />
              <polygon points={poly(s.values)} fill="none" stroke={color} strokeWidth={si === 0 ? 2 : 1.5} />
              {s.values.map((v, i) => {
                const [x, y] = pt(i, v);
                return <circle key={i} cx={x} cy={y} r={2.5} fill={color} />;
              })}
            </g>
          );
        })}
      </svg>
      <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1">
        {series.map((s, si) => (
          <span key={s.id} className={`${MONO} inline-flex items-center gap-2 text-muted-foreground`}>
            <span
              className="inline-block h-2 w-4"
              style={{ background: SERIES_INK[si % SERIES_INK.length] }}
            />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------- hue distribution ----------

export function HueStrip({
  name,
  color,
  histogram,
  total,
}: {
  name: string;
  color: string;
  histogram: number[];
  total: number;
}) {
  const denom = Math.max(1, total);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className={`${MONO} truncate text-foreground`} style={{ color }}>
          {name}
        </span>
        <span className={`${MONO} text-muted-foreground`}>
          {histogram.filter((c) => c > 0).length}/16 bands
        </span>
      </div>
      <div className="flex h-5 w-full overflow-hidden border" style={{ borderColor: HAIR }}>
        {histogram.map((count, i) =>
          count > 0 ? (
            <span
              key={i}
              title={`${HUE_BUCKETS[i]} — ${Math.round((count / denom) * 100)}%`}
              style={{ width: `${(count / denom) * 100}%`, background: BUCKET_EXEMPLARS[i] }}
            />
          ) : null,
        )}
        {histogram.every((c) => c === 0) && (
          <span className={`${MONO} px-2 py-1 text-muted-foreground`}>neutral-led</span>
        )}
      </div>
    </div>
  );
}

// ---------- warm / cool balance ----------

export function WarmCoolBar({
  name,
  warm,
  cool,
  neutral,
}: {
  name: string;
  warm: number;
  cool: number;
  neutral: number;
}) {
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className={`${MONO} truncate text-foreground`}>{name}</span>
        <span className={`${MONO} text-muted-foreground`}>
          warm {pct(warm)} · cool {pct(cool)}
        </span>
      </div>
      <div className="flex h-4 w-full overflow-hidden border" style={{ borderColor: HAIR }}>
        {warm > 0 && <span style={{ width: pct(warm), background: ACCENT }} title={`Warm ${pct(warm)}`} />}
        {cool > 0 && <span style={{ width: pct(cool), background: INK }} title={`Cool ${pct(cool)}`} />}
        {neutral > 0 && (
          <span
            style={{ width: pct(neutral), background: "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(10,10,10,0.12) 3px, rgba(10,10,10,0.12) 4px)" }}
            title={`Neutral ${pct(neutral)}`}
          />
        )}
      </div>
    </div>
  );
}

// ---------- typography DNA ----------

export function TypeDnaBar({
  name,
  serif,
  sans,
  mono,
  dominant,
  weights,
}: {
  name: string;
  serif: number;
  sans: number;
  mono: number;
  dominant: string;
  weights: number[];
}) {
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className={`${MONO} truncate text-foreground`}>{name}</span>
        <span className={`${MONO} text-muted-foreground`}>
          {dominant} · {weights.length} weight{weights.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="flex h-4 w-full overflow-hidden border" style={{ borderColor: HAIR }}>
        {serif > 0 && <span style={{ width: pct(serif), background: INK }} title={`Serif ${pct(serif)}`} />}
        {sans > 0 && (
          <span style={{ width: pct(sans), background: "#A39E93" }} title={`Sans ${pct(sans)}`} />
        )}
        {mono > 0 && <span style={{ width: pct(mono), background: ACCENT }} title={`Mono ${pct(mono)}`} />}
      </div>
      <div className="mt-2 flex items-center gap-4">
        <span className={`${MONO} inline-flex items-center gap-1.5 text-muted-foreground`}>
          <span className="inline-block h-2 w-2" style={{ background: INK }} /> serif
        </span>
        <span className={`${MONO} inline-flex items-center gap-1.5 text-muted-foreground`}>
          <span className="inline-block h-2 w-2" style={{ background: "#A39E93" }} /> sans
        </span>
        <span className={`${MONO} inline-flex items-center gap-1.5 text-muted-foreground`}>
          <span className="inline-block h-2 w-2" style={{ background: ACCENT }} /> mono
        </span>
        {weights.length > 0 && (
          <span className={`${MONO} text-muted-foreground`}>{weights.join(" / ")}</span>
        )}
      </div>
    </div>
  );
}

// ---------- voice spectrum (diverging) ----------

export function VoiceSpectrumRow({
  name,
  value,
  leftLabel,
  rightLabel,
}: {
  name: string;
  value: number;
  leftLabel: string;
  rightLabel: string;
}) {
  const v = Math.max(-1, Math.min(1, value));
  const right = v >= 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className={`${MONO} text-muted-foreground`}>{leftLabel}</span>
        <span className={`${MONO} truncate text-foreground`}>{name}</span>
        <span className={`${MONO} text-muted-foreground`}>{rightLabel}</span>
      </div>
      <div className="relative h-4 w-full border" style={{ borderColor: HAIR }}>
        <span
          className="absolute inset-y-0 left-1/2 w-px"
          style={{ background: "rgba(10,10,10,0.35)" }}
        />
        <span
          className="absolute inset-y-[3px]"
          style={
            right
              ? { left: "50%", width: `${(v / 2) * 100}%`, background: INK }
              : { right: "50%", width: `${(-v / 2) * 100}%`, background: ACCENT }
          }
          title={`${v >= 0 ? rightLabel : leftLabel} ${Math.abs(v).toFixed(2)}`}
        />
      </div>
    </div>
  );
}
