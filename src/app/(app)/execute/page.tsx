import { requireUser } from "@/lib/auth";
import { getExecuteSnapshot } from "@/lib/data/execute";
import { isSupabaseConfigured } from "@/lib/env";
import { ExecuteView } from "@/components/execute/execute-view";

export const dynamic = "force-dynamic";

export default async function ExecutePage() {
  const user = await requireUser();
  const snapshot = await getExecuteSnapshot(user.id);
  const supabaseEnabled = isSupabaseConfigured();

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 px-5 py-6">
      {!supabaseEnabled ? (
        <p className="rounded-lg bg-accent-soft px-3 py-2 text-center text-xs font-medium text-foreground">
          Demo mode — fictional data
        </p>
      ) : null}
      <ExecuteView snapshot={snapshot} userId={user.id} supabaseEnabled={supabaseEnabled} />
    </main>
  );
}
