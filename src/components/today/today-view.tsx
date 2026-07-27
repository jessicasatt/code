"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  endCallBlockAction,
  logQuickResultAction,
  recordCheckinAction,
  startCallBlockAction,
} from "@/app/actions";
import { formatAppTime } from "@/lib/date/timezone";
import { formatCentsAsUsd } from "@/lib/domain/money";
import { BEHAVIORAL_CHECKIN_REASONS, type AnsweredStatus, type BehavioralCheckinReason } from "@/lib/domain/types";
import type { TodaySnapshot } from "@/lib/data/today";

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

const PACE_LABEL: Record<TodaySnapshot["paceStatus"], { label: string; className: string }> = {
  ahead: { label: "Ahead of pace", className: "text-success" },
  on_pace: { label: "On pace", className: "text-accent" },
  behind: { label: "Behind pace", className: "text-danger" },
};

export function TodayView({ snapshot }: { snapshot: TodaySnapshot }) {
  const [isPending, startTransition] = useTransition();
  const [showLogResult, setShowLogResult] = useState(false);
  const [showStartBlock, setShowStartBlock] = useState(false);
  const [showCheckin, setShowCheckin] = useState(false);
  const [checkinSaved, setCheckinSaved] = useState(false);

  const pace = PACE_LABEL[snapshot.paceStatus];
  const progressPct = snapshot.goal.monthlyRevenueGoalCents
    ? Math.min(100, Math.round((snapshot.goal.currentMrrCents / snapshot.goal.monthlyRevenueGoalCents) * 100))
    : 0;

  function handleEndBlock(blockId: string, incomplete: boolean) {
    startTransition(async () => {
      await endCallBlockAction(blockId);
      if (incomplete) setShowCheckin(true);
    });
  }

  function handleStartBlock(durationMinutes: number, callTarget: number) {
    startTransition(async () => {
      await startCallBlockAction({ durationMinutes, callTarget });
      setShowStartBlock(false);
    });
  }

  function handleLogResult(answeredStatus: AnsweredStatus, meaningfulConversation: boolean) {
    startTransition(async () => {
      await logQuickResultAction({ answeredStatus, meaningfulConversation });
      setShowLogResult(false);
    });
  }

  function handleCheckin(reason: BehavioralCheckinReason) {
    startTransition(async () => {
      await recordCheckinAction({ reason, note: null, trigger: "call_block_ended_incomplete" });
      setShowCheckin(false);
      setCheckinSaved(true);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Next action */}
      <div className="rounded-2xl bg-foreground px-5 py-5 text-background">
        <p className="text-xs uppercase tracking-wide opacity-70">Next action</p>
        <p className="mt-1 text-lg font-medium leading-snug">{snapshot.nextAction.message}</p>
      </div>

      {/* MRR progress */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <p className="text-sm text-muted">Current MRR / Goal</p>
        <p className="mt-1 text-4xl font-semibold tracking-tight text-foreground">
          {formatCentsAsUsd(snapshot.goal.currentMrrCents)}{" "}
          <span className="text-lg font-normal text-muted">/ {formatCentsAsUsd(snapshot.goal.monthlyRevenueGoalCents)}</span>
        </p>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-accent-soft">
          <div className="h-full rounded-full bg-accent" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="mt-4 flex justify-between text-sm text-muted">
          <span>{formatCentsAsUsd(snapshot.remainingMrrCents)} remaining</span>
          <span>
            ~{snapshot.clientsNeeded} client{snapshot.clientsNeeded === 1 ? "" : "s"} needed
          </span>
        </div>
      </section>

      {/* Calls today */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-baseline justify-between">
          <p className="text-sm text-muted">Calls today</p>
          <span className={`text-sm font-medium ${pace.className}`}>{pace.label}</span>
        </div>
        <p className="mt-1 text-4xl font-semibold tracking-tight text-foreground">
          {snapshot.callsToday} <span className="text-lg font-normal text-muted">/ {snapshot.dailyCallTarget}</span>
        </p>
        <p className="mt-2 text-sm text-muted">
          {snapshot.callsThisWeek} / {snapshot.weeklyCallTarget} this week · {snapshot.requiredDailyPace} calls/day needed to
          stay on pace
        </p>
      </section>

      {/* Stat grid */}
      <section className="grid grid-cols-2 gap-3">
        <Stat label="Human answers" value={snapshot.humanAnswers ?? "—"} />
        <Stat label="Meaningful conversations" value={snapshot.meaningfulConversations} />
        <Stat label="Appointments booked" value={snapshot.appointmentsBooked} />
        <Stat label="Follow-ups due" value={snapshot.followUpsDue} />
      </section>

      {/* Call block */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        {snapshot.activeWorkBlock ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <p className="text-sm text-muted">Active call block</p>
              <p className="text-sm text-muted">ends {formatAppTime(new Date(snapshot.activeWorkBlock.plannedEnd), "h:mm a")}</p>
            </div>
            <p className="text-3xl font-semibold text-foreground">
              {snapshot.activeWorkBlock.callsCompleted} / {snapshot.activeWorkBlock.callTarget} calls
            </p>
            <button
              disabled={isPending}
              onClick={() =>
                handleEndBlock(
                  snapshot.activeWorkBlock!.id,
                  snapshot.activeWorkBlock!.callsCompleted < snapshot.activeWorkBlock!.callTarget,
                )
              }
              className="rounded-xl bg-foreground px-4 py-4 text-base font-medium text-background disabled:opacity-60"
            >
              End call block
            </button>
          </div>
        ) : showStartBlock ? (
          <StartBlockForm onStart={handleStartBlock} onCancel={() => setShowStartBlock(false)} isPending={isPending} />
        ) : (
          <button
            disabled={isPending}
            onClick={() => setShowStartBlock(true)}
            className="w-full rounded-xl bg-foreground px-4 py-4 text-base font-medium text-background disabled:opacity-60"
          >
            Start call block
          </button>
        )}
      </section>

      {showCheckin ? (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <p className="mb-3 text-sm font-medium text-foreground">What interrupted the block?</p>
          <div className="flex flex-wrap gap-2">
            {BEHAVIORAL_CHECKIN_REASONS.map((reason) => (
              <button
                key={reason}
                disabled={isPending}
                onClick={() => handleCheckin(reason)}
                className="rounded-full border border-border px-3 py-2 text-sm text-foreground"
              >
                {REASON_LABELS[reason]}
              </button>
            ))}
          </div>
        </section>
      ) : checkinSaved ? (
        <p className="text-center text-sm text-muted">Thanks — logged.</p>
      ) : null}

      {/* Quick actions */}
      <section className="flex flex-col gap-3">
        {showLogResult ? (
          <LogResultForm onLog={handleLogResult} onCancel={() => setShowLogResult(false)} isPending={isPending} />
        ) : (
          <button
            onClick={() => setShowLogResult(true)}
            className="rounded-xl border border-border bg-surface px-4 py-4 text-base font-medium text-foreground"
          >
            Log quick result
          </button>
        )}
        <Link
          href="/review"
          className="rounded-xl border border-border bg-surface px-4 py-4 text-center text-base font-medium text-foreground"
        >
          Review today
        </Link>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function StartBlockForm({
  onStart,
  onCancel,
  isPending,
}: {
  onStart: (durationMinutes: number, callTarget: number) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [duration, setDuration] = useState(60);
  const [callTarget, setCallTarget] = useState(20);

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm text-muted">
        Block length (minutes)
        <input
          type="number"
          min={5}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="input"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm text-muted">
        Call target for this block
        <input
          type="number"
          min={1}
          value={callTarget}
          onChange={(e) => setCallTarget(Number(e.target.value))}
          className="input"
        />
      </label>
      <div className="flex gap-3">
        <button
          disabled={isPending}
          onClick={() => onStart(duration, callTarget)}
          className="flex-1 rounded-xl bg-foreground px-4 py-4 text-base font-medium text-background disabled:opacity-60"
        >
          Start now
        </button>
        <button onClick={onCancel} className="rounded-xl border border-border px-4 py-4 text-base text-foreground">
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
