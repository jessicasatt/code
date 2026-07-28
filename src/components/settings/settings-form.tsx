"use client";

import { useState, useTransition } from "react";
import {
  deleteMyDataAction,
  signOutAction,
  updateGoalAction,
  updateNotificationPreferenceAction,
  updateProfileAction,
} from "@/app/actions";
import { WEEKDAYS } from "@/lib/domain/onboarding-input";
import { centsToDollars, dollarsToCents } from "@/lib/domain/money";
import type { Goal, Profile, Weekday } from "@/lib/domain/types";
import { ALL_NOTIFICATION_CATEGORIES, CATEGORIES_REQUIRING_FREQUENT_SCHEDULING, type NotificationCategory } from "@/lib/domain/notifications";
import { subscribeToPush, unsubscribeFromPush } from "@/lib/push-client";
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

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  morning_brief: "Morning brief",
  block_starting_soon: "Call block starting in 10 min",
  no_calls_logged_yet: "No call logged 10 min into a block",
  few_calls_remaining: "3 calls left in a block",
  inactivity: "No activity for 25 min mid-block",
  block_target_completed: "Call block target completed",
  follow_up_due: "Follow-up due",
  behind_weekly_pace: "Behind weekly pace",
  end_of_day_summary: "End-of-day summary",
  weekly_review: "Weekly review",
};

export function SettingsForm({
  profile,
  goal,
  highLevelConnected,
  pushConfigured,
  hasPushSubscription,
  notificationPreferences,
  userEmail,
}: {
  profile: Profile;
  goal: Goal;
  highLevelConnected: boolean;
  pushConfigured: boolean;
  hasPushSubscription: boolean;
  notificationPreferences: Record<NotificationCategory, boolean>;
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

  const notificationPermission = useNotificationPermission();
  const [subscribed, setSubscribed] = useState(hasPushSubscription);
  const [preferences, setPreferences] = useState(notificationPreferences);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);

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

  async function handleEnablePush() {
    setPushBusy(true);
    setPushMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushMessage("Notification permission was not granted.");
        return;
      }
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        setPushMessage("Push isn't configured on the server yet.");
        return;
      }
      const ok = await subscribeToPush(vapidPublicKey);
      setSubscribed(ok);
      if (!ok) setPushMessage("Couldn't complete the subscription. Try again.");
    } finally {
      setPushBusy(false);
    }
  }

  async function handleDisablePush() {
    setPushBusy(true);
    try {
      await unsubscribeFromPush();
      setSubscribed(false);
    } finally {
      setPushBusy(false);
    }
  }

  async function handleTestPush() {
    setPushBusy(true);
    setPushMessage(null);
    try {
      const response = await fetch("/api/push/test", { method: "POST" });
      const body = await response.json().catch(() => ({}));
      setPushMessage(response.ok ? "Test notification sent." : (body.error ?? "Failed to send test notification."));
    } finally {
      setPushBusy(false);
    }
  }

  function toggleCategory(category: NotificationCategory) {
    const next = !preferences[category];
    setPreferences((prev) => ({ ...prev, [category]: next }));
    startTransition(async () => {
      await updateNotificationPreferenceAction(category, next);
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

      <Section title="Notifications">
        {!pushConfigured ? (
          <p className="text-sm text-muted">Push notifications aren&apos;t configured on the server yet.</p>
        ) : notificationPermission === "unsupported" ? (
          <p className="text-sm text-muted">This browser doesn&apos;t support push notifications.</p>
        ) : !subscribed ? (
          <button
            disabled={pushBusy}
            onClick={handleEnablePush}
            className="rounded-xl bg-foreground px-4 py-3 text-sm font-medium text-background disabled:opacity-60"
          >
            {pushBusy ? "Enabling…" : "Enable notifications on this device"}
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <span className="text-sm text-foreground">This device</span>
              <span className="text-sm font-medium text-success">Enabled</span>
            </div>
            <div className="flex gap-2">
              <button
                disabled={pushBusy}
                onClick={handleTestPush}
                className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-medium text-foreground disabled:opacity-60"
              >
                Send test notification
              </button>
              <button
                disabled={pushBusy}
                onClick={handleDisablePush}
                className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-medium text-foreground disabled:opacity-60"
              >
                Disable
              </button>
            </div>
            {pushMessage ? <p className="text-sm text-muted">{pushMessage}</p> : null}

            <div className="mt-2 flex flex-col gap-2">
              {ALL_NOTIFICATION_CATEGORIES.map((category) => {
                const unavailable = CATEGORIES_REQUIRING_FREQUENT_SCHEDULING.includes(category);
                return (
                  <div
                    key={category}
                    className={`flex items-center justify-between rounded-xl border border-border p-3 ${unavailable ? "opacity-60" : ""}`}
                  >
                    <div>
                      <span className="text-sm text-foreground">{CATEGORY_LABELS[category]}</span>
                      {unavailable ? (
                        <p className="text-xs text-muted">Needs more frequent scheduling than your current plan allows.</p>
                      ) : null}
                    </div>
                    {unavailable ? (
                      <span className="text-xs text-muted">Unavailable</span>
                    ) : (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={preferences[category]}
                        onClick={() => toggleCategory(category)}
                        className={`h-6 w-11 shrink-0 rounded-full transition-colors ${preferences[category] ? "bg-accent" : "bg-border"}`}
                      >
                        <span
                          className={`block h-5 w-5 translate-x-0.5 rounded-full bg-surface transition-transform ${preferences[category] ? "translate-x-5" : ""}`}
                        />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
