import type { Centavos, Debt } from "@/lib/debt";
import type { FutureIncome } from "./future";

/** A monthly income source or expense. */
export interface LineItem {
  id: string;
  name: string;
  amount: Centavos;
}

/** A payment the user actually made, logged against one debt. */
export interface Payment {
  id: string;
  debtId: string;
  /** ISO date (yyyy-mm-dd). */
  date: string;
  amount: Centavos;
  balanceAfter: Centavos;
}

export interface FinanceData {
  incomes: LineItem[];
  /** Income expected later (bonuses, raises, 13th month pay). */
  futureIncome: FutureIncome[];
  expenses: LineItem[];
  emergencyFund: Centavos;
  emergencyFundTarget: Centavos;
  debts: Debt[];
  payments: Payment[];
}

export const emptyFinanceData: FinanceData = {
  incomes: [],
  futureIncome: [],
  expenses: [],
  emergencyFund: 0,
  emergencyFundTarget: 0,
  debts: [],
  payments: [],
};
