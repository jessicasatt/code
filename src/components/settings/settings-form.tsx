"use client";

import { useState, useTransition } from "react";
import { deleteMyDataAction, signOutAction, updateGoalAction, updateProfileAction } from "@/app/actions";
import { WEEKDAYS } from "@/lib/domain/onboarding-input";
import { centsToDollars, dollarsToCents } from "@/lib/domain/money";
import type { Goal, Profile, Weekday } from "@/lib/domain/types";

const WEEKDAY_LABELS: Record<Weekday, string> = {
  sunday: "Sun",
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
};

const NOTIFICATION_CATEGORIES = [
  "Morning brief",
  "Call block reminders",
  "Inactivity nudges",
  "Follow-up due",
  "Weekly review",
];

export function SettingsForm({
  profile,
  goal,
  highLevelConnected,
  userEmail,
}: {
  profile: Profile;
  goal: Goal;
  highLevelConnected: boolean;
  userEmail: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const [monthlyGoal, setMonthlyGoal] = useState(centsToDollars(goal.monthlyRevenueGoalCents));
  const [avgClientValue, setAvgClientValue] = useState(centsToDollars(goal.averageClientValueCents));
  const [dailyTarget, setDailyTarget] = useState(goal.dailyCallTarget);
  const [weeklyTarget, setWeeklyTarget] = useState(goal.weeklyCallTarget);

  const [workdays, setWorkdays] = useState<Weekday[]>(profile.workdays);
  const [callingHoursStart, setCallingHoursStart] = useState(profile.callingHoursStart);
  const [callingHoursEnd, setCallingHoursEnd] = useState(profile.callingHoursEnd);
  const [quietHoursStart, setQuietHoursStart] = useState(profile.quietHoursStart);
  const [quietHoursEnd, setQuietHoursEnd] = useState(profile.quietHoursEnd);
  const [morningBriefTime, setMorningBriefTime] = useState(profile.morningBriefTime);
  const [endOfDaySummaryTime, setEndOfDaySummaryTime] = useState(profile.endOfDaySummaryTime);

  function toggleWorkday(day: Weekday) {
    setWorkdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  function saveGoal() {
    startTransition(async () => {
      await updateGoalAction({
        monthlyRevenueGoalCents: dollarsToCents(monthlyGoal),
        averageClientValueCents: dollarsToCents(avgClientValue),
        dailyCallTarget: dailyTarget,
        weeklyCallTarget: weeklyTarget,
      });
      setSavedAt(new Date().toLocaleTimeString());
    });
  }

  function saveSchedule() {
    startTransition(async () => {
      await updateProfileAction({
        workdays,
        callingHoursStart,
        callingHoursEnd,
        quietHoursStart,
        quietHoursEnd,
        morningBriefTime,
        endOfDaySummaryTime,
      });
      setSavedAt(new Date().toLocaleTimeString());
    });
  }

  function handleDelete() {
    if (!window.confirm("This permanently deletes all your Jessica OS data. Continue?")) return;
    startTransition(async () => {
      await deleteMyDataAction();
    });
  }

  return (
    <div className="flex flex-col gap-8">
      {userEmail ? <p className="text-sm text-muted">Signed in as {userEmail}</p> : null}

      <Section title="Revenue goal">
        <Field label="Monthly recurring revenue goal ($)">
          <input
            type="number"
            className="input"
            value={monthlyGoal}
            onChange={(e) => setMonthlyGoal(Number(e.target.value))}
          />
        </Field>
        <Field label="Average monthly GEO client value ($)">
          <input
            type="number"
            className="input"
            value={avgClientValue}
            onChange={(e) => setAvgClientValue(Number(e.target.value))}
          />
        </Field>
        <Field label="Daily call target">
          <input
            type="number"
            className="input"
            value={dailyTarget}
            onChange={(e) => setDailyTarget(Number(e.target.value))}
          />
        </Field>
        <Field label="Weekly call target">
          <input
            type="number"
            className="input"
            value={weeklyTarget}
            onChange={(e) => setWeeklyTarget(Number(e.target.value))}
          />
        </Field>
        <button
          disabled={isPending}
          onClick={saveGoal}
          className="rounded-xl bg-foreground px-4 py-3 text-sm font-medium text-background disabled:opacity-60"
        >
          Save revenue goal
        </button>
      </Section>

      <Section title="Schedule">
        <Field label="Workdays">
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => (
              <button
                type="button"
                key={day}
                onClick={() => toggleWorkday(day)}
                className={`rounded-full border px-3 py-2 text-sm ${
                  workdays.includes(day) ? "border-accent bg-accent-soft text-foreground" : "border-border text-muted"
                }`}
              >
                {WEEKDAY_LABELS[day]}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Calling hours">
          <div className="flex items-center gap-2">
            <input type="time" className="input" value={callingHoursStart} onChange={(e) => setCallingHoursStart(e.target.value)} />
            <span className="text-muted">to</span>
            <input type="time" className="input" value={callingHoursEnd} onChange={(e) => setCallingHoursEnd(e.target.value)} />
          </div>
        </Field>
        <Field label="Quiet hours">
          <div className="flex items-center gap-2">
            <input type="time" className="input" value={quietHoursStart} onChange={(e) => setQuietHoursStart(e.target.value)} />
            <span className="text-muted">to</span>
            <input type="time" className="input" value={quietHoursEnd} onChange={(e) => setQuietHoursEnd(e.target.value)} />
          </div>
        </Field>
        <Field label="Morning brief time">
          <input type="time" className="input" value={morningBriefTime} onChange={(e) => setMorningBriefTime(e.target.value)} />
        </Field>
        <Field label="End-of-day summary time">
          <input
            type="time"
            className="input"
            value={endOfDaySummaryTime}
            onChange={(e) => setEndOfDaySummaryTime(e.target.value)}
          />
        </Field>
        <button
          disabled={isPending}
          onClick={saveSchedule}
          className="rounded-xl bg-foreground px-4 py-3 text-sm font-medium text-background disabled:opacity-60"
        >
          Save schedule
        </button>
      </Section>

      {savedAt ? <p className="text-sm text-success">Saved at {savedAt}</p> : null}

      <Section title="Notification categories">
        <p className="text-sm text-muted">
          Available once push notifications are connected. See ARCHITECTURE.md for the Milestone 3 plan.
        </p>
        <div className="flex flex-col gap-2">
          {NOTIFICATION_CATEGORIES.map((category) => (
            <div key={category} className="flex items-center justify-between rounded-xl border border-border p-3 opacity-60">
              <span className="text-sm text-foreground">{category}</span>
              <span className="text-xs text-muted">Coming soon</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="HighLevel connection">
        <div className="flex items-center justify-between rounded-xl border border-border p-4">
          <p className="text-sm text-muted">Development-mode Private Integration Token</p>
          <span className={`text-sm font-medium ${highLevelConnected ? "text-success" : "text-muted"}`}>
            {highLevelConnected ? "Connected" : "Not connected"}
          </span>
        </div>
      </Section>

      <Section title="Your data">
        <a
          href="/api/data-export"
          className="rounded-xl border border-border px-4 py-3 text-center text-sm font-medium text-foreground"
        >
          Export my data
        </a>
        <button
          disabled={isPending}
          onClick={handleDelete}
          className="rounded-xl border border-danger px-4 py-3 text-sm font-medium text-danger disabled:opacity-60"
        >
          Delete my data
        </button>
      </Section>

      <button
        onClick={() => startTransition(() => signOutAction())}
        className="rounded-xl border border-border px-4 py-3 text-sm font-medium text-foreground"
      >
        Sign out
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-sm font-medium uppercase tracking-wide text-muted">{title}</legend>
      {children}
    </fieldset>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2 text-sm text-muted">
      {label}
      {children}
    </label>
  );
}
