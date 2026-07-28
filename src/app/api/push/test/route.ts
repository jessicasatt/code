import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { isPushConfigured } from "@/lib/env";
import { sendPushToUser } from "@/lib/notifications/send";

/** "Send a test notification" (Settings). */
export async function POST() {
  const user = await requireUser();

  if (!isPushConfigured()) {
    return NextResponse.json({ error: "Push notifications are not configured yet." }, { status: 400 });
  }

  const result = await sendPushToUser(user.id, {
    title: "Jessica OS",
    body: "Test notification — if you can see this, push is working.",
    deepLink: "/today",
    category: "morning_brief",
  });

  if (result.sent === 0) {
    return NextResponse.json({ error: "No active push subscription found for this device." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, sent: result.sent });
}
