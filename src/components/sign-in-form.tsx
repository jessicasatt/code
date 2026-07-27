"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      setStatus("sent");
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong sending the link.");
    }
  }

  if (status === "sent") {
    return (
      <p className="text-center text-foreground">
        Check <span className="font-medium">{email}</span> for a sign-in link.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm text-muted">
        Email address
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-xl border border-border bg-surface px-4 py-3 text-base text-foreground outline-none focus:border-accent"
          placeholder="you@example.com"
          autoComplete="email"
        />
      </label>
      <button
        type="submit"
        disabled={status === "sending"}
        className="rounded-xl bg-foreground px-4 py-3 text-base font-medium text-background transition-opacity disabled:opacity-60"
      >
        {status === "sending" ? "Sending link…" : "Send sign-in link"}
      </button>
      {status === "error" && errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}
    </form>
  );
}
