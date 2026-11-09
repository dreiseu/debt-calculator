import type { Debt } from "@/lib/debt";
import type { FutureIncome } from "@/lib/finance/future";
import type { FinanceData, LineItem, Payment } from "@/lib/finance/types";

/*
 * Conversion between the app's FinanceData and database rows. Rows omit
 * user_id: the database fills it from the signed-in user.
 */

export interface ProfileRow {
  emergency_fund: number;
  emergency_fund_target: number;
}

export interface BudgetItemRow {
  id: string;
  type: "income" | "expense";
  name: string;
  amount: number;
  position: number;
}

export interface FutureIncomeRow {
  id: string;
  name: string;
  kind: FutureIncome["kind"];
  amount: number;
  month: string;
  end_month: string | null;
  share_to_debt: number;
  position: number;
}

export interface DebtRow {
  id: string;
  name: string;
  kind: Debt["kind"];
  due_day: number | null;
  late_fee: number;
  original_balance: number | null;
  position: number;
  balance: number | null;
  monthly_interest_rate: number | null;
  min_payment_rate: number | null;
  min_payment_floor: number | null;
  minimum_due_override: number | null;
  installment_amount: number | null;
  installments_remaining: number | null;
  principal: number | null;
  monthly_add_on_rate: number | null;
  term_months: number | null;
  months_paid: number | null;
  paid_ahead: number | null;
}

export interface PaymentRow {
  id: string;
  debt_id: string;
  paid_on: string;
  amount: number;
  balance_after: number;
}

export interface Rows {
  profile: ProfileRow;
  budget_items: BudgetItemRow[];
  future_incomes: FutureIncomeRow[];
  debts: DebtRow[];
  payments: PaymentRow[];
}

export type RowTable = Exclude<keyof Rows, "profile">;

const emptyDebtColumns = {
  balance: null,
  monthly_interest_rate: null,
  min_payment_rate: null,
  min_payment_floor: null,
  minimum_due_override: null,
  installment_amount: null,
  installments_remaining: null,
  principal: null,
  monthly_add_on_rate: null,
  term_months: null,
  months_paid: null,
  paid_ahead: null,
};

export function debtToRow(debt: Debt, position: number): DebtRow {
  const common = {
    id: debt.id,
    name: debt.name,
    kind: debt.kind,
    due_day: debt.dueDay ?? null,
    late_fee: debt.lateFee,
    original_balance: debt.originalBalance ?? null,
    position,
    ...emptyDebtColumns,
  };
  switch (debt.kind) {
    case "revolving":
      return {
        ...common,
        balance: debt.balance,
        monthly_interest_rate: debt.monthlyInterestRate,
        min_payment_rate: debt.minPaymentRate,
        min_payment_floor: debt.minPaymentFloor,
        minimum_due_override: debt.minimumDueOverride ?? null,
      };
    case "installment":
      return {
        ...common,
        installment_amount: debt.installmentAmount,
        installments_remaining: debt.installmentsRemaining,
        paid_ahead: debt.paidAhead ?? null,
      };
    case "add_on":
      return {
        ...common,
        principal: debt.principal,
        monthly_add_on_rate: debt.monthlyAddOnRate,
        term_months: debt.termMonths,
        months_paid: debt.monthsPaid,
        paid_ahead: debt.paidAhead ?? null,
      };
  }
}

const optional = <T>(value: T | null) => (value === null ? undefined : value);

export function rowToDebt(row: DebtRow): Debt {
  const common = {
    id: row.id,
    name: row.name,
    dueDay: optional(row.due_day),
    lateFee: row.late_fee,
    originalBalance: optional(row.original_balance),
  };
  switch (row.kind) {
    case "revolving":
      return {
        ...common,
        kind: "revolving",
        balance: row.balance!,
        monthlyInterestRate: row.monthly_interest_rate!,
        minPaymentRate: row.min_payment_rate!,
        minPaymentFloor: row.min_payment_floor!,
        minimumDueOverride: optional(row.minimum_due_override),
      };
    case "installment":
      return {
        ...common,
        kind: "installment",
        installmentAmount: row.installment_amount!,
        installmentsRemaining: row.installments_remaining!,
        paidAhead: optional(row.paid_ahead),
      };
    case "add_on":
      return {
        ...common,
        kind: "add_on",
        principal: row.principal!,
        monthlyAddOnRate: row.monthly_add_on_rate!,
        termMonths: row.term_months!,
        monthsPaid: row.months_paid!,
        paidAhead: optional(row.paid_ahead),
      };
  }
}

const itemToRow =
  (type: BudgetItemRow["type"]) =>
  (item: LineItem, position: number): BudgetItemRow => ({
    id: item.id,
    type,
    name: item.name,
    amount: item.amount,
    position,
  });

const rowToItem = (row: BudgetItemRow): LineItem => ({ id: row.id, name: row.name, amount: row.amount });

const futureToRow = (income: FutureIncome, position: number): FutureIncomeRow => ({
  id: income.id,
  name: income.name,
  kind: income.kind,
  amount: income.amount,
  month: income.month,
  end_month: income.endMonth ?? null,
  share_to_debt: income.shareToDebt,
  position,
});

const rowToFuture = (row: FutureIncomeRow): FutureIncome => ({
  id: row.id,
  name: row.name,
  kind: row.kind,
  amount: row.amount,
  month: row.month,
  endMonth: optional(row.end_month),
  shareToDebt: row.share_to_debt,
});

const paymentToRow = (p: Payment): PaymentRow => ({
  id: p.id,
  debt_id: p.debtId,
  paid_on: p.date,
  amount: p.amount,
  balance_after: p.balanceAfter,
});

const rowToPayment = (row: PaymentRow): Payment => ({
  id: row.id,
  debtId: row.debt_id,
  date: row.paid_on,
  amount: row.amount,
  balanceAfter: row.balance_after,
});

export function toRows(data: FinanceData): Rows {
  return {
    profile: {
      emergency_fund: data.emergencyFund,
      emergency_fund_target: data.emergencyFundTarget,
    },
    budget_items: [...data.incomes.map(itemToRow("income")), ...data.expenses.map(itemToRow("expense"))],
    future_incomes: data.futureIncome.map(futureToRow),
    debts: data.debts.map(debtToRow),
    payments: data.payments.map(paymentToRow),
  };
}

const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;

export function fromRows(rows: Rows): FinanceData {
  const items = [...rows.budget_items].sort(byPosition);
  return {
    incomes: items.filter((r) => r.type === "income").map(rowToItem),
    expenses: items.filter((r) => r.type === "expense").map(rowToItem),
    futureIncome: [...rows.future_incomes].sort(byPosition).map(rowToFuture),
    emergencyFund: rows.profile.emergency_fund,
    emergencyFundTarget: rows.profile.emergency_fund_target,
    debts: [...rows.debts].sort(byPosition).map(rowToDebt),
    payments: rows.payments.map(rowToPayment),
  };
}

export const emptyRows: Rows = toRows({
  incomes: [],
  expenses: [],
  futureIncome: [],
  emergencyFund: 0,
  emergencyFundTarget: 0,
  debts: [],
  payments: [],
});

export interface RowChanges {
  profile: ProfileRow | null;
  upserts: Partial<Record<RowTable, Rows[RowTable]>>;
  deletes: Partial<Record<RowTable, string[]>>;
}

const tables: RowTable[] = ["budget_items", "future_incomes", "debts", "payments"];

/** Rows that were added or changed, and ids that were removed, between two snapshots. */
export function diffRows(prev: Rows, next: Rows): RowChanges {
  const changes: RowChanges = {
    profile: JSON.stringify(prev.profile) === JSON.stringify(next.profile) ? null : next.profile,
    upserts: {},
    deletes: {},
  };
  for (const table of tables) {
    const before = new Map<string, string>(
      (prev[table] as { id: string }[]).map((r) => [r.id, JSON.stringify(r)]),
    );
    const after = next[table] as { id: string }[];
    const changed = after.filter((r) => before.get(r.id) !== JSON.stringify(r));
    const nextIds = new Set(after.map((r) => r.id));
    const removed = [...before.keys()].filter((id) => !nextIds.has(id));
    if (changed.length) changes.upserts[table] = changed as Rows[RowTable];
    if (removed.length) changes.deletes[table] = removed;
  }
  return changes;
}

export const hasChanges = (c: RowChanges) =>
  c.profile !== null || Object.keys(c.upserts).length > 0 || Object.keys(c.deletes).length > 0;
