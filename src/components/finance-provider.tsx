"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { withFreshIds } from "@/lib/finance/progress";
import { emptyFinanceData, type FinanceData } from "@/lib/finance/types";
import { getSupabase } from "@/lib/supabase/client";
import { diffRows, emptyRows, fromRows, hasChanges, toRows, type Rows } from "@/lib/supabase/rows";
import { loadRows, pushChanges } from "@/lib/supabase/sync";

/*
 * Holds the user's finances for every screen.
 *
 * Guests: data lives in this browser's localStorage.
 * Signed in: data loads from Supabase, and edits are saved shortly after the
 * user stops typing. Only rows that changed since the last save are sent.
 * Signing up into an empty account brings the guest data along.
 */

const STORAGE_KEY = "utang-tracker:v1";
const SAVE_DELAY_MS = 800;
const RETRY_DELAY_MS = 5_000;

export type SaveStatus = "saved" | "saving" | "error";

interface FinanceContextValue {
  data: FinanceData;
  /** False until data has loaded, so screens don't flash empty states. */
  ready: boolean;
  update: (change: (data: FinanceData) => FinanceData) => void;
  replace: (data: FinanceData) => void;
  /** Signed-in user's email, or null for guests. */
  email: string | null;
  saveStatus: SaveStatus;
  /** Message to show when loading the account failed. */
  loadError: string | null;
  signOut: () => Promise<void>;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

function loadLocal(): FinanceData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...emptyFinanceData, ...JSON.parse(saved) } : emptyFinanceData;
  } catch {
    return emptyFinanceData;
  }
}

function saveLocal(data: FinanceData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage can be unavailable (private mode, quota); the app still works for this visit.
  }
}

function clearLocal() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}

const isEmpty = (data: FinanceData) =>
  data.debts.length === 0 &&
  data.incomes.length === 0 &&
  data.expenses.length === 0 &&
  data.futureIncome.length === 0;

interface Account {
  id: string;
  email: string | null;
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const supabase = getSupabase();
  const [data, setData] = useState<FinanceData>(emptyFinanceData);
  const [ready, setReady] = useState(false);
  // undefined = still checking for a session; null = guest.
  const [account, setAccount] = useState<Account | null | undefined>(supabase ? undefined : null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [loadError, setLoadError] = useState<string | null>(null);

  const accountRef = useRef<Account | null>(null);
  const latest = useRef<FinanceData>(emptyFinanceData);
  const synced = useRef<Rows>(emptyRows);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef<Promise<void> | null>(null);

  // Track who is signed in. The callback only stores the user; loading happens
  // in the effect below (Supabase advises against awaiting inside it).
  useEffect(() => {
    if (!supabase) return;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      setAccount((current) => {
        const next = user ? { id: user.id, email: user.email ?? null } : null;
        return current?.id === next?.id && current !== undefined ? current : next;
      });
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  const save = useCallback(async (): Promise<void> => {
    const user = accountRef.current;
    if (!supabase || !user) return;
    if (saving.current) {
      await saving.current;
      return save();
    }
    const next = toRows(latest.current);
    const changes = diffRows(synced.current, next);
    if (!hasChanges(changes)) {
      setSaveStatus("saved");
      return;
    }
    setSaveStatus("saving");
    saving.current = pushChanges(supabase, user.id, changes)
      .then(() => {
        synced.current = next;
        // More edits may have arrived while this save was in flight.
        const pending = hasChanges(diffRows(next, toRows(latest.current)));
        setSaveStatus(pending ? "saving" : "saved");
        if (pending) schedule(0);
      })
      .catch((error) => {
        console.error("Saving to Supabase failed", error);
        setSaveStatus("error");
        schedule(RETRY_DELAY_MS);
      })
      .finally(() => {
        saving.current = null;
      });
    return saving.current;
    // schedule is stable (defined below with useCallback and no deps)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const schedule = useCallback(
    (delay: number) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        void save();
      }, delay);
    },
    [save],
  );

  // Load data whenever the signed-in user changes.
  useEffect(() => {
    if (account === undefined) return;
    let cancelled = false;
    accountRef.current = account;
    setLoadError(null);

    if (account === null) {
      const local = loadLocal();
      latest.current = local;
      synced.current = emptyRows;
      setData(local);
      setSaveStatus("saved");
      setReady(true);
      return;
    }

    // Until the account loads, assume nothing is saved: a later save can then
    // only add rows, never delete ones it hasn't seen.
    synced.current = emptyRows;
    setReady(false);
    (async () => {
      try {
        const rows = await loadRows(supabase!);
        if (cancelled) return;
        const remote = fromRows(rows);
        const guest = loadLocal();
        synced.current = rows;

        if (isEmpty(remote) && !isEmpty(guest)) {
          // First sign-in: bring what they entered as a guest into the account.
          const imported = withFreshIds(guest);
          latest.current = imported;
          setData(imported);
          setReady(true);
          await save();
          // Keep the browser copy until the upload has actually succeeded.
          if (!hasChanges(diffRows(synced.current, toRows(imported)))) clearLocal();
        } else {
          latest.current = remote;
          setData(remote);
          setReady(true);
        }
      } catch (error) {
        if (cancelled) return;
        console.error("Loading from Supabase failed", error);
        setLoadError("Your data couldn't be loaded. Check your connection and refresh the page.");
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [account, supabase, save]);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    const onLeave = (event: BeforeUnloadEvent) => {
      if (accountRef.current && (timer.current || saving.current)) event.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, []);

  const update = useCallback(
    (change: (data: FinanceData) => FinanceData) => {
      const next = change(latest.current);
      latest.current = next;
      setData(next);
      if (accountRef.current) {
        setSaveStatus("saving");
        schedule(SAVE_DELAY_MS);
      } else {
        saveLocal(next);
      }
    },
    [schedule],
  );

  const replace = useCallback(
    (next: FinanceData) => update(() => (accountRef.current ? withFreshIds(next) : next)),
    [update],
  );

  const signOut = useCallback(async () => {
    if (!supabase) return;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    await save();
    await supabase.auth.signOut();
  }, [supabase, save]);

  return (
    <FinanceContext.Provider
      value={{
        data,
        ready,
        update,
        replace,
        email: account?.email ?? null,
        saveStatus,
        loadError,
        signOut,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) throw new Error("useFinance must be used inside FinanceProvider");
  return context;
}
