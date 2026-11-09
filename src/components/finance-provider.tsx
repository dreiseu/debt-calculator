"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { emptyFinanceData, type FinanceData } from "@/lib/finance/types";

/*
 * Holds the user's finances for every screen. For now it persists to this
 * browser's localStorage; the Supabase step swaps the load/save calls for
 * database reads and writes without changing the screens.
 */

const STORAGE_KEY = "utang-tracker:v1";

interface FinanceContextValue {
  data: FinanceData;
  /** False until saved data has been read, so screens don't flash empty states. */
  ready: boolean;
  update: (change: (data: FinanceData) => FinanceData) => void;
  replace: (data: FinanceData) => void;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

function load(): FinanceData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...emptyFinanceData, ...JSON.parse(saved) } : emptyFinanceData;
  } catch {
    return emptyFinanceData;
  }
}

function save(data: FinanceData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage can be unavailable (private mode, quota); the app still works for this visit.
  }
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<FinanceData>(emptyFinanceData);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setData(load());
    setReady(true);
  }, []);

  const update = useCallback((change: (data: FinanceData) => FinanceData) => {
    setData((current) => {
      const next = change(current);
      save(next);
      return next;
    });
  }, []);

  const replace = useCallback((next: FinanceData) => update(() => next), [update]);

  return (
    <FinanceContext.Provider value={{ data, ready, update, replace }}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) throw new Error("useFinance must be used inside FinanceProvider");
  return context;
}
