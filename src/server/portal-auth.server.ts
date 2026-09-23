// Security & Authentication Helpers for Brand Guidelines Portals
// Implements password hashing, HMAC session tokens, and timing-safe comparisons.

import crypto from "node:crypto";

export function safeTimingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.byteLength !== bufB.byteLength) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function hashPassword(password: string): string {
  const salt = "bm_portal_salt_v1";
  return crypto.createHash("sha256").update(`${salt}:${password}`).digest("hex");
}

export function createPasswordToken(slug: string): string {
  const secret = process.env.LOVABLE_CRON_SECRET || "portal_secret_key_8841";
  const payload = `${slug}:${Date.now()}`;
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64");
}

export function verifyPasswordToken(token: string, slug: string): boolean {
  try {
    const raw = Buffer.from(token, "base64").toString("utf-8");
    const [tokenSlug, timestampStr, sig] = raw.split(":");
    if (!tokenSlug || !timestampStr || !sig) return false;
    if (tokenSlug.toLowerCase() !== slug.toLowerCase()) return false;

    // Token valid for 7 days
    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp) || Date.now() - timestamp > 7 * 24 * 60 * 60 * 1000) return false;

    const secret = process.env.LOVABLE_CRON_SECRET || "portal_secret_key_8841";
    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(`${tokenSlug}:${timestampStr}`)
      .digest("hex");

    return safeTimingSafeEqual(sig, expectedSig);
  } catch {
    return false;
  }
}
