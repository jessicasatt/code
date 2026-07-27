import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/data/settings";
import { isHighLevelConfigured } from "@/lib/env";
import { SettingsForm } from "@/components/settings/settings-form";

export default async function SettingsPage() {
  const user = await requireUser();
  const settings = await getSettings(user.id);

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 px-5 py-6">
      <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
      <SettingsForm
        profile={settings.profile}
        goal={settings.goal}
        highLevelConnected={isHighLevelConfigured()}
        userEmail={user.email}
      />
    </main>
  );
}
