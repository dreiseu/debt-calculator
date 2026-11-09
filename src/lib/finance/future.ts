import type { Centavos } from "@/lib/debt";

/**
 * Income the user expects later: a bonus in one month, a raise from a month
 * on, or something every year like 13th month pay in December.
 */
export type FutureIncomeKind = "one_time" | "monthly" | "yearly";

export interface FutureIncome {
  id: string;
  name: string;
  kind: FutureIncomeKind;
  amount: Centavos;
  /** First (or only) month it arrives, "yyyy-mm". */
  month: string;
  /** Last month for "monthly" income, inclusive. Open-ended when missing. */
  endMonth?: string;
  /** Fraction of it that goes toward debt (1 = all of it). */
  shareToDebt: number;
}

export const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

/**
 * Calendar month for a plan month. Month 1 is the current month — the
 * payment due now — so a 6-month plan finishes 5 months from today.
 */
export const planMonthDate = (month: number, today: Date = new Date()) =>
  new Date(today.getFullYear(), today.getMonth() + month - 1, 1);

function arrivesIn(income: FutureIncome, key: string) {
  if (key < income.month) return false;
  switch (income.kind) {
    case "one_time":
      return key === income.month;
    case "monthly":
      return !income.endMonth || key <= income.endMonth;
    case "yearly":
      return key.slice(5) === income.month.slice(5);
  }
}

/** Extra money for debt in a calendar month ("yyyy-mm"). */
export function futureIncomeIn(items: FutureIncome[], key: string): Centavos {
  return items
    .filter((income) => arrivesIn(income, key))
    .reduce((sum, income) => sum + Math.round(income.amount * income.shareToDebt), 0);
}

/** Month-by-month debt budget: the regular amount plus future income that month. */
export function budgetWithFutureIncome(
  base: Centavos,
  items: FutureIncome[],
  today: Date = new Date(),
): (month: number) => Centavos {
  return (month) => base + futureIncomeIn(items, monthKey(planMonthDate(month, today)));
}
