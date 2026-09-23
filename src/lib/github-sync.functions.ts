import { createServerFn } from "@tanstack/react-start";
import {
  ValidateGitHubTokenInputSchema,
  FetchGitHubReposInputSchema,
  FetchGitHubBranchesInputSchema,
  CreateTokenPullRequestInputSchema,
  GetKitGitSyncsInputSchema,
  executeValidateGitHubToken,
  executeFetchGitHubRepos,
  executeFetchGitHubBranches,
  executeCreateTokenPullRequest,
  executeGetKitGitSyncs,
  type ExecuteCreateTokenPullRequestResult,
} from "@/server/github-sync.server";
import type { KitGitSync } from "@/db/schema";

export const validateGitHubTokenFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => ValidateGitHubTokenInputSchema.parse(d))
  .handler(async ({ data }) => {
    return executeValidateGitHubToken(data);
  });

export const fetchGitHubReposFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => FetchGitHubReposInputSchema.parse(d))
  .handler(async ({ data }) => {
    return executeFetchGitHubRepos(data);
  });

export const fetchGitHubBranchesFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => FetchGitHubBranchesInputSchema.parse(d))
  .handler(async ({ data }) => {
    return executeFetchGitHubBranches(data);
  });

export const createTokenPullRequestFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => CreateTokenPullRequestInputSchema.parse(d))
  .handler(async ({ data }): Promise<ExecuteCreateTokenPullRequestResult> => {
    return executeCreateTokenPullRequest(data);
  });

export const getKitGitSyncsFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => GetKitGitSyncsInputSchema.parse(d))
  .handler(async ({ data }): Promise<KitGitSync[]> => {
    return executeGetKitGitSyncs(data);
  });
