// GitHub Connection & Automated PR Dispatch Modal Component.
// Manages encrypted PAT connection, repository/branch/path selection, live PR preview,
// and sync history from `kit_git_syncs`.

import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  validateGitHubTokenFn,
  fetchGitHubReposFn,
  fetchGitHubBranchesFn,
  createTokenPullRequestFn,
  getKitGitSyncsFn,
} from "@/server/github-sync.server";
import {
  GitPullRequest,
  Check,
  AlertCircle,
  Loader2,
  ExternalLink,
  ShieldCheck,
  Eye,
  EyeOff,
  GitBranch,
  FolderGit2,
  History,
  FileCode,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

export type GitHubSyncModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kitId: string;
  kitName: string;
  onSyncSuccess?: (prUrl: string, prNumber: number) => void;
};

export function GitHubSyncModal({
  open,
  onOpenChange,
  kitId,
  kitName,
  onSyncSuccess,
}: GitHubSyncModalProps) {
  const validateToken = useServerFn(validateGitHubTokenFn);
  const fetchRepos = useServerFn(fetchGitHubReposFn);
  const fetchBranches = useServerFn(fetchBranchesFn);
  const createPr = useServerFn(createTokenPullRequestFn);
  const getSyncs = useServerFn(getKitGitSyncsFn);

  // Connection State
  const [pat, setPat] = useState("");
  const [showPat, setShowPat] = useState(false);
  const [encryptedToken, setEncryptedToken] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<{
    login: string;
    name: string | null;
    avatar_url: string;
  } | null>(null);
  const [validating, setValidating] = useState(false);

  // Target Repository & Branch State
  const [repos, setRepos] = useState<
    Array<{ fullName: string; defaultBranch: string; private: boolean }>
  >([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [targetRepo, setTargetRepo] = useState("");
  const [targetBranch, setTargetBranch] = useState("main");
  const [branches, setBranches] = useState<string[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [filePath, setFilePath] = useState("src/theme");

  // Dispatch & Sync History State
  const [activeTab, setActiveTab] = useState<"dispatch" | "history" | "preview">("dispatch");
  const [dispatching, setDispatching] = useState(false);
  const [recentPr, setRecentPr] = useState<{ url: string; number: number; branch: string } | null>(
    null,
  );
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load sync history when modal opens or tab changes
  useEffect(() => {
    if (open) {
      loadHistory();
    }
  }, [open, kitId]);

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const logs = await getSyncs({ data: { kitId } });
      setHistoryList(logs || []);
    } catch {
      // Non-blocking on network/db
    } finally {
      setLoadingHistory(false);
    }
  }

  // Handle PAT verification
  async function handleVerifyToken() {
    const rawToken = pat.trim();
    if (!rawToken) {
      toast.error("Please enter a GitHub Personal Access Token.");
      return;
    }

    setValidating(true);
    setErrorMessage(null);
    try {
      const res = await validateToken({ data: { token: rawToken } });
      setUserProfile(res.user);
      setEncryptedToken(res.encryptedToken);
      // Mask token input for security
      setPat("");
      toast.success(`Connected as @${res.user.login}`);

      // Auto-load repos
      loadUserRepos(res.encryptedToken);
    } catch (err: any) {
      const msg = err?.message || "Failed to authenticate token with GitHub.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setValidating(false);
    }
  }

  async function loadUserRepos(tokenToUse: string) {
    setLoadingRepos(true);
    try {
      const userRepos = await fetchRepos({ data: { token: tokenToUse } });
      setRepos(userRepos);
      if (userRepos.length > 0 && !targetRepo) {
        setTargetRepo(userRepos[0].fullName);
        setTargetBranch(userRepos[0].defaultBranch || "main");
        loadBranches(userRepos[0].fullName, tokenToUse);
      }
    } catch {
      // Non-blocking, user can type repo manually
    } finally {
      setLoadingRepos(false);
    }
  }

  async function loadBranches(repoFullName: string, tokenToUse: string) {
    const [owner, repo] = repoFullName.split("/");
    if (!owner || !repo) return;

    setLoadingBranches(true);
    try {
      const bList = await fetchBranches({
        data: { token: tokenToUse, owner, repo },
      });
      setBranches(bList);
      if (bList.includes("main")) setTargetBranch("main");
      else if (bList.includes("master")) setTargetBranch("master");
      else if (bList.length > 0) setTargetBranch(bList[0]);
    } catch {
      // Fallback: leave manual text input
    } finally {
      setLoadingBranches(false);
    }
  }

  function handleRepoChange(repoFullName: string) {
    setTargetRepo(repoFullName);
    const found = repos.find((r) => r.fullName === repoFullName);
    if (found?.defaultBranch) {
      setTargetBranch(found.defaultBranch);
    }
    const token = encryptedToken || pat.trim();
    if (token) {
      loadBranches(repoFullName, token);
    }
  }

  async function handleDispatchPR() {
    const activeToken = encryptedToken || pat.trim();
    if (!activeToken) {
      toast.error("Please connect your GitHub Personal Access Token first.");
      return;
    }
    if (!targetRepo || !targetRepo.includes("/")) {
      toast.error("Please specify a valid Target Repository ('owner/repo').");
      return;
    }
    if (!targetBranch.trim()) {
      toast.error("Please specify a Target Branch.");
      return;
    }

    setDispatching(true);
    setErrorMessage(null);
    setRecentPr(null);

    try {
      const result = await createPr({
        data: {
          kitId,
          token: activeToken,
          repo: targetRepo.trim(),
          baseBranch: targetBranch.trim(),
          filePath: filePath.trim() || "src/theme",
        },
      });

      setRecentPr({
        url: result.prUrl,
        number: result.prNumber,
        branch: result.branchName,
      });

      toast.success(`Pull Request #${result.prNumber} created!`);
      loadHistory();
      if (onSyncSuccess) {
        onSyncSuccess(result.prUrl, result.prNumber);
      }
    } catch (err: any) {
      const msg = err?.message || "Failed to create Pull Request on GitHub.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setDispatching(false);
    }
  }

  function fetchBranchesFn(arg0: { data: { token: string; owner: string; repo: string } }) {
    return fetchGitHubBranchesFn(arg0);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-2xl border-[#0A0A0A] bg-background text-foreground p-0"
        style={{ borderRadius: 0 }}
      >
        {/* Modal Header */}
        <div className="border-b border-[#0A0A0A] bg-background p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#8B1A1A]">
                // DEVOPS & REPO AUTOMATION
              </p>
              <DialogTitle className="mt-1 text-2xl [font-family:'Cormorant_Garamond',serif] sm:text-3xl">
                GitHub Token Sync
              </DialogTitle>
            </div>
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {kitName}
            </span>
          </div>

          <DialogDescription className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Automatically commit generated design tokens (<code>tokens.css</code>,{" "}
            <code>tailwind.config.js</code>, and <code>tokens.json</code>) directly to your
            repository via atomic pull requests.
          </DialogDescription>

          {/* Navigation Tabs */}
          <div className="mt-6 flex items-center gap-2 border-b border-[color:var(--border-subtle)] pb-2 font-mono text-[11px] uppercase tracking-[0.16em]">
            <button
              type="button"
              onClick={() => setActiveTab("dispatch")}
              className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${
                activeTab === "dispatch"
                  ? "border border-[#0A0A0A] bg-foreground text-background font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              style={{ borderRadius: 0 }}
            >
              <GitPullRequest className="h-3.5 w-3.5" />
              [ Configure & Dispatch ]
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${
                activeTab === "history"
                  ? "border border-[#0A0A0A] bg-foreground text-background font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              style={{ borderRadius: 0 }}
            >
              <History className="h-3.5 w-3.5" />
              [ Sync Logs ({historyList.length}) ]
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("preview")}
              className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${
                activeTab === "preview"
                  ? "border border-[#0A0A0A] bg-foreground text-background font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              style={{ borderRadius: 0 }}
            >
              <FileCode className="h-3.5 w-3.5" />
              [ PR Spec Preview ]
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* Error Banner */}
          {errorMessage && (
            <div className="flex items-start gap-3 border border-red-500/40 bg-red-500/10 p-4 text-xs text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
              <div className="min-w-0 flex-1">
                <p className="font-mono uppercase tracking-[0.16em] text-red-500 font-bold">
                  // ERROR: SYNC FAILED
                </p>
                <p className="mt-1 leading-relaxed text-foreground">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Success Banner */}
          {recentPr && (
            <div className="border border-green-500/40 bg-green-500/10 p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="font-mono text-xs uppercase tracking-[0.18em] text-green-500 font-bold">
                    Pull Request Dispatched
                  </span>
                </div>
                <a
                  href={recentPr.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-foreground hover:underline"
                >
                  View on GitHub <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Branch: <code className="text-foreground">{recentPr.branch}</code>
              </p>
            </div>
          )}

          {/* TAB 1: DISPATCH CONFIGURATION */}
          {activeTab === "dispatch" && (
            <div className="space-y-6">
              {/* Step 1: GitHub Connection */}
              <div className="border border-[color:var(--border-subtle)] p-4 bg-muted/20">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    // STEP 1 · AUTHENTICATION
                  </span>
                  {userProfile && (
                    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-green-500">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Encrypted & Verified
                    </span>
                  )}
                </div>

                {userProfile ? (
                  <div className="mt-3 flex items-center justify-between gap-3 border border-[color:var(--border-subtle)] bg-background p-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={userProfile.avatar_url}
                        alt={userProfile.login}
                        className="h-8 w-8 rounded-full border border-[color:var(--border-subtle)]"
                      />
                      <div>
                        <p className="text-xs font-semibold text-foreground">
                          {userProfile.name || userProfile.login}
                        </p>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          @{userProfile.login}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setUserProfile(null);
                        setEncryptedToken(null);
                        setPat("");
                      }}
                      className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
                    >
                      [ Disconnect ]
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    <div className="relative">
                      <input
                        type={showPat ? "text" : "password"}
                        value={pat}
                        onChange={(e) => setPat(e.target.value)}
                        placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        className="w-full border border-[color:var(--border-subtle)] bg-background px-3 py-2 pr-20 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-[#0A0A0A] focus:outline-none"
                        style={{ borderRadius: 0 }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPat(!showPat)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                        title={showPat ? "Hide token" : "Show token"}
                      >
                        {showPat ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] text-muted-foreground">
                        Requires GitHub PAT with <code>repo</code> or <code>contents:write</code> &amp;{" "}
                        <code>pull_requests:write</code>.{" "}
                        <a
                          href="https://github.com/settings/tokens/new?description=Brand%20Muse%20Design%20Tokens&scopes=repo"
                          target="_blank"
                          rel="noreferrer"
                          className="underline hover:text-foreground"
                        >
                          Generate token ↗
                        </a>
                      </p>
                      <button
                        type="button"
                        onClick={handleVerifyToken}
                        disabled={validating || !pat.trim()}
                        className="flex items-center gap-1.5 border border-[#0A0A0A] bg-foreground px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-background hover:opacity-90 disabled:opacity-50"
                        style={{ borderRadius: 0 }}
                      >
                        {validating ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Verifying…
                          </>
                        ) : (
                          "[ Verify PAT ]"
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Repository & Branch Setup */}
              <div className="border border-[color:var(--border-subtle)] p-4 bg-muted/20 space-y-4">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  // STEP 2 · REPOSITORY & BRANCH TARGETS
                </span>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5 flex items-center gap-1">
                      <FolderGit2 className="h-3 w-3" /> Target Repository
                    </label>
                    {repos.length > 0 ? (
                      <select
                        value={targetRepo}
                        onChange={(e) => handleRepoChange(e.target.value)}
                        className="w-full border border-[color:var(--border-subtle)] bg-background px-3 py-2 font-mono text-xs text-foreground focus:border-[#0A0A0A] focus:outline-none"
                        style={{ borderRadius: 0 }}
                      >
                        {repos.map((r) => (
                          <option key={r.fullName} value={r.fullName}>
                            {r.fullName} {r.private ? "(Private)" : ""}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={targetRepo}
                        onChange={(e) => setTargetRepo(e.target.value)}
                        placeholder="owner/repository-name"
                        className="w-full border border-[color:var(--border-subtle)] bg-background px-3 py-2 font-mono text-xs text-foreground focus:border-[#0A0A0A] focus:outline-none"
                        style={{ borderRadius: 0 }}
                      />
                    )}
                    {loadingRepos && (
                      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                        Loading repositories…
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5 flex items-center gap-1">
                      <GitBranch className="h-3 w-3" /> Base Branch
                    </label>
                    {branches.length > 0 ? (
                      <select
                        value={targetBranch}
                        onChange={(e) => setTargetBranch(e.target.value)}
                        className="w-full border border-[color:var(--border-subtle)] bg-background px-3 py-2 font-mono text-xs text-foreground focus:border-[#0A0A0A] focus:outline-none"
                        style={{ borderRadius: 0 }}
                      >
                        {branches.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={targetBranch}
                        onChange={(e) => setTargetBranch(e.target.value)}
                        placeholder="main"
                        className="w-full border border-[color:var(--border-subtle)] bg-background px-3 py-2 font-mono text-xs text-foreground focus:border-[#0A0A0A] focus:outline-none"
                        style={{ borderRadius: 0 }}
                      />
                    )}
                    {loadingBranches && (
                      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                        Loading branches…
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5 flex items-center gap-1">
                    <FileCode className="h-3 w-3" /> Target Directory / Path
                  </label>
                  <input
                    type="text"
                    value={filePath}
                    onChange={(e) => setFilePath(e.target.value)}
                    placeholder="src/theme"
                    className="w-full border border-[color:var(--border-subtle)] bg-background px-3 py-2 font-mono text-xs text-foreground focus:border-[#0A0A0A] focus:outline-none"
                    style={{ borderRadius: 0 }}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Outputs <code>{filePath || "src/theme"}/tokens.css</code>,{" "}
                    <code>{filePath || "src/theme"}/tailwind.config.js</code>, and{" "}
                    <code>{filePath || "src/theme"}/tokens.json</code>.
                  </p>
                </div>
              </div>

              {/* Action: Dispatch Pull Request */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleDispatchPR}
                  disabled={dispatching || (!userProfile && !pat.trim()) || !targetRepo}
                  className="w-full flex items-center justify-center gap-2 border border-[#8B1A1A] bg-[#8B1A1A] py-3 px-4 font-mono text-xs uppercase tracking-[0.18em] text-[#F4EFE6] font-bold transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ borderRadius: 0 }}
                >
                  {dispatching ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating Branch &amp; Pull Request…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      [ Commit Tokens &amp; Open Pull Request ]
                    </>
                  )}
                </button>
                <p className="mt-2 text-center font-mono text-[10px] text-muted-foreground">
                  Creates branch <code>brand-muse/update-tokens-*</code> from {targetBranch || "main"}
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: SYNC HISTORY */}
          {activeTab === "history" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  // SUPABASE SYNC LOGS · TABLE: KIT_GIT_SYNCS
                </span>
                <button
                  type="button"
                  onClick={loadHistory}
                  className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
                >
                  [ Refresh Logs ]
                </button>
              </div>

              {loadingHistory ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : historyList.length === 0 ? (
                <div className="border border-dashed border-[color:var(--border-subtle)] p-8 text-center">
                  <History className="mx-auto h-6 w-6 text-muted-foreground opacity-50" />
                  <p className="mt-2 text-xs text-muted-foreground">
                    No pull requests dispatched yet for this brand kit.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[color:var(--border-subtle)] border border-[color:var(--border-subtle)]">
                  {historyList.map((log) => {
                    const isSuccess = log.status === "success";
                    return (
                      <div
                        key={log.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-background hover:bg-muted/10 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-block h-2 w-2 rounded-full ${
                                isSuccess ? "bg-green-500" : "bg-red-500"
                              }`}
                            />
                            <span className="font-mono text-xs font-semibold text-foreground">
                              {log.repoName || log.repo_name}
                            </span>
                            {log.prNumber || log.pr_number ? (
                              <span className="font-mono text-[10px] text-muted-foreground">
                                PR #{log.prNumber || log.pr_number}
                              </span>
                            ) : null}
                          </div>
                          {log.branchName || log.branch_name ? (
                            <p className="mt-1 font-mono text-[10px] text-muted-foreground truncate">
                              Branch: {log.branchName || log.branch_name}
                            </p>
                          ) : null}
                          {log.errorMessage || log.error_message ? (
                            <p className="mt-1 text-[11px] text-red-400">
                              {log.errorMessage || log.error_message}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {new Date(log.createdAt || log.created_at).toLocaleDateString()}{" "}
                            {new Date(log.createdAt || log.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {(log.prUrl || log.pr_url) && (
                            <a
                              href={log.prUrl || log.pr_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 border border-[#0A0A0A] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground hover:bg-foreground hover:text-background transition-colors"
                              style={{ borderRadius: 0 }}
                            >
                              Open PR <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PR SPEC PREVIEW */}
          {activeTab === "preview" && (
            <div className="space-y-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                // AUTOMATED EDITORIAL PR SUMMARY PREVIEW
              </span>
              <div className="border border-[color:var(--border-subtle)] bg-muted/10 p-4 font-mono text-[11px] text-muted-foreground max-h-72 overflow-y-auto leading-relaxed whitespace-pre-wrap">
{`## 🎨 Brand Muse Automated Design Tokens Sync
Dispatched on: ${new Date().toUTCString()}

### 📦 Updated Brand Kit: ${kitName}

This pull request synchronizes the latest design tokens, theme definitions, and CSS custom properties.

### 📂 Committed Token Manifest
- \`${filePath || "src/theme"}/tokens.css\` — Plain CSS Custom Properties (:root variables)
- \`${filePath || "src/theme"}/tailwind.config.js\` — Tailwind CSS theme configuration extension
- \`${filePath || "src/theme"}/tokens.json\` — W3C Design Tokens Community Group (DTCG) specification

### 🚀 Developer Integration Guide
\`\`\`css
@import "./${filePath || "src/theme"}/tokens.css";
\`\`\`
`}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
