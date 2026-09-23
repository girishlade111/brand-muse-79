// Shared API Key Validation Schemas & Types.
// Safe for both client forms and server authenticators.

import { z } from "zod";

export const GenerateApiKeyInputSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  name: z.string().min(1, "Key name is required").max(80),
  rateLimitPerMin: z.number().int().min(10).max(600).default(60),
});

export const ListApiKeysInputSchema = z.object({
  userId: z.string().min(1),
});

export const RevokeApiKeyInputSchema = z.object({
  keyId: z.string().uuid(),
  userId: z.string().min(1),
});

export type GenerateApiKeyInput = z.infer<typeof GenerateApiKeyInputSchema>;
export type ListApiKeysInput = z.infer<typeof ListApiKeysInputSchema>;
export type RevokeApiKeyInput = z.infer<typeof RevokeApiKeyInputSchema>;

export type GenerateApiKeyResult = {
  ok: boolean;
  rawKey: string;
  apiKey: {
    id: string;
    userId: string;
    prefix: string;
    name: string;
    rateLimitPerMin: number;
    createdAt: string;
  };
};
