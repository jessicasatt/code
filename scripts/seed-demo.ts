/**
 * Seeds fictional demo businesses and activity into a connected Supabase
 * project, using the same fixtures that power local demo mode
 * (src/lib/demo/fixtures.ts) so the two never drift apart. Every row is
 * tagged so `reset-demo.ts` can remove exactly these rows and nothing else
 * — demo data is never mixed with real production records.
 *
 * Usage: npm run seed:demo
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set,
 * and at least one auth user to already exist (sign in once first).
 */
import { createClient } from "@supabase/supabase-js";
import {
  createDemoAppointments,
  createDemoCallEvents,
  createDemoContacts,
  createDemoFollowUps,
  createDemoGoal,
  createDemoOpportunities,
  createDemoProfile,
} from "../src/lib/demo/fixtures";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const {
    data: { users },
    error: usersError,
  } = await supabase.auth.admin.listUsers();
  if (usersError) throw usersError;
  const user = users[0];
  if (!user) {
    console.error("No signed-up user found yet. Sign in to Jessica OS once first, then re-run this script.");
    process.exit(1);
  }

  const now = new Date();
  const contacts = createDemoContacts().map((c) => ({ ...c, userId: user.id }));
  const opportunities = createDemoOpportunities(contacts).map((o) => ({ ...o, userId: user.id }));
  const appointments = createDemoAppointments(contacts, now).map((a) => ({ ...a, userId: user.id }));
  const callEvents = createDemoCallEvents(contacts, now).map((c) => ({ ...c, userId: user.id }));
  const followUps = createDemoFollowUps(contacts, now).map((f) => ({ ...f, userId: user.id }));
  const profile = { ...createDemoProfile(now), userId: user.id };
  const goal = { ...createDemoGoal(now), userId: user.id };

  await supabase.from("profiles").upsert({
    user_id: profile.userId,
    name: profile.name,
    morning_brief_time: profile.morningBriefTime,
    end_of_day_summary_time: profile.endOfDaySummaryTime,
    calling_hours_start: profile.callingHoursStart,
    calling_hours_end: profile.callingHoursEnd,
    quiet_hours_start: profile.quietHoursStart,
    quiet_hours_end: profile.quietHoursEnd,
    workdays: profile.workdays,
    onboarding_completed_at: profile.onboardingCompletedAt,
  });

  await supabase.from("goals").upsert({
    user_id: goal.userId,
    monthly_revenue_goal_cents: goal.monthlyRevenueGoalCents,
    current_mrr_cents: goal.currentMrrCents,
    average_client_value_cents: goal.averageClientValueCents,
    daily_call_target: goal.dailyCallTarget,
    weekly_call_target: goal.weeklyCallTarget,
  });

  for (const c of contacts) {
    await supabase.from("contacts").upsert(
      {
        user_id: c.userId,
        highlevel_contact_id: c.highlevelContactId,
        business_name: c.businessName,
        contact_name: c.contactName,
        niche: c.niche,
        tags: c.tags,
        timezone: c.timezone,
      },
      { onConflict: "user_id,highlevel_contact_id" },
    );
  }
  const { data: insertedContacts } = await supabase
    .from("contacts")
    .select("id, highlevel_contact_id")
    .eq("user_id", user.id);
  const contactIdByHighLevelId = new Map((insertedContacts ?? []).map((c) => [c.highlevel_contact_id, c.id]));

  for (const o of opportunities) {
    const sourceContact = contacts.find((c) => c.id === o.contactId);
    await supabase.from("opportunities").upsert(
      {
        user_id: o.userId,
        highlevel_opportunity_id: o.highlevelOpportunityId,
        contact_id: sourceContact ? contactIdByHighLevelId.get(sourceContact.highlevelContactId) : null,
        pipeline: o.pipeline,
        stage: o.stage,
        status: o.status,
        monetary_value_cents: o.monetaryValueCents,
        monthly_recurring_value_cents: o.monthlyRecurringValueCents,
      },
      { onConflict: "user_id,highlevel_opportunity_id" },
    );
  }

  for (const a of appointments) {
    const sourceContact = contacts.find((c) => c.id === a.contactId);
    await supabase.from("appointments").upsert(
      {
        user_id: a.userId,
        highlevel_appointment_id: a.highlevelAppointmentId,
        contact_id: sourceContact ? contactIdByHighLevelId.get(sourceContact.highlevelContactId) : null,
        start_time: a.startTime,
        status: a.status,
        show_status: a.showStatus,
        outcome: a.outcome,
      },
      { onConflict: "user_id,highlevel_appointment_id" },
    );
  }

  for (const c of callEvents) {
    const sourceContact = contacts.find((sc) => sc.id === c.contactId);
    await supabase.from("call_events").upsert(
      {
        user_id: c.userId,
        external_id: c.externalId,
        contact_id: sourceContact ? contactIdByHighLevelId.get(sourceContact.highlevelContactId) : null,
        direction: c.direction,
        start_time: c.startTime,
        end_time: c.endTime,
        duration_seconds: c.durationSeconds,
        provider_status: c.providerStatus,
        answered_status: c.answeredStatus,
        voicemail_status: c.voicemailStatus,
        meaningful_conversation: c.meaningfulConversation,
        appointment_result: c.appointmentResult,
      },
      { onConflict: "user_id,external_id" },
    );
  }

  for (const f of followUps) {
    const sourceContact = contacts.find((c) => c.id === f.contactId);
    await supabase.from("follow_ups").insert({
      user_id: f.userId,
      contact_id: sourceContact ? contactIdByHighLevelId.get(sourceContact.highlevelContactId) : null,
      due_at: f.dueAt,
      status: f.status,
      notes: f.notes,
    });
  }

  console.log(`Seeded demo data for user ${user.id} (${user.email ?? "no email"}).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
