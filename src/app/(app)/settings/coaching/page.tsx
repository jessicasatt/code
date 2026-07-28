import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getCoachingSettings } from "@/lib/data/coaching-settings";
import { CoachingSettingsForm } from "@/components/settings/coaching-settings-form";

export const dynamic = "force-dynamic";

export default async function CoachingSettingsPage() {
  const user = await requireUser();
  const coachingSettings = await getCoachingSettings(user.id);

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 px-5 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Proactive coaching</h1>
        <p className="mt-1 text-sm text-muted">
          Jessica OS never tells you to finish the mountain — it assigns the next small hill. These settings control
          how and when it steps in.
        </p>
      </div>
      <CoachingSettingsForm settings={coachingSettings} />
      <Link href="/settings" className="text-center text-sm font-medium text-accent">
        Back to Settings
      </Link>
    </main>
  );
}
