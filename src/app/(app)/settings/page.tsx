import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/data/settings";
import { getNotificationPreferences, getPushSubscriptionCount } from "@/lib/data/notification-preferences";
import { isHighLevelConfigured, isPushConfigured } from "@/lib/env";
import { SettingsForm } from "@/components/settings/settings-form";

export default async function SettingsPage() {
  const user = await requireUser();
  const [settings, notificationPreferences, pushSubscriptionCount] = await Promise.all([
    getSettings(user.id),
    getNotificationPreferences(user.id),
    getPushSubscriptionCount(user.id),
  ]);

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 px-5 py-6">
      <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
      <SettingsForm
        profile={settings.profile}
        goal={settings.goal}
        highLevelConnected={isHighLevelConfigured()}
        pushConfigured={isPushConfigured()}
        notificationPreferences={notificationPreferences}
        hasPushSubscription={pushSubscriptionCount > 0}
        userEmail={user.email}
      />
      <Link href="/settings/diagnostics" className="text-center text-sm font-medium text-accent">
        Connection diagnostics
      </Link>
    </main>
  );
}
