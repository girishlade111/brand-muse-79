import { STUDIO_ASSET_META, type StudioAssetType } from "@/lib/studio";

type StudioCanvasProps = {
  svg: string;
  assetType: StudioAssetType;
  zoom: number;
};

// Real-time responsive zoomable viewport. The SVG string is the single source
// of truth — preview and export render byte-identical output.
export function StudioCanvas({ svg, assetType, zoom }: StudioCanvasProps) {
  const meta = STUDIO_ASSET_META[assetType];
  const frameWidth = Math.max(280, Math.round(meta.width * zoom));

  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        <span>
          // preview — {meta.label}
        </span>
        <span>
          {meta.width} × {meta.height} · {Math.round(zoom * 100)}%
        </span>
      </div>
      <div
        className="overflow-auto border border-[#0A0A0A] bg-[#F4EFE6] p-4"
        style={{ borderRadius: 0 }}
      >
        <div className="mx-auto" style={{ width: frameWidth, maxWidth: "100%" }}>
          <div
            className="[&>svg]:block [&>svg]:h-auto [&>svg]:w-full [&>svg]:border [&>svg]:border-[rgba(10,10,10,0.2)]"
            style={{ borderRadius: 0 }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>
      </div>
    </div>
  );
}
