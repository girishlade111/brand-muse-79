/** Smooth-scroll helper that delegates to the Lenis instance when available. */
export function smoothScrollTo(target: string | HTMLElement, offset = -80) {
  const lenis = typeof window !== "undefined" ? window.__lenis : undefined;
  if (lenis) {
    lenis.scrollTo(target, {
      offset,
      duration: 0.9,
      easing: (t: number) => 1 - Math.pow(1 - t, 3),
    });
    return;
  }
  const el = typeof target === "string" ? document.querySelector(target) : target;
  if (el && "scrollIntoView" in el)
    (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "start" });
}
