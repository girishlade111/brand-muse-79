// Webhook Event Delivery Engine.
// Dispatches signed HMAC-SHA256 event notifications to developer endpoints
// for events: `kit.extraction_completed`, `kit.tokens_updated`, and `kit.failed`.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db, webhookSubscriptions, type WebhookSubscription } from "@/db/index.server";
import crypto from "node:crypto";

import {
  WEBHOOK_EVENTS,
  type WebhookEventName,
  CreateWebhookSubscriptionInputSchema,
  ListWebhookSubscriptionsInputSchema,
  DeleteWebhookSubscriptionInputSchema,
  TestPingWebhookInputSchema,
  type CreateWebhookSubscriptionInput,
  type ListWebhookSubscriptionsInput,
  type DeleteWebhookSubscriptionInput,
  type TestPingWebhookInput,
} from "@/lib/webhooks";

export {
  WEBHOOK_EVENTS,
  type WebhookEventName,
  CreateWebhookSubscriptionInputSchema,
  ListWebhookSubscriptionsInputSchema,
  DeleteWebhookSubscriptionInputSchema,
  TestPingWebhookInputSchema,
  type CreateWebhookSubscriptionInput,
  type ListWebhookSubscriptionsInput,
  type DeleteWebhookSubscriptionInput,
  type TestPingWebhookInput,
};

// ---------------------------------------------------------------------------
// Signature & Payload Helpers
// ---------------------------------------------------------------------------

export function signWebhookPayload(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(24).toString("hex")}`;
}

export type WebhookPayload<T = any> = {
  id: string;
  event: string;
  created_at: string;
  data: T;
};

// ---------------------------------------------------------------------------
// Pure Handlers
// ---------------------------------------------------------------------------

export async function executeCreateWebhookSubscription(
  input: CreateWebhookSubscriptionInput,
  overrides?: { db?: any },
): Promise<{ ok: boolean; subscription: WebhookSubscription }> {
  const activeDb = overrides?.db || db;
  const secret = generateWebhookSecret();

  const [created] = await activeDb
    .insert(webhookSubscriptions)
    .values({
      userId: input.userId,
      url: input.url,
      secret,
      events: input.events,
    })
    .returning();

  return { ok: true, subscription: created };
}

export async function executeListWebhookSubscriptions(
  input: ListWebhookSubscriptionsInput,
  overrides?: { db?: any },
): Promise<WebhookSubscription[]> {
  const activeDb = overrides?.db || db;
  const rows = await activeDb
    .select()
    .from(webhookSubscriptions)
    .where(eq(webhookSubscriptions.userId, input.userId));

  return rows;
}

export async function executeDeleteWebhookSubscription(
  input: DeleteWebhookSubscriptionInput,
  overrides?: { db?: any },
): Promise<{ ok: boolean }> {
  const activeDb = overrides?.db || db;
  await activeDb
    .delete(webhookSubscriptions)
    .where(
      and(
        eq(webhookSubscriptions.id, input.subscriptionId),
        eq(webhookSubscriptions.userId, input.userId),
      ),
    );

  return { ok: true };
}

export async function dispatchWebhookEvent(
  event: WebhookEventName | "ping",
  data: any,
  options?: {
    userId?: string;
    customFetch?: typeof fetch;
    db?: any;
  },
): Promise<{ dispatched: number; failed: number }> {
  const activeDb = options?.db || db;
  const customFetch = options?.customFetch || fetch;

  let subscriptions: WebhookSubscription[] = [];

  if (activeDb) {
    try {
      const query = options?.userId
        ? activeDb
            .select()
            .from(webhookSubscriptions)
            .where(eq(webhookSubscriptions.userId, options.userId))
        : activeDb.select().from(webhookSubscriptions);

      const all = await query;
      const list = Array.isArray(all) ? all : [];
      subscriptions = list.filter(
        (sub: WebhookSubscription) => event === "ping" || sub.events?.includes(event),
      );
    } catch (err) {
      console.warn("[webhooks.server] Failed to query webhook subscriptions:", err);
      return { dispatched: 0, failed: 0 };
    }
  }

  if (subscriptions.length === 0) {
    return { dispatched: 0, failed: 0 };
  }

  const payloadObject: WebhookPayload = {
    id: `evt_${crypto.randomBytes(16).toString("hex")}`,
    event,
    created_at: new Date().toISOString(),
    data,
  };

  const payloadJson = JSON.stringify(payloadObject);
  let dispatched = 0;
  let failed = 0;

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        const signature = signWebhookPayload(payloadJson, sub.secret);
        const res = await customFetch(sub.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "BrandMuse-Webhooks/1.0",
            "X-BrandMuse-Signature": `sha256=${signature}`,
            "X-BrandMuse-Event": event,
            "X-BrandMuse-Delivery": payloadObject.id,
          },
          body: payloadJson,
          signal: AbortSignal.timeout(6000), // 6-second timeout
        });

        if (res.ok) {
          dispatched += 1;
        } else {
          failed += 1;
          console.warn(
            `[webhooks.server] Webhook delivery returned HTTP ${res.status}: ${sub.url}`,
          );
        }
      } catch (err: any) {
        failed += 1;
        console.warn(`[webhooks.server] Webhook delivery failed for ${sub.url}:`, err?.message);
      }
    }),
  );

  return { dispatched, failed };
}

export async function executeTestPingWebhook(
  input: TestPingWebhookInput,
  overrides?: { db?: any; customFetch?: typeof fetch },
): Promise<{ ok: boolean; status: number; message: string }> {
  const activeDb = overrides?.db || db;
  const customFetch = overrides?.customFetch || fetch;

  const [sub] = await activeDb
    .select()
    .from(webhookSubscriptions)
    .where(
      and(
        eq(webhookSubscriptions.id, input.subscriptionId),
        eq(webhookSubscriptions.userId, input.userId),
      ),
    )
    .limit(1);

  if (!sub) {
    throw new Error("Webhook subscription not found");
  }

  const payload: WebhookPayload = {
    id: `evt_test_${crypto.randomBytes(8).toString("hex")}`,
    event: "ping",
    created_at: new Date().toISOString(),
    data: { message: "Brand Muse webhook test ping. Connectivity verified." },
  };

  const payloadJson = JSON.stringify(payload);
  const signature = signWebhookPayload(payloadJson, sub.secret);

  try {
    const res = await customFetch(sub.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "BrandMuse-Webhooks/1.0",
        "X-BrandMuse-Signature": `sha256=${signature}`,
        "X-BrandMuse-Event": "ping",
        "X-BrandMuse-Delivery": payload.id,
      },
      body: payloadJson,
      signal: AbortSignal.timeout(5000),
    });

    return {
      ok: res.ok,
      status: res.status,
      message: res.ok
        ? `Successfully sent test ping (HTTP ${res.status}).`
        : `Endpoint responded with HTTP ${res.status}.`,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      message: `Failed to reach webhook endpoint: ${err?.message || "Network error"}`,
    };
  }
}

// ---------------------------------------------------------------------------
// TanStack Start Server Functions
// ---------------------------------------------------------------------------

export const createWebhookSubscriptionFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => CreateWebhookSubscriptionInputSchema.parse(d))
  .handler(async ({ data }) => {
    return executeCreateWebhookSubscription(data);
  });

export const listWebhookSubscriptionsFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => ListWebhookSubscriptionsInputSchema.parse(d))
  .handler(async ({ data }) => {
    return executeListWebhookSubscriptions(data);
  });

export const deleteWebhookSubscriptionFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => DeleteWebhookSubscriptionInputSchema.parse(d))
  .handler(async ({ data }) => {
    return executeDeleteWebhookSubscription(data);
  });

export const testPingWebhookFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => TestPingWebhookInputSchema.parse(d))
  .handler(async ({ data }) => {
    return executeTestPingWebhook(data);
  });
