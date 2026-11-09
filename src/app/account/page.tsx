"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFinance } from "@/components/finance-provider";
import { Button, Field, Notice, PageHeader, TextInput } from "@/components/ui";
import { getSupabase } from "@/lib/supabase/client";

type Mode = "sign-in" | "sign-up";

function friendlyError(message: string) {
  if (/invalid login credentials/i.test(message)) return "That email and password don't match an account.";
  if (/already registered/i.test(message)) return "There's already an account with this email. Sign in instead.";
  if (/password should be at least/i.test(message)) return "Use a password with at least 8 characters.";
  if (/email not confirmed/i.test(message)) return "Confirm your email first, using the link we sent you.";
  return message;
}

export default function AccountPage() {
  const supabase = getSupabase();
  const router = useRouter();
  const { email: signedInEmail, ready, data, signOut } = useFinance();
  const [mode, setMode] = useState<Mode>("sign-up");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  if (!supabase) {
    return (
      <>
        <PageHeader title="Account" />
        <Notice tone="ochre">
          Accounts aren&apos;t set up for this copy of the app yet, so your data stays in this browser.
          See the README for how to connect Supabase.
        </Notice>
      </>
    );
  }

  if (!ready) return null;

  if (signedInEmail) {
    return (
      <>
        <PageHeader title="Account">
          Signed in as <strong className="text-ink">{signedInEmail}</strong>. Your data is saved to
          your account and available on any device you sign in on.
        </PageHeader>
        <Button variant="secondary" onClick={() => signOut().then(() => router.push("/"))}>
          Sign out
        </Button>
      </>
    );
  }

  const hasGuestData = data.debts.length > 0 || data.incomes.length > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const credentials = { email: email.trim(), password };
    const result =
      mode === "sign-up"
        ? await supabase.auth.signUp(credentials)
        : await supabase.auth.signInWithPassword(credentials);
    setBusy(false);

    if (result.error) {
      setError(friendlyError(result.error.message));
    } else if (!result.data.session) {
      // Email confirmation is turned on for this Supabase project.
      setCheckEmail(true);
    } else {
      router.push("/");
    }
  };

  if (checkEmail) {
    return (
      <>
        <PageHeader title="Check your email">
          We sent a confirmation link to <strong className="text-ink">{email}</strong>. Open it, then
          come back and sign in.
        </PageHeader>
        <Button
          variant="secondary"
          onClick={() => {
            setCheckEmail(false);
            setMode("sign-in");
          }}
        >
          Sign in
        </Button>
      </>
    );
  }

  return (
    <>
      <PageHeader title={mode === "sign-up" ? "Create an account" : "Sign in"}>
        {mode === "sign-up"
          ? "Save your data to an account so it's safe and available on your phone and computer."
          : "Welcome back. Sign in to see your saved debts and plan."}
      </PageHeader>

      {mode === "sign-up" && hasGuestData && (
        <div className="mb-6 max-w-md">
          <Notice tone="mint">What you&apos;ve entered on this device will be moved into your new account.</Notice>
        </div>
      )}

      <form onSubmit={submit} className="flex max-w-sm flex-col gap-4">
        <Field label="Email">
          {(id) => (
            <TextInput
              id={id}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>
        <Field label="Password" hint={mode === "sign-up" ? "At least 8 characters." : undefined}>
          {(id) => (
            <TextInput
              id={id}
              type="password"
              autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
              required
              minLength={mode === "sign-up" ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>

        {error && <Notice tone="berry">{error}</Notice>}

        <Button type="submit" disabled={busy || !email || !password}>
          {busy ? "One moment…" : mode === "sign-up" ? "Create account" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-ink-muted">
        {mode === "sign-up" ? "Already have an account? " : "New here? "}
        <button
          type="button"
          className="font-semibold text-indigo underline"
          onClick={() => {
            setMode(mode === "sign-up" ? "sign-in" : "sign-up");
            setError(null);
          }}
        >
          {mode === "sign-up" ? "Sign in" : "Create an account"}
        </button>
        {" "}or <Link href="/" className="text-indigo underline">keep using it as a guest</Link>.
      </p>
    </>
  );
}
