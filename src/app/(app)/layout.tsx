import { requireUser } from "@/lib/auth";
import { BottomNav } from "@/components/bottom-nav";

// These screens read per-user auth/demo state that Next.js can't see as
// "dynamic" in demo mode (no cookies()/headers() call on that code path),
// so without this they'd be statically prerendered once at build time and
// never reflect runtime changes.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1 safe-top">{children}</div>
      <BottomNav />
    </div>
  );
}
