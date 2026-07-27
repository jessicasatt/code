/**
 * Pre-deployment sanity check. Run before/after deploying (see
 * DEPLOYMENT.md). Exits non-zero only for a genuinely broken deployment
 * (Supabase misconfigured); optional integrations print a warning instead
 * of failing, since the app is meant to work without them until connected.
 */
const REQUIRED = [
  { key: "NEXT_PUBLIC_SUPABASE_URL", label: "Supabase project URL" },
  { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", label: "Supabase anon key" },
  { key: "SUPABASE_SERVICE_ROLE_KEY", label: "Supabase service role key" },
];

const OPTIONAL = [
  { key: "HIGHLEVEL_PRIVATE_INTEGRATION_TOKEN", label: "HighLevel Private Integration Token", group: "HighLevel" },
  { key: "HIGHLEVEL_LOCATION_ID", label: "HighLevel Location ID", group: "HighLevel" },
  { key: "NEXT_PUBLIC_VAPID_PUBLIC_KEY", label: "VAPID public key", group: "Web Push" },
  { key: "VAPID_PRIVATE_KEY", label: "VAPID private key", group: "Web Push" },
  { key: "VAPID_SUBJECT", label: "VAPID subject", group: "Web Push" },
  { key: "OPENAI_API_KEY", label: "OpenAI API key", group: "AI coaching (Milestone 5)" },
  { key: "CRON_SECRET", label: "Cron secret", group: "Scheduler" },
];

function check<T extends { key: string }>(entries: T[]): (T & { present: boolean })[] {
  return entries.map((e) => ({ ...e, present: Boolean(process.env[e.key]?.trim()) }));
}

function main() {
  const required = check(REQUIRED);
  const optional = check(OPTIONAL);

  console.log("Jessica OS — deployment validation\n");

  console.log("Required (real deployment):");
  for (const r of required) {
    console.log(`  [${r.present ? "x" : " "}] ${r.label} (${r.key})`);
  }

  const groups = [...new Set(optional.map((o) => o.group))];
  for (const group of groups) {
    console.log(`\n${group} (optional — app runs without it):`);
    for (const o of optional.filter((x) => x.group === group)) {
      console.log(`  [${o.present ? "x" : " "}] ${o.label} (${o.key})`);
    }
  }

  const missingRequired = required.filter((r) => !r.present);
  if (missingRequired.length > 0) {
    console.log(
      `\nMissing ${missingRequired.length} required variable(s). The app will run in demo mode until these are set — see SETUP.md Phase 1.`,
    );
    console.log("This is not a failure for a demo deployment; exiting 0. Set NEXT_PUBLIC_SUPABASE_URL etc. before going live.");
  } else {
    console.log("\nAll required variables are set.");
  }

  process.exit(0);
}

main();
