"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { StorageNotice, useAccount } from "./account";

function safeNext(fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const next = new URLSearchParams(window.location.search).get("next");
  // Only same-site paths, so the sign-in page cannot be used as an open redirect.
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter();
  const { refresh } = useAccount();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
        name: form.get("name"),
      }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const data = (await res?.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Something went wrong. Try again.");
      return;
    }
    await refresh();
    router.push(mode === "signup" ? "/onboarding" : safeNext("/account"));
    router.refresh();
  }

  const signup = mode === "signup";
  return (
    <div className="mx-auto max-w-md px-4 pb-16 pt-12 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {signup ? "Create your Interlock account" : "Sign in to Interlock"}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {signup
          ? "Your account keeps your privacy choices and, only if you ask it to, your incident reports in one place."
          : "Welcome back."}
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-card border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        {signup && (
          <label className="block">
            <span className="text-sm font-medium">Your name</span>
            <input name="name" autoComplete="name" className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2" />
          </label>
        )}
        <label className="block">
          <span className="text-sm font-medium">Email</span>
          <input name="email" type="email" required autoComplete="email" className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Password</span>
          <input
            name="password"
            type="password"
            required
            minLength={signup ? 10 : undefined}
            autoComplete={signup ? "new-password" : "current-password"}
            className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2"
          />
          {signup && <span className="mt-1 block text-xs text-muted">At least 10 characters. Do not reuse a real password for this prototype.</span>}
        </label>

        {error && (
          <p role="alert" className="text-sm" style={{ color: "var(--tier-critical)" }}>
            {error}
          </p>
        )}

        <button type="submit" disabled={busy} className="w-full rounded-md bg-brand px-3 py-2.5 font-medium text-white disabled:opacity-50">
          {busy ? "One moment…" : signup ? "Create account" : "Sign in"}
        </button>

        <p className="text-center text-sm text-muted">
          {signup ? (
            <>Already have an account? <Link href="/signin" className="text-brand underline">Sign in</Link></>
          ) : (
            <>New here? <Link href="/signup" className="text-brand underline">Create an account</Link></>
          )}
        </p>
      </form>

      <div className="mt-4">
        <StorageNotice />
      </div>
      <p className="mt-4 text-xs leading-snug text-faint">
        Creating an account turns nothing on. Every kind of analysis starts switched off until you
        choose it. Read the <Link href="/privacy" className="underline">privacy notice</Link>.
      </p>
    </div>
  );
}
