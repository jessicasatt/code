export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center safe-top safe-bottom">
      <h1 className="text-2xl font-semibold text-foreground">You&apos;re offline</h1>
      <p className="max-w-sm text-muted">
        Jessica OS needs a connection to show current activity and revenue progress. Reconnect and reopen the app.
      </p>
    </main>
  );
}
