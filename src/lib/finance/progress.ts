import { applyPayment, initialBalance, type Centavos, type Debt } from "@/lib/debt";
import type { FinanceData } from "./types";

export const newId = () => crypto.randomUUID();

/** Starting amount for progress: what was owed when tracking began. */
export const originalBalanceOf = (debt: Debt) => debt.originalBalance ?? initialBalance(debt);

/** Logs a payment and updates the debt's balance in one step. */
export function recordPayment(
  data: FinanceData,
  debtId: string,
  amount: Centavos,
  date: string,
): FinanceData {
  const debt = data.debts.find((d) => d.id === debtId);
  if (!debt || amount <= 0) return data;

  const updated = applyPayment(debt, amount);
  const paid = initialBalance(debt) - initialBalance(updated);
  if (paid <= 0) return data;

  return {
    ...data,
    debts: data.debts.map((d) => (d.id === debtId ? updated : d)),
    payments: [
      ...data.payments,
      { id: newId(), debtId, date, amount: paid, balanceAfter: initialBalance(updated) },
    ],
  };
}

export function removeDebt(data: FinanceData, debtId: string): FinanceData {
  return {
    ...data,
    debts: data.debts.filter((d) => d.id !== debtId),
    payments: data.payments.filter((p) => p.debtId !== debtId),
  };
}

export function debtProgress(debt: Debt) {
  const original = originalBalanceOf(debt);
  const remaining = initialBalance(debt);
  const paid = Math.max(0, original - remaining);
  return { original, remaining, paid, fraction: original > 0 ? paid / original : 1 };
}

export function overallProgress(debts: Debt[]) {
  const original = debts.reduce((sum, d) => sum + originalBalanceOf(d), 0);
  const remaining = debts.reduce((sum, d) => sum + initialBalance(d), 0);
  const paid = Math.max(0, original - remaining);
  return {
    original,
    remaining,
    paid,
    fraction: original > 0 ? paid / original : 0,
    debtsCleared: debts.filter((d) => initialBalance(d) === 0).length,
  };
}

export interface Milestone {
  id: string;
  label: string;
  reached: boolean;
}

export function milestones(data: FinanceData): Milestone[] {
  const { fraction, debtsCleared, original, remaining } = overallProgress(data.debts);
  const hasDebts = data.debts.length > 0;
  return [
    { id: "first-payment", label: "Logged your first payment", reached: data.payments.length > 0 },
    { id: "quarter", label: "Paid off a quarter of your debt", reached: hasDebts && fraction >= 0.25 },
    { id: "first-cleared", label: "Cleared your first debt", reached: debtsCleared > 0 },
    { id: "half", label: "Halfway there", reached: hasDebts && fraction >= 0.5 },
    { id: "three-quarters", label: "Three quarters paid", reached: hasDebts && fraction >= 0.75 },
    { id: "debt-free", label: "Debt-free", reached: hasDebts && original > 0 && remaining === 0 },
  ];
}
