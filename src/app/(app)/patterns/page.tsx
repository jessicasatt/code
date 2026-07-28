import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth";
import { getPatternsSnapshot } from "@/lib/data/patterns";
import { CHECKIN_REASON_LABELS } from "@/lib/labels/behavioral-checkin-reasons";

export const dynamic = "force-dynamic";

export default async function PatternsPage() {
  const user = await requireUser();
  const patterns = await getPatternsSnapshot(user.id);

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 px-5 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Patterns</h1>
        <p className="mt-1 text-sm text-muted">
          Factual, observed patterns only — never a guess about how you feel. Every card shows how much data it&apos;s
          based on.
        </p>
      </div>

      {!patterns.hasAnyPattern ? (
        <section className="rounded-2xl border border-dashed border-border p-5 text-center">
          <p className="text-sm text-muted">
            We are collecting activity and check-in data. Patterns will appear after several completed call blocks.
          </p>
        </section>
      ) : (
        <div className="flex flex-col gap-3">
          {patterns.recovery ? (
            <PatternCard>
              Restarting with one call helped you resume {Math.round((patterns.recovery.pct / 100) * patterns.recovery.sampleSize)}{" "}
              of {patterns.recovery.sampleSize} interrupted blocks.
            </PatternCard>
          ) : null}

          {patterns.callsBeforeNoon ? (
            <PatternCard>
              You completed {patterns.callsBeforeNoon.pct}% of calls before noon this week, based on{" "}
              {patterns.callsBeforeNoon.sampleSize} calls.
            </PatternCard>
          ) : null}

          {patterns.blockCompletion ? (
            <PatternCard>
              You completed {patterns.blockCompletion.pct}% of the call blocks you started, based on{" "}
              {patterns.blockCompletion.sampleSize} blocks.
            </PatternCard>
          ) : null}

          {patterns.topInterruptionReason ? (
            <PatternCard>
              Your most common interruption was &ldquo;{CHECKIN_REASON_LABELS[patterns.topInterruptionReason.reason]}&rdquo; —{" "}
              {patterns.topInterruptionReason.count} of {patterns.topInterruptionReason.totalCheckins} check-ins.
            </PatternCard>
          ) : null}
        </div>
      )}
    </main>
  );
}

function PatternCard({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <p className="text-foreground">{children}</p>
    </section>
  );
}
