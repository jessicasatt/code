import { requireUser } from "@/lib/auth";
import { getReviewSnapshot } from "@/lib/data/review";
import { formatCentsAsUsd } from "@/lib/domain/money";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const user = await requireUser();
  const review = await getReviewSnapshot(user.id);
  const targetCompletionPct = review.dailyCallTarget ? Math.round((review.callsToday / review.dailyCallTarget) * 100) : 0;

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 px-5 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Today&apos;s review</h1>
        <p className="mt-1 text-sm text-muted">Recorded facts and calculated metrics — nothing inferred.</p>
      </div>

      <section className="grid grid-cols-2 gap-3">
        <ReviewStat label="Calls completed" value={review.callsToday} />
        <ReviewStat label="Target completion" value={`${targetCompletionPct}%`} />
        <ReviewStat label="Blocks started" value={review.blocksStartedToday} />
        <ReviewStat label="Blocks completed" value={review.blocksCompletedToday} />
        <ReviewStat label="Human answers" value={review.humanAnswers ?? "—"} />
        <ReviewStat label="Meaningful conversations" value={review.meaningfulConversations} />
        <ReviewStat label="Appointments booked" value={review.appointmentsBooked} />
        <ReviewStat label="Follow-ups due" value={review.followUpsDue} />
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <p className="text-xs uppercase tracking-wide text-muted">Revenue</p>
        <p className="mt-2 text-foreground">
          {formatCentsAsUsd(review.remainingMrrCents)} remaining to reach {formatCentsAsUsd(review.monthlyRevenueGoalCents)}.
        </p>
      </section>

      {review.factualObservation || review.nextExperiment ? (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Today, in one line</p>
          {review.factualObservation ? <p className="mt-2 text-foreground">{review.factualObservation}</p> : null}
          {review.nextExperiment ? <p className="mt-1 text-muted">{review.nextExperiment}</p> : null}
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-border p-5 text-center">
          <p className="text-sm text-muted">
            Weekly review and restart-behavior history will appear here as more call blocks are completed.
          </p>
        </section>
      )}
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
