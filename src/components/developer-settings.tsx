// Developer Settings Component: API Keys, Webhook Subscriptions & Integration Quickstart.
// Allows developers to generate, inspect, and revoke API keys and configure webhook delivery.

import { useState, useEffect, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { generateApiKeyFn, listApiKeysFn, revokeApiKeyFn } from "@/server/api-auth.server";
import {
  createWebhookSubscriptionFn,
  listWebhookSubscriptionsFn,
  deleteWebhookSubscriptionFn,
  testPingWebhookFn,
  WEBHOOK_EVENTS,
  type WebhookEventName,
} from "@/server/webhooks.server";
import {
  Key,
  Webhook,
  Code,
  Copy,
  Check,
  Trash2,
  Plus,
  Loader2,
  ExternalLink,
  ShieldAlert,
  Send,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export type DeveloperSettingsProps = {
  userId?: string;
  className?: string;
};

export function DeveloperSettings({ userId = "user-default", className }: DeveloperSettingsProps) {
  const [activeTab, setActiveTab] = useState<"keys" | "webhooks" | "quickstart">("keys");

  // API Keys state
  const listKeys = useServerFn(listApiKeysFn);
  const generateKey = useServerFn(generateApiKeyFn);
  const revokeKey = useServerFn(revokeApiKeyFn);

  const [keysList, setKeysList] = useState<any[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [createKeyModalOpen, setCreateKeyModalOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [keyRateLimit, setKeyRateLimit] = useState(60);
  const [creatingKey, setCreatingKey] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Webhooks state
  const listWebhooks = useServerFn(listWebhookSubscriptionsFn);
  const createWebhook = useServerFn(createWebhookSubscriptionFn);
  const deleteWebhook = useServerFn(deleteWebhookSubscriptionFn);
  const testPing = useServerFn(testPingWebhookFn);

  const [webhooksList, setWebhooksList] = useState<any[]>([]);
  const [loadingWebhooks, setLoadingWebhooks] = useState(false);
  const [addWebhookModalOpen, setAddWebhookModalOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<WebhookEventName[]>([
    "kit.extraction_completed",
    "kit.tokens_updated",
    "kit.failed",
  ]);
  const [creatingWebhook, setCreatingWebhook] = useState(false);
  const [testingPingId, setTestingPingId] = useState<string | null>(null);

  // Load API Keys
  const loadKeys = useCallback(async () => {
    setLoadingKeys(true);
    try {
      const res = await listKeys({ data: { userId } });
      setKeysList(res || []);
    } catch {
      // Non-blocking
    } finally {
      setLoadingKeys(false);
    }
  }, [userId, listKeys]);

  // Load Webhooks
  const loadWebhooks = useCallback(async () => {
    setLoadingWebhooks(true);
    try {
      const res = await listWebhooks({ data: { userId } });
      setWebhooksList(res || []);
    } catch {
      // Non-blocking
    } finally {
      setLoadingWebhooks(false);
    }
  }, [userId, listWebhooks]);

  useEffect(() => {
    loadKeys();
    loadWebhooks();
  }, [loadKeys, loadWebhooks]);

  // Handlers: API Keys
  async function handleCreateKey(e: React.FormEvent) {
    e.preventDefault();
    if (!keyName.trim()) {
      toast.error("Please provide a name for this API key.");
      return;
    }

    setCreatingKey(true);
    try {
      const res = await generateKey({
        data: {
          userId,
          name: keyName.trim(),
          rateLimitPerMin: keyRateLimit,
        },
      });

      setRevealedKey(res.rawKey);
      setKeyName("");
      loadKeys();
      toast.success("API Key generated successfully.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to generate API Key.");
    } finally {
      setCreatingKey(false);
    }
  }

  async function handleRevokeKey(keyId: string, name: string) {
    if (!confirm(`Are you sure you want to revoke API Key "${name}"? This cannot be undone.`)) {
      return;
    }

    try {
      await revokeKey({ data: { keyId, userId } });
      toast.success(`API Key "${name}" revoked.`);
      loadKeys();
    } catch (err: any) {
      toast.error(err?.message || "Failed to revoke API key.");
    }
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedKey(false), 2000);
  }

  // Handlers: Webhooks
  async function handleCreateWebhook(e: React.FormEvent) {
    e.preventDefault();
    if (!webhookUrl.trim() || !webhookUrl.startsWith("http")) {
      toast.error("Please enter a valid HTTP/HTTPS webhook URL.");
      return;
    }
    if (selectedEvents.length === 0) {
      toast.error("Please select at least one event to subscribe to.");
      return;
    }

    setCreatingWebhook(true);
    try {
      await createWebhook({
        data: {
          userId,
          url: webhookUrl.trim(),
          events: selectedEvents,
        },
      });

      setWebhookUrl("");
      setAddWebhookModalOpen(false);
      loadWebhooks();
      toast.success("Webhook endpoint registered.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to register webhook.");
    } finally {
      setCreatingWebhook(false);
    }
  }

  async function handleDeleteWebhook(subscriptionId: string) {
    if (!confirm("Delete this webhook subscription?")) return;
    try {
      await deleteWebhook({ data: { subscriptionId, userId } });
      toast.success("Webhook subscription deleted.");
      loadWebhooks();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete webhook.");
    }
  }

  async function handleTestPing(subscriptionId: string) {
    setTestingPingId(subscriptionId);
    try {
      const res = await testPing({ data: { subscriptionId, userId } });
      if (res.ok) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err?.message || "Ping test failed.");
    } finally {
      setTestingPingId(null);
    }
  }

  return (
    <div className={`space-y-6 ${className || ""}`}>
      {/* Header Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#0A0A0A] pb-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#8B1A1A]">
            // DEVELOPER PLATFORM · INTEGRATIONS
          </p>
          <h2 className="mt-1 text-3xl [font-family:'Cormorant_Garamond',serif] sm:text-4xl">
            Developer Settings &amp; API
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/api/v1/docs"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 border border-[#0A0A0A] bg-background px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-foreground hover:bg-foreground hover:text-background transition-colors"
            style={{ borderRadius: 0 }}
          >
            [ Interactive Docs <ExternalLink className="h-3 w-3" /> ]
          </a>
          <a
            href="/api/v1/openapi.json"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 border border-[#0A0A0A] bg-background px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-foreground hover:bg-foreground hover:text-background transition-colors"
            style={{ borderRadius: 0 }}
          >
            [ OpenAPI Spec ↗ ]
          </a>
        </div>
      </div>

      {/* Navigation Tab Bar */}
      <div className="flex items-center gap-2 border-b border-[color:var(--border-subtle)] pb-2 font-mono text-[11px] uppercase tracking-[0.16em]">
        <button
          type="button"
          onClick={() => setActiveTab("keys")}
          className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${
            activeTab === "keys"
              ? "border border-[#0A0A0A] bg-foreground text-background font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
          style={{ borderRadius: 0 }}
        >
          <Key className="h-3.5 w-3.5" />[ API Keys ({keysList.length}) ]
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("webhooks")}
          className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${
            activeTab === "webhooks"
              ? "border border-[#0A0A0A] bg-foreground text-background font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
          style={{ borderRadius: 0 }}
        >
          <Webhook className="h-3.5 w-3.5" />[ Webhooks ({webhooksList.length}) ]
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("quickstart")}
          className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${
            activeTab === "quickstart"
              ? "border border-[#0A0A0A] bg-foreground text-background font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
          style={{ borderRadius: 0 }}
        >
          <Code className="h-3.5 w-3.5" />[ REST cURL Snippets ]
        </button>
      </div>

      {/* TAB 1: API KEYS */}
      {activeTab === "keys" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">
                Manage personal API keys for headless brand ingestion and token querying.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setRevealedKey(null);
                setCreateKeyModalOpen(true);
              }}
              className="flex items-center gap-1.5 border border-[#8B1A1A] bg-[#8B1A1A] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-[#F4EFE6] font-bold hover:opacity-90 transition-opacity"
              style={{ borderRadius: 0 }}
            >
              <Plus className="h-3.5 w-3.5" />[ Create New API Key ]
            </button>
          </div>

          {loadingKeys ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : keysList.length === 0 ? (
            <div className="border border-dashed border-[color:var(--border-subtle)] p-10 text-center">
              <Key className="mx-auto h-8 w-8 text-muted-foreground opacity-40" />
              <p className="mt-3 text-sm font-semibold">No API Keys Generated</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Create an API key to programmatically trigger brand kit extractions or query design
                tokens.
              </p>
            </div>
          ) : (
            <div className="border border-[#0A0A0A] divide-y divide-[color:var(--border-subtle)] bg-background">
              {keysList.map((k) => (
                <div
                  key={k.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-muted/10 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">{k.name}</span>
                      <span className="font-mono text-[10px] border border-[color:var(--border-subtle)] bg-muted/40 px-2 py-0.5 text-muted-foreground">
                        {k.rateLimitPerMin || 60} req/min
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-4 font-mono text-[11px] text-muted-foreground">
                      <span>
                        Key Prefix: <code className="text-foreground">{k.prefix}</code>
                      </span>
                      <span>•</span>
                      <span>
                        Last Used:{" "}
                        {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : "Never"}
                      </span>
                      <span>•</span>
                      <span>Created: {new Date(k.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRevokeKey(k.id, k.name)}
                      className="flex items-center gap-1 border border-red-500/30 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                      style={{ borderRadius: 0 }}
                    >
                      <Trash2 className="h-3 w-3" />[ Revoke ]
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: WEBHOOKS */}
      {activeTab === "webhooks" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">
                Receive real-time HTTP POST notifications when extractions finish or tokens change.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAddWebhookModalOpen(true)}
              className="flex items-center gap-1.5 border border-[#8B1A1A] bg-[#8B1A1A] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-[#F4EFE6] font-bold hover:opacity-90 transition-opacity"
              style={{ borderRadius: 0 }}
            >
              <Plus className="h-3.5 w-3.5" />[ Add Webhook Endpoint ]
            </button>
          </div>

          {loadingWebhooks ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : webhooksList.length === 0 ? (
            <div className="border border-dashed border-[color:var(--border-subtle)] p-10 text-center">
              <Webhook className="mx-auto h-8 w-8 text-muted-foreground opacity-40" />
              <p className="mt-3 text-sm font-semibold">No Webhook Endpoints Configured</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add an HTTPS endpoint to automatically receive webhook dispatches for extraction
                events.
              </p>
            </div>
          ) : (
            <div className="border border-[#0A0A0A] divide-y divide-[color:var(--border-subtle)] bg-background">
              {webhooksList.map((wh) => (
                <div
                  key={wh.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-muted/10 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-foreground truncate">
                        {wh.url}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-[10px]">
                      {(wh.events || []).map((ev: string) => (
                        <span
                          key={ev}
                          className="border border-[color:var(--border-subtle)] bg-muted/30 px-2 py-0.5 text-muted-foreground"
                        >
                          {ev}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                      <span>
                        Secret: <code>{wh.secret.slice(0, 10)}...</code>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(wh.secret)}
                        className="underline hover:text-foreground"
                      >
                        Copy secret
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={testingPingId === wh.id}
                      onClick={() => handleTestPing(wh.id)}
                      className="flex items-center gap-1 border border-[#0A0A0A] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground hover:bg-foreground hover:text-background transition-colors disabled:opacity-50"
                      style={{ borderRadius: 0 }}
                    >
                      {testingPingId === wh.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Send className="h-3 w-3" />
                      )}
                      [ Test Ping ]
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteWebhook(wh.id)}
                      className="flex items-center gap-1 border border-red-500/30 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                      style={{ borderRadius: 0 }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: QUICKSTART & CURL SNIPPETS */}
      {activeTab === "quickstart" && (
        <div className="space-y-6">
          <div className="border border-[color:var(--border-subtle)] p-4 bg-muted/10">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#8B1A1A]">
              // 01 · ASYNCHRONOUS EXTRACTION PIPELINE
            </span>
            <p className="mt-1 text-xs text-muted-foreground">
              POST a website URL to trigger automated token extraction.
            </p>
            <div className="relative mt-3">
              <pre className="border border-[color:var(--border-subtle)] bg-[#0A0A0A] p-4 font-mono text-[11px] text-[#F4EFE6] overflow-x-auto">
                {`curl -X POST https://app.brandmuse.io/api/v1/extract \\
  -H "Authorization: Bearer bm_live_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://stripe.com"}'`}
              </pre>
            </div>
          </div>

          <div className="border border-[color:var(--border-subtle)] p-4 bg-muted/10">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#8B1A1A]">
              // 02 · FULL BRAND IDENTITY JSON SCHEMA
            </span>
            <p className="mt-1 text-xs text-muted-foreground">
              Retrieve full colors, typography, DTCG variables, and logos.
            </p>
            <div className="relative mt-3">
              <pre className="border border-[color:var(--border-subtle)] bg-[#0A0A0A] p-4 font-mono text-[11px] text-[#F4EFE6] overflow-x-auto">
                {`curl https://app.brandmuse.io/api/v1/kits/8f3b20df-4f05-4f40-84c1-cbfb49e3bf32 \\
  -H "Authorization: Bearer bm_live_your_api_key_here"`}
              </pre>
            </div>
          </div>

          <div className="border border-[color:var(--border-subtle)] p-4 bg-muted/10">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#8B1A1A]">
              // 03 · RAW CDN TOKENS.CSS EMBED
            </span>
            <p className="mt-1 text-xs text-muted-foreground">
              Embed directly into any website HTML with automatic caching and Content-Type:
              text/css.
            </p>
            <div className="relative mt-3">
              <pre className="border border-[color:var(--border-subtle)] bg-[#0A0A0A] p-4 font-mono text-[11px] text-[#F4EFE6] overflow-x-auto">
                {`<link rel="stylesheet" href="https://app.brandmuse.io/api/v1/kits/8f3b20df-4f05-4f40-84c1-cbfb49e3bf32/css">`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* CREATE API KEY MODAL */}
      <Dialog open={createKeyModalOpen} onOpenChange={setCreateKeyModalOpen}>
        <DialogContent
          className="border-[#0A0A0A] bg-background text-foreground sm:max-w-md p-6"
          style={{ borderRadius: 0 }}
        >
          <DialogHeader>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#8B1A1A]">
              // SECURITY CREDENTIALS
            </p>
            <DialogTitle className="text-2xl [font-family:'Cormorant_Garamond',serif]">
              Generate Developer API Key
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              API Keys allow programmatic access to the Brand Muse extraction and token APIs.
            </DialogDescription>
          </DialogHeader>

          {revealedKey ? (
            <div className="mt-4 space-y-4">
              <div className="border border-amber-500/40 bg-amber-500/10 p-4">
                <div className="flex items-start gap-2 text-amber-500">
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em] font-bold">
                    Copy your API key now
                  </p>
                </div>
                <p className="mt-1.5 text-xs text-foreground leading-relaxed">
                  For your security, we only store a cryptographic hash of this key. You will not be
                  able to see this secret again!
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Secret API Key
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={revealedKey}
                    className="w-full border border-[color:var(--border-subtle)] bg-background px-3 py-2 font-mono text-xs text-foreground focus:outline-none"
                    style={{ borderRadius: 0 }}
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(revealedKey)}
                    className="flex items-center gap-1 border border-[#0A0A0A] bg-foreground text-background px-3 py-2 font-mono text-xs uppercase"
                    style={{ borderRadius: 0 }}
                  >
                    {copiedKey ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCreateKeyModalOpen(false)}
                className="w-full border border-[#0A0A0A] bg-foreground py-2 font-mono text-xs uppercase tracking-[0.14em] text-background hover:opacity-90"
                style={{ borderRadius: 0 }}
              >
                [ I Have Saved My Key ]
              </button>
            </div>
          ) : (
            <form onSubmit={handleCreateKey} className="mt-4 space-y-4">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1">
                  Key Name / Description
                </label>
                <input
                  type="text"
                  required
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="e.g. Production Mobile App or CI Pipeline"
                  className="w-full border border-[color:var(--border-subtle)] bg-background px-3 py-2 font-mono text-xs text-foreground focus:border-[#0A0A0A] focus:outline-none"
                  style={{ borderRadius: 0 }}
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1">
                  Rate Limit Threshold
                </label>
                <select
                  value={keyRateLimit}
                  onChange={(e) => setKeyRateLimit(Number(e.target.value))}
                  className="w-full border border-[color:var(--border-subtle)] bg-background px-3 py-2 font-mono text-xs text-foreground focus:border-[#0A0A0A] focus:outline-none"
                  style={{ borderRadius: 0 }}
                >
                  <option value={60}>60 requests / minute (Standard Tier)</option>
                  <option value={120}>120 requests / minute (Pro Tier)</option>
                  <option value={300}>300 requests / minute (High Volume Enterprise)</option>
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={creatingKey}
                  className="w-full flex items-center justify-center gap-1.5 border border-[#8B1A1A] bg-[#8B1A1A] py-2.5 font-mono text-xs uppercase tracking-[0.16em] text-[#F4EFE6] font-bold hover:opacity-90 disabled:opacity-50"
                  style={{ borderRadius: 0 }}
                >
                  {creatingKey ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Generating…
                    </>
                  ) : (
                    "[ Generate API Key ]"
                  )}
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ADD WEBHOOK MODAL */}
      <Dialog open={addWebhookModalOpen} onOpenChange={setAddWebhookModalOpen}>
        <DialogContent
          className="border-[#0A0A0A] bg-background text-foreground sm:max-w-md p-6"
          style={{ borderRadius: 0 }}
        >
          <DialogHeader>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#8B1A1A]">
              // EVENT DISPATCH PIPELINE
            </p>
            <DialogTitle className="text-2xl [font-family:'Cormorant_Garamond',serif]">
              Register Webhook Endpoint
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Receive signed HMAC-SHA256 HTTP POST notifications when brand extraction jobs
              complete.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateWebhook} className="mt-4 space-y-4">
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1">
                Webhook Target URL
              </label>
              <input
                type="url"
                required
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://api.yourdomain.com/webhooks/brand-muse"
                className="w-full border border-[color:var(--border-subtle)] bg-background px-3 py-2 font-mono text-xs text-foreground focus:border-[#0A0A0A] focus:outline-none"
                style={{ borderRadius: 0 }}
              />
            </div>

            <div>
              <label className="block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">
                Subscribed Events
              </label>
              <div className="space-y-2 border border-[color:var(--border-subtle)] p-3 bg-muted/10">
                {WEBHOOK_EVENTS.map((ev) => {
                  const checked = selectedEvents.includes(ev);
                  return (
                    <label
                      key={ev}
                      className="flex items-center gap-2 cursor-pointer font-mono text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedEvents([...selectedEvents, ev]);
                          } else {
                            setSelectedEvents(selectedEvents.filter((x) => x !== ev));
                          }
                        }}
                        className="rounded-none border-foreground"
                      />
                      <span className="text-foreground">{ev}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={creatingWebhook}
                className="w-full flex items-center justify-center gap-1.5 border border-[#8B1A1A] bg-[#8B1A1A] py-2.5 font-mono text-xs uppercase tracking-[0.16em] text-[#F4EFE6] font-bold hover:opacity-90 disabled:opacity-50"
                style={{ borderRadius: 0 }}
              >
                {creatingWebhook ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Registering…
                  </>
                ) : (
                  "[ Register Webhook ]"
                )}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
