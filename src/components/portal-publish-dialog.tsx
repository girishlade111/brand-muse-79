import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe,
  KeyRound,
  Layers,
  Loader2,
  Lock,
  RefreshCw,
  Shield,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  checkSlugAvailability,
  getPortalSettings,
  provisionCustomDomain,
  removeCustomDomain,
  updatePortalSettings,
  verifyCustomDomainDns,
} from "@/lib/portal.functions";

interface PortalPublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kitId: string;
  kitName: string;
  ownerToken: string;
}

export function PortalPublishDialog({
  open,
  onOpenChange,
  kitId,
  kitName,
  ownerToken,
}: PortalPublishDialogProps) {
  const fetchSettings = useServerFn(getPortalSettings);
  const saveSettings = useServerFn(updatePortalSettings);
  const checkSlug = useServerFn(checkSlugAvailability);
  const connectDomain = useServerFn(provisionCustomDomain);
  const verifyDns = useServerFn(verifyCustomDomainDns);
  const disconnectDomain = useServerFn(removeCustomDomain);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<any>(null);

  // Form State
  const [isPublished, setIsPublished] = useState(true);
  const [slug, setSlug] = useState("");
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugReason, setSlugReason] = useState<string | null>(null);

  // Custom Domain State
  const [customDomainInput, setCustomDomainInput] = useState("");
  const [domainConnecting, setDomainConnecting] = useState(false);
  const [verifyingDns, setVerifyingDns] = useState(false);

  // Security State
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [password, setPassword] = useState("");
  const [clearPassword, setClearPassword] = useState(false);
  const [passwordHint, setPasswordHint] = useState("");
  const [expiresAt, setExpiresAt] = useState<string>("");

  // Whitelabel State
  const [whitelabelRemoveBadge, setWhitelabelRemoveBadge] = useState(false);
  const [whitelabelTitle, setWhitelabelTitle] = useState("");
  const [whitelabelMetaDescription, setWhitelabelMetaDescription] = useState("");
  const [whitelabelFaviconUrl, setWhitelabelFaviconUrl] = useState("");

  const copy = (text: string, label: string = "Copied") => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  // Load settings on open
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchSettings({ data: { kitId, ownerToken } })
      .then((s) => {
        setSettings(s);
        setIsPublished(Boolean(s.isPublished));
        setSlug(s.slug || "");
        setCustomDomainInput(s.customDomain || "");
        setIsPasswordProtected(Boolean(s.isPasswordProtected));
        setPasswordHint(s.passwordHint || "");
        setExpiresAt(s.expiresAt ? s.expiresAt.slice(0, 16) : "");
        setWhitelabelRemoveBadge(Boolean(s.whitelabelRemoveBadge));
        setWhitelabelTitle(s.whitelabelTitle || "");
        setWhitelabelMetaDescription(s.whitelabelMetaDescription || "");
        setWhitelabelFaviconUrl(s.whitelabelFaviconUrl || "");
      })
      .catch((e: any) => {
        toast.error(e?.message || "Failed to load portal configuration");
      })
      .finally(() => setLoading(false));
  }, [open, kitId, ownerToken, fetchSettings]);

  // Check slug availability debounce
  useEffect(() => {
    if (!slug || slug === settings?.slug) {
      setSlugAvailable(true);
      setSlugReason(null);
      return;
    }
    const timer = setTimeout(async () => {
      setSlugChecking(true);
      try {
        const res = await checkSlug({ data: { slug, currentKitId: kitId } });
        setSlugAvailable(res.available);
        setSlugReason(res.reason || null);
      } catch {
        setSlugAvailable(false);
      } finally {
        setSlugChecking(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [slug, settings?.slug, kitId, checkSlug]);

  // Save Settings
  const handleSave = async () => {
    if (!slug) {
      toast.error("Please provide a URL slug");
      return;
    }
    if (slugAvailable === false) {
      toast.error(slugReason || "This slug is not available");
      return;
    }

    setSaving(true);
    try {
      const res = await saveSettings({
        data: {
          kitId,
          ownerToken,
          slug,
          isPublished,
          isPasswordProtected,
          password: password.trim() ? password.trim() : undefined,
          clearPassword: clearPassword,
          passwordHint: passwordHint.trim() || null,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
          whitelabelRemoveBadge,
          whitelabelTitle: whitelabelTitle.trim() || null,
          whitelabelMetaDescription: whitelabelMetaDescription.trim() || null,
          whitelabelFaviconUrl: whitelabelFaviconUrl.trim() || null,
        },
      });

      if (res.success) {
        toast.success("Brand Guidelines Portal updated & edge cache primed");
        setClearPassword(false);
        setPassword("");
        onOpenChange(false);
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to update portal");
    } finally {
      setSaving(false);
    }
  };

  // Connect Custom Domain
  const handleConnectDomain = async () => {
    if (!customDomainInput.trim()) return;
    setDomainConnecting(true);
    try {
      const res = await connectDomain({
        data: {
          kitId,
          ownerToken,
          domain: customDomainInput.trim(),
        },
      });
      setSettings((prev: any) => ({
        ...prev,
        customDomain: res.customDomain,
        customDomainStatus: res.status,
        customDomainSslStatus: res.sslStatus,
        customDomainCnameTarget: res.cnameTarget,
        cfVerificationData: {
          ownershipVerification: res.ownershipVerification,
          sslValidationRecords: res.sslValidationRecords,
        },
      }));
      toast.success(
        res.simulationMode
          ? "Domain attached in DNS simulation mode"
          : "Domain provisioned with Cloudflare SSL for SaaS",
      );
    } catch (e: any) {
      toast.error(e?.message || "Failed to connect domain");
    } finally {
      setDomainConnecting(false);
    }
  };

  // Verify DNS Status
  const handleVerifyDns = async () => {
    setVerifyingDns(true);
    try {
      const res = await verifyDns({
        data: {
          kitId,
          ownerToken,
        },
      });
      setSettings((prev: any) => ({
        ...prev,
        customDomainStatus: res.status,
        customDomainSslStatus: res.sslStatus,
        customDomainCnameTarget: res.cnameTarget,
        cfVerificationData: {
          ownershipVerification: res.ownershipVerification,
          sslValidationRecords: res.sslValidationRecords,
        },
      }));
      if (res.status === "active") {
        toast.success("Domain verified and active on edge!");
      } else {
        toast.info(`Current status: ${res.status}. SSL: ${res.sslStatus}`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to verify DNS");
    } finally {
      setVerifyingDns(false);
    }
  };

  // Remove Domain
  const handleDisconnectDomain = async () => {
    if (!confirm("Are you sure you want to disconnect this custom domain?")) return;
    try {
      await disconnectDomain({
        data: {
          kitId,
          ownerToken,
        },
      });
      setSettings((prev: any) => ({
        ...prev,
        customDomain: null,
        customDomainStatus: "unconfigured",
        cfVerificationData: null,
      }));
      setCustomDomainInput("");
      toast.success("Custom domain removed");
    } catch (e: any) {
      toast.error(e?.message || "Failed to remove domain");
    }
  };

  const portalUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/p/${slug}`
      : `https://branddna.app/p/${slug}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-[#0F0F0F] text-[#F4EFE6] border-[#262626] p-0 overflow-hidden sm:rounded-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-[#262626] bg-[#141414]">
          <DialogHeader>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-neutral-400">
              <Globe className="h-3.5 w-3.5 text-emerald-400" />
              <span>// CLOUD INFRASTRUCTURE & HOSTING</span>
            </div>
            <DialogTitle className="text-2xl font-serif font-bold text-foreground">
              Publish Brand Guidelines Website
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-400 font-sans">
              Host a live, interactive, white-labeled microsite for {kitName} on custom subdomains
              or your own custom domain with Cloudflare SSL for SaaS and edge caching.
            </DialogDescription>
          </DialogHeader>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs font-mono text-neutral-400 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
            Loading portal configuration...
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Live Status Toggle Card */}
            <div className="rounded-xl border border-neutral-800 bg-[#141414] p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 font-medium text-sm">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isPublished ? "bg-emerald-400 animate-pulse" : "bg-neutral-600"
                    }`}
                  />
                  <span>
                    Website Status: {isPublished ? "Live & Published" : "Draft / Private"}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {isPublished
                    ? "Accessible to clients, partners, and media teams."
                    : "Only visible to you while drafting."}
                </p>
              </div>
              <Switch checked={isPublished} onCheckedChange={setIsPublished} />
            </div>

            <Tabs defaultValue="domain" className="w-full">
              <TabsList className="grid grid-cols-3 bg-neutral-900 border border-neutral-800 p-1 rounded-xl">
                <TabsTrigger
                  value="domain"
                  className="font-mono text-[11px] uppercase tracking-wider data-[state=active]:bg-neutral-800 data-[state=active]:text-white"
                >
                  Domain & URL
                </TabsTrigger>
                <TabsTrigger
                  value="security"
                  className="font-mono text-[11px] uppercase tracking-wider data-[state=active]:bg-neutral-800 data-[state=active]:text-white"
                >
                  Access & Security
                </TabsTrigger>
                <TabsTrigger
                  value="whitelabel"
                  className="font-mono text-[11px] uppercase tracking-wider data-[state=active]:bg-neutral-800 data-[state=active]:text-white"
                >
                  Whitelabeling
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: Domain & URL */}
              <TabsContent value="domain" className="space-y-6 pt-4">
                {/* Subdomain Slug */}
                <div className="space-y-2">
                  <Label className="text-xs font-mono uppercase tracking-wider text-neutral-400">
                    Hosted Subdomain / Slug
                  </Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        value={slug}
                        onChange={(e) => setSlug(e.target.value.toLowerCase().trim())}
                        placeholder="e.g. acme-brand"
                        className="font-mono text-xs bg-neutral-900 border-neutral-800 pr-8"
                      />
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                        {slugChecking ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-500" />
                        ) : slugAvailable === true ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : slugAvailable === false ? (
                          <X className="h-3.5 w-3.5 text-red-400" />
                        ) : null}
                      </div>
                    </div>
                  </div>
                  {slugReason && <p className="text-[11px] text-red-400 font-sans">{slugReason}</p>}

                  {/* Public Link Preview */}
                  <div className="mt-3 flex items-center justify-between p-3 rounded-lg bg-neutral-900/60 border border-neutral-800 text-xs font-mono">
                    <span className="text-neutral-400 truncate max-w-[360px]">{portalUrl}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copy(portalUrl, "Portal link")}
                        className="h-7 px-2 text-neutral-400 hover:text-white"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <a href={`/p/${slug}`} target="_blank" rel="noreferrer">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-neutral-400 hover:text-white"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                    </div>
                  </div>
                </div>

                {/* Custom Domain (Cloudflare SSL for SaaS) */}
                <div className="pt-4 border-t border-neutral-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs font-mono uppercase tracking-wider text-neutral-300">
                        Custom Domain (Cloudflare SSL for SaaS)
                      </Label>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Point your own domain (e.g. <code>brand.company.com</code>) directly to your
                        guidelines.
                      </p>
                    </div>
                    {settings?.customDomain && (
                      <span
                        className={`font-mono text-[10px] uppercase px-2 py-0.5 rounded-full border ${
                          settings.customDomainStatus === "active"
                            ? "bg-emerald-950/40 border-emerald-800 text-emerald-400"
                            : "bg-amber-950/40 border-amber-800 text-amber-400"
                        }`}
                      >
                        {settings.customDomainStatus}
                      </span>
                    )}
                  </div>

                  {!settings?.customDomain ? (
                    <div className="flex gap-2">
                      <Input
                        value={customDomainInput}
                        onChange={(e) => setCustomDomainInput(e.target.value)}
                        placeholder="brand.yourcompany.com"
                        className="font-mono text-xs bg-neutral-900 border-neutral-800"
                      />
                      <Button
                        onClick={handleConnectDomain}
                        disabled={domainConnecting || !customDomainInput.trim()}
                        className="font-mono text-xs uppercase bg-[#F4EFE6] text-[#0A0A0A] hover:bg-white shrink-0"
                      >
                        {domainConnecting ? "Provisioning..." : "Connect"}
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-semibold text-emerald-400">
                          https://{settings.customDomain}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleVerifyDns}
                            disabled={verifyingDns}
                            className="h-7 text-xs font-mono border-neutral-700"
                          >
                            <RefreshCw
                              className={`mr-1 h-3 w-3 ${verifyingDns ? "animate-spin" : ""}`}
                            />
                            Verify Status
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleDisconnectDomain}
                            className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/20 px-2"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* DNS Instructions Box */}
                      <div className="pt-2 border-t border-neutral-800 text-xs space-y-2">
                        <p className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">
                          // REQUIRED DNS RECORDS (IN YOUR DOMAIN REGISTRAR)
                        </p>
                        <div className="grid grid-cols-3 gap-2 p-2 bg-neutral-950 rounded border border-neutral-800 font-mono text-[11px]">
                          <div>
                            <span className="text-neutral-500 block text-[9px]">TYPE</span>
                            <span>CNAME</span>
                          </div>
                          <div>
                            <span className="text-neutral-500 block text-[9px]">HOST</span>
                            <span>{settings.customDomain.split(".")[0]}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-neutral-500 block text-[9px]">TARGET</span>
                              <span>
                                {settings.customDomainCnameTarget || "cname.branddna.app"}
                              </span>
                            </div>
                            <button
                              onClick={() =>
                                copy(
                                  settings.customDomainCnameTarget || "cname.branddna.app",
                                  "CNAME target",
                                )
                              }
                              className="text-neutral-400 hover:text-white"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        {settings.cfVerificationData?.ownershipVerification &&
                          settings.cfVerificationData.ownershipVerification.type === "txt" && (
                            <div className="grid grid-cols-3 gap-2 p-2 bg-neutral-950 rounded border border-neutral-800 font-mono text-[11px]">
                              <div>
                                <span className="text-neutral-500 block text-[9px]">TYPE</span>
                                <span>TXT (Ownership)</span>
                              </div>
                              <div className="truncate">
                                <span className="text-neutral-500 block text-[9px]">NAME</span>
                                <span className="truncate">
                                  {settings.cfVerificationData.ownershipVerification.name}
                                </span>
                              </div>
                              <div className="flex items-center justify-between truncate">
                                <span className="truncate">
                                  {settings.cfVerificationData.ownershipVerification.value}
                                </span>
                                <button
                                  onClick={() =>
                                    copy(
                                      settings.cfVerificationData.ownershipVerification.value,
                                      "TXT record",
                                    )
                                  }
                                  className="text-neutral-400 hover:text-white"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* TAB 2: Access & Security */}
              <TabsContent value="security" className="space-y-6 pt-4">
                {/* Password Protection */}
                <div className="rounded-xl border border-neutral-800 bg-[#141414] p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 font-medium text-sm">
                        <Lock className="h-4 w-4 text-amber-400" />
                        <span>Passphrase Protection</span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Require an access code to view the guidelines (ideal for pre-launch
                        rebrands).
                      </p>
                    </div>
                    <Switch
                      checked={isPasswordProtected}
                      onCheckedChange={setIsPasswordProtected}
                    />
                  </div>

                  {isPasswordProtected && (
                    <div className="space-y-3 pt-3 border-t border-neutral-800">
                      <div>
                        <Label className="text-xs font-mono uppercase text-neutral-400">
                          {settings?.hasPassword ? "Change Passphrase" : "Set Passphrase"}
                        </Label>
                        <Input
                          type="password"
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            setClearPassword(false);
                          }}
                          placeholder={
                            settings?.hasPassword
                              ? "Enter new passphrase (leave empty to keep current)"
                              : "Enter secret access passphrase"
                          }
                          className="mt-1 font-mono text-xs bg-neutral-900 border-neutral-800"
                        />
                      </div>

                      <div>
                        <Label className="text-xs font-mono uppercase text-neutral-400">
                          Passphrase Hint (Optional)
                        </Label>
                        <Input
                          value={passwordHint}
                          onChange={(e) => setPasswordHint(e.target.value)}
                          placeholder="e.g. Agency campaign codename"
                          className="mt-1 font-mono text-xs bg-neutral-900 border-neutral-800"
                        />
                      </div>

                      {settings?.hasPassword && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setClearPassword(true);
                            setPassword("");
                            setIsPasswordProtected(false);
                            toast.info("Password will be removed upon saving");
                          }}
                          className="text-xs text-red-400 hover:text-red-300 hover:bg-red-950/20"
                        >
                          Remove Passphrase
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Expiring Access */}
                <div className="rounded-xl border border-neutral-800 bg-[#141414] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 font-medium text-sm">
                        <Shield className="h-4 w-4 text-blue-400" />
                        <span>Expiring Pre-Launch Access</span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Automatically lock guidelines access on a predetermined launch date.
                      </p>
                    </div>
                    {expiresAt && (
                      <button
                        onClick={() => setExpiresAt("")}
                        className="text-xs text-neutral-500 hover:text-neutral-300"
                      >
                        Clear Expiry
                      </button>
                    )}
                  </div>

                  <div>
                    <Input
                      type="datetime-local"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      className="font-mono text-xs bg-neutral-900 border-neutral-800"
                    />
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + 7);
                          setExpiresAt(d.toISOString().slice(0, 16));
                        }}
                        className="text-[10px] font-mono h-6 px-2"
                      >
                        +7 Days
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + 30);
                          setExpiresAt(d.toISOString().slice(0, 16));
                        }}
                        className="text-[10px] font-mono h-6 px-2"
                      >
                        +30 Days
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* TAB 3: Whitelabeling */}
              <TabsContent value="whitelabel" className="space-y-4 pt-4">
                <div className="rounded-xl border border-neutral-800 bg-[#141414] p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-sm">
                        Remove "Powered by Brand Muse" Badge
                      </span>
                      <p className="text-xs text-neutral-400">
                        100% white-label your public guidelines microsite for enterprise brand
                        compliance.
                      </p>
                    </div>
                    <Switch
                      checked={whitelabelRemoveBadge}
                      onCheckedChange={setWhitelabelRemoveBadge}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-mono uppercase text-neutral-400">
                      Custom Website Title
                    </Label>
                    <Input
                      value={whitelabelTitle}
                      onChange={(e) => setWhitelabelTitle(e.target.value)}
                      placeholder={`${kitName} — Official Brand Guidelines`}
                      className="mt-1 font-mono text-xs bg-neutral-900 border-neutral-800"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-mono uppercase text-neutral-400">
                      Custom Meta Description
                    </Label>
                    <Input
                      value={whitelabelMetaDescription}
                      onChange={(e) => setWhitelabelMetaDescription(e.target.value)}
                      placeholder="Official brand guidelines, logos, typography, and assets."
                      className="mt-1 font-mono text-xs bg-neutral-900 border-neutral-800"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-mono uppercase text-neutral-400">
                      Custom Favicon URL
                    </Label>
                    <Input
                      value={whitelabelFaviconUrl}
                      onChange={(e) => setWhitelabelFaviconUrl(e.target.value)}
                      placeholder="https://assets.yourcompany.com/favicon.ico"
                      className="mt-1 font-mono text-xs bg-neutral-900 border-neutral-800"
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#262626] bg-[#141414] flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-xs font-mono text-neutral-400 hover:text-white"
          >
            Cancel
          </Button>

          <Button
            onClick={handleSave}
            disabled={saving || loading}
            className="bg-[#F4EFE6] text-[#0A0A0A] hover:bg-white font-mono text-xs uppercase tracking-wider px-6"
          >
            {saving ? "Publishing to Edge..." : "Save & Update Edge"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
