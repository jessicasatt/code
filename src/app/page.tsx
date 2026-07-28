import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isOnboardingComplete } from "@/lib/data/onboarding";

// See src/app/(app)/layout.tsx for why this is forced dynamic.
export const dynamic = "force-dynamic";

export default async function RootPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }
  const onboarded = await isOnboardingComplete(user.id);
  redirect(onboarded ? "/execute" : "/onboarding");
}
