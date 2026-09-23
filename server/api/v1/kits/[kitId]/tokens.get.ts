// Nitro REST API Route: GET /api/v1/kits/:kitId/tokens?token=:shareToken
// Serves W3C DTCG tokens and Figma Local Variables JSON payload to external tools & Figma plugin.

import { executeGetFigmaTokens } from "@/server/figma-sync.server";

export default async function (event: any) {
  const req = event?.node?.req || event?.req;
  const res = event?.node?.res || event?.res;

  // Set CORS headers
  if (res && typeof res.setHeader === "function") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }

  const rawUrl = req?.url || event?.url || "/";
  const url = new URL(rawUrl, "http://localhost");
  const pathParts = url.pathname.split("/").filter(Boolean);
  const kitIdx = pathParts.indexOf("kits");
  const kitId = kitIdx !== -1 && pathParts.length > kitIdx + 1 ? pathParts[kitIdx + 1] : "";
  const token = url.searchParams.get("token") || undefined;

  if (!kitId) {
    if (res) res.statusCode = 400;
    return { error: "Missing kitId in route path" };
  }

  try {
    const payload = await executeGetFigmaTokens({ kitId, token });
    return payload;
  } catch (err: any) {
    const isUnauthorized = String(err?.message || "").includes("Unauthorized");
    if (res) {
      res.statusCode = isUnauthorized ? 401 : 404;
    }
    return { error: err?.message || "Brand kit not found" };
  }
}
