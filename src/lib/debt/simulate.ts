import type { Centavos } from "./money";
import type { Debt, DebtMonth, DebtState } from "./types";
import { initialState, minimumDue, prepaymentSavingsRate, stepDebt } from "./debts";

/**
 * avalanche: extra money goes to the debt whose prepayment saves the most interest.
 * snowball:  extra money goes to the smallest balance first (quick wins).
 */
export type Strategy = "avalanche" | "snowball";

export type MonthlyBudget = Centavos | "minimum" | ((month: number) => Centavos);

export interface SimulationOptions {
  strategy: Strategy;
  /**
   * Amount available for debts each month: a fixed amount, a function of the
   * 1-based month (for income that changes over time), or "minimum" to pay
   * only minimums.
   */
  monthlyBudget: MonthlyBudget;
  /** Safety stop; a plan that hasn't finished by then is reported as never paying off. */
  maxMonths?: number;
  /**
   * Plan month in which each debt's first payment falls (default 1). Before
   * it the debt sits untouched: nothing due, no payments, no interest.
   */
  startMonths?: Record<string, number>;
}

export interface SimulatedMonth {
  /** 1-based month number from today. */
  month: number;
  debts: DebtMonth[];
  totalPayment: Centavos;
  /** Budget left over once every debt is cleared. */
  unused: Centavos;
  /** How far the budget fell short of the combined minimum due. */
  shortfall: Centavos;
}

export interface SimulationResult {
  months: SimulatedMonth[];
  /** null when debts are not cleared within maxMonths. */
  monthsToDebtFree: number | null;
  totalPaid: Centavos;
  totalInterest: Centavos;
  totalLateFees: Centavos;
  /** Month each debt reaches zero, or null if it never does. */
  payoffMonth: Record<string, number | null>;
  /** Order in which debts were fully paid off. */
  payoffOrder: string[];
}

export const DEFAULT_MAX_MONTHS = 600;

function priorityOrder(
  debts: Debt[],
  states: Map<string, DebtState>,
  strategy: Strategy,
  isActive: (d: Debt) => boolean,
): Debt[] {
  const balance = (d: Debt) => states.get(d.id)!.balance;
  return debts
    .filter((d) => balance(d) > 0 && isActive(d))
    .sort((a, b) => {
      if (strategy === "avalanche") {
        const byRate = prepaymentSavingsRate(b) - prepaymentSavingsRate(a);
        if (byRate !== 0) return byRate;
      }
      return balance(a) - balance(b);
    });
}

export function simulatePayoff(debts: Debt[], options: SimulationOptions): SimulationResult {
  const maxMonths = options.maxMonths ?? DEFAULT_MAX_MONTHS;
  const states = new Map(debts.map((d) => [d.id, initialState(d)]));
  const payoffMonth: Record<string, number | null> = {};
  const payoffOrder: string[] = [];
  const months: SimulatedMonth[] = [];
  let totalPaid = 0;
  let totalInterest = 0;
  let totalLateFees = 0;

  for (const d of debts) {
    payoffMonth[d.id] = states.get(d.id)!.balance > 0 ? null : 0;
  }

  const startOf = (d: Debt) => Math.max(1, options.startMonths?.[d.id] ?? 1);

  for (let month = 1; month <= maxMonths; month++) {
    if ([...states.values()].every((s) => s.balance <= 0)) break;

    const isActive = (d: Debt) => startOf(d) <= month;
    const isFirstMonth = (d: Debt) => startOf(d) === month;
    const order = priorityOrder(debts, states, options.strategy, isActive);
    const mins = new Map(
      order.map((d) => [d.id, minimumDue(d, states.get(d.id)!, isFirstMonth(d))]),
    );
    const totalMinimum = [...mins.values()].reduce((sum, m) => sum + m, 0);
    const budget = options.monthlyBudget;
    let available =
      budget === "minimum"
        ? totalMinimum
        : typeof budget === "function"
          ? Math.max(0, budget(month))
          : budget;
    const shortfall = Math.max(0, totalMinimum - available);

    // Minimums first (in priority order if money is short), then everything
    // left goes to the top-priority debts.
    const payments = new Map<string, Centavos>();
    for (const d of order) {
      const pay = Math.min(mins.get(d.id)!, available);
      payments.set(d.id, pay);
      available -= pay;
    }
    for (const d of order) {
      if (available <= 0) break;
      const room = states.get(d.id)!.balance - payments.get(d.id)!;
      const extra = Math.min(room, available);
      payments.set(d.id, payments.get(d.id)! + extra);
      available -= extra;
    }

    const debtMonths: DebtMonth[] = [];
    for (const d of debts) {
      const state = states.get(d.id)!;
      if (state.balance <= 0 || !isActive(d)) continue;
      const { month: result, next } = stepDebt(d, state, payments.get(d.id) ?? 0, isFirstMonth(d));
      states.set(d.id, next);
      debtMonths.push(result);
      totalPaid += result.payment;
      totalInterest += result.interest;
      totalLateFees += result.lateFee;
      if (next.balance <= 0) {
        payoffMonth[d.id] = month;
        payoffOrder.push(d.id);
      }
    }

    months.push({
      month,
      debts: debtMonths,
      totalPayment: debtMonths.reduce((sum, m) => sum + m.payment, 0),
      unused: available,
      shortfall,
    });
  }

  const allPaid = [...states.values()].every((s) => s.balance <= 0);

  return {
    months,
    monthsToDebtFree: allPaid ? months.length : null,
    totalPaid,
    totalInterest,
    totalLateFees,
    payoffMonth,
    payoffOrder,
  };
}

/** Avalanche, snowball and minimum-only plans side by side for the same budget. */
export function compareStrategies(
  debts: Debt[],
  monthlyBudget: Exclude<MonthlyBudget, "minimum">,
  startMonths?: Record<string, number>,
) {
  return {
    avalanche: simulatePayoff(debts, { strategy: "avalanche", monthlyBudget, startMonths }),
    snowball: simulatePayoff(debts, { strategy: "snowball", monthlyBudget, startMonths }),
    minimumOnly: simulatePayoff(debts, { strategy: "avalanche", monthlyBudget: "minimum", startMonths }),
  };
}
