import { createServerFn } from "@tanstack/react-start";
import {
  ValidateGitHubTokenInputSchema,
  FetchGitHubReposInputSchema,
  FetchGitHubBranchesInputSchema,
  CreateTokenPullRequestInputSchema,
  GetKitGitSyncsInputSchema,
  type ExecuteCreateTokenPullRequestResult,
} from "@/lib/github-sync";
import type { KitGitSync } from "@/db/schema";

export const validateGitHubTokenFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => ValidateGitHubTokenInputSchema.parse(d))
  .handler(async ({ data }) => {
    const { executeValidateGitHubToken } = await import("@/server/github-sync.server");
    return executeValidateGitHubToken(data);
  });

export const fetchGitHubReposFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => FetchGitHubReposInputSchema.parse(d))
  .handler(async ({ data }) => {
    const { executeFetchGitHubRepos } = await import("@/server/github-sync.server");
    return executeFetchGitHubRepos(data);
  });

export const fetchGitHubBranchesFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => FetchGitHubBranchesInputSchema.parse(d))
  .handler(async ({ data }) => {
    const { executeFetchGitHubBranches } = await import("@/server/github-sync.server");
    return executeFetchGitHubBranches(data);
  });

export const createTokenPullRequestFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => CreateTokenPullRequestInputSchema.parse(d))
  .handler(async ({ data }): Promise<ExecuteCreateTokenPullRequestResult> => {
    const { executeCreateTokenPullRequest } = await import("@/server/github-sync.server");
    return executeCreateTokenPullRequest(data);
  });

export const getKitGitSyncsFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => GetKitGitSyncsInputSchema.parse(d))
  .handler(async ({ data }): Promise<KitGitSync[]> => {
    const { executeGetKitGitSyncs } = await import("@/server/github-sync.server");
    return executeGetKitGitSyncs(data);
  });
