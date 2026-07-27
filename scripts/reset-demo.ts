/**
 * Removes exactly the rows seed-demo.ts created (identified by their
 * "demo-" id prefixes / "demo" tag) and re-seeds fresh copies. Never
 * touches real production rows.
 *
 * Usage: npm run reset:demo
 */
import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: demoContacts } = await supabase.from("contacts").select("id").contains("tags", ["demo"]);
  const demoContactIds = (demoContacts ?? []).map((c) => c.id);

  if (demoContactIds.length > 0) {
    await supabase.from("follow_ups").delete().in("contact_id", demoContactIds);
  }
  await supabase.from("call_events").delete().like("external_id", "demo-%");
  await supabase.from("appointments").delete().like("highlevel_appointment_id", "demo-%");
  await supabase.from("opportunities").delete().like("highlevel_opportunity_id", "demo-%");
  await supabase.from("contacts").delete().contains("tags", ["demo"]);

  console.log("Cleared previous demo rows.");
  console.log("Re-seeding...");

  await import("./seed-demo");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
