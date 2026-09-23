// Cloudflare Custom Hostnames (SSL for SaaS) Integration
// Enables white-labeled custom domains (e.g. brand.clientcompany.com)
// pointing directly to a published Brand Guidelines portal.

export interface CloudflareCustomHostnameResult {
  id: string;
  hostname: string;
  status: "active" | "pending" | "error" | "moved" | "blocked";
  sslStatus: "active" | "pending" | "initializing" | "pending_validation" | "error";
  cnameTarget: string;
  ownershipVerification?: {
    type: string;
    name: string;
    value: string;
  };
  sslValidationRecords?: Array<{
    status: string;
    txtName?: string;
    txtValue?: string;
    httpUrl?: string;
    httpBody?: string;
  }>;
  verificationErrors?: string[];
  simulationMode?: boolean;
}

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

export function getCloudflareConfig() {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
  const cnameTarget = process.env.CLOUDFLARE_CNAME_TARGET?.trim() || "cname.branddna.app";
  const isConfigured = Boolean(zoneId && apiToken);

  return {
    zoneId,
    apiToken,
    cnameTarget,
    isConfigured,
  };
}

/**
 * Normalize and validate a domain string.
 * Rejects IP addresses, protocols, paths, or illegal characters.
 */
export function normalizeCustomDomain(rawDomain: string): string {
  let domain = rawDomain.trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//, "");
  domain = domain.replace(/\/.*$/, "");
  domain = domain.replace(/:\d+$/, "");

  // Prevent reserving system domains
  const reserved = ["localhost", "branddna.app", "lovable.app", "brandmuse.app"];
  if (reserved.some((r) => domain === r || domain.endsWith("." + r))) {
    throw new Error(`Domain "${domain}" cannot be used as a custom domain.`);
  }

  // Domain regex: must have at least one dot, valid labels
  const domainRegex = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})+$/;
  if (!domainRegex.test(domain)) {
    throw new Error(
      `Invalid custom domain format "${rawDomain}". Example format: brand.yourcompany.com`,
    );
  }

  return domain;

  return domain;
}

/**
 * Provision a Custom Hostname via Cloudflare Custom Hostnames API (SSL for SaaS).
 * If Cloudflare credentials are not configured, runs in high-fidelity simulation mode.
 */
export async function createCustomHostname(
  hostname: string,
): Promise<CloudflareCustomHostnameResult> {
  const normalized = normalizeCustomDomain(hostname);
  const config = getCloudflareConfig();

  if (!config.isConfigured) {
    // High-fidelity simulation mode for local dev / unconfigured environments
    const mockId = `mock_cf_${Buffer.from(normalized).toString("hex").slice(0, 16)}`;
    return {
      id: mockId,
      hostname: normalized,
      status: "pending",
      sslStatus: "pending_validation",
      cnameTarget: config.cnameTarget,
      ownershipVerification: {
        type: "cname",
        name: normalized,
        value: config.cnameTarget,
      },
      sslValidationRecords: [
        {
          status: "pending",
          txtName: `_cf-custom-hostname.${normalized}`,
          txtValue: `cf-verify-${mockId.slice(8)}`,
        },
      ],
      verificationErrors: [],
      simulationMode: true,
    };
  }

  const endpoint = `${CF_API_BASE}/zones/${config.zoneId}/custom_hostnames`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      hostname: normalized,
      ssl: {
        method: "http",
        type: "dv",
        settings: {
          min_tls_version: "1.2",
        },
      },
    }),
  });

  const body = (await response.json()) as any;

  if (!response.ok || !body.success) {
    const errorMsg = body?.errors?.[0]?.message || `Cloudflare API returned status ${response.status}`;
    // If hostname already exists in zone, attempt to fetch it
    if (body?.errors?.[0]?.code === 1406) {
      return getCustomHostnameByDomain(normalized);
    }
    throw new Error(`Failed to provision custom domain on Cloudflare: ${errorMsg}`);
  }

  const result = body.result;
  return formatCloudflareResult(result, config.cnameTarget);
}

/**
 * Fetch Custom Hostname status by ID from Cloudflare.
 */
export async function getCustomHostnameStatus(
  hostnameId: string,
  domainHint?: string,
): Promise<CloudflareCustomHostnameResult> {
  const config = getCloudflareConfig();

  if (!config.isConfigured || hostnameId.startsWith("mock_cf_")) {
    const domain = domainHint || "custom.brand.com";
    return {
      id: hostnameId,
      hostname: domain,
      status: "active",
      sslStatus: "active",
      cnameTarget: config.cnameTarget,
      ownershipVerification: {
        type: "cname",
        name: domain,
        value: config.cnameTarget,
      },
      sslValidationRecords: [],
      verificationErrors: [],
      simulationMode: true,
    };
  }

  const endpoint = `${CF_API_BASE}/zones/${config.zoneId}/custom_hostnames/${hostnameId}`;
  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
    },
  });

  const body = (await response.json()) as any;
  if (!response.ok || !body.success) {
    const errorMsg = body?.errors?.[0]?.message || `Cloudflare API returned status ${response.status}`;
    throw new Error(`Failed to check Cloudflare custom hostname status: ${errorMsg}`);
  }

  return formatCloudflareResult(body.result, config.cnameTarget);
}

/**
 * Fetch Custom Hostname status by domain name from Cloudflare.
 */
export async function getCustomHostnameByDomain(
  domain: string,
): Promise<CloudflareCustomHostnameResult> {
  const config = getCloudflareConfig();
  if (!config.isConfigured) {
    return {
      id: `mock_cf_${Buffer.from(domain).toString("hex").slice(0, 16)}`,
      hostname: domain,
      status: "active",
      sslStatus: "active",
      cnameTarget: config.cnameTarget,
      simulationMode: true,
    };
  }

  const endpoint = `${CF_API_BASE}/zones/${config.zoneId}/custom_hostnames?hostname=${encodeURIComponent(domain)}`;
  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
    },
  });

  const body = (await response.json()) as any;
  if (!response.ok || !body.success || !body.result?.length) {
    throw new Error(`Hostname ${domain} not found in Cloudflare zone.`);
  }

  return formatCloudflareResult(body.result[0], config.cnameTarget);
}

/**
 * Remove Custom Hostname from Cloudflare.
 */
export async function deleteCustomHostname(hostnameId: string): Promise<boolean> {
  const config = getCloudflareConfig();
  if (!config.isConfigured || hostnameId.startsWith("mock_cf_")) {
    return true;
  }

  const endpoint = `${CF_API_BASE}/zones/${config.zoneId}/custom_hostnames/${hostnameId}`;
  const response = await fetch(endpoint, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
    },
  });

  const body = (await response.json()) as any;
  return response.ok && Boolean(body.success);
}

function formatCloudflareResult(
  result: any,
  cnameTarget: string,
): CloudflareCustomHostnameResult {
  const rawStatus = (result.status || "pending").toLowerCase();
  const rawSslStatus = (result.ssl?.status || "pending").toLowerCase();

  let status: CloudflareCustomHostnameResult["status"] = "pending";
  if (rawStatus === "active") status = "active";
  else if (rawStatus === "pending") status = "pending";
  else if (rawStatus === "blocked") status = "blocked";
  else if (rawStatus === "moved") status = "moved";
  else status = "error";

  let sslStatus: CloudflareCustomHostnameResult["sslStatus"] = "pending";
  if (rawSslStatus === "active") sslStatus = "active";
  else if (rawSslStatus === "pending_validation") sslStatus = "pending_validation";
  else if (rawSslStatus === "initializing") sslStatus = "initializing";
  else status = "error";

  return {
    id: result.id,
    hostname: result.hostname,
    status,
    sslStatus,
    cnameTarget,
    ownershipVerification: result.ownership_verification
      ? {
          type: result.ownership_verification.type || "cname",
          name: result.ownership_verification.name || result.hostname,
          value: result.ownership_verification.value || cnameTarget,
        }
      : {
          type: "cname",
          name: result.hostname,
          value: cnameTarget,
        },
    sslValidationRecords: (result.ssl?.validation_records || []).map((r: any) => ({
      status: r.status,
      txtName: r.txt_name,
      txtValue: r.txt_value,
      httpUrl: r.http_url,
      httpBody: r.http_body,
    })),
    verificationErrors: result.verification_errors || [],
    simulationMode: false,
  };
}
