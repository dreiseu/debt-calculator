import { toCentavos } from "@/lib/debt";
import { monthKey } from "./future";
import type { FinanceData } from "./types";

// Future income dates stay relative to today so the demo never goes stale.
const now = new Date();
const thisDecember = `${now.getFullYear()}-12`;
const inThreeMonths = monthKey(new Date(now.getFullYear(), now.getMonth() + 3, 1));

/** Realistic demo data so the app can be explored without typing everything in. */
export const sampleFinanceData: FinanceData = {
  incomes: [
    { id: "salary", name: "Salary (net)", amount: toCentavos(38_000) },
    { id: "freelance", name: "Freelance design", amount: toCentavos(6_000) },
  ],
  futureIncome: [
    {
      id: "13th-month",
      name: "13th month pay",
      kind: "yearly",
      amount: toCentavos(38_000),
      month: thisDecember,
      shareToDebt: 0.6,
    },
    {
      id: "raise",
      name: "Expected raise",
      kind: "monthly",
      amount: toCentavos(4_000),
      month: inThreeMonths,
      shareToDebt: 1,
    },
  ],
  expenses: [
    { id: "rent", name: "Rent", amount: toCentavos(9_000) },
    { id: "food", name: "Food and groceries", amount: toCentavos(8_000) },
    { id: "bills", name: "Electricity, water, internet", amount: toCentavos(3_500) },
    { id: "transport", name: "Transportation", amount: toCentavos(3_000) },
    { id: "family", name: "Padala to family", amount: toCentavos(4_000) },
  ],
  emergencyFund: toCentavos(12_000),
  emergencyFundTarget: toCentavos(82_500),
  payments: [
    { id: "p1", debtId: "card-bpi", date: "2026-10-15", amount: toCentavos(1_500), balanceAfter: toCentavos(42_300) },
    { id: "p2", debtId: "spaylater", date: "2026-10-05", amount: toCentavos(1_200), balanceAfter: toCentavos(8_750) },
    { id: "p3", debtId: "billease", date: "2026-10-28", amount: toCentavos(2_150), balanceAfter: toCentavos(15_050) },
    { id: "p4", debtId: "gloan", date: "2026-10-20", amount: toCentavos(1_984.67), balanceAfter: toCentavos(17_862.03) },
  ],
  debts: [
    {
      id: "card-bpi",
      name: "BPI credit card",
      originalBalance: toCentavos(50_000),
      kind: "revolving",
      balance: toCentavos(42_300),
      monthlyInterestRate: 0.03,
      minPaymentRate: 0.03,
      minPaymentFloor: toCentavos(500),
      minimumDueOverride: toCentavos(1_269),
      lateFee: toCentavos(850),
      dueDay: 15,
    },
    {
      id: "spaylater",
      name: "SPayLater",
      originalBalance: toCentavos(12_000),
      kind: "revolving",
      balance: toCentavos(8_750),
      monthlyInterestRate: 0.0295,
      minPaymentRate: 0.1,
      minPaymentFloor: toCentavos(300),
      lateFee: toCentavos(250),
      dueDay: 5,
    },
    {
      id: "billease",
      name: "BillEase phone",
      originalBalance: toCentavos(25_800),
      kind: "installment",
      installmentAmount: toCentavos(2_150),
      installmentsRemaining: 7,
      lateFee: toCentavos(200),
      dueDay: 28,
    },
    {
      id: "gloan",
      name: "GLoan",
      originalBalance: toCentavos(23_816.04),
      kind: "add_on",
      principal: toCentavos(20_000),
      monthlyAddOnRate: 0.0159,
      termMonths: 12,
      monthsPaid: 3,
      lateFee: toCentavos(300),
      dueDay: 20,
    },
  ],
};
