import { createServerFn } from "@tanstack/react-start";
import {
  GenerateApiKeyInputSchema,
  ListApiKeysInputSchema,
  RevokeApiKeyInputSchema,
  executeGenerateApiKey,
  executeListApiKeys,
  executeRevokeApiKey,
  type GenerateApiKeyResult,
} from "@/server/api-auth.server";
import {
  CreateWebhookSubscriptionInputSchema,
  ListWebhookSubscriptionsInputSchema,
  DeleteWebhookSubscriptionInputSchema,
  TestPingWebhookInputSchema,
  executeCreateWebhookSubscription,
  executeListWebhookSubscriptions,
  executeDeleteWebhookSubscription,
  executeTestPingWebhook,
  WEBHOOK_EVENTS,
  type WebhookEventName,
} from "@/server/webhooks.server";

export { WEBHOOK_EVENTS, type WebhookEventName };

export const generateApiKeyFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => GenerateApiKeyInputSchema.parse(d))
  .handler(async ({ data }): Promise<GenerateApiKeyResult> => {
    return executeGenerateApiKey(data);
  });

export const listApiKeysFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => ListApiKeysInputSchema.parse(d))
  .handler(async ({ data }) => {
    return executeListApiKeys(data);
  });

export const revokeApiKeyFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => RevokeApiKeyInputSchema.parse(d))
  .handler(async ({ data }) => {
    return executeRevokeApiKey(data);
  });

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
