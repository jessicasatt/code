import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getHighLevelDiagnostics } from "@/lib/data/diagnostics";
import { formatAppTime } from "@/lib/date/timezone";

export const dynamic = "force-dynamic";

export default async function DiagnosticsPage() {
  const user = await requireUser();
  const highlevel = await getHighLevelDiagnostics(user.id);

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 px-5 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Diagnostics</h1>
        <p className="mt-1 text-sm text-muted">Technical connection detail. Not needed for day-to-day use.</p>
      </div>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <p className="text-xs uppercase tracking-wide text-muted">HighLevel connection</p>
        {!highlevel.configured ? (
          <p className="mt-2 text-sm text-foreground">Not configured. No Private Integration Token is set for this app.</p>
        ) : (
          <div className="mt-2 flex flex-col gap-2 text-sm text-foreground">
            <p>Status: {highlevel.connected ? "Connected" : "Not connected"}</p>
            <p>
              Last verified:{" "}
              {highlevel.lastVerifiedAt ? formatAppTime(new Date(highlevel.lastVerifiedAt), "MMM d, h:mm a") : "Never"}
            </p>
            {highlevel.error ? (
              <p className="rounded-lg bg-danger/10 px-3 py-2 text-danger">{highlevel.error}</p>
            ) : (
              <p className="text-muted">No errors reported.</p>
            )}
          </div>
        )}
      </section>

      <Link
        href="/settings"
        className="rounded-xl border border-border bg-surface px-4 py-3 text-center text-sm font-medium text-foreground"
      >
        Back to Settings
      </Link>
    </main>
  );
}
