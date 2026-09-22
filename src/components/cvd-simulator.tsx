// Color Vision Deficiency simulator — client-side SVG filter overlay over the
// brand palette plus an instant report of which functional color distinctions
// break under each deficiency.

import { useId, useMemo, useState } from "react";
import { normalizeHex } from "@/lib/color";
import {
  CVD_KINDS,
  cvdBreakageReport,
  cvdMatrixSvg,
  type CvdKind,
} from "@/lib/intelligence";

type CvdColor = { hex: string; role?: string | null; name?: string | null };

const MONO = "font-mono text-[10px] uppercase tracking-[0.16em]";
const HAIR = "rgba(10,10,10,0.20)";

export function CvdSimulator({ colors }: { colors: CvdColor[] }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [kind, setKind] = useState<CvdKind | "none">("none");

  const hexes = useMemo(
    () =>
      [...new Set((colors ?? []).map((c) => normalizeHex(c.hex ?? "")).filter((h) => /^#[0-9a-f]{6}$/.test(h)))].map((h) =>
        h.toUpperCase(),
      ),
    [colors],
  );

  const report = useMemo(() => cvdBreakageReport(colors), [colors]);
  const active = report.find((r) => r.kind === kind);

  if (!hexes.length) return null;

  const btn = (isActive: boolean) =>
    isActive
      ? "border border-[#0A0A0A] bg-[#0A0A0A] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[#F4EFE6]"
      : "border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground hover:border-[#0A0A0A]";

  return (
    <div>
      <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
        <defs>
          {CVD_KINDS.map((k) => (
            <filter key={k.id} id={`cvd-${uid}-${k.id}`}>
              <feColorMatrix type="matrix" values={cvdMatrixSvg(k.id)} />
            </filter>
          ))}
        </defs>
      </svg>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setKind("none")}
          className={btn(kind === "none")}
          style={{ borderRadius: 0, borderColor: kind === "none" ? undefined : HAIR }}
        >
          Original
        </button>
        {CVD_KINDS.map((k) => {
          const rep = report.find((r) => r.kind === k.id);
          const broken = rep?.brokenPairs.length ?? 0;
          return (
            <button
              key={k.id}
              type="button"
              onClick={() => setKind(k.id)}
              className={btn(kind === k.id)}
              style={{ borderRadius: 0, borderColor: kind === k.id ? undefined : HAIR }}
              title={`${k.label} — ${k.hint}. ${broken} distinction${broken === 1 ? "" : "s"} break.`}
            >
              {k.label}
              {broken > 0 && <span className="ml-1 opacity-70">[{broken}]</span>}
            </button>
          );
        })}
      </div>

      <div
        className="mt-3 flex overflow-hidden border"
        style={{
          borderColor: HAIR,
          filter: kind === "none" ? undefined : `url(#cvd-${uid}-${kind})`,
        }}
      >
        {hexes.map((h) => (
          <span
            key={h}
            title={h}
            className="h-14 flex-1"
            style={{ background: h, minWidth: 32 }}
          />
        ))}
      </div>
      <p className={`${MONO} mt-2 text-muted-foreground`}>
        {kind === "none"
          ? `Full palette — ${hexes.length} colours. Pick a deficiency to simulate.`
          : `Simulated ${active?.label} (${active?.hint}) — filtered preview above.`}
      </p>

      {active && (
        <div className="mt-3 border p-3" style={{ borderColor: HAIR }}>
          {active.brokenPairs.length === 0 ? (
            <p className={`${MONO} text-foreground`}>
              [ OK ] No functional distinctions break under {active.label}.
            </p>
          ) : (
            <div className="space-y-2">
              <p className={`${MONO} text-foreground`}>
                [ {active.brokenPairs.length} BREAK{active.brokenPairs.length === 1 ? "" : "S"} ] of{" "}
                {active.checked} pairs collapse under {active.label}
              </p>
              {active.brokenPairs.slice(0, 8).map((b) => (
                <div key={`${b.a}-${b.b}`} className="flex items-center gap-2">
                  <span className="inline-block h-4 w-6 border" style={{ background: b.a, borderColor: HAIR }} />
                  <span className="inline-block h-4 w-6 border" style={{ background: b.b, borderColor: HAIR }} />
                  <span className={`${MONO} text-muted-foreground`}>
                    {b.a} / {b.b} — {b.normalRatio.toFixed(1)}:1 → {b.simRatio.toFixed(1)}:1
                  </span>
                </div>
              ))}
              {active.brokenPairs.length > 8 && (
                <p className={`${MONO} text-muted-foreground`}>
                  + {active.brokenPairs.length - 8} more
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
