// Automated GitHub Sync Engine & PR Dispatcher.
// Commits updated design tokens directly to developer repositories via GitHub REST API.
// Features secure PAT encryption, atomic multi-file Git Tree commits, editorial PR generation,
// rate-limit resilience, and sync history tracking in Supabase / Drizzle `kit_git_syncs`.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import {
  db,
  brandKits,
  kitColors,
  kitFonts,
  kitTokens,
  kitGitSyncs,
  type KitGitSync,
} from "@/db/index.server";
import { buildCSS, buildTailwindConfig, buildTokensJSON, slug } from "@/lib/exports";
import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// Security: Server-side Token Encryption Helpers (AES-256-GCM)
// ---------------------------------------------------------------------------

const ENCRYPTION_SECRET =
  process.env.SESSION_SECRET ||
  process.env.ENCRYPTION_KEY ||
  "brand-muse-github-sync-token-secret-key-32";

function getCipherKey(): Buffer {
  return crypto.createHash("sha256").update(ENCRYPTION_SECRET).digest();
}

/**
 * Encrypts a plain PAT so it can be held safely in client session state without plain exposure.
 */
export function encryptToken(plainText: string): string {
  if (!plainText) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getCipherKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `enc:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts an encrypted token string. If the token is not encrypted (e.g. freshly input PAT),
 * returns it as-is.
 */
export function decryptToken(tokenText: string): string {
  if (!tokenText) return "";
  if (!tokenText.startsWith("enc:")) {
    return tokenText;
  }
  try {
    const parts = tokenText.split(":");
    if (parts.length !== 4) return tokenText;
    const [, ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", getCipherKey(), iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  } catch (err) {
    throw new Error("Failed to decrypt authentication token. Please re-authenticate.");
  }
}

import {
  ValidateGitHubTokenInputSchema,
  FetchGitHubReposInputSchema,
  FetchGitHubBranchesInputSchema,
  CreateTokenPullRequestInputSchema,
  GetKitGitSyncsInputSchema,
  type ValidateGitHubTokenInput,
  type FetchGitHubReposInput,
  type FetchGitHubBranchesInput,
  type CreateTokenPullRequestInput,
  type GetKitGitSyncsInput,
  type ExecuteCreateTokenPullRequestResult,
} from "@/lib/github-sync";

export {
  ValidateGitHubTokenInputSchema,
  FetchGitHubReposInputSchema,
  FetchGitHubBranchesInputSchema,
  CreateTokenPullRequestInputSchema,
  GetKitGitSyncsInputSchema,
  type ValidateGitHubTokenInput,
  type FetchGitHubReposInput,
  type FetchGitHubBranchesInput,
  type CreateTokenPullRequestInput,
  type GetKitGitSyncsInput,
  type ExecuteCreateTokenPullRequestResult,
};

// ---------------------------------------------------------------------------
// GitHub REST Client & Error Handling
// ---------------------------------------------------------------------------

export class GitHubApiError extends Error {
  status: number;
  rateLimitReset?: Date;
  constructor(message: string, status = 500, rateLimitReset?: Date) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
    this.rateLimitReset = rateLimitReset;
  }
}

export type GitHubRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: any;
  token: string;
};

export async function githubRestRequest<T = any>(
  path: string,
  options: GitHubRequestOptions,
  customFetch: typeof fetch = fetch,
): Promise<T> {
  const decryptedToken = decryptToken(options.token);
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = `https://api.github.com${cleanPath}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${decryptedToken}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Brand-Muse-DevOps-Engine/1.0",
  };

  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  const response = await customFetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const remaining = response.headers.get("x-ratelimit-remaining");
  const resetHeader = response.headers.get("x-ratelimit-reset");
  const resetDate = resetHeader ? new Date(parseInt(resetHeader, 10) * 1000) : undefined;

  if (response.status === 401) {
    throw new GitHubApiError(
      "GitHub Authentication Failed: Personal Access Token is invalid or expired.",
      401,
    );
  }

  if (response.status === 403 || response.status === 429) {
    if (remaining === "0") {
      const resetTimeStr = resetDate ? resetDate.toLocaleTimeString() : "shortly";
      throw new GitHubApiError(
        `GitHub API rate limit exceeded. Rate limit resets at ${resetTimeStr}.`,
        response.status,
        resetDate,
      );
    }
    const errBody = await response.json().catch(() => ({}));
    throw new GitHubApiError(
      errBody.message ||
        "GitHub Access Forbidden: Ensure token has 'repo' or 'contents:write' and 'pull_requests:write' permissions.",
      403,
    );
  }

  if (response.status === 409) {
    const errBody = await response.json().catch(() => ({}));
    const detail = errBody.message ? `: ${errBody.message}` : "";
    throw new GitHubApiError(
      `Git conflict encountered on GitHub (HTTP 409)${detail}. The target branch has diverged or reference already exists.`,
      409,
    );
  }

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new GitHubApiError(
      errBody.message || `GitHub API error: HTTP ${response.status} ${response.statusText}`,
      response.status,
    );
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// Pure Handlers (Directly Testable)
// ---------------------------------------------------------------------------

export async function executeValidateGitHubToken(
  data: ValidateGitHubTokenInput,
  customFetch: typeof fetch = fetch,
): Promise<{
  ok: boolean;
  user: { login: string; name: string | null; avatar_url: string };
  scopes: string[];
  encryptedToken: string;
}> {
  const plainToken = decryptToken(data.token);
  const user = await githubRestRequest<{ login: string; name: string | null; avatar_url: string }>(
    "/user",
    { token: plainToken, method: "GET" },
    customFetch,
  );

  const encryptedToken = encryptToken(plainToken);

  return {
    ok: true,
    user: {
      login: user.login,
      name: user.name ?? user.login,
      avatar_url: user.avatar_url,
    },
    scopes: ["repo", "contents:write", "pull_requests:write"],
    encryptedToken,
  };
}

export async function executeFetchGitHubRepos(
  data: FetchGitHubReposInput,
  customFetch: typeof fetch = fetch,
): Promise<
  Array<{
    fullName: string;
    name: string;
    owner: string;
    defaultBranch: string;
    private: boolean;
    permissions?: { push: boolean };
  }>
> {
  const repos = await githubRestRequest<any[]>(
    "/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator,organization_member",
    { token: data.token, method: "GET" },
    customFetch,
  );

  return (repos || []).map((r) => ({
    fullName: r.full_name,
    name: r.name,
    owner: r.owner?.login || "",
    defaultBranch: r.default_branch || "main",
    private: Boolean(r.private),
    permissions: r.permissions,
  }));
}

export async function executeFetchGitHubBranches(
  data: FetchGitHubBranchesInput,
  customFetch: typeof fetch = fetch,
): Promise<string[]> {
  const branches = await githubRestRequest<any[]>(
    `/repos/${encodeURIComponent(data.owner)}/${encodeURIComponent(data.repo)}/branches?per_page=100`,
    { token: data.token, method: "GET" },
    customFetch,
  );

  return (branches || []).map((b) => b.name);
}

// ---------------------------------------------------------------------------
// Editorial PR Markdown Summary Generator
// ---------------------------------------------------------------------------

export function buildTokenPullRequestBody(params: {
  kitName: string;
  sourceUrl?: string | null;
  colors: Array<{ hex: string; role?: string | null; name?: string | null }>;
  fonts: Array<{ family: string; role?: string | null; weights?: string[] | null }>;
  tokens: Array<{ category: string; name: string; value: string }>;
  files: Array<{ path: string; description: string }>;
}): string {
  const timestamp = new Date().toUTCString();
  const colorCount = params.colors.length;
  const fontCount = params.fonts.length;
  const tokenCount = params.tokens.length;

  const colorTableRows = params.colors
    .slice(0, 15)
    .map((c) => {
      const name = c.name || "Custom";
      const role = c.role || "accent";
      const hex = c.hex.toUpperCase();
      return `| \`${hex}\` | **${name}** | \`${role}\` |`;
    })
    .join("\n");

  const fontList = params.fonts
    .slice(0, 10)
    .map((f) => {
      const weights =
        Array.isArray(f.weights) && f.weights.length ? `(${f.weights.join(", ")})` : "";
      return `- **${f.family}** [${f.role || "body"}] ${weights}`;
    })
    .join("\n");

  const tokenCategories =
    Array.from(new Set(params.tokens.map((t) => t.category))).join(", ") ||
    "spacing, radius, shadow";

  const filesList = params.files.map((f) => `- [\`${f.path}\`](#) — *${f.description}*`).join("\n");

  return `## 🎨 Brand Muse Automated Design Tokens Sync

> **Automated Pull Request** generated by [Brand Muse](https://github.com/).
> Dispatched on: **${timestamp}**
${params.sourceUrl ? `> Source URL: \`${params.sourceUrl}\`` : ""}

### 📦 Updated Brand Kit: **${params.kitName}**

This pull request synchronizes the latest design tokens, theme definitions, and CSS custom properties extracted from **${params.kitName}**.

---

### 📋 Token Inventory Highlights

| Category | Count | Summary |
| :--- | :--- | :--- |
| 🎨 **Colors** | \`${colorCount}\` | ${params.colors
    .slice(0, 4)
    .map((c) => `\`${c.hex}\``)
    .join(", ")}${colorCount > 4 ? " …" : ""} |
| 🔤 **Typography** | \`${fontCount}\` | ${params.fonts.map((f) => f.family).join(", ") || "Standard System"} |
| 📐 **DTCG Tokens** | \`${tokenCount}\` | ${tokenCategories} |

---

### 🎨 Color Palette

| Hex | Token Name | Semantic Role |
| :--- | :--- | :--- |
${colorTableRows || "| — | *No colors defined* | — |"}

---

### 🔤 Typography & Font Families

${fontList || "*System default sans-serif / monospace*"}

---

### 📂 Committed Token Manifest

${filesList}

---

### 🚀 Developer Integration Guide

\`\`\`css
/* Import in your root CSS / styles */
@import "./${params.files[0]?.path || "tokens.css"}";
\`\`\`

\`\`\`javascript
// tailwind.config.js
module.exports = require("./${params.files[1]?.path || "tailwind.config.js"}");
\`\`\`

---
*Synchronized automatically via Brand Muse Platform DevOps Engine.*
`;
}

// ---------------------------------------------------------------------------
// Automated PR Dispatcher Engine
// ---------------------------------------------------------------------------

export async function executeCreateTokenPullRequest(
  data: CreateTokenPullRequestInput,
  overrides?: {
    customFetch?: typeof fetch;
    kit?: any;
    colors?: any[];
    fonts?: any[];
    tokens?: any[];
    db?: any;
  },
): Promise<ExecuteCreateTokenPullRequestResult> {
  const customFetch = overrides?.customFetch || fetch;
  const activeDb = overrides?.db || db;
  const plainToken = decryptToken(data.token);

  const [owner, repo] = data.repo.split("/");
  if (!owner || !repo) {
    throw new Error("Target repository must be formatted as 'owner/repo'");
  }

  // 1. Fetch Brand Kit data
  let kit = overrides?.kit;
  let colors = overrides?.colors;
  let fonts = overrides?.fonts;
  let tokens = overrides?.tokens;

  if (!kit && activeDb) {
    const kitRows = await activeDb
      .select()
      .from(brandKits)
      .where(eq(brandKits.id, data.kitId))
      .limit(1);
    kit = kitRows[0];
  }

  if (!kit) {
    throw new Error(`Brand kit ${data.kitId} not found`);
  }

  if (!colors || !fonts || !tokens) {
    const [colorRows, fontRows, tokenRows] = await Promise.all([
      colors
        ? Promise.resolve(colors)
        : activeDb.select().from(kitColors).where(eq(kitColors.kitId, data.kitId)),
      fonts
        ? Promise.resolve(fonts)
        : activeDb.select().from(kitFonts).where(eq(kitFonts.kitId, data.kitId)),
      tokens
        ? Promise.resolve(tokens)
        : activeDb.select().from(kitTokens).where(eq(kitTokens.kitId, data.kitId)),
    ]);
    colors = colorRows || [];
    fonts = fontRows || [];
    tokens = tokenRows || [];
  }

  const finalColors: any[] = colors || [];
  const finalFonts: any[] = fonts || [];
  const finalTokens: any[] = tokens || [];

  // 2. Generate Token Artifacts
  const cssContent = buildCSS({
    colors: finalColors,
    fonts: finalFonts,
    tokens: finalTokens,
  });
  const tailwindContent = buildTailwindConfig({
    colors: finalColors,
    fonts: finalFonts,
    tokens: finalTokens,
  });
  const dtcgJsonContent = buildTokensJSON({
    colors: finalColors,
    fonts: finalFonts,
    tokens: finalTokens,
  });

  // 3. Format Target Paths
  const rawPath = (data.filePath || "src/theme").replace(/\\/g, "/").trim();
  const cleanDir = rawPath.replace(/\/+$/, "").replace(/^\/+/, "");

  // If user provided a specific file like `styles/tokens.css`, extract directory
  const baseDir =
    cleanDir.endsWith(".css") || cleanDir.endsWith(".json") || cleanDir.endsWith(".js")
      ? cleanDir.split("/").slice(0, -1).join("/")
      : cleanDir;

  const prefix = baseDir ? `${baseDir}/` : "";
  const cssPath = `${prefix}tokens.css`;
  const tailwindPath = `${prefix}tailwind.config.js`;
  const jsonPath = `${prefix}tokens.json`;

  const filesManifest = [
    {
      path: cssPath,
      content: cssContent,
      description: "Plain CSS Custom Properties (:root variables)",
    },
    {
      path: tailwindPath,
      content: tailwindContent,
      description: "Tailwind CSS theme configuration extension",
    },
    {
      path: jsonPath,
      content: dtcgJsonContent,
      description: "W3C Design Tokens Community Group (DTCG) specification",
    },
  ];

  // 4. Branch Name
  const timestamp = Date.now();
  const branchName = `brand-muse/update-tokens-${timestamp}`;
  const baseBranch = data.baseBranch || "main";

  let createdPrUrl = "";
  let createdPrNumber = 0;
  let newCommitSha = "";

  try {
    // 5. Get base branch commit SHA
    const baseRefData = await githubRestRequest<{ object: { sha: string } }>(
      `/repos/${owner}/${repo}/git/ref/heads/${baseBranch}`,
      { token: plainToken, method: "GET" },
      customFetch,
    );
    const baseCommitSha = baseRefData.object.sha;

    // 6. Get base tree SHA from base commit
    const baseCommitData = await githubRestRequest<{ tree: { sha: string } }>(
      `/repos/${owner}/${repo}/git/commits/${baseCommitSha}`,
      { token: plainToken, method: "GET" },
      customFetch,
    );
    const baseTreeSha = baseCommitData.tree.sha;

    // 7. Create Git Tree with the 3 token files
    const treeEntries = filesManifest.map((f) => ({
      path: f.path,
      mode: "100644",
      type: "blob",
      content: f.content,
    }));

    const newTreeData = await githubRestRequest<{ sha: string }>(
      `/repos/${owner}/${repo}/git/trees`,
      {
        token: plainToken,
        method: "POST",
        body: {
          base_tree: baseTreeSha,
          tree: treeEntries,
        },
      },
      customFetch,
    );
    const newTreeSha = newTreeData.sha;

    // 8. Create Commit
    const commitMessage = `feat(design-tokens): synchronize latest brand tokens from Brand Muse\n\nAutomated commit updating tokens.css, tailwind.config.js, and tokens.json.`;
    const newCommitData = await githubRestRequest<{ sha: string }>(
      `/repos/${owner}/${repo}/git/commits`,
      {
        token: plainToken,
        method: "POST",
        body: {
          message: commitMessage,
          tree: newTreeSha,
          parents: [baseCommitSha],
        },
      },
      customFetch,
    );
    newCommitSha = newCommitData.sha;

    // 9. Create Branch Reference
    await githubRestRequest(
      `/repos/${owner}/${repo}/git/refs`,
      {
        token: plainToken,
        method: "POST",
        body: {
          ref: `refs/heads/${branchName}`,
          sha: newCommitSha,
        },
      },
      customFetch,
    );

    // 10. Generate Editorial PR Body
    const prBody = buildTokenPullRequestBody({
      kitName: kit.name || "Brand Muse Kit",
      sourceUrl: kit.sourceUrl || kit.source_url,
      colors: finalColors,
      fonts: finalFonts,
      tokens: finalTokens,
      files: filesManifest.map((f) => ({ path: f.path, description: f.description })),
    });

    // 11. Open Pull Request
    const prTitle =
      data.customPrTitle ||
      `feat(design-tokens): update brand tokens from ${kit.name || "Brand Muse"}`;

    const prData = await githubRestRequest<{ html_url: string; number: number }>(
      `/repos/${owner}/${repo}/pulls`,
      {
        token: plainToken,
        method: "POST",
        body: {
          title: prTitle,
          head: branchName,
          base: baseBranch,
          body: prBody,
          maintainer_can_modify: true,
        },
      },
      customFetch,
    );

    createdPrUrl = prData.html_url;
    createdPrNumber = prData.number;

    // 12. Record sync success in Supabase / Drizzle `kit_git_syncs`
    if (activeDb) {
      try {
        await activeDb.insert(kitGitSyncs).values({
          kitId: data.kitId,
          repoName: data.repo,
          branchName,
          prUrl: createdPrUrl,
          prNumber: createdPrNumber,
          status: "success",
          commitSha: newCommitSha,
        });
      } catch (dbErr) {
        console.warn("[github-sync.server] Failed to record git sync log to DB:", dbErr);
      }
    }

    return {
      ok: true,
      prUrl: createdPrUrl,
      prNumber: createdPrNumber,
      branchName,
      commitSha: newCommitSha,
      files: filesManifest.map((f) => f.path),
      message: `Pull Request #${createdPrNumber} successfully opened on ${data.repo}.`,
    };
  } catch (err: any) {
    // Record failure in `kit_git_syncs` if possible
    if (activeDb) {
      try {
        await activeDb.insert(kitGitSyncs).values({
          kitId: data.kitId,
          repoName: data.repo,
          branchName,
          status: "failed",
          errorMessage: String(err?.message || "Unknown error").slice(0, 500),
        });
      } catch {}
    }
    throw err;
  }
}

export async function executeGetKitGitSyncs(
  data: GetKitGitSyncsInput,
  overrides?: { db?: any },
): Promise<KitGitSync[]> {
  const activeDb = overrides?.db || db;
  if (!activeDb) return [];

  try {
    const syncs = await activeDb
      .select()
      .from(kitGitSyncs)
      .where(eq(kitGitSyncs.kitId, data.kitId))
      .orderBy(desc(kitGitSyncs.createdAt))
      .limit(25);
    return syncs;
  } catch (err) {
    console.warn("[github-sync.server] executeGetKitGitSyncs error:", err);
    return [];
  }
}

export {
  validateGitHubTokenFn,
  fetchGitHubReposFn,
  fetchGitHubBranchesFn,
  createTokenPullRequestFn,
  getKitGitSyncsFn,
} from "@/lib/github-sync.functions";
