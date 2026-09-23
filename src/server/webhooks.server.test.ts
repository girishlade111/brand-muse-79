import { describe, it, expect, vi } from "vitest";
import {
  signWebhookPayload,
  generateWebhookSecret,
  executeCreateWebhookSubscription,
  executeListWebhookSubscriptions,
  executeDeleteWebhookSubscription,
  dispatchWebhookEvent,
  executeTestPingWebhook,
} from "./webhooks.server";

describe("Webhook Event Delivery Engine", () => {
  describe("HMAC-SHA256 Signature Verification", () => {
    it("signs payload deterministically with HMAC-SHA256", () => {
      const secret = "whsec_test_secret_123456789";
      const payload = JSON.stringify({ event: "kit.extraction_completed", data: { kit_id: "123" } });

      const sig1 = signWebhookPayload(payload, secret);
      const sig2 = signWebhookPayload(payload, secret);

      expect(sig1).toHaveLength(64);
      expect(sig1).toBe(sig2);

      // Altering payload changes signature
      const modifiedPayload = JSON.stringify({ event: "kit.extraction_completed", data: { kit_id: "456" } });
      const sigModified = signWebhookPayload(modifiedPayload, secret);
      expect(sig1).not.toBe(sigModified);
    });

    it("generates webhook secrets with 'whsec_' prefix", () => {
      const secret = generateWebhookSecret();
      expect(secret).toMatch(/^whsec_[a-f0-9]{48}$/);
    });
  });

  describe("Subscription Management", () => {
    it("creates a webhook subscription with auto-generated secret", async () => {
      const mockDb = {
        insert: () => ({
          values: (val: any) => ({
            returning: () =>
              Promise.resolve([
                {
                  ...val,
                  id: "sub-uuid-1",
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              ]),
          }),
        }),
      };

      const res = await executeCreateWebhookSubscription(
        {
          userId: "user-1",
          url: "https://example.com/api/webhooks",
          events: ["kit.extraction_completed", "kit.failed"],
        },
        { db: mockDb },
      );

      expect(res.ok).toBe(true);
      expect(res.subscription.url).toBe("https://example.com/api/webhooks");
      expect(res.subscription.secret).toMatch(/^whsec_/);
      expect(res.subscription.events).toContain("kit.extraction_completed");
    });

    it("lists subscriptions for a specific user", async () => {
      const mockDb = {
        select: () => ({
          from: () => ({
            where: () =>
              Promise.resolve([
                {
                  id: "sub-1",
                  userId: "user-1",
                  url: "https://example.com/hooks",
                  secret: "whsec_123",
                  events: ["kit.tokens_updated"],
                  createdAt: new Date(),
                },
              ]),
          }),
        }),
      };

      const subs = await executeListWebhookSubscriptions({ userId: "user-1" }, { db: mockDb });
      expect(subs.length).toBe(1);
      expect(subs[0].url).toBe("https://example.com/hooks");
    });

    it("deletes a webhook subscription", async () => {
      let deleted = false;
      const mockDb = {
        delete: () => ({
          where: () => {
            deleted = true;
            return Promise.resolve();
          },
        }),
      };

      const res = await executeDeleteWebhookSubscription(
        { subscriptionId: "sub-1", userId: "user-1" },
        { db: mockDb },
      );

      expect(res.ok).toBe(true);
      expect(deleted).toBe(true);
    });
  });

  describe("Webhook Dispatch Pipeline", () => {
    it("delivers signed event payload to subscribed endpoints", async () => {
      const sentHeaders: Record<string, string>[] = [];
      const sentBodies: any[] = [];

      const mockFetch = vi.fn().mockImplementation((url: string, opts: any) => {
        sentHeaders.push(opts.headers);
        sentBodies.push(JSON.parse(opts.body));
        return Promise.resolve({ ok: true, status: 200 });
      });

      const mockDb = {
        select: () => ({
          from: () => ({
            where: () =>
              Promise.resolve([
                {
                  id: "sub-1",
                  userId: "user-1",
                  url: "https://api.subscriber.com/events",
                  secret: "whsec_test_secret",
                  events: ["kit.extraction_completed"],
                },
              ]),
          }),
        }),
      };

      const res = await dispatchWebhookEvent(
        "kit.extraction_completed",
        { kit_id: "kit-123", name: "Brand Muse" },
        { userId: "user-1", customFetch: mockFetch as any, db: mockDb },
      );

      expect(res.dispatched).toBe(1);
      expect(res.failed).toBe(0);
      expect(sentBodies[0].event).toBe("kit.extraction_completed");
      expect(sentBodies[0].data.kit_id).toBe("kit-123");

      // Verify signature in header
      const sigHeader = sentHeaders[0]["X-BrandMuse-Signature"];
      expect(sigHeader).toMatch(/^sha256=[a-f0-9]{64}$/);
      const expectedSig = signWebhookPayload(JSON.stringify(sentBodies[0]), "whsec_test_secret");
      expect(sigHeader).toBe(`sha256=${expectedSig}`);
    });

    it("ignores subscriptions that do not listen to the event", async () => {
      const mockFetch = vi.fn();
      const mockDb = {
        select: () => ({
          from: () => ({
            where: () =>
              Promise.resolve([
                {
                  id: "sub-1",
                  userId: "user-1",
                  url: "https://api.subscriber.com/events",
                  secret: "whsec_test",
                  events: ["kit.failed"], // Only listening to kit.failed
                },
              ]),
          }),
        }),
      };

      const res = await dispatchWebhookEvent(
        "kit.extraction_completed",
        { kit_id: "kit-123" },
        { userId: "user-1", customFetch: mockFetch as any, db: mockDb },
      );

      expect(res.dispatched).toBe(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("handles delivery network errors gracefully without throwing", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("Connection refused"));
      const mockDb = {
        select: () => ({
          from: () => ({
            where: () =>
              Promise.resolve([
                {
                  id: "sub-1",
                  userId: "user-1",
                  url: "https://unreachable.endpoint/webhook",
                  secret: "whsec_test",
                  events: ["kit.failed"],
                },
              ]),
          }),
        }),
      };

      const res = await dispatchWebhookEvent(
        "kit.failed",
        { kit_id: "kit-123", error: "Source site blocked" },
        { userId: "user-1", customFetch: mockFetch as any, db: mockDb },
      );

      expect(res.dispatched).toBe(0);
      expect(res.failed).toBe(1);
    });

    it("sends test ping to verify webhook connectivity", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      const mockDb = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () =>
                Promise.resolve([
                  {
                    id: "sub-1",
                    userId: "user-1",
                    url: "https://api.subscriber.com/webhook",
                    secret: "whsec_test",
                    events: ["kit.extraction_completed"],
                  },
                ]),
            }),
          }),
        }),
      };

      const pingResult = await executeTestPingWebhook(
        { subscriptionId: "sub-1", userId: "user-1" },
        { db: mockDb, customFetch: mockFetch as any },
      );

      expect(pingResult.ok).toBe(true);
      expect(pingResult.status).toBe(200);
      expect(pingResult.message).toContain("Successfully sent test ping");
    });
  });
});
