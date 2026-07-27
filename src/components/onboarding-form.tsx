"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { completeOnboardingAction } from "@/app/actions";
import { WEEKDAYS } from "@/lib/domain/onboarding-input";
import type { Weekday } from "@/lib/domain/types";
import { useNotificationPermission } from "@/lib/use-notification-permission";

const WEEKDAY_LABELS: Record<Weekday, string> = {
  sunday: "Sun",
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
};

const DEFAULT_WORKDAYS: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday"];

export function OnboardingForm({ highLevelConnected }: { highLevelConnected: boolean }) {
  const [name, setName] = useState("");
  const [monthlyRevenueGoal, setMonthlyRevenueGoal] = useState(10_000);
  const [currentMrr, setCurrentMrr] = useState(0);
  const [averageClientValue, setAverageClientValue] = useState(1_250);
  const [workdays, setWorkdays] = useState<Weekday[]>(DEFAULT_WORKDAYS);
  const [dailyCallTarget, setDailyCallTarget] = useState(40);
  const [weeklyCallTarget, setWeeklyCallTarget] = useState(175);
  const [morningBriefTime, setMorningBriefTime] = useState("07:30");
  const [endOfDaySummaryTime, setEndOfDaySummaryTime] = useState("18:00");
  const [callingHoursStart, setCallingHoursStart] = useState("09:00");
  const [callingHoursEnd, setCallingHoursEnd] = useState("17:00");
  const syncedNotificationStatus = useNotificationPermission();
  const [permissionOverride, setPermissionOverride] = useState<NotificationPermission | null>(null);
  const notificationStatus = permissionOverride ?? syncedNotificationStatus;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function toggleWorkday(day: Weekday) {
    setWorkdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  async function requestNotifications() {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setPermissionOverride(permission);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await completeOnboardingAction({
          name,
          monthlyRevenueGoalDollars: monthlyRevenueGoal,
          currentMrrDollars: currentMrr,
          averageClientValueDollars: averageClientValue,
          workdays,
          dailyCallTarget,
          weeklyCallTarget,
          morningBriefTime,
          endOfDaySummaryTime,
          callingHoursStart,
          callingHoursEnd,
        });
        router.push("/today");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Section title="About you">
        <Field label="Your name">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder="Jessica"
          />
        </Field>
      </Section>

      <Section title="Revenue goal">
        <Field label="Monthly recurring revenue goal ($)">
          <input
            type="number"
            min={0}
            step={100}
            required
            value={monthlyRevenueGoal}
            onChange={(e) => setMonthlyRevenueGoal(Number(e.target.value))}
            className="input"
          />
        </Field>
        <Field label="Current recurring revenue ($)">
          <input
            type="number"
            min={0}
            step={100}
            required
            value={currentMrr}
            onChange={(e) => setCurrentMrr(Number(e.target.value))}
            className="input"
          />
        </Field>
        <Field label="Average monthly GEO client value ($)">
          <input
            type="number"
            min={1}
            required
            value={averageClientValue}
            onChange={(e) => setAverageClientValue(Number(e.target.value))}
            className="input"
          />
        </Field>
      </Section>

      <Section title="Workdays">
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((day) => (
            <button
              type="button"
              key={day}
              onClick={() => toggleWorkday(day)}
              className={`rounded-full border px-3 py-2 text-sm transition-colors ${
                workdays.includes(day)
                  ? "border-accent bg-accent-soft text-foreground"
                  : "border-border text-muted"
              }`}
              aria-pressed={workdays.includes(day)}
            >
              {WEEKDAY_LABELS[day]}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Call targets">
        <Field label="Daily call target">
          <input
            type="number"
            min={1}
            required
            value={dailyCallTarget}
            onChange={(e) => setDailyCallTarget(Number(e.target.value))}
            className="input"
          />
        </Field>
        <Field label="Weekly call target">
          <input
            type="number"
            min={1}
            required
            value={weeklyCallTarget}
            onChange={(e) => setWeeklyCallTarget(Number(e.target.value))}
            className="input"
          />
        </Field>
      </Section>

      <Section title="Schedule">
        <Field label="Morning brief time">
          <input
            type="time"
            required
            value={morningBriefTime}
            onChange={(e) => setMorningBriefTime(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="End-of-day summary time">
          <input
            type="time"
            required
            value={endOfDaySummaryTime}
            onChange={(e) => setEndOfDaySummaryTime(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Normal calling hours">
          <div className="flex items-center gap-2">
            <input
              type="time"
              required
              value={callingHoursStart}
              onChange={(e) => setCallingHoursStart(e.target.value)}
              className="input"
            />
            <span className="text-muted">to</span>
            <input
              type="time"
              required
              value={callingHoursEnd}
              onChange={(e) => setCallingHoursEnd(e.target.value)}
              className="input"
            />
          </div>
        </Field>
      </Section>

      <Section title="Notifications">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4">
          <p className="text-sm text-muted">
            Jessica OS nudges you when you fall behind pace or go quiet during a call block.
          </p>
          {notificationStatus === "granted" ? (
            <span className="whitespace-nowrap text-sm font-medium text-success">Enabled</span>
          ) : notificationStatus === "unsupported" ? (
            <span className="whitespace-nowrap text-sm text-muted">Not supported</span>
          ) : (
            <button
              type="button"
              onClick={requestNotifications}
              className="whitespace-nowrap rounded-lg border border-accent px-3 py-2 text-sm font-medium text-accent"
            >
              Enable
            </button>
          )}
        </div>
      </Section>

      <Section title="HighLevel connection">
        <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-4">
          <p className="text-sm text-muted">Calls, contacts, and appointments sync from GoHighLevel.</p>
          <span className={`whitespace-nowrap text-sm font-medium ${highLevelConnected ? "text-success" : "text-muted"}`}>
            {highLevelConnected ? "Connected" : "Not connected yet"}
          </span>
        </div>
      </Section>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <button
        type="submit"
        disabled={isPending || workdays.length === 0}
        className="rounded-xl bg-foreground px-4 py-4 text-base font-medium text-background disabled:opacity-60"
      >
        {isPending ? "Saving…" : "Complete setup"}
      </button>
    </form>
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
