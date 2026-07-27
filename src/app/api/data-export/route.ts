import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDemoState } from "@/lib/demo/store";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const EXPORTABLE_TABLES = [
  "profiles",
  "goals",
  "highlevel_connections",
  "contacts",
  "opportunities",
  "appointments",
  "follow_ups",
  "work_blocks",
  "call_events",
  "behavioral_checkins",
  "notification_preferences",
  "notification_deliveries",
] as const;

/** "Export my data" (SPEC.md Settings). Everything this user owns, as one JSON file. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let data: Record<string, unknown>;

  if (!isSupabaseConfigured()) {
    data = { mode: "demo", ...getDemoState() };
  } else {
    const supabase = await createServerSupabaseClient();
    const entries = await Promise.all(
      EXPORTABLE_TABLES.map(async (table) => {
        const { data: rows } = await supabase.from(table).select("*").eq("user_id", user.id);
        return [table, rows ?? []] as const;
      }),
    );
    data = { mode: "live", tables: Object.fromEntries(entries) };
  }

  return NextResponse.json(
    { exportedAt: new Date().toISOString(), userId: user.id, ...data },
    {
      headers: {
        "Content-Disposition": `attachment; filename="jessica-os-export-${user.id}.json"`,
      },
    },
  );
}
