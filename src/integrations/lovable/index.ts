// Auth is stubbed in this personal-app build (see src/lib/auth.tsx).
// This module preserves the `lovable.auth.signInWithOAuth` call shape so any
// legacy call sites keep compiling, but it performs no Supabase session work.

import { createLovableAuth } from "@lovable.dev/cloud-auth-js";

const lovableAuth = createLovableAuth();

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (
      provider: "google" | "apple" | "microsoft" | "lovable",
      opts?: SignInOptions,
    ) => {
      const result = await lovableAuth.signInWithOAuth(provider, {
        redirect_uri: opts?.redirect_uri,
        extraParams: {
          ...opts?.extraParams,
        },
      });

      if (result.redirected) {
        return result;
      }

      if (result.error) {
        return result;
      }

      // No Supabase session to attach since auth was removed (Neon migration).
      return result;
    },
  },
};
