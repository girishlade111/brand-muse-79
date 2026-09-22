// Interactive UI Component Sandbox - live brand-styled previews (buttons,
// form elements, cards, nav/footer) with per-component Copy Code.

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  TARGETS,
  resolveSandboxTheme,
  sandboxCode,
  type CodeTarget,
  type SandboxColor,
  type SandboxComponentId,
  type SandboxFont,
  type SandboxTheme,
} from "@/lib/sandbox";

const MONO = "'Courier Prime', monospace";

function SandboxBlock({
  eyebrow,
  title,
  id,
  theme,
  children,
}: {
  eyebrow: string;
  title: string;
  id: SandboxComponentId;
  theme: SandboxTheme;
  children: React.ReactNode;
}) {
  const [target, setTarget] = useState<CodeTarget>("html");
  const code = useMemo(() => sandboxCode(target, id, theme), [target, id, theme]);

  function copy() {
    navigator.clipboard.writeText(code).then(
      () => toast.success(`Copied ${title} (${target})`),
      () => toast.error("Copy failed"),
    );
  }

  return (
    <div className="border border-[#0A0A0A]" style={{ borderRadius: 0 }}>
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b border-[#0A0A0A] px-4 py-2"
        style={{ borderRadius: 0 }}
      >
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {eyebrow}
          </span>
          <span className="text-lg" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            {title}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {TARGETS.map((tg) => (
            <button
              key={tg.id}
              type="button"
              onClick={() => setTarget(tg.id)}
              className={
                target === tg.id
                  ? "border border-[#0A0A0A] bg-[#0A0A0A] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#F4EFE6]"
                  : "border border-[rgba(10,10,10,0.25)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] hover:border-[#0A0A0A]"
              }
              style={{ borderRadius: 0, fontFamily: MONO }}
            >
              {tg.label}
            </button>
          ))}
          <button
            type="button"
            onClick={copy}
            className="border border-[#0A0A0A] bg-transparent px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] hover:bg-[#0A0A0A] hover:text-[#F4EFE6]"
            style={{ borderRadius: 0, fontFamily: MONO }}
          >
            [ Copy code ]
          </button>
        </div>
      </div>
      <div className="grid gap-0 lg:grid-cols-2">
        <div className="border-b border-[rgba(10,10,10,0.2)] p-5 lg:border-b-0 lg:border-r">
          {children}
        </div>
        <pre
          className="max-h-80 overflow-auto whitespace-pre-wrap break-words bg-[#0A0A0A] p-4 font-mono text-[11px] leading-relaxed text-[#F4EFE6]"
          style={{ borderRadius: 0 }}
        >
          {code}
        </pre>
      </div>
    </div>
  );
}

export function ComponentSandbox({
  kitName,
  colors,
  fonts,
  logoUrl,
}: {
  kitName: string;
  colors: SandboxColor[];
  fonts: SandboxFont[];
  logoUrl: string | null;
}) {
  const theme = useMemo(
    () => resolveSandboxTheme(kitName, colors, fonts),
    [kitName, colors, fonts],
  );
  const [checked, setChecked] = useState(true);
  const [toggled, setToggled] = useState(true);

  const btnStyle = (kind: "primary" | "secondary" | "ghost" | "disabled"): React.CSSProperties => {
    const base: React.CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      padding: "12px 32px",
      fontFamily: MONO,
      fontSize: 12,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      borderRadius: 0,
      cursor: "pointer",
    };
    if (kind === "primary")
      return {
        ...base,
        background: theme.accent,
        color: theme.accentFg,
        border: `1px solid ${theme.accent}`,
      };
    if (kind === "secondary")
      return {
        ...base,
        background: "transparent",
        color: theme.ink,
        border: `1px solid ${theme.ink}`,
      };
    if (kind === "ghost")
      return {
        ...base,
        background: "transparent",
        color: theme.ink,
        border: "1px solid transparent",
      };
    return {
      ...base,
      background: theme.muted,
      color: theme.paper,
      border: `1px solid ${theme.muted}`,
      opacity: 0.5,
      cursor: "not-allowed",
    };
  };
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 16px",
    fontFamily: MONO,
    fontSize: 13,
    background: "transparent",
    color: theme.ink,
    border: `1px solid ${theme.ink}`,
    borderRadius: 0,
    outline: "none",
  };

  return (
    <div className="space-y-6">
      <SandboxBlock eyebrow="// buttons" title="Buttons" id="buttons" theme={theme}>
        <div className="flex flex-wrap gap-3">
          <button type="button" style={btnStyle("primary")}>
            [ Primary ]
          </button>
          <button type="button" style={btnStyle("secondary")}>
            [ Secondary ]
          </button>
          <button type="button" style={btnStyle("ghost")}>
            [ Ghost ]
          </button>
          <button type="button" style={btnStyle("disabled")} disabled>
            [ Disabled ]
          </button>
        </div>
      </SandboxBlock>

      <SandboxBlock eyebrow="// form" title="Form elements" id="form" theme={theme}>
        <div className="grid max-w-md gap-4">
          <input placeholder="Name" style={inputStyle} aria-label="Name" />
          <select style={inputStyle} aria-label="Plan" defaultValue="Growth">
            <option>Starter</option>
            <option>Growth</option>
            <option>Scale</option>
          </select>
          <label className="flex items-center gap-2 text-sm" style={{ accentColor: theme.accent }}>
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />
            Email me the guide
          </label>
          <button
            type="button"
            role="switch"
            aria-checked={toggled}
            onClick={() => setToggled((v) => !v)}
            className="flex h-6 w-11 items-center px-0.5"
            style={{
              background: toggled ? theme.accent : "transparent",
              border: `1px solid ${theme.ink}`,
              borderRadius: 0,
              justifyContent: toggled ? "flex-end" : "flex-start",
            }}
          >
            <span
              className="inline-block h-4 w-4"
              style={{ background: toggled ? theme.accentFg : theme.ink }}
            />
          </button>
        </div>
      </SandboxBlock>

      <div className="grid gap-6 xl:grid-cols-3">
        <SandboxBlock eyebrow="// card" title="Pricing tier" id="pricing" theme={theme}>
          <div
            style={{
              border: `1px solid ${theme.ink}`,
              background: theme.paper,
              padding: 32,
              borderRadius: 0,
            }}
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.22em]">// Growth</p>
            <p
              style={{
                fontFamily: `'${theme.displayFont}', serif`,
                fontSize: 56,
                margin: "12px 0",
              }}
            >
              $49
            </p>
            <ul className="m-0 grid list-none gap-2 p-0 text-sm">
              <li>— 5 brand kits</li>
              <li>— Token export</li>
              <li>— Shared workspace</li>
            </ul>
            <button type="button" style={{ ...btnStyle("primary"), marginTop: 24 }}>
              [ Start trial ]
            </button>
          </div>
        </SandboxBlock>

        <SandboxBlock eyebrow="// card" title="Metric counter" id="metric" theme={theme}>
          <div
            style={{
              border: `1px solid ${theme.ink}`,
              background: theme.paper,
              padding: 24,
              borderRadius: 0,
            }}
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.22em]">// Kits shipped</p>
            <p
              style={{
                fontFamily: `'${theme.displayFont}', serif`,
                fontSize: 64,
                lineHeight: 1,
                color: theme.ink,
              }}
            >
              128
            </p>
            <p className="text-sm" style={{ color: theme.accent }}>
              +12 this week
            </p>
          </div>
        </SandboxBlock>

        <SandboxBlock eyebrow="// card" title="Feature highlight" id="feature" theme={theme}>
          <div
            style={{
              border: `1px solid ${theme.ink}`,
              borderLeft: `6px solid ${theme.accent}`,
              background: theme.paper,
              padding: 24,
              borderRadius: 0,
            }}
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.22em]">01. Tokens</p>
            <p
              style={{ fontFamily: `'${theme.displayFont}', serif`, fontSize: 28, margin: "8px 0" }}
            >
              One source of truth
            </p>
            <p className="text-sm">Every color, font, and token in a single structured kit.</p>
            <span
              className="font-mono text-[11px] uppercase tracking-[0.16em]"
              style={{ color: theme.accent }}
            >
              [ Read the guide ]
            </span>
          </div>
        </SandboxBlock>
      </div>

      <SandboxBlock eyebrow="// navigation" title="Nav & footer" id="nav" theme={theme}>
        <div style={{ borderRadius: 0 }}>
          <header
            className="flex items-center justify-between gap-4 px-6"
            style={{ borderBottom: `1px solid ${theme.ink}`, height: 56, background: theme.paper }}
          >
            {logoUrl ? (
              <img src={logoUrl} alt={theme.brand} style={{ height: 24, objectFit: "contain" }} />
            ) : (
              <span className="font-mono text-[13px] uppercase tracking-[0.2em]">
                {theme.brand}
              </span>
            )}
            <nav className="hidden gap-6 text-sm sm:flex">
              <span>Kits</span>
              <span>Compare</span>
              <span>Studio</span>
            </nav>
            <button type="button" style={{ ...btnStyle("primary"), padding: "8px 16px" }}>
              [ New kit ]
            </button>
          </header>
          <footer
            className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
            style={{ background: theme.ink, color: theme.paper }}
          >
            <span className="font-mono text-[11px] uppercase tracking-[0.2em]">{theme.brand}</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] opacity-70">
              Guidelines · Tokens · v1.0
            </span>
          </footer>
        </div>
      </SandboxBlock>
    </div>
  );
}
