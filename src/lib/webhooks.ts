// Shared Webhook Definitions & Validation Schemas.
// Safe for both client forms and server dispatchers.

import { z } from "zod";

export const WEBHOOK_EVENTS = [
  "kit.extraction_completed",
  "kit.tokens_updated",
  "kit.failed",
] as const;

export type WebhookEventName = (typeof WEBHOOK_EVENTS)[number];

export const CreateWebhookSubscriptionInputSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  url: z.string().url("Valid webhook URL is required"),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1, "At least one event must be selected"),
});

export const ListWebhookSubscriptionsInputSchema = z.object({
  userId: z.string().min(1),
});

export const DeleteWebhookSubscriptionInputSchema = z.object({
  subscriptionId: z.string().uuid(),
  userId: z.string().min(1),
});

export const TestPingWebhookInputSchema = z.object({
  subscriptionId: z.string().uuid(),
  userId: z.string().min(1),
});

export type CreateWebhookSubscriptionInput = z.infer<typeof CreateWebhookSubscriptionInputSchema>;
export type ListWebhookSubscriptionsInput = z.infer<typeof ListWebhookSubscriptionsInputSchema>;
export type DeleteWebhookSubscriptionInput = z.infer<typeof DeleteWebhookSubscriptionInputSchema>;
export type TestPingWebhookInput = z.infer<typeof TestPingWebhookInputSchema>;
