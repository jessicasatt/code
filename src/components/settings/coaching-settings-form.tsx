"use client";

import { useState, useTransition } from "react";
import { pauseCoachingAction, setVacationModeAction, updateCoachingSettingsAction } from "@/app/actions";
import type { CoachingIntensity, CoachingSettings } from "@/lib/domain/types";

const INTENSITY_OPTIONS: { value: CoachingIntensity; label: string; description: string }[] = [
  { value: "gentle", label: "Gentle", description: "Fewer nudges, softer language." },
  { value: "standard", label: "Standard", description: "The default balance." },
  { value: "direct", label: "Direct", description: "More nudges, more direct language." },
];

export function CoachingSettingsForm({ settings }: { settings: CoachingSettings }) {
  const [isPending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const [desiredFirstCallTime, setDesiredFirstCallTime] = useState(settings.desiredFirstCallTime);
  const [defaultBlockSize, setDefaultBlockSize] = useState(settings.defaultBlockSize);
  const [inactivityThresholdMinutes, setInactivityThresholdMinutes] = useState(settings.inactivityThresholdMinutes);
  const [behindPaceTolerancePct, setBehindPaceTolerancePct] = useState(settings.behindPaceTolerancePct);
  const [notificationCooldownMinutes, setNotificationCooldownMinutes] = useState(settings.notificationCooldownMinutes);
  const [maxProactiveNotificationsPerDay, setMaxProactiveNotificationsPerDay] = useState(
    settings.maxProactiveNotificationsPerDay,
  );
  const [coachingIntensity, setCoachingIntensity] = useState<CoachingIntensity>(settings.coachingIntensity);

  const [pausedUntil, setPausedUntil] = useState(settings.coachingPausedUntil);
  const [vacationMode, setVacationMode] = useState(settings.vacationMode);

  function save() {
    startTransition(async () => {
      await updateCoachingSettingsAction({
        desiredFirstCallTime,
        defaultBlockSize,
        inactivityThresholdMinutes,
        behindPaceTolerancePct,
        notificationCooldownMinutes,
        maxProactiveNotificationsPerDay,
        coachingIntensity,
      });
      setSavedAt(new Date().toLocaleTimeString());
    });
  }

  function pause(minutesFromNow: number | "tomorrow") {
    startTransition(async () => {
      await pauseCoachingAction(minutesFromNow);
      setVacationMode(false);
      setPausedUntil(
        minutesFromNow === "tomorrow"
          ? "paused"
          : new Date(Date.now() + minutesFromNow * 60_000).toISOString(),
      );
    });
  }

  function resume() {
    startTransition(async () => {
      await pauseCoachingAction(null);
      setPausedUntil(null);
    });
  }

  function toggleVacationMode() {
    const next = !vacationMode;
    startTransition(async () => {
      await setVacationModeAction(next);
      setVacationMode(next);
      if (next) setPausedUntil(null);
    });
  }

  const isPaused = vacationMode || Boolean(pausedUntil);

  return (
    <div className="flex flex-col gap-6">
      <Section title="Pause">
        {isPaused ? (
          <div className="rounded-xl border border-border bg-surface p-4 text-sm text-foreground">
            {vacationMode ? "Vacation mode is on — coaching is paused until you turn it off." : "Coaching is paused."}
            <button
              disabled={isPending}
              onClick={resume}
              className="mt-3 w-full rounded-xl bg-foreground px-4 py-3 text-sm font-medium text-background disabled:opacity-60"
            >
              Resume coaching now
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <PauseButton disabled={isPending} onClick={() => pause(30)}>
              30 minutes
            </PauseButton>
            <PauseButton disabled={isPending} onClick={() => pause(60)}>
              1 hour
            </PauseButton>
            <PauseButton disabled={isPending} onClick={() => pause("tomorrow")}>
              Until tomorrow
            </PauseButton>
            <PauseButton disabled={isPending} onClick={toggleVacationMode}>
              Vacation mode
            </PauseButton>
          </div>
        )}
      </Section>

      <Section title="Coaching intensity">
        <div className="flex flex-col gap-2">
          {INTENSITY_OPTIONS.map((option) => (
            <button
              type="button"
              key={option.value}
              onClick={() => setCoachingIntensity(option.value)}
              className={`rounded-xl border p-3 text-left ${
                coachingIntensity === option.value ? "border-accent bg-accent-soft" : "border-border bg-surface"
              }`}
            >
              <p className="text-sm font-medium text-foreground">{option.label}</p>
              <p className="text-xs text-muted">{option.description}</p>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Schedule">
        <Field label="Timezone">
          <p className="rounded-xl border border-border bg-surface px-3 py-3 text-sm text-muted">
            {settings.timezone} (only fully supported timezone today)
          </p>
        </Field>
        <Field label="Desired first-call time">
          <input
            type="time"
            className="input"
            value={desiredFirstCallTime}
            onChange={(e) => setDesiredFirstCallTime(e.target.value)}
          />
        </Field>
        <Field label="Default block size (calls)">
          <input
            type="number"
            min={1}
            className="input"
            value={defaultBlockSize}
            onChange={(e) => setDefaultBlockSize(Number(e.target.value))}
          />
        </Field>
      </Section>

      <Section title="Sensitivity">
        <Field label="Inactivity threshold during an active block (minutes)">
          <input
            type="number"
            min={5}
            className="input"
            value={inactivityThresholdMinutes}
            onChange={(e) => setInactivityThresholdMinutes(Number(e.target.value))}
          />
        </Field>
        <Field label="Behind-pace tolerance (%)">
          <input
            type="number"
            min={0}
            max={100}
            className="input"
            value={behindPaceTolerancePct}
            onChange={(e) => setBehindPaceTolerancePct(Number(e.target.value))}
          />
        </Field>
        <Field label="Notification cooldown (minutes)">
          <input
            type="number"
            min={5}
            className="input"
            value={notificationCooldownMinutes}
            onChange={(e) => setNotificationCooldownMinutes(Number(e.target.value))}
          />
        </Field>
        <Field label="Maximum proactive notifications per day">
          <input
            type="number"
            min={0}
            className="input"
            value={maxProactiveNotificationsPerDay}
            onChange={(e) => setMaxProactiveNotificationsPerDay(Number(e.target.value))}
          />
        </Field>
      </Section>

      {savedAt ? <p className="text-center text-sm text-muted">Saved at {savedAt}</p> : null}
      <button
        disabled={isPending}
        onClick={save}
        className="rounded-xl bg-foreground px-4 py-3 text-sm font-medium text-background disabled:opacity-60"
      >
        Save coaching settings
      </button>

      <p className="text-center text-xs text-muted">
        Desired first-call time, inactivity threshold, behind-pace tolerance, and default block size are already in
        effect. Notification limit and coaching intensity take full effect once proactive interventions ship.
      </p>
    </div>
  );
}

function PauseButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-xl border border-border bg-surface px-3 py-3 text-sm font-medium text-foreground disabled:opacity-60"
    >
      {children}
    </button>
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
