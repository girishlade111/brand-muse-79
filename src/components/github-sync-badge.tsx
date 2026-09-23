// Interactive Workbench Top Bar "Sync to GitHub" Status Badge.
// Displays current GitHub sync status (e.g. PR #42 synced or ready to sync)
// and opens the GitHub connection & PR dispatch modal.

import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getKitGitSyncsFn } from "@/lib/github-sync.functions";
import { GitHubSyncModal } from "./github-sync-modal";
import { GitPullRequest, CheckCircle2, GitBranch } from "lucide-react";

export type GitHubSyncBadgeProps = {
  kitId: string;
  kitName: string;
  className?: string;
};

export function GitHubSyncBadge({ kitId, kitName, className }: GitHubSyncBadgeProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [latestSync, setLatestSync] = useState<{
    prUrl: string | null;
    prNumber: number | null;
    repoName: string;
    createdAt: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const getSyncs = useServerFn(getKitGitSyncsFn);

  useEffect(() => {
    let cancelled = false;
    async function checkLatestSync() {
      setLoading(true);
      try {
        const logs = await getSyncs({ data: { kitId } });
        if (!cancelled && logs && logs.length > 0) {
          const successLog = logs.find((l) => l.status === "success") || logs[0];
          setLatestSync({
            prUrl: successLog.prUrl,
            prNumber: successLog.prNumber,
            repoName: successLog.repoName,
            createdAt: String(successLog.createdAt),
          });
        }
      } catch {
        // Non-blocking
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    checkLatestSync();
    return () => {
      cancelled = true;
    };
  }, [kitId, getSyncs]);

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className={`group inline-flex items-center gap-2 border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-all hover:-translate-y-0.5 ${
          latestSync?.prUrl
            ? "border-green-600/40 bg-green-500/10 text-foreground hover:border-green-600"
            : "border-[#0A0A0A] bg-background text-foreground hover:bg-[#0A0A0A] hover:text-background"
        } ${className || ""}`}
        style={{ borderRadius: 0 }}
        title={
          latestSync?.prUrl
            ? `Latest PR #${latestSync.prNumber} opened on ${latestSync.repoName}`
            : "Sync brand tokens directly to GitHub via Pull Request"
        }
      >
        {latestSync?.prUrl ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            <GitPullRequest className="h-3.5 w-3.5 text-green-500" />
            <span>
              [ ⑂ {latestSync.prNumber ? `PR #${latestSync.prNumber}` : "GITHUB"} SYNCED ]
            </span>
          </>
        ) : (
          <>
            <GitBranch className="h-3.5 w-3.5 text-muted-foreground group-hover:text-background" />
            <span>[ ⑂ SYNC TO GITHUB ]</span>
          </>
        )}
      </button>

      <GitHubSyncModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        kitId={kitId}
        kitName={kitName}
        onSyncSuccess={(prUrl, prNumber) => {
          setLatestSync({
            prUrl,
            prNumber,
            repoName: "GitHub Repository",
            createdAt: new Date().toISOString(),
          });
        }}
      />
    </>
  );
}
