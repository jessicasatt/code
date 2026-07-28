import { requireUser } from "@/lib/auth";
import { getExecuteSnapshot } from "@/lib/data/execute";

export default async function PatternsPage() {
  const user = await requireUser();
  const snapshot = await getExecuteSnapshot(user.id);

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
          We are collecting activity and check-in data. Patterns will appear after several completed call blocks.
        </p>
      </section>
    </main>
  );
}
