import type { Debt } from "@/lib/debt";
import type { FinanceData } from "./types";

/** Local date from "yyyy-mm-dd" (not UTC, so it doesn't shift a day in Manila). */
export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** "2027-01-15" → "Jan 15, 2027". */
export const formatIsoDate = (iso: string) =>
  parseIsoDate(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/**
 * Plan month of a debt's first payment: 1 when it's due this month or has
 * already started, 3 when it's two calendar months away, and so on.
 */
export function startMonthOf(debt: Debt, today: Date = new Date()): number {
  if (!debt.firstPaymentDate) return 1;
  const first = parseIsoDate(debt.firstPaymentDate);
  const months = (first.getFullYear() - today.getFullYear()) * 12 + first.getMonth() - today.getMonth();
  return Math.max(1, months + 1);
}

/** Start months for debts that begin after this month, for simulatePayoff. */
export function startMonthsFor(debts: Debt[], today: Date = new Date()): Record<string, number> {
  return Object.fromEntries(
    debts.map((d) => [d.id, startMonthOf(d, today)] as const).filter(([, month]) => month > 1),
  );
}

/** True when the first payment falls in a later month than today's. */
export const startsLater = (debt: Debt, today: Date = new Date()) => startMonthOf(debt, today) > 1;

/** How many monthly due dates, counting from the first payment, have arrived by today. */
export function paymentsDueSoFar(firstPaymentDate: string, today: Date = new Date()): number {
  const first = parseIsoDate(firstPaymentDate);
  const now = startOfDay(today);
  if (now < first) return 0;
  const monthsSince = (now.getFullYear() - first.getFullYear()) * 12 + now.getMonth() - first.getMonth();
  const lastDayThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dueDayThisMonth = Math.min(first.getDate(), lastDayThisMonth);
  return monthsSince + (now.getDate() >= dueDayThisMonth ? 1 : 0);
}

/**
 * Counts installments whose due date has passed as paid. Uses whichever is
 * further along, the stored count or the calendar, so logging a payment early
 * and then reaching its due date never counts it twice.
 */
export function catchUpDebt(debt: Debt, today: Date = new Date()): Debt {
  if (!debt.firstPaymentDate) return debt;
  const due = paymentsDueSoFar(debt.firstPaymentDate, today);

  if (debt.kind === "installment" && debt.totalInstallments) {
    const left = Math.max(0, debt.totalInstallments - due);
    return left < debt.installmentsRemaining
      ? { ...debt, installmentsRemaining: left, paidAhead: 0 }
      : debt;
  }
  if (debt.kind === "add_on") {
    const paid = Math.min(debt.termMonths, due);
    return paid > debt.monthsPaid ? { ...debt, monthsPaid: paid, paidAhead: 0 } : debt;
  }
  return debt;
}

/** Applies catchUpDebt to every debt; returns the same object when nothing changed. */
export function catchUpScheduledPayments(data: FinanceData, today: Date = new Date()): FinanceData {
  const debts = data.debts.map((d) => catchUpDebt(d, today));
  return debts.some((d, i) => d !== data.debts[i]) ? { ...data, debts } : data;
}
