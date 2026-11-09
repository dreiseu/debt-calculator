import { describe, expect, it } from "vitest";
import { toCentavos } from "./money";
import { compareStrategies, simulatePayoff } from "./simulate";
import type { InstallmentDebt, RevolvingDebt } from "./types";

function card(id: string, balance: number, monthlyRate: number): RevolvingDebt {
  return {
    id,
    name: id,
    kind: "revolving",
    balance: toCentavos(balance),
    monthlyInterestRate: monthlyRate,
    minPaymentRate: 0.03,
    minPaymentFloor: toCentavos(500),
    lateFee: toCentavos(850),
  };
}

const installment: InstallmentDebt = {
  id: "billease",
  name: "BillEase",
  kind: "installment",
  installmentAmount: toCentavos(1_500),
  installmentsRemaining: 4,
  lateFee: toCentavos(200),
};

describe("simulatePayoff", () => {
  it("matches a hand-calculated schedule", () => {
    // Month 1: 1,000 − 600 = 400, +2% = 408. Month 2: pay 408.
    const result = simulatePayoff([card("a", 1_000, 0.02)], {
      strategy: "avalanche",
      monthlyBudget: toCentavos(600),
    });
    expect(result.monthsToDebtFree).toBe(2);
    expect(result.totalInterest).toBe(toCentavos(8));
    expect(result.totalPaid).toBe(toCentavos(1_008));
    expect(result.months[1].unused).toBe(toCentavos(192));
  });

  it("pays a fixed installment off in exactly its remaining months", () => {
    const result = simulatePayoff([installment], {
      strategy: "avalanche",
      monthlyBudget: toCentavos(1_500),
    });
    expect(result.monthsToDebtFree).toBe(4);
    expect(result.totalInterest).toBe(0);
    expect(result.totalLateFees).toBe(0);
  });

  it("avalanche targets the highest interest rate first", () => {
    const debts = [card("small-cheap", 5_000, 0.01), card("big-expensive", 20_000, 0.03)];
    const result = simulatePayoff(debts, { strategy: "avalanche", monthlyBudget: toCentavos(5_000) });
    expect(result.payoffOrder[0]).toBe("big-expensive");
  });

  it("snowball targets the smallest balance first", () => {
    const debts = [card("small-cheap", 5_000, 0.01), card("big-expensive", 20_000, 0.03)];
    const result = simulatePayoff(debts, { strategy: "snowball", monthlyBudget: toCentavos(5_000) });
    expect(result.payoffOrder[0]).toBe("small-cheap");
  });

  it("avalanche never costs more interest than snowball", () => {
    const debts = [card("a", 5_000, 0.01), card("b", 20_000, 0.03), installment];
    const { avalanche, snowball, minimumOnly } = compareStrategies(debts, toCentavos(6_000));
    expect(avalanche.totalInterest).toBeLessThanOrEqual(snowball.totalInterest);
    expect(avalanche.monthsToDebtFree).not.toBeNull();
    expect(minimumOnly.totalInterest).toBeGreaterThan(avalanche.totalInterest);
  });

  it("rolls leftover money to the next debt in the same month", () => {
    const debts = [card("a", 500, 0.03), card("b", 10_000, 0.03)];
    const result = simulatePayoff(debts, { strategy: "snowball", monthlyBudget: toCentavos(3_000) });
    const [a, b] = result.months[0].debts;
    expect(a.payment).toBe(toCentavos(500));
    expect(b.payment).toBe(toCentavos(2_500));
    expect(result.payoffMonth.a).toBe(1);
  });

  it("never applies the budget to more than what is owed", () => {
    const result = simulatePayoff([card("a", 1_000, 0.03)], {
      strategy: "avalanche",
      monthlyBudget: toCentavos(5_000),
    });
    expect(result.totalPaid).toBe(toCentavos(1_000));
    expect(result.months[0].unused).toBe(toCentavos(4_000));
  });

  it("reports a shortfall and late fees when the budget misses the minimums", () => {
    const result = simulatePayoff([card("a", 10_000, 0.03)], {
      strategy: "avalanche",
      monthlyBudget: toCentavos(200),
      maxMonths: 24,
    });
    expect(result.months[0].shortfall).toBe(toCentavos(300));
    expect(result.totalLateFees).toBeGreaterThan(0);
    expect(result.monthsToDebtFree).toBeNull();
    expect(result.payoffMonth.a).toBeNull();
  });

  it("paying only minimums eventually clears a card thanks to the floor", () => {
    const result = simulatePayoff([card("a", 10_000, 0.03)], {
      strategy: "avalanche",
      monthlyBudget: "minimum",
    });
    expect(result.monthsToDebtFree).not.toBeNull();
    expect(result.totalLateFees).toBe(0);
  });

  it("handles an empty debt list", () => {
    const result = simulatePayoff([], { strategy: "avalanche", monthlyBudget: toCentavos(1_000) });
    expect(result.monthsToDebtFree).toBe(0);
    expect(result.months).toHaveLength(0);
  });

  it("accepts a budget that changes month to month", () => {
    // ₱600 a month, plus a ₱5,000 bonus in month 2 clears the rest early
    const debts = [card("a", 10_000, 0.03)];
    const steady = simulatePayoff(debts, { strategy: "avalanche", monthlyBudget: toCentavos(600) });
    const withBonus = simulatePayoff(debts, {
      strategy: "avalanche",
      monthlyBudget: (month) => toCentavos(month === 2 ? 5_600 : 600),
    });
    expect(withBonus.months[1].totalPayment).toBe(toCentavos(5_600));
    expect(withBonus.monthsToDebtFree!).toBeLessThan(steady.monthsToDebtFree!);
    expect(withBonus.totalInterest).toBeLessThan(steady.totalInterest);
  });

  it("leaves a debt untouched until its start month", () => {
    const later = { ...card("later", 10_000, 0.03) };
    const result = simulatePayoff([later, installment], {
      strategy: "avalanche",
      monthlyBudget: toCentavos(3_000),
      startMonths: { later: 3 },
    });
    expect(result.months[0].debts.map((d) => d.debtId)).toEqual(["billease"]);
    expect(result.months[1].debts.map((d) => d.debtId)).toEqual(["billease"]);
    // No interest accrues before it starts
    expect(result.months[2].debts.find((d) => d.debtId === "later")!.startBalance).toBe(toCentavos(10_000));
    expect(result.totalLateFees).toBe(0);
    expect(result.monthsToDebtFree).not.toBeNull();
  });

  it("keeps counting months while only a not-yet-started debt is left", () => {
    const result = simulatePayoff([card("later", 1_000, 0.03)], {
      strategy: "avalanche",
      monthlyBudget: toCentavos(5_000),
      startMonths: { later: 4 },
    });
    expect(result.monthsToDebtFree).toBe(4);
    expect(result.payoffMonth.later).toBe(4);
    expect(result.months[0].debts).toHaveLength(0);
  });
});
