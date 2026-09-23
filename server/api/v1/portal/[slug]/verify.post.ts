// Nitro REST API Route: POST /api/v1/portal/:slug/verify
// Verifies password for protected brand guidelines portals.

import { db, publishedPortals } from "@/db/index.server";
import { eq } from "drizzle-orm";
import {
  hashPassword,
  createPasswordToken,
  safeTimingSafeEqual,
} from "@/server/portal-auth.server";

export default async function (event: any) {
  const req = event?.node?.req || event?.req;
  const res = event?.node?.res || event?.res;

  // Set CORS headers
  if (res && typeof res.setHeader === "function") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }

  if (req?.method === "OPTIONS" || event?.method === "OPTIONS") {
    if (res) {
      res.statusCode = 204;
      res.end?.();
    }
    return new Response(null, { status: 204 });
  }

  // Extract slug from URL path
  const rawUrl = req?.url || event?.url || "/";
  const url = new URL(rawUrl, "http://localhost");
  const pathParts = url.pathname.split("/").filter(Boolean);
  const portalIdx = pathParts.indexOf("portal");
  let slug = "";
  if (portalIdx !== -1 && pathParts.length > portalIdx + 1) {
    slug = pathParts[portalIdx + 1];
  }

  let body: any = {};
  try {
    if (event?.readBody) {
      body = await event.readBody();
    } else if (req) {
      const chunks: any[] = [];
      for await (const chunk of req) chunks.push(chunk);
      body = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
    }
  } catch {
    body = {};
  }

  const password = body?.password?.trim();
  if (!slug || !password) {
    if (res) res.statusCode = 400;
    return { error: "Missing slug or password parameter", status: 400 };
  }

  const rows = await db
    .select({
      id: publishedPortals.id,
      slug: publishedPortals.slug,
      passwordHash: publishedPortals.passwordHash,
      isPasswordProtected: publishedPortals.isPasswordProtected,
    })
    .from(publishedPortals)
    .where(eq(publishedPortals.slug, slug.toLowerCase()))
    .limit(1);

  if (!rows.length || !rows[0].isPasswordProtected || !rows[0].passwordHash) {
    if (res) res.statusCode = 400;
    return { error: "This portal does not require a password", status: 400 };
  }

  const expectedHash = rows[0].passwordHash;
  const providedHash = hashPassword(password);

  const isMatch = crypto.timingSafeEqual(
    Buffer.from(expectedHash),
    Buffer.from(providedHash),
  );

  if (!isMatch) {
    if (res) res.statusCode = 401;
    return { error: "Incorrect password. Please try again.", status: 401 };
  }

  const token = createPasswordToken(rows[0].slug);
  return { success: true, token };
}
