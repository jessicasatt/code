"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  endCallBlockAction,
  logQuickResultAction,
  recordCheckinAction,
  startCallBlockAction,
} from "@/app/actions";
import { minutesBetween } from "@/lib/date/timezone";
import { formatCentsAsUsd } from "@/lib/domain/money";
import { DEFAULT_BLOCK_SIZING_CONFIG } from "@/lib/domain/block-sizing";
import { BEHAVIORAL_CHECKIN_REASONS, type AnsweredStatus, type BehavioralCheckinReason } from "@/lib/domain/types";
import type { ExecuteSnapshot } from "@/lib/data/execute";
import { createClient } from "@/lib/supabase/client";

const HIGHLEVEL_APP_URL = "https://app.gohighlevel.com/";
const SYNC_POLL_MS = 25_000;

const REASON_LABELS: Record<BehavioralCheckinReason, string> = {
  anxiety: "Anxiety",
  rejection: "Rejection",
  distracted: "Distracted",
  low_energy: "Low energy",
  other_work: "Other work",
  technical_issue: "Technical issue",
  bad_lead_list: "Bad lead list",
  needed_a_break: "Needed a break",
  completed_activity_elsewhere: "Completed activity elsewhere",
};

interface CompletedSummary {
  callsCompleted: number;
  callTarget: number;
  humanAnswers: number | null;
  meaningfulConversations: number;
  appointmentsBooked: number;
  durationMinutes: number | null;
}

type SyncState = "live" | "updating" | "error";

function formatMinutesAgo(minutes: number): string {
  if (minutes <= 0) return "just now";
  if (minutes === 1) return "1 minute ago";
  return `${minutes} minutes ago`;
}

function formatSecondsAgo(seconds: number): string {
  if (seconds < 45) return "Live";
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return "Last synced moments ago";
  return `Last synced ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
}

export function ExecuteView({
  snapshot,
  userId,
  supabaseEnabled,
}: {
  snapshot: ExecuteSnapshot;
  userId: string;
  supabaseEnabled: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showStartBlock, setShowStartBlock] = useState(false);
  const [showLogResult, setShowLogResult] = useState(false);
  const [checkinSaved, setCheckinSaved] = useState(false);
  const [completedSummary, setCompletedSummary] = useState<CompletedSummary | null>(null);
  const [syncState, setSyncState] = useState<SyncState>(snapshot.highLevelSync.error ? "error" : "live");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(snapshot.highLevelSync.lastSyncedAt);
  const [secondsAgo, setSecondsAgo] = useState(0);

  // Client-triggered on-demand sync: safe to call every ~25s because it's
  // scoped to just the active block's window (see src/lib/highlevel/sync.ts),
  // not a broad reconciliation sweep. This is the primary real-time path.
  useEffect(() => {
    if (!supabaseEnabled) return;
    let cancelled = false;

    async function sync() {
      setSyncState("updating");
      try {
        const res = await fetch("/api/highlevel/sync-now", { method: "POST" });
        const data = await res.json();
        if (cancelled) return;
        setSyncState(data.error ? "error" : "live");
        setLastSyncedAt(new Date().toISOString());
        router.refresh();
      } catch {
        if (!cancelled) setSyncState("error");
      }
    }

    sync();
    const interval = setInterval(sync, SYNC_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [supabaseEnabled, router]);

  // Supabase Realtime: refresh immediately on any change to this user's own
  // call/work-block rows, instead of waiting for the next poll tick.
  useEffect(() => {
    if (!supabaseEnabled) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`execute-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "call_events", filter: `user_id=eq.${userId}` },
        () => {
          setLastSyncedAt(new Date().toISOString());
          setSyncState("live");
          router.refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "work_blocks", filter: `user_id=eq.${userId}` },
        () => {
          setLastSyncedAt(new Date().toISOString());
          setSyncState("live");
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabaseEnabled, userId, router]);

  useEffect(() => {
    const tick = setInterval(() => {
      if (!lastSyncedAt) return;
      setSecondsAgo(Math.max(0, Math.round((Date.now() - new Date(lastSyncedAt).getTime()) / 1000)));
    }, 1000);
    return () => clearInterval(tick);
  }, [lastSyncedAt]);

  const state = useMemo(() => {
    if (completedSummary) return "completed" as const;
    if (!snapshot.activeWorkBlock) return "no_block" as const;
    if (snapshot.isInactive) return "inactive" as const;
    const remaining = Math.max(0, snapshot.activeWorkBlock.callTarget - snapshot.activeWorkBlock.callsCompleted);
    if (remaining > 0 && remaining <= DEFAULT_BLOCK_SIZING_CONFIG.nearCompletionThreshold) return "near_complete" as const;
    return "active" as const;
  }, [snapshot, completedSummary]);

  function handleStartBlock(durationMinutes: number, callTarget: number) {
    startTransition(async () => {
      await startCallBlockAction({ durationMinutes, callTarget });
      setShowStartBlock(false);
      setCompletedSummary(null);
      router.refresh();
    });
  }

  function handleEndBlock() {
    const block = snapshot.activeWorkBlock;
    if (!block) return;
    startTransition(async () => {
      await endCallBlockAction(block.id);
      setCompletedSummary({
        callsCompleted: block.callsCompleted,
        callTarget: block.callTarget,
        humanAnswers: snapshot.humanAnswers,
        meaningfulConversations: snapshot.meaningfulConversations,
        appointmentsBooked: snapshot.appointmentsBooked,
        durationMinutes: block.actualStart ? minutesBetween(new Date(), new Date(block.actualStart)) : null,
      });
      router.refresh();
    });
  }

  function handleLogResult(answeredStatus: AnsweredStatus, meaningfulConversation: boolean) {
    startTransition(async () => {
      await logQuickResultAction({ answeredStatus, meaningfulConversation });
      setShowLogResult(false);
      router.refresh();
    });
  }

  function handleCheckin(reason: BehavioralCheckinReason) {
    startTransition(async () => {
      await recordCheckinAction({ reason, note: null, trigger: "block_inactivity" });
      setCheckinSaved(true);
    });
  }

  const syncLabel =
    !supabaseEnabled
      ? null
      : syncState === "error" || snapshot.highLevelSync.error
        ? "HighLevel connection issue"
        : syncState === "updating"
          ? "Updating…"
          : formatSecondsAgo(secondsAgo);

  return (
    <div className="flex flex-col gap-6">
      {syncLabel ? (
        <div className="flex items-center justify-center gap-2 text-xs text-muted">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              syncLabel === "HighLevel connection issue"
                ? "bg-danger"
                : syncLabel === "Updating…"
                  ? "bg-accent animate-pulse"
                  : "bg-success"
            }`}
          />
          {syncLabel}
        </div>
      ) : null}

      {state === "no_block" && (
        <NoBlockState
          snapshot={snapshot}
          showStartBlock={showStartBlock}
          onOpenStartBlock={() => setShowStartBlock(true)}
          onCancelStartBlock={() => setShowStartBlock(false)}
          onStart={handleStartBlock}
          isPending={isPending}
        />
      )}

      {state === "active" && (
        <ActiveBlockState snapshot={snapshot} onEndBlock={handleEndBlock} isPending={isPending} />
      )}

      {state === "near_complete" && (
        <NearCompleteState snapshot={snapshot} onEndBlock={handleEndBlock} isPending={isPending} />
      )}

      {state === "inactive" && (
        <InactiveState
          snapshot={snapshot}
          onEndBlock={handleEndBlock}
          isPending={isPending}
          checkinSaved={checkinSaved}
          onCheckin={handleCheckin}
        />
      )}

      {state === "completed" && completedSummary && (
        <CompletedState
          summary={completedSummary}
          onTakeBreak={() => setCompletedSummary(null)}
          onStartAnother={() => {
            setCompletedSummary(null);
            setShowStartBlock(true);
          }}
        />
      )}

      {showLogResult ? (
        <LogResultForm onLog={handleLogResult} onCancel={() => setShowLogResult(false)} isPending={isPending} />
      ) : (
        <button
          onClick={() => setShowLogResult(true)}
          className="rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-muted"
        >
          Log a call result manually
        </button>
      )}

      <SecondaryReporting snapshot={snapshot} deemphasize={state === "active" || state === "near_complete" || state === "inactive"} />
    </div>
  );
}

function NoBlockState({
  snapshot,
  showStartBlock,
  onOpenStartBlock,
  onCancelStartBlock,
  onStart,
  isPending,
}: {
  snapshot: ExecuteSnapshot;
  showStartBlock: boolean;
  onOpenStartBlock: () => void;
  onCancelStartBlock: () => void;
  onStart: (durationMinutes: number, callTarget: number) => void;
  isPending: boolean;
}) {
  const modeMessage: Record<ExecuteSnapshot["suggestedBlockMode"], string> = {
    normal: "Start your next call block.",
    restart: "Let's restart with one call.",
    post_restart_recovery: "Nice work getting back in. Ready for a bit more?",
    high_momentum: "You're on a roll. Keep it going.",
  };

  return (
    <section className="rounded-2xl bg-foreground px-5 py-6 text-background">
      <p className="text-lg font-medium leading-snug">{modeMessage[snapshot.suggestedBlockMode]}</p>
      <p className="mt-1 text-sm opacity-70">
        Suggested: {snapshot.suggestedBlockSize} call{snapshot.suggestedBlockSize === 1 ? "" : "s"} · about{" "}
        {snapshot.suggestedBlockMinutes} minutes
      </p>

      {showStartBlock ? (
        <div className="mt-4">
          <StartBlockForm
            defaultDuration={snapshot.suggestedBlockMinutes}
            defaultCallTarget={snapshot.suggestedBlockSize}
            onStart={onStart}
            onCancel={onCancelStartBlock}
            isPending={isPending}
          />
        </div>
      ) : (
        <button
          disabled={isPending}
          onClick={onOpenStartBlock}
          className="mt-4 w-full rounded-xl bg-background px-4 py-4 text-base font-semibold text-foreground disabled:opacity-60"
        >
          Start {snapshot.suggestedBlockSize}-call block
        </button>
      )}
    </section>
  );
}

function ActiveBlockState({
  snapshot,
  onEndBlock,
  isPending,
}: {
  snapshot: ExecuteSnapshot;
  onEndBlock: () => void;
  isPending: boolean;
}) {
  const block = snapshot.activeWorkBlock!;
  const remaining = Math.max(0, block.callTarget - block.callsCompleted);
  const sinceLastCall = block.lastActivityAt ? minutesBetween(new Date(), new Date(block.lastActivityAt)) : null;

  return (
    <section className="rounded-2xl bg-foreground px-5 py-6 text-background">
      <p className="text-xs uppercase tracking-wide opacity-70">Active call block</p>
      <p className="mt-1 text-3xl font-semibold">
        {block.callsCompleted} of {block.callTarget}
      </p>
      <p className="mt-1 text-sm opacity-70">
        {remaining} call{remaining === 1 ? "" : "s"} remaining ·{" "}
        {sinceLastCall === null ? "No calls yet this block" : `Last call ${formatMinutesAgo(sinceLastCall)}`}
      </p>
      <p className="mt-4 text-lg font-medium leading-snug">Make the next call.</p>
      <div className="mt-4 flex flex-col gap-3">
        <a
          href={HIGHLEVEL_APP_URL}
          target="_blank"
          rel="noreferrer"
          className="w-full rounded-xl bg-background px-4 py-4 text-center text-base font-semibold text-foreground"
        >
          Open GoHighLevel
        </a>
        <button
          disabled={isPending}
          onClick={onEndBlock}
          className="w-full rounded-xl border border-background/40 px-4 py-3 text-sm font-medium opacity-80 disabled:opacity-40"
        >
          End block
        </button>
      </div>
    </section>
  );
}

function NearCompleteState({
  snapshot,
  onEndBlock,
  isPending,
}: {
  snapshot: ExecuteSnapshot;
  onEndBlock: () => void;
  isPending: boolean;
}) {
  const block = snapshot.activeWorkBlock!;
  const remaining = Math.max(0, block.callTarget - block.callsCompleted);

  return (
    <section className="rounded-2xl bg-foreground px-5 py-6 text-background">
      <p className="text-xs uppercase tracking-wide opacity-70">Almost there</p>
      <p className="mt-1 text-lg font-medium leading-snug">
        You are {remaining} call{remaining === 1 ? "" : "s"} from completing this block.
      </p>
      <div className="mt-4 flex flex-col gap-3">
        <a
          href={HIGHLEVEL_APP_URL}
          target="_blank"
          rel="noreferrer"
          className="w-full rounded-xl bg-background px-4 py-4 text-center text-base font-semibold text-foreground"
        >
          Finish the block
        </a>
        <button
          disabled={isPending}
          onClick={onEndBlock}
          className="w-full rounded-xl border border-background/40 px-4 py-3 text-sm font-medium opacity-80 disabled:opacity-40"
        >
          End block now
        </button>
      </div>
    </section>
  );
}

function InactiveState({
  snapshot,
  onEndBlock,
  isPending,
  checkinSaved,
  onCheckin,
}: {
  snapshot: ExecuteSnapshot;
  onEndBlock: () => void;
  isPending: boolean;
  checkinSaved: boolean;
  onCheckin: (reason: BehavioralCheckinReason) => void;
}) {
  return (
    <section className="rounded-2xl bg-foreground px-5 py-6 text-background">
      <p className="text-xs uppercase tracking-wide opacity-70">Paused</p>
      <p className="mt-1 text-lg font-medium leading-snug">Let&apos;s restart with one call.</p>
      <div className="mt-4 flex flex-col gap-3">
        <a
          href={HIGHLEVEL_APP_URL}
          target="_blank"
          rel="noreferrer"
          className="w-full rounded-xl bg-background px-4 py-4 text-center text-base font-semibold text-foreground"
        >
          Make one call
        </a>
        <button
          disabled={isPending}
          onClick={onEndBlock}
          className="w-full rounded-xl border border-background/40 px-4 py-3 text-sm font-medium opacity-80 disabled:opacity-40"
        >
          End block
        </button>
      </div>

      {checkinSaved ? (
        <p className="mt-4 text-center text-sm opacity-80">Thanks — logged.</p>
      ) : (
        <div className="mt-5 border-t border-background/20 pt-4">
          <p className="mb-3 text-sm font-medium opacity-90">What interrupted the block?</p>
          <div className="flex flex-wrap gap-2">
            {BEHAVIORAL_CHECKIN_REASONS.map((reason) => (
              <button
                key={reason}
                disabled={isPending}
                onClick={() => onCheckin(reason)}
                className="rounded-full border border-background/40 px-3 py-2 text-sm"
              >
                {REASON_LABELS[reason]}
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="mt-3 text-center text-xs opacity-60">{snapshot.activeWorkBlock?.callsCompleted ?? 0} calls so far this block</p>
    </section>
  );
}

function CompletedState({
  summary,
  onTakeBreak,
  onStartAnother,
}: {
  summary: CompletedSummary;
  onTakeBreak: () => void;
  onStartAnother: () => void;
}) {
  return (
    <section className="rounded-2xl bg-foreground px-5 py-6 text-background">
      <p className="text-xs uppercase tracking-wide opacity-70">Block complete</p>
      <p className="mt-1 text-3xl font-semibold">
        {summary.callsCompleted} of {summary.callTarget} calls
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="opacity-60">Human answers</p>
          <p className="text-lg font-semibold">{summary.humanAnswers ?? "—"}</p>
        </div>
        <div>
          <p className="opacity-60">Meaningful conversations</p>
          <p className="text-lg font-semibold">{summary.meaningfulConversations}</p>
        </div>
        <div>
          <p className="opacity-60">Appointments booked</p>
          <p className="text-lg font-semibold">{summary.appointmentsBooked}</p>
        </div>
        <div>
          <p className="opacity-60">Duration</p>
          <p className="text-lg font-semibold">{summary.durationMinutes !== null ? `${summary.durationMinutes} min` : "—"}</p>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-3">
        <button
          onClick={onStartAnother}
          className="w-full rounded-xl bg-background px-4 py-4 text-base font-semibold text-foreground"
        >
          Start another block
        </button>
        <button onClick={onTakeBreak} className="w-full rounded-xl border border-background/40 px-4 py-3 text-sm font-medium">
          Take a short break
        </button>
        <Link href="/review" className="w-full rounded-xl border border-background/40 px-4 py-3 text-center text-sm font-medium">
          Review follow-ups
        </Link>
      </div>
    </section>
  );
}

function SecondaryReporting({ snapshot, deemphasize }: { snapshot: ExecuteSnapshot; deemphasize: boolean }) {
  const progressPct = snapshot.goal.monthlyRevenueGoalCents
    ? Math.min(100, Math.round((snapshot.goal.currentMrrCents / snapshot.goal.monthlyRevenueGoalCents) * 100))
    : 0;

  return (
    <div className={`flex flex-col gap-3 ${deemphasize ? "opacity-70" : ""}`}>
      <section className="grid grid-cols-2 gap-3">
        <Stat label="Calls today" value={`${snapshot.callsToday} / ${snapshot.dailyCallTarget}`} />
        <Stat label="Calls this week" value={`${snapshot.callsThisWeek} / ${snapshot.weeklyCallTarget}`} />
        <Stat label="Meaningful conversations" value={snapshot.meaningfulConversations} />
        <Stat label="Appointments booked" value={snapshot.appointmentsBooked} />
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-xs text-muted">Current MRR / Goal</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          {formatCentsAsUsd(snapshot.goal.currentMrrCents)}{" "}
          <span className="text-sm font-normal text-muted">/ {formatCentsAsUsd(snapshot.goal.monthlyRevenueGoalCents)}</span>
        </p>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-accent-soft">
          <div className="h-full rounded-full bg-accent" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="mt-3 flex justify-between text-xs text-muted">
          <span>{formatCentsAsUsd(snapshot.remainingMrrCents)} remaining</span>
          <span>{snapshot.requiredDailyPace} calls/day needed to stay on pace</span>
        </div>
      </section>

      {snapshot.followUpsDue > 0 ? (
        <Link
          href="/review"
          className="rounded-xl border border-border bg-surface px-4 py-3 text-center text-sm font-medium text-foreground"
        >
          {snapshot.followUpsDue} follow-up{snapshot.followUpsDue === 1 ? "" : "s"} due
        </Link>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function StartBlockForm({
  defaultDuration,
  defaultCallTarget,
  onStart,
  onCancel,
  isPending,
}: {
  defaultDuration: number;
  defaultCallTarget: number;
  onStart: (durationMinutes: number, callTarget: number) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [duration, setDuration] = useState(defaultDuration);
  const [callTarget, setCallTarget] = useState(defaultCallTarget);

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm opacity-80">
        Block length (minutes)
        <input
          type="number"
          min={5}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="input text-foreground"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm opacity-80">
        Call target for this block
        <input
          type="number"
          min={1}
          value={callTarget}
          onChange={(e) => setCallTarget(Number(e.target.value))}
          className="input text-foreground"
        />
      </label>
      <div className="flex gap-3">
        <button
          disabled={isPending}
          onClick={() => onStart(duration, callTarget)}
          className="flex-1 rounded-xl bg-background px-4 py-4 text-base font-semibold text-foreground disabled:opacity-60"
        >
          Start now
        </button>
        <button onClick={onCancel} className="rounded-xl border border-background/40 px-4 py-4 text-base">
          Cancel
        </button>
      </div>
    </div>
  );
}

function LogResultForm({
  onLog,
  onCancel,
  isPending,
}: {
  onLog: (answeredStatus: AnsweredStatus, meaningfulConversation: boolean) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="mb-3 text-sm text-muted">How did that call go?</p>
      <div className="grid grid-cols-1 gap-2">
        <button
          disabled={isPending}
          onClick={() => onLog("answered", true)}
          className="rounded-xl border border-border px-4 py-3 text-left text-sm text-foreground"
        >
          Answered — meaningful conversation
        </button>
        <button
          disabled={isPending}
          onClick={() => onLog("answered", false)}
          className="rounded-xl border border-border px-4 py-3 text-left text-sm text-foreground"
        >
          Answered — brief
        </button>
        <button
          disabled={isPending}
          onClick={() => onLog("voicemail", false)}
          className="rounded-xl border border-border px-4 py-3 text-left text-sm text-foreground"
        >
          Voicemail
        </button>
        <button
          disabled={isPending}
          onClick={() => onLog("no_answer", false)}
          className="rounded-xl border border-border px-4 py-3 text-left text-sm text-foreground"
        >
          No answer
        </button>
      </div>
      <button onClick={onCancel} className="mt-3 w-full text-center text-sm text-muted">
        Cancel
      </button>
    </div>
  );
}
