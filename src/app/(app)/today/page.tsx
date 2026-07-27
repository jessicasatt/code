import { requireUser } from "@/lib/auth";
import { getTodaySnapshot } from "@/lib/data/today";
import { isSupabaseConfigured } from "@/lib/env";
import { TodayView } from "@/components/today/today-view";

export default async function TodayPage() {
  const user = await requireUser();
  const snapshot = await getTodaySnapshot(user.id);

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 px-5 py-6">
      {!isSupabaseConfigured() ? (
        <p className="rounded-lg bg-accent-soft px-3 py-2 text-center text-xs font-medium text-foreground">
          Demo mode — fictional data
        </p>
      ) : null}
      <TodayView snapshot={snapshot} />
    </main>
  );
}
