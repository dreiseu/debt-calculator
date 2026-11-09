"use client";

import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useFinance } from "./finance-provider";
import { Notice } from "./ui";

const statusText = { saved: "Saved", saving: "Saving…", error: "Couldn't save, retrying" };

/** Guest prompt or signed-in email with save status. */
export function AccountStatus({ compact = false }: { compact?: boolean }) {
  const { email, saveStatus, ready } = useFinance();
  if (!isSupabaseConfigured || !ready) return null;

  if (!email) {
    return (
      <Link href="/account" className="text-sm font-semibold text-indigo">
        {compact ? "Sign in" : "Sign in to save across devices"}
      </Link>
    );
  }

  return (
    <Link href="/account" className="block text-xs text-ink-muted hover:text-ink">
      {!compact && <span className="block truncate font-medium text-ink">{email}</span>}
      <span role="status" className={saveStatus === "error" ? "text-berry" : undefined}>
        {statusText[saveStatus]}
      </span>
    </Link>
  );
}

export function LoadError() {
  const { loadError } = useFinance();
  if (!loadError) return null;
  return (
    <div className="mb-6">
      <Notice tone="berry">{loadError}</Notice>
    </div>
  );
}
