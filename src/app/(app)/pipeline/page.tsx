import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getHighLevelProvider } from "@/lib/highlevel";
import { formatCentsAsUsd } from "@/lib/domain/money";
import { formatAppTime } from "@/lib/date/timezone";
import type { Appointment, Contact, Opportunity } from "@/lib/domain/types";

function NotConnected({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-4 text-center">
      <p className="text-sm text-muted">{message}</p>
      <Link href="/settings/diagnostics" className="mt-2 inline-block text-sm font-medium text-accent">
        Review HighLevel connection
      </Link>
    </div>
  );
}

async function settleOrNull<T>(promise: Promise<T>, label: string): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    console.error(`Pipeline: ${label} unavailable`, error);
    return null;
  }
}

export default async function PipelinePage() {
  await requireUser();
  const provider = getHighLevelProvider();

  const [opportunities, appointments, contacts] = await Promise.all([
    settleOrNull<Opportunity[]>(provider.getOpportunities(), "opportunities"),
    settleOrNull<Appointment[]>(provider.getAppointments(), "appointments"),
    settleOrNull<Contact[]>(provider.getContacts(), "contacts"),
  ]);

  const contactById = new Map((contacts ?? []).map((c) => [c.id, c]));

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 px-5 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Pipeline</h1>
        <p className="mt-1 text-sm text-muted">A summary from HighLevel — not a replacement for the full CRM.</p>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted">Open opportunities</h2>
        <div className="flex flex-col gap-2">
          {opportunities === null ? (
            <NotConnected message="Pipeline data is not connected yet." />
          ) : opportunities.length === 0 ? (
            <p className="text-sm text-muted">No open opportunities yet.</p>
          ) : (
            opportunities.map((opp) => (
              <div key={opp.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-foreground">{contactById.get(opp.contactId ?? "")?.businessName ?? "Unknown"}</p>
                  <p className="text-sm text-muted">{formatCentsAsUsd(opp.monthlyRecurringValueCents)}/mo</p>
                </div>
                <p className="mt-1 text-sm text-muted">{opp.stage}</p>
              </div>
            ))
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted">Upcoming appointments</h2>
        <div className="flex flex-col gap-2">
          {appointments === null ? (
            <NotConnected message="Appointment data is not connected yet." />
          ) : appointments.length === 0 ? (
            <p className="text-sm text-muted">Nothing scheduled.</p>
          ) : (
            appointments.map((appt) => (
              <div key={appt.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-foreground">{contactById.get(appt.contactId ?? "")?.businessName ?? "Unknown"}</p>
                  <p className="text-sm text-muted">{formatAppTime(new Date(appt.startTime), "MMM d, h:mm a")}</p>
                </div>
                <p className="mt-1 text-sm text-muted capitalize">{appt.status}</p>
              </div>
            ))
          )}
        </div>
      </section>

      {contacts === null ? <NotConnected message="Contact data is not connected yet." /> : null}
    </main>
  );
}
