import { createServerFn } from "@tanstack/react-start";
import {
  GenerateApiKeyInputSchema,
  ListApiKeysInputSchema,
  RevokeApiKeyInputSchema,
  type GenerateApiKeyResult,
} from "@/lib/api-keys";
import {
  CreateWebhookSubscriptionInputSchema,
  ListWebhookSubscriptionsInputSchema,
  DeleteWebhookSubscriptionInputSchema,
  TestPingWebhookInputSchema,
  WEBHOOK_EVENTS,
  type WebhookEventName,
} from "@/lib/webhooks";

export { WEBHOOK_EVENTS, type WebhookEventName };

export const generateApiKeyFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => GenerateApiKeyInputSchema.parse(d))
  .handler(async ({ data }): Promise<GenerateApiKeyResult> => {
    const { executeGenerateApiKey } = await import("@/server/api-auth.server");
    return executeGenerateApiKey(data);
  });

export const listApiKeysFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => ListApiKeysInputSchema.parse(d))
  .handler(async ({ data }) => {
    const { executeListApiKeys } = await import("@/server/api-auth.server");
    return executeListApiKeys(data);
  });

export const revokeApiKeyFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => RevokeApiKeyInputSchema.parse(d))
  .handler(async ({ data }) => {
    const { executeRevokeApiKey } = await import("@/server/api-auth.server");
    return executeRevokeApiKey(data);
  });

export const createWebhookSubscriptionFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => CreateWebhookSubscriptionInputSchema.parse(d))
  .handler(async ({ data }) => {
    const { executeCreateWebhookSubscription } = await import("@/server/webhooks.server");
    return executeCreateWebhookSubscription(data);
  });

export const listWebhookSubscriptionsFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => ListWebhookSubscriptionsInputSchema.parse(d))
  .handler(async ({ data }) => {
    const { executeListWebhookSubscriptions } = await import("@/server/webhooks.server");
    return executeListWebhookSubscriptions(data);
  });

export const deleteWebhookSubscriptionFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => DeleteWebhookSubscriptionInputSchema.parse(d))
  .handler(async ({ data }) => {
    const { executeDeleteWebhookSubscription } = await import("@/server/webhooks.server");
    return executeDeleteWebhookSubscription(data);
  });

export const testPingWebhookFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => TestPingWebhookInputSchema.parse(d))
  .handler(async ({ data }) => {
    const { executeTestPingWebhook } = await import("@/server/webhooks.server");
    return executeTestPingWebhook(data);
  });
