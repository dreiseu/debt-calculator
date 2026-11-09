import { initialBalance, initialState, minimumDue, type Debt } from "@/lib/debt";
import type { FinanceData, LineItem } from "./types";

const sum = (items: LineItem[]) => items.reduce((total, item) => total + item.amount, 0);

export function summarize(data: FinanceData) {
  const totalIncome = sum(data.incomes);
  const totalExpenses = sum(data.expenses);
  const availableForDebt = totalIncome - totalExpenses;
  const totalDebt = data.debts.reduce((total, d) => total + initialBalance(d), 0);
  const totalMinimumDue = data.debts.reduce(
    (total, d) => total + minimumDue(d, initialState(d), true),
    0,
  );

  return {
    totalIncome,
    totalExpenses,
    availableForDebt,
    totalDebt,
    totalMinimumDue,
    canCoverMinimums: availableForDebt >= totalMinimumDue,
    /** How many months of expenses the emergency fund would cover. */
    emergencyFundMonths: totalExpenses > 0 ? data.emergencyFund / totalExpenses : null,
  };
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(date.getDate(), lastDay));
  return result;
}

export const formatMonthYear = (date: Date) =>
  date.toLocaleDateString("en-PH", { month: "long", year: "numeric" });

/** Next due date for a day-of-month, clamped to short months (31 → Feb 28). */
export function nextDueDate(dueDay: number, today: Date): Date {
  const clamp = (year: number, month: number) => {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(dueDay, lastDay));
  };
  const thisMonth = clamp(today.getFullYear(), today.getMonth());
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return thisMonth >= startOfToday ? thisMonth : clamp(today.getFullYear(), today.getMonth() + 1);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Debts with a due day, soonest first. */
export function upcomingDueDates(debts: Debt[], today: Date) {
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return debts
    .filter((d) => d.dueDay !== undefined && initialBalance(d) > 0)
    .map((debt) => {
      const date = nextDueDate(debt.dueDay!, today);
      return {
        debt,
        date,
        daysLeft: Math.round((date.getTime() - startOfToday.getTime()) / DAY_MS),
        minimumDue: minimumDue(debt, initialState(debt), true),
      };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

/** 1 → "1st", 22 → "22nd", 13 → "13th". */
export function ordinal(n: number) {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  const suffixes: Record<number, string> = { 1: "st", 2: "nd", 3: "rd" };
  return `${n}${suffixes[n % 10] ?? "th"}`;
}
