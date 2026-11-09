import { describe, expect, it } from "vitest";
import {
  addOnEffectiveMonthlyRate,
  addOnMonthlyPayment,
  applyPayment,
  initialBalance,
  initialState,
  minimumDue,
  projectNextMonth,
  stepDebt,
} from "./debts";
import { formatPeso, toCentavos } from "./money";
import type { AddOnDebt, InstallmentDebt, RevolvingDebt } from "./types";

const card: RevolvingDebt = {
  id: "card",
  name: "BPI Card",
  kind: "revolving",
  balance: toCentavos(10_000),
  monthlyInterestRate: 0.03,
  minPaymentRate: 0.03,
  minPaymentFloor: toCentavos(500),
  lateFee: toCentavos(850),
};

const installment: InstallmentDebt = {
  id: "billease",
  name: "BillEase",
  kind: "installment",
  installmentAmount: toCentavos(1_500),
  installmentsRemaining: 4,
  lateFee: toCentavos(200),
};

const addOn: AddOnDebt = {
  id: "loan",
  name: "Cash loan",
  kind: "add_on",
  principal: toCentavos(10_000),
  monthlyAddOnRate: 0.03,
  termMonths: 6,
  monthsPaid: 2,
  lateFee: toCentavos(300),
};

describe("money", () => {
  it("formats centavos as pesos", () => {
    expect(formatPeso(toCentavos(1234.5))).toBe("₱1,234.50");
  });
});

describe("minimumDue", () => {
  it("uses the floor when the percentage is smaller", () => {
    expect(minimumDue(card, { balance: card.balance, pastDue: 0 }, false)).toBe(
      toCentavos(500),
    );
  });

  it("uses the percentage when it exceeds the floor", () => {
    expect(minimumDue(card, { balance: toCentavos(50_000), pastDue: 0 }, false)).toBe(
      toCentavos(1_500),
    );
  });

  it("uses the statement override only in the first month", () => {
    const withStatement = { ...card, minimumDueOverride: toCentavos(700) };
    const state = { balance: card.balance, pastDue: 0 };
    expect(minimumDue(withStatement, state, true)).toBe(toCentavos(700));
    expect(minimumDue(withStatement, state, false)).toBe(toCentavos(500));
  });

  it("never exceeds the remaining balance", () => {
    expect(minimumDue(card, { balance: toCentavos(200), pastDue: 0 }, false)).toBe(
      toCentavos(200),
    );
  });

  it("adds past-due amounts on top of the regular minimum", () => {
    expect(
      minimumDue(installment, { balance: toCentavos(6_000), pastDue: toCentavos(1_700) }, false),
    ).toBe(toCentavos(3_200));
  });
});

describe("revolving debt", () => {
  it("charges interest on what remains after the payment", () => {
    const month = projectNextMonth(card, toCentavos(2_000));
    expect(month.interest).toBe(toCentavos(240));
    expect(month.lateFee).toBe(0);
    expect(month.endBalance).toBe(toCentavos(8_240));
  });

  it("adds a late fee and carries the missed minimum when underpaid", () => {
    const { month, next } = stepDebt(card, { balance: card.balance, pastDue: 0 }, 0, true);
    expect(month.lateFee).toBe(toCentavos(850));
    expect(month.endBalance).toBe(toCentavos(11_150));
    expect(next.pastDue).toBe(toCentavos(1_350));
    // 3% of 11,150 = 334.50 < 500 floor, plus 1,350 past due
    expect(minimumDue(card, next, false)).toBe(toCentavos(1_850));
  });
});

describe("installment debt", () => {
  it("totals the remaining installments with no extra interest", () => {
    expect(initialBalance(installment)).toBe(toCentavos(6_000));
    const month = projectNextMonth(installment, toCentavos(1_500));
    expect(month.interest).toBe(0);
    expect(month.endBalance).toBe(toCentavos(4_500));
  });
});

describe("add-on loan", () => {
  it("computes amortization as principal/term + principal × rate", () => {
    // 10,000 / 6 = 1,666.67 + 300 = 1,966.67
    expect(addOnMonthlyPayment(addOn)).toBe(toCentavos(1_966.67));
    expect(initialBalance(addOn)).toBe(toCentavos(1_966.67) * 4);
  });

  it("reveals the effective monthly rate behind the flat add-on rate", () => {
    const rate = addOnEffectiveMonthlyRate(0.03, 6);
    const payment = 1 / 6 + 0.03;
    const presentValue = (payment * (1 - Math.pow(1 + rate, -6))) / rate;
    expect(presentValue).toBeCloseTo(1, 9);
    // ≈ 4.94% per month — far more than the advertised 3%
    expect(rate).toBeGreaterThan(0.049);
    expect(rate).toBeLessThan(0.05);
  });

  it("returns 0 for interest-free loans", () => {
    expect(addOnEffectiveMonthlyRate(0, 6)).toBe(0);
  });
});

describe("applyPayment", () => {
  it("reduces a card balance and drops the old statement minimum", () => {
    const paid = applyPayment({ ...card, minimumDueOverride: toCentavos(700) }, toCentavos(3_000));
    expect(initialBalance(paid)).toBe(toCentavos(7_000));
    expect(paid.kind === "revolving" && paid.minimumDueOverride).toBeFalsy();
  });

  it("counts off whole installments and keeps the remainder as credit", () => {
    const paid = applyPayment(installment, toCentavos(2_000));
    expect(paid).toMatchObject({ installmentsRemaining: 3, paidAhead: toCentavos(500) });
    expect(initialBalance(paid)).toBe(toCentavos(4_000));
    // Only 1,000 more is needed to cover next month's installment
    expect(minimumDue(paid, initialState(paid), true)).toBe(toCentavos(1_000));
  });

  it("advances months paid on add-on loans", () => {
    const paid = applyPayment(addOn, toCentavos(1_966.67) * 2);
    expect(paid).toMatchObject({ monthsPaid: 4, paidAhead: 0 });
  });

  it("never pays more than what is owed", () => {
    const paid = applyPayment(installment, toCentavos(99_999));
    expect(initialBalance(paid)).toBe(0);
    expect(paid).toMatchObject({ installmentsRemaining: 0, paidAhead: 0 });
  });
});
