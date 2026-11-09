import type { Centavos } from "./money";
import type { AddOnDebt, Debt, DebtMonth, DebtState } from "./types";

/** Monthly amortization of an add-on loan, in centavos. */
export function addOnMonthlyPayment(debt: AddOnDebt): Centavos {
  return (
    Math.round(debt.principal / debt.termMonths) +
    Math.round(debt.principal * debt.monthlyAddOnRate)
  );
}

/** Fixed amount owed per month for installment-style debts. */
function installmentAmount(debt: Debt): Centavos {
  switch (debt.kind) {
    case "installment":
      return debt.installmentAmount;
    case "add_on":
      return addOnMonthlyPayment(debt);
    case "revolving":
      throw new Error("Revolving debts have no fixed installment");
  }
}

/** Total currently owed on a debt before any new payment. */
export function initialBalance(debt: Debt): Centavos {
  switch (debt.kind) {
    case "revolving":
      return debt.balance;
    case "installment":
      return Math.max(
        0,
        debt.installmentAmount * debt.installmentsRemaining - (debt.paidAhead ?? 0),
      );
    case "add_on":
      return Math.max(
        0,
        addOnMonthlyPayment(debt) * Math.max(0, debt.termMonths - debt.monthsPaid) -
          (debt.paidAhead ?? 0),
      );
  }
}

export function initialState(debt: Debt): DebtState {
  const credit = debt.kind === "revolving" ? 0 : (debt.paidAhead ?? 0);
  return { balance: initialBalance(debt), pastDue: -credit };
}

/**
 * Records a real payment against a debt and returns the updated debt.
 * Installment-style debts count off whole installments and keep any
 * remainder as `paidAhead` toward the next one.
 */
export function applyPayment(debt: Debt, amount: Centavos): Debt {
  const paid = Math.min(Math.max(0, amount), initialBalance(debt));

  if (debt.kind === "revolving") {
    return { ...debt, balance: debt.balance - paid, minimumDueOverride: undefined };
  }

  const perMonth = installmentAmount(debt);
  const credit = (debt.paidAhead ?? 0) + paid;
  const wholeInstallments = Math.floor(credit / perMonth);
  const paidAhead = credit - wholeInstallments * perMonth;

  if (debt.kind === "installment") {
    const remaining = Math.max(0, debt.installmentsRemaining - wholeInstallments);
    return { ...debt, installmentsRemaining: remaining, paidAhead: remaining ? paidAhead : 0 };
  }
  const monthsPaid = Math.min(debt.termMonths, debt.monthsPaid + wholeInstallments);
  return { ...debt, monthsPaid, paidAhead: monthsPaid < debt.termMonths ? paidAhead : 0 };
}

/**
 * Minimum due for the coming month. Revolving debts use the statement value
 * on the first month if the user entered one, otherwise the bank-style
 * estimate. Any unpaid amount from the previous month is added on top.
 */
export function minimumDue(debt: Debt, state: DebtState, isFirstMonth: boolean): Centavos {
  if (state.balance <= 0) return 0;

  if (debt.kind === "revolving") {
    if (isFirstMonth && debt.minimumDueOverride !== undefined) {
      return Math.min(debt.minimumDueOverride, state.balance);
    }
    const estimate = Math.max(
      Math.round(state.balance * debt.minPaymentRate),
      debt.minPaymentFloor,
    );
    return Math.min(estimate + state.pastDue, state.balance);
  }

  return Math.max(0, Math.min(installmentAmount(debt) + state.pastDue, state.balance));
}

/**
 * Rate used to rank debts for the avalanche strategy: how much interest an
 * extra peso of payment saves per month.
 *
 * Fixed-installment and add-on loans rank at 0 because PH lending apps
 * generally don't rebate interest on early payment — paying them ahead clears
 * them sooner but doesn't shrink the total owed.
 */
export function prepaymentSavingsRate(debt: Debt): number {
  return debt.kind === "revolving" ? debt.monthlyInterestRate : 0;
}

/**
 * Advances one debt by one month: applies the payment, a late fee if the
 * minimum wasn't met, then interest on what remains (revolving only).
 */
export function stepDebt(
  debt: Debt,
  state: DebtState,
  payment: Centavos,
  isFirstMonth: boolean,
): { month: DebtMonth; next: DebtState } {
  const minDue = minimumDue(debt, state, isFirstMonth);
  const paid = Math.min(Math.max(0, payment), state.balance);
  const remaining = state.balance - paid;
  const shortfall = Math.max(0, minDue - paid);
  const lateFee = shortfall > 0 ? debt.lateFee : 0;
  const interest =
    debt.kind === "revolving" ? Math.round(remaining * debt.monthlyInterestRate) : 0;
  const endBalance = remaining + interest + lateFee;

  return {
    month: {
      debtId: debt.id,
      startBalance: state.balance,
      minimumDue: minDue,
      payment: paid,
      interest,
      lateFee,
      endBalance,
    },
    next: {
      balance: endBalance,
      pastDue: shortfall > 0 ? Math.min(shortfall + lateFee, endBalance) : 0,
    },
  };
}

/** "If I pay this amount now, what's left next month?" */
export function projectNextMonth(debt: Debt, payment: Centavos): DebtMonth {
  return stepDebt(debt, initialState(debt), payment, true).month;
}

/**
 * True monthly interest rate of an add-on loan — the rate at which the fixed
 * amortization repays the principal. A 3% add-on rate over 6 months is about
 * 4.9% per month in effective terms, which is what the user is really paying.
 */
export function addOnEffectiveMonthlyRate(
  monthlyAddOnRate: number,
  termMonths: number,
): number {
  if (monthlyAddOnRate <= 0 || termMonths <= 0) return 0;

  const payment = 1 / termMonths + monthlyAddOnRate; // per ₱1 of principal
  const presentValue = (rate: number) =>
    (payment * (1 - Math.pow(1 + rate, -termMonths))) / rate;

  // presentValue decreases as rate increases; bisect until it equals 1.
  let low = 1e-9;
  let high = 1;
  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    if (presentValue(mid) > 1) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}
