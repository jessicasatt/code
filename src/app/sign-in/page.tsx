import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";
import { SignInForm } from "@/components/sign-in-form";

// Whether Supabase is configured can change between deployments/environments
// without any code change, and Next's build cache doesn't treat env vars as
// a cache key for unchanged pages — without this, a redeploy that only adds
// env vars can keep serving a stale prerendered "demo mode" page. See
// src/app/(app)/layout.tsx for the same issue on the authenticated routes.
export const dynamic = "force-dynamic";

export default function SignInPage() {
  const configured = isSupabaseConfigured();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 safe-top safe-bottom">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Jessica OS</h1>
        <p className="max-w-xs text-muted">Your private sales execution coach.</p>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-sm">
        {configured ? (
          <SignInForm />
        ) : (
          <div className="flex flex-col gap-4 text-center">
            <p className="text-sm text-muted">
              Supabase isn&apos;t connected yet, so Jessica OS is running in demo mode with fictional sales activity.
            </p>
            <Link
              href="/today"
              className="rounded-xl bg-foreground px-4 py-3 text-base font-medium text-background"
            >
              Continue in demo mode
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
