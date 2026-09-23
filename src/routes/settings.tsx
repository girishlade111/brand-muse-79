// Settings Page: Developer Settings, API Keys & Webhooks.

import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { DeveloperSettings } from "@/components/developer-settings";
import { useAuth } from "@/lib/auth";
import { getAnonToken } from "@/lib/anon";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const userId = user?.id ?? (typeof window !== "undefined" ? getAnonToken() : "dev-user");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <DeveloperSettings userId={userId} />
      </main>
    </div>
  );
}
