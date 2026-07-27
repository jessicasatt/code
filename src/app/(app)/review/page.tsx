import { requireUser } from "@/lib/auth";
import { getTodaySnapshot } from "@/lib/data/today";
import { formatCentsAsUsd } from "@/lib/domain/money";

export default async function ReviewPage() {
  const user = await requireUser();
  const snapshot = await getTodaySnapshot(user.id);
  const targetCompletionPct = snapshot.dailyCallTarget
    ? Math.round((snapshot.callsToday / snapshot.dailyCallTarget) * 100)
    : 0;

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 px-5 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Today&apos;s review</h1>
        <p className="mt-1 text-sm text-muted">Recorded facts and calculated metrics — nothing inferred.</p>
      </div>

      <section className="grid grid-cols-2 gap-3">
        <ReviewStat label="Calls completed" value={snapshot.callsToday} />
        <ReviewStat label="Target completion" value={`${targetCompletionPct}%`} />
        <ReviewStat label="Human answers" value={snapshot.humanAnswers ?? "—"} />
        <ReviewStat label="Meaningful conversations" value={snapshot.meaningfulConversations} />
        <ReviewStat label="Appointments booked" value={snapshot.appointmentsBooked} />
        <ReviewStat label="Follow-ups due" value={snapshot.followUpsDue} />
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <p className="text-xs uppercase tracking-wide text-muted">Revenue</p>
        <p className="mt-2 text-foreground">
          {formatCentsAsUsd(snapshot.remainingMrrCents)} remaining to reach{" "}
          {formatCentsAsUsd(snapshot.goal.monthlyRevenueGoalCents)}.
        </p>
      </section>

      <section className="rounded-2xl border border-dashed border-border p-5 text-center">
        <p className="text-sm text-muted">
          Longest inactivity gap, weekly review, and daily metrics history land in Milestone 4 once daily_metrics
          rollups are wired to real HighLevel activity.
        </p>
      </section>
    </main>
  );
}

function ReviewStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
