// Precision Japanese Calligraphy Step Indicator
// Visualizes asynchronous multi-step extraction milestones via Server-Sent Events (SSE).
// Aesthetic: Washi parchment, Sumi ink strokes, Hanko vermillion seal, gold leaf accents.

import React, { useEffect, useState, useRef } from "react";
import {
  EXTRACTION_STEPS,
  type ExtractionStepName,
  type ExtractionStatus,
  type StepMilestone,
} from "@/server/job-queue.server";

export interface CalligraphyStepIndicatorProps {
  kitId?: string | null;
  activeStep?: ExtractionStepName;
  status?: ExtractionStatus;
  progress?: number;
  attempt?: number;
  error?: string | null;
  logs?: string[];
  onCompleted?: () => void;
  onFailed?: (error: string) => void;
}

export function CalligraphyStepIndicator({
  kitId,
  activeStep: initialStep = "scrape_homepage",
  status: initialStatus = "crawling",
  progress: initialProgress = 10,
  attempt: initialAttempt = 1,
  error: initialError = null,
  logs: initialLogs = [],
  onCompleted,
  onFailed,
}: CalligraphyStepIndicatorProps) {
  const [currentStep, setCurrentStep] = useState<ExtractionStepName>(initialStep);
  const [currentStatus, setCurrentStatus] = useState<ExtractionStatus>(initialStatus);
  const [progress, setProgress] = useState<number>(initialProgress);
  const [attempt, setAttempt] = useState<number>(initialAttempt);
  const [error, setError] = useState<string | null>(initialError);
  const [logs, setLogs] = useState<string[]>(initialLogs);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  const completedRef = useRef(false);
  const startTimeRef = useRef<number>(Date.now());

  // Timer ticker
  useEffect(() => {
    startTimeRef.current = Date.now();
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [kitId]);

  // Server-Sent Events connection
  useEffect(() => {
    if (!kitId) return;

    let eventSource: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    function connectSSE() {
      if (completedRef.current) return;
      const sseUrl = `/api/kits/${kitId}/stream`;
      eventSource = new EventSource(sseUrl);

      eventSource.onopen = () => {
        setIsConnected(true);
      };

      eventSource.addEventListener("progress", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data.step) setCurrentStep(data.step);
          if (data.status) setCurrentStatus(data.status);
          if (typeof data.progress === "number") setProgress(data.progress);
          if (typeof data.attempt === "number") setAttempt(data.attempt);
          if (data.error) setError(data.error);
          if (Array.isArray(data.logs)) setLogs(data.logs);
        } catch {}
      });

      eventSource.addEventListener("completed", (e: MessageEvent) => {
        completedRef.current = true;
        setCurrentStatus("completed");
        setCurrentStep("persist_and_finalize");
        setProgress(100);
        eventSource?.close();
        onCompleted?.();
      });

      eventSource.addEventListener("failed", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setError(data.error || "Extraction failed");
          setCurrentStatus("failed");
          onFailed?.(data.error || "Extraction failed");
        } catch {
          setError("Extraction failed");
        }
        eventSource?.close();
      });

      eventSource.onerror = () => {
        setIsConnected(false);
        eventSource?.close();
        if (!completedRef.current) {
          retryTimeout = setTimeout(connectSSE, 2000);
        }
      };
    }

    connectSSE();

    return () => {
      if (eventSource) eventSource.close();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [kitId, onCompleted, onFailed]);

  // Map step to index
  const activeIndex = EXTRACTION_STEPS.findIndex((s) => s.step === currentStep);
  const activeMilestone = EXTRACTION_STEPS[activeIndex] || EXTRACTION_STEPS[0];

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}s`;
  };

  const getStatusBadge = () => {
    switch (currentStatus) {
      case "crawling":
        return { label: "巡回中 · Crawling", color: "bg-amber-500/10 text-amber-700 border-amber-300 dark:text-amber-400" };
      case "analyzing_colors":
        return { label: "色相抽出 · Color Alchemy", color: "bg-indigo-500/10 text-indigo-700 border-indigo-300 dark:text-indigo-400" };
      case "resolving_fonts":
        return { label: "書体同定 · Font Probing", color: "bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:text-emerald-400" };
      case "synthesizing_voice":
        return { label: "調合推敲 · AI Synthesis", color: "bg-purple-500/10 text-purple-700 border-purple-300 dark:text-purple-400" };
      case "completed":
        return { label: "落款完了 · Ready", color: "bg-emerald-600/15 text-emerald-800 border-emerald-400 dark:text-emerald-300" };
      case "failed":
        return { label: "中断 · Retrying", color: "bg-rose-500/15 text-rose-800 border-rose-300 dark:text-rose-400" };
      default:
        return { label: "準備中 · Ingesting", color: "bg-stone-500/10 text-stone-700 border-stone-300 dark:text-stone-400" };
    }
  };

  const statusBadge = getStatusBadge();

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#D8C7B0]/60 dark:border-[#38332E] bg-gradient-to-b from-[#FAF7F2] to-[#F3EDE2] dark:from-[#181614] dark:to-[#121110] p-6 sm:p-8 shadow-sm transition-all duration-500">
      {/* Decorative Washi Paper & Calligraphy Watermark */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035] dark:opacity-[0.06] select-none flex items-center justify-end pr-10 font-serif text-[180px] leading-none"
        style={{ fontFamily: "'Noto Serif JP', 'Cormorant Garamond', serif" }}
      >
        墨
      </div>

      {/* Header telemetry row */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E4D7C5] dark:border-[#2C2723] pb-5">
        <div className="flex items-center gap-3">
          {/* Vermillion Hanko Seal (判子) */}
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-[#8B1A1A] bg-[#8B1A1A]/10 text-[#8B1A1A] dark:border-[#C83232] dark:bg-[#C83232]/10 dark:text-[#E84E4E] shadow-sm">
            <span
              className="text-lg font-bold select-none [font-family:'Noto_Serif_JP',serif]"
              title="Hanko 印章"
            >
              {activeMilestone.kanjiNum}
            </span>
            {/* Live Pulsing Dot */}
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8B1A1A] opacity-75 dark:bg-[#E84E4E]"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#8B1A1A] dark:bg-[#E84E4E]"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#736B63] dark:text-[#A89E94]">
                STEP {activeIndex + 1} OF 5 · {activeMilestone.romaji}
              </span>
              {isConnected && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-mono text-emerald-700 dark:text-emerald-400">
                  <span className="h-1 w-1 rounded-full bg-emerald-500"></span> SSE LIVE
                </span>
              )}
            </div>
            <h3
              className="text-xl sm:text-2xl font-semibold tracking-tight text-[#1C1917] dark:text-[#F5F2EB] flex items-center gap-2.5 mt-0.5"
              style={{ fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif" }}
            >
              <span>{activeMilestone.kanjiName}</span>
              <span className="text-sm font-normal text-[#8A7F73] dark:text-[#9E9488]">
                ({activeMilestone.label})
              </span>
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {attempt > 1 && (
            <div className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 dark:border-amber-700/60 bg-amber-500/10 px-2.5 py-1 text-xs font-mono text-amber-700 dark:text-amber-400">
              <span>↻ Jittered Retry #{attempt}</span>
            </div>
          )}

          <div
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-mono font-medium ${statusBadge.color}`}
          >
            {statusBadge.label}
          </div>

          <div className="font-mono text-xs text-[#736B63] dark:text-[#A89E94] bg-[#EFE8DC] dark:bg-[#201D1A] px-2.5 py-1 rounded-md border border-[#E0D3C1] dark:border-[#302A24]">
            ⏱ {formatTimer(elapsedSeconds)}
          </div>
        </div>
      </div>

      {/* Five-step Calligraphy Progression Stepper */}
      <div className="mt-8 grid grid-cols-5 gap-2 sm:gap-3">
        {EXTRACTION_STEPS.map((m, idx) => {
          const isDone = idx < activeIndex || (idx === activeIndex && currentStatus === "completed");
          const isCurrent = idx === activeIndex && currentStatus !== "completed";
          const isUpcoming = idx > activeIndex;

          return (
            <div
              key={m.step}
              className={`relative flex flex-col rounded-xl p-3 sm:p-3.5 border transition-all duration-500 ${
                isCurrent
                  ? "border-[#C5A059] bg-[#FFFFFF]/90 dark:bg-[#221E1A] shadow-md ring-1 ring-[#C5A059]/40"
                  : isDone
                    ? "border-[#8B1A1A]/40 dark:border-[#8B1A1A]/30 bg-[#FAF4EA]/80 dark:bg-[#1A1613]"
                    : "border-[#E5D8C7]/50 dark:border-[#24201C] bg-[#F2EDE4]/40 dark:bg-[#141210]/40 opacity-60"
              }`}
            >
              {/* Stepper Header */}
              <div className="flex items-center justify-between">
                <span
                  className={`text-base sm:text-lg font-bold [font-family:'Noto_Serif_JP',serif] ${
                    isCurrent
                      ? "text-[#8B1A1A] dark:text-[#E84E4E]"
                      : isDone
                        ? "text-[#4A7C59] dark:text-[#68A87C]"
                        : "text-[#A89E94] dark:text-[#645C54]"
                  }`}
                >
                  {m.kanjiNum}
                </span>

                <span
                  className={`text-xs sm:text-sm font-semibold [font-family:'Noto_Serif_JP',serif] ${
                    isCurrent
                      ? "text-[#1C1917] dark:text-[#F5F2EB]"
                      : isDone
                        ? "text-[#3D3833] dark:text-[#C5BCB2]"
                        : "text-[#8F857A] dark:text-[#645C54]"
                  }`}
                >
                  {m.kanjiName}
                </span>
              </div>

              {/* Romaji & Short Label */}
              <div className="mt-1.5 hidden sm:block">
                <p className="font-mono text-[9px] uppercase tracking-wider text-[#736B63] dark:text-[#9A9084] truncate">
                  {m.romaji}
                </p>
                <p className="text-[11px] font-medium text-[#292524] dark:text-[#E7E2D8] truncate mt-0.5">
                  {m.label.split(" ")[0]}
                </p>
              </div>

              {/* Status bar within milestone */}
              <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-[#E5D8C7] dark:bg-[#28221D]">
                <div
                  className={`h-full transition-all duration-700 ${
                    isDone
                      ? "w-full bg-[#4A7C59]"
                      : isCurrent
                        ? "w-full bg-[#C5A059] animate-pulse"
                        : "w-0"
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Detailed Current Step Description & Progress Meter */}
      <div className="mt-6 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-[#44403C] dark:text-[#D6D0C5]">
            {activeMilestone.detail}
          </span>
          <span className="font-mono font-bold text-sm text-[#1C1917] dark:text-[#F5F2EB]">
            {Math.round(progress)}%
          </span>
        </div>

        {/* Precision Progress Bar with Gold Leaf Gradient */}
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-[#E5DACB] dark:bg-[#28231E]">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r from-[#8B1A1A] via-[#C5A059] to-[#4A7C59]"
            style={{ width: `${Math.min(100, Math.max(5, progress))}%` }}
          />
        </div>
      </div>

      {/* Live Step Logs / Telemetry Drawer */}
      {logs.length > 0 && (
        <div className="mt-6 rounded-xl border border-[#E0D2BF] dark:border-[#2C2723] bg-[#EFE8DC]/50 dark:bg-[#141210]/80 p-3 sm:p-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#E2D5C3]/60 dark:border-[#28231E]">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#736B63] dark:text-[#A89E94]">
              // Workflow Telemetry Stream
            </span>
            <span className="font-mono text-[10px] text-[#8F857A] dark:text-[#786F65]">
              {logs.length} events logged
            </span>
          </div>
          <div className="mt-2.5 max-h-24 overflow-y-auto space-y-1 font-mono text-[11px] text-[#44403C] dark:text-[#C5BCB2] select-text">
            {logs.slice(-5).map((log, idx) => (
              <div key={idx} className="flex items-start gap-2 leading-relaxed">
                <span className="text-[#C5A059] shrink-0">›</span>
                <span className="break-all">{log}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error / Retrying Notification Alert */}
      {error && (
        <div className="mt-4 rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 p-3.5 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2.5">
          <span className="font-bold text-rose-600 dark:text-rose-400">⚠️</span>
          <div className="flex-1">
            <span className="font-semibold">Notice:</span> {error}
          </div>
        </div>
      )}
    </div>
  );
}
