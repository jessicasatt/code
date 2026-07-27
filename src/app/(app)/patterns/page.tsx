import { requireUser } from "@/lib/auth";
import { getTodaySnapshot } from "@/lib/data/today";

export default async function PatternsPage() {
  const user = await requireUser();
  const snapshot = await getTodaySnapshot(user.id);

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 px-5 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Patterns</h1>
        <p className="mt-1 text-sm text-muted">
          Factual, observed patterns only — never a guess about how you feel. Behavioral check-ins build up here over
          time.
        </p>
      </div>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <p className="text-xs uppercase tracking-wide text-muted">Calculated metric</p>
        <p className="mt-2 text-foreground">
          {snapshot.callsToday} of your {snapshot.dailyCallTarget} daily target calls are logged so far today.
        </p>
      </section>

      <section className="rounded-2xl border border-dashed border-border p-5 text-center">
        <p className="text-sm text-muted">
          Deeper patterns (best call windows, niche performance, check-in trends) unlock once daily metrics and
          behavioral check-in history build up — see Milestone 4 in IMPLEMENTATION_PLAN.md.
        </p>
      </section>
    </main>
  );
}
