import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isOnboardingComplete } from "@/lib/data/onboarding";
import { isHighLevelConfigured } from "@/lib/env";
import { OnboardingForm } from "@/components/onboarding-form";

// See src/app/(app)/layout.tsx for why this is forced dynamic.
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await requireUser();
  const alreadyOnboarded = await isOnboardingComplete(user.id);
  if (alreadyOnboarded) {
    redirect("/today");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-8 px-6 py-10 safe-top safe-bottom">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Set up Jessica OS</h1>
        <p className="mt-1 text-muted">A few numbers so Jessica OS can show you exactly where you stand, every day.</p>
      </div>
      <OnboardingForm highLevelConnected={isHighLevelConfigured()} />
    </main>
  );
}
