// Shared GitHub Sync Validation Schemas & Types.
// Safe for both client forms and server RPC handlers.

import { z } from "zod";

export const ValidateGitHubTokenInputSchema = z.object({
  token: z.string().min(1, "GitHub Personal Access Token is required"),
});

export const FetchGitHubReposInputSchema = z.object({
  token: z.string().min(1),
});

export const FetchGitHubBranchesInputSchema = z.object({
  token: z.string().min(1),
  owner: z.string().min(1),
  repo: z.string().min(1),
});

export const CreateTokenPullRequestInputSchema = z.object({
  kitId: z.string().uuid("Invalid Brand Kit ID"),
  token: z.string().min(1, "GitHub Token is required"),
  repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, "Repository must be in 'owner/repo' format"),
  baseBranch: z.string().min(1).default("main"),
  filePath: z.string().optional().default("src/theme"),
  customPrTitle: z.string().optional(),
});

export const GetKitGitSyncsInputSchema = z.object({
  kitId: z.string().uuid(),
});

export type ValidateGitHubTokenInput = z.infer<typeof ValidateGitHubTokenInputSchema>;
export type FetchGitHubReposInput = z.infer<typeof FetchGitHubReposInputSchema>;
export type FetchGitHubBranchesInput = z.infer<typeof FetchGitHubBranchesInputSchema>;
export type CreateTokenPullRequestInput = z.infer<typeof CreateTokenPullRequestInputSchema>;
export type GetKitGitSyncsInput = z.infer<typeof GetKitGitSyncsInputSchema>;

export type ExecuteCreateTokenPullRequestResult = {
  ok: boolean;
  prUrl: string;
  prNumber: number;
  branchName: string;
  commitSha: string;
  files: string[];
  message: string;
};
