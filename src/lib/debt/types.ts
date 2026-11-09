import type { Centavos } from "./money";

interface DebtBase {
  id: string;
  name: string;
  /** Day of the month the payment is due (1–31). Used for reminders. */
  dueDay?: number;
  /** Charged once for every month the minimum due isn't fully paid. */
  lateFee: Centavos;
  /** Amount owed when the user started tracking; used for progress. */
  originalBalance?: Centavos;
  /** Date the first payment is due (yyyy-mm-dd). Nothing is due before it. */
  firstPaymentDate?: string;
}

/**
 * Credit cards and credit lines (e.g. GGives/SPayLater limits): interest is
 * charged monthly on whatever balance is left after the payment.
 */
export interface RevolvingDebt extends DebtBase {
  kind: "revolving";
  balance: Centavos;
  /** 0.03 = 3% per month (the BSP cap for credit cards). */
  monthlyInterestRate: number;
  /** Estimated minimum due = max(balance × minPaymentRate, minPaymentFloor). */
  minPaymentRate: number;
  minPaymentFloor: Centavos;
  /** Minimum due printed on the current statement; overrides the estimate for month 1. */
  minimumDueOverride?: Centavos;
}

/**
 * Lending apps with a fixed amount per month (BillEase, SLoan, GLoan…).
 * Interest is already baked into the installment.
 */
export interface InstallmentDebt extends DebtBase {
  kind: "installment";
  installmentAmount: Centavos;
  installmentsRemaining: number;
  /**
   * Total number of installments. With firstPaymentDate set, installments
   * whose due date has passed are counted as paid automatically.
   */
  totalInstallments?: number;
  /** Paid toward the next installment but not yet a full installment. */
  paidAhead?: Centavos;
}

/**
 * Loans quoted as a flat "add-on" rate per month on the original principal.
 * Monthly amortization = principal / term + principal × rate.
 */
export interface AddOnDebt extends DebtBase {
  kind: "add_on";
  principal: Centavos;
  /** 0.03 = 3% of the original principal per month. */
  monthlyAddOnRate: number;
  termMonths: number;
  monthsPaid: number;
  /** Paid toward the next amortization but not yet a full one. */
  paidAhead?: Centavos;
}

export type Debt = RevolvingDebt | InstallmentDebt | AddOnDebt;

/** Mutable per-debt state the simulator carries from month to month. */
export interface DebtState {
  balance: Centavos;
  /**
   * Unpaid minimum (plus late fee) rolled into next month's minimum due.
   * Negative when the user has already paid part of the coming installment.
   */
  pastDue: Centavos;
}

export interface DebtMonth {
  debtId: string;
  startBalance: Centavos;
  minimumDue: Centavos;
  payment: Centavos;
  interest: Centavos;
  lateFee: Centavos;
  endBalance: Centavos;
}
