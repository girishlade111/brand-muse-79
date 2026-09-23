import { describe, it, expect, vi } from "vitest";
import {
  encryptToken,
  decryptToken,
  CreateTokenPullRequestInputSchema,
  buildTokenPullRequestBody,
  executeValidateGitHubToken,
  executeFetchGitHubRepos,
  executeFetchGitHubBranches,
  executeCreateTokenPullRequest,
  executeGetKitGitSyncs,
  githubRestRequest,
  GitHubApiError,
} from "./github-sync.server";

describe("GitHub Sync Server Engine", () => {
  describe("Security: Token Encryption & Decryption", () => {
    it("encrypts and decrypts a personal access token cleanly", () => {
      const originalToken = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";
      const encrypted = encryptToken(originalToken);

      expect(encrypted).toMatch(/^enc:/);
      expect(encrypted).not.toContain(originalToken);

      const decrypted = decryptToken(encrypted);
      expect(decrypted).toBe(originalToken);
    });

    it("leaves plaintext tokens unmodified when decryptToken is called", () => {
      const plain = "ghp_plainTokenDirectInput";
      expect(decryptToken(plain)).toBe(plain);
    });

    it("throws an error when decrypting an invalid enc string", () => {
      expect(() => decryptToken("enc:invalid:hex:data")).toThrow();
    });
  });

  describe("Input Validation Schemas", () => {
    it("validates a proper CreateTokenPullRequest input", () => {
      const valid = CreateTokenPullRequestInputSchema.safeParse({
        kitId: "11111111-1111-1111-1111-111111111111",
        token: "ghp_testToken",
        repo: "acme-corp/web-app",
        baseBranch: "main",
        filePath: "src/theme",
      });
      expect(valid.success).toBe(true);
    });

    it("rejects an invalid repository format", () => {
      const invalid = CreateTokenPullRequestInputSchema.safeParse({
        kitId: "11111111-1111-1111-1111-111111111111",
        token: "ghp_testToken",
        repo: "not-a-valid-repo-format",
      });
      expect(invalid.success).toBe(false);
      if (!invalid.success) {
        expect(invalid.error.issues[0].message).toContain("owner/repo");
      }
    });

    it("rejects a non-uuid kitId", () => {
      const invalid = CreateTokenPullRequestInputSchema.safeParse({
        kitId: "invalid-id",
        token: "ghp_testToken",
        repo: "acme/web",
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe("Editorial PR Markdown Summary Builder", () => {
    it("synthesizes comprehensive PR body with colors, typography, and token files", () => {
      const md = buildTokenPullRequestBody({
        kitName: "Acme Cyber",
        sourceUrl: "https://acme.cyber",
        colors: [
          { hex: "#8B1A1A", role: "primary", name: "Imperial Red" },
          { hex: "#0A0A0A", role: "background", name: "Obsidian" },
        ],
        fonts: [
          { family: "Cormorant Garamond", role: "display", weights: ["600", "700"] },
          { family: "JetBrains Mono", role: "mono", weights: ["400"] },
        ],
        tokens: [
          { category: "radius", name: "sm", value: "0px" },
          { category: "spacing", name: "md", value: "1rem" },
        ],
        files: [
          { path: "src/theme/tokens.css", description: "CSS Variables" },
          { path: "src/theme/tailwind.config.js", description: "Tailwind Theme" },
          { path: "src/theme/tokens.json", description: "W3C DTCG Format" },
        ],
      });

      expect(md).toContain("## 🎨 Brand Muse Automated Design Tokens Sync");
      expect(md).toContain("Acme Cyber");
      expect(md).toContain("https://acme.cyber");
      expect(md).toContain("#8B1A1A");
      expect(md).toContain("Imperial Red");
      expect(md).toContain("Cormorant Garamond");
      expect(md).toContain("src/theme/tokens.css");
      expect(md).toContain("src/theme/tailwind.config.js");
      expect(md).toContain("src/theme/tokens.json");
    });
  });

  describe("Rate Limit & Error Handling", () => {
    it("gracefully parses rate-limit exceeded header and throws GitHubApiError", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 403,
        ok: false,
        headers: new Headers({
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": "1727088000",
        }),
        json: async () => ({ message: "API rate limit exceeded" }),
      });

      await expect(
        githubRestRequest("/user", { token: "dummy" }, mockFetch as any),
      ).rejects.toThrow(/rate limit exceeded/i);
    });

    it("handles 401 unauthorized errors", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 401,
        ok: false,
        headers: new Headers(),
        json: async () => ({ message: "Bad credentials" }),
      });

      await expect(
        githubRestRequest("/user", { token: "bad_token" }, mockFetch as any),
      ).rejects.toThrow(/GitHub Authentication Failed/i);
    });

    it("handles 409 conflict errors", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 409,
        ok: false,
        headers: new Headers(),
        json: async () => ({ message: "Reference already exists" }),
      });

      await expect(
        githubRestRequest("/git/refs", { token: "token", method: "POST" }, mockFetch as any),
      ).rejects.toThrow(/conflict/i);
    });
  });

  describe("User & Repo Inspection Handlers", () => {
    it("validates token and returns user profile + encrypted token", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        headers: new Headers({ "x-ratelimit-remaining": "4999" }),
        json: async () => ({
          login: "octocat",
          name: "The Octocat",
          avatar_url: "https://github.com/images/error/octocat_happy.gif",
        }),
      });

      const res = await executeValidateGitHubToken(
        { token: "ghp_mock_token_123" },
        mockFetch as any,
      );

      expect(res.ok).toBe(true);
      expect(res.user.login).toBe("octocat");
      expect(res.encryptedToken).toMatch(/^enc:/);
      expect(decryptToken(res.encryptedToken)).toBe("ghp_mock_token_123");
    });

    it("fetches repositories for the authenticated user", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        headers: new Headers({ "x-ratelimit-remaining": "4999" }),
        json: async () => [
          {
            full_name: "octocat/hello-world",
            name: "hello-world",
            owner: { login: "octocat" },
            default_branch: "main",
            private: false,
            permissions: { push: true },
          },
        ],
      });

      const repos = await executeFetchGitHubRepos({ token: "ghp_mock_token" }, mockFetch as any);

      expect(repos.length).toBe(1);
      expect(repos[0].fullName).toBe("octocat/hello-world");
      expect(repos[0].defaultBranch).toBe("main");
    });

    it("fetches branches for a target repository", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        headers: new Headers(),
        json: async () => [{ name: "main" }, { name: "develop" }, { name: "feature/tokens" }],
      });

      const branches = await executeFetchGitHubBranches(
        { token: "ghp_mock_token", owner: "octocat", repo: "hello-world" },
        mockFetch as any,
      );

      expect(branches).toEqual(["main", "develop", "feature/tokens"]);
    });
  });

  describe("executeCreateTokenPullRequest PR Dispatch Workflow", () => {
    it("performs full Git Data API sequence to create commit & pull request", async () => {
      const mockDbCalls: any[] = [];
      const mockDb = {
        insert: (table: any) => ({
          values: (val: any) => {
            mockDbCalls.push({ table, val });
            return Promise.resolve();
          },
        }),
      };

      const mockFetch = vi.fn().mockImplementation((url: string, opts: any) => {
        const urlStr = String(url);

        // 1. Get base branch commit SHA
        if (urlStr.includes("/git/ref/heads/main")) {
          return Promise.resolve({
            status: 200,
            ok: true,
            headers: new Headers(),
            json: async () => ({ object: { sha: "base-commit-sha-123" } }),
          });
        }

        // 2. Get base tree SHA from base commit
        if (urlStr.includes("/git/commits/base-commit-sha-123")) {
          return Promise.resolve({
            status: 200,
            ok: true,
            headers: new Headers(),
            json: async () => ({ tree: { sha: "base-tree-sha-456" } }),
          });
        }

        // 3. Create Tree
        if (urlStr.includes("/git/trees") && opts.method === "POST") {
          const body = JSON.parse(opts.body);
          expect(body.base_tree).toBe("base-tree-sha-456");
          expect(body.tree.length).toBe(3); // tokens.css, tailwind.config.js, tokens.json
          return Promise.resolve({
            status: 201,
            ok: true,
            headers: new Headers(),
            json: async () => ({ sha: "new-tree-sha-789" }),
          });
        }

        // 4. Create Commit
        if (urlStr.includes("/git/commits") && opts.method === "POST") {
          const body = JSON.parse(opts.body);
          expect(body.tree).toBe("new-tree-sha-789");
          expect(body.parents).toEqual(["base-commit-sha-123"]);
          return Promise.resolve({
            status: 201,
            ok: true,
            headers: new Headers(),
            json: async () => ({ sha: "new-commit-sha-999" }),
          });
        }

        // 5. Create Ref (branch)
        if (urlStr.includes("/git/refs") && opts.method === "POST") {
          const body = JSON.parse(opts.body);
          expect(body.ref).toMatch(/^refs\/heads\/brand-muse\/update-tokens-/);
          expect(body.sha).toBe("new-commit-sha-999");
          return Promise.resolve({
            status: 201,
            ok: true,
            headers: new Headers(),
            json: async () => ({ ref: body.ref }),
          });
        }

        // 6. Create Pull Request
        if (urlStr.includes("/pulls") && opts.method === "POST") {
          const body = JSON.parse(opts.body);
          expect(body.base).toBe("main");
          expect(body.head).toMatch(/^brand-muse\/update-tokens-/);
          expect(body.body).toContain("Acme Corp");
          return Promise.resolve({
            status: 201,
            ok: true,
            headers: new Headers(),
            json: async () => ({
              html_url: "https://github.com/acme/app/pull/42",
              number: 42,
            }),
          });
        }

        return Promise.reject(new Error(`Unexpected mock URL: ${urlStr}`));
      });

      const kit = {
        id: "11111111-1111-1111-1111-111111111111",
        name: "Acme Corp",
        sourceUrl: "https://acme.com",
      };
      const colors = [
        { hex: "#FF0055", role: "primary", name: "Neon Pink" },
        { hex: "#000000", role: "background", name: "Black" },
      ];
      const fonts = [{ family: "Inter", role: "sans", weights: ["400", "700"] }];
      const tokens = [{ category: "radius", name: "sm", value: "4px" }];

      const result = await executeCreateTokenPullRequest(
        {
          kitId: "11111111-1111-1111-1111-111111111111",
          token: "ghp_valid_token",
          repo: "acme/app",
          baseBranch: "main",
          filePath: "src/theme",
        },
        {
          customFetch: mockFetch as any,
          kit,
          colors,
          fonts,
          tokens,
          db: mockDb,
        },
      );

      expect(result.ok).toBe(true);
      expect(result.prUrl).toBe("https://github.com/acme/app/pull/42");
      expect(result.prNumber).toBe(42);
      expect(result.branchName).toMatch(/^brand-muse\/update-tokens-/);
      expect(result.commitSha).toBe("new-commit-sha-999");
      expect(result.files).toContain("src/theme/tokens.css");
      expect(result.files).toContain("src/theme/tailwind.config.js");
      expect(result.files).toContain("src/theme/tokens.json");

      // Verify DB record logged
      expect(mockDbCalls.length).toBe(1);
      expect(mockDbCalls[0].val.repoName).toBe("acme/app");
      expect(mockDbCalls[0].val.prUrl).toBe("https://github.com/acme/app/pull/42");
      expect(mockDbCalls[0].val.status).toBe("success");
    });
  });

  describe("executeGetKitGitSyncs History Query", () => {
    it("fetches previous sync logs for a kit", async () => {
      const mockRows = [
        {
          id: "sync-1",
          kitId: "11111111-1111-1111-1111-111111111111",
          repoName: "acme/app",
          prUrl: "https://github.com/acme/app/pull/42",
          status: "success",
          createdAt: new Date(),
        },
      ];

      const mockDb = {
        select: () => ({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => Promise.resolve(mockRows),
              }),
            }),
          }),
        }),
      };

      const syncs = await executeGetKitGitSyncs(
        { kitId: "11111111-1111-1111-1111-111111111111" },
        { db: mockDb },
      );

      expect(syncs.length).toBe(1);
      expect(syncs[0].prUrl).toBe("https://github.com/acme/app/pull/42");
    });
  });
});
