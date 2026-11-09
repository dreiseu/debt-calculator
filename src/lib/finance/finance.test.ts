import { describe, expect, it } from "vitest";
import { initialBalance, toCentavos } from "@/lib/debt";
import { milestones, overallProgress, recordPayment, removeDebt } from "./progress";
import { sampleFinanceData } from "./sample";
import { addMonths, nextDueDate, summarize, upcomingDueDates } from "./summary";

describe("summarize", () => {
  it("works out what's left for debt after expenses", () => {
    const s = summarize(sampleFinanceData);
    expect(s.totalIncome).toBe(toCentavos(44_000));
    expect(s.totalExpenses).toBe(toCentavos(27_500));
    expect(s.availableForDebt).toBe(toCentavos(16_500));
    expect(s.canCoverMinimums).toBe(true);
  });
});

describe("dates", () => {
  it("rolls a passed due day into next month", () => {
    expect(nextDueDate(5, new Date(2026, 10, 9))).toEqual(new Date(2026, 11, 5));
    expect(nextDueDate(15, new Date(2026, 10, 9))).toEqual(new Date(2026, 10, 15));
  });

  it("clamps the 31st to the end of short months", () => {
    expect(nextDueDate(31, new Date(2027, 1, 2))).toEqual(new Date(2027, 1, 28));
    expect(addMonths(new Date(2027, 0, 31), 1)).toEqual(new Date(2027, 1, 28));
  });

  it("sorts upcoming dues soonest first", () => {
    const due = upcomingDueDates(sampleFinanceData.debts, new Date(2026, 10, 9));
    expect(due.map((d) => d.debt.id)).toEqual(["card-bpi", "gloan", "billease", "spaylater"]);
    expect(due[0].daysLeft).toBe(6);
  });
});

describe("payments and progress", () => {
  const data = { ...sampleFinanceData, payments: [] };

  it("logs a payment and lowers the debt's balance", () => {
    const next = recordPayment(data, "spaylater", toCentavos(1_000), "2026-11-09");
    const debt = next.debts.find((d) => d.id === "spaylater")!;
    expect(initialBalance(debt)).toBe(toCentavos(7_750));
    expect(next.payments).toEqual([
      expect.objectContaining({ amount: toCentavos(1_000), balanceAfter: toCentavos(7_750) }),
    ]);
  });

  it("caps a payment at the balance and ignores payments on cleared debts", () => {
    const cleared = recordPayment(data, "spaylater", toCentavos(50_000), "2026-11-09");
    expect(cleared.payments[0].amount).toBe(toCentavos(8_750));
    expect(recordPayment(cleared, "spaylater", toCentavos(100), "2026-11-10")).toBe(cleared);
  });

  it("measures progress against the original balance", () => {
    const debts = data.debts.map((d) => ({ ...d, originalBalance: initialBalance(d) }));
    const next = recordPayment({ ...data, debts }, "spaylater", toCentavos(8_750), "2026-11-09");
    const progress = overallProgress(next.debts);
    expect(progress.paid).toBe(toCentavos(8_750));
    expect(progress.debtsCleared).toBe(1);
    const reached = milestones(next).filter((m) => m.reached).map((m) => m.id);
    expect(reached).toEqual(["first-payment", "first-cleared"]);
  });

  it("removes a debt with its payments", () => {
    const next = removeDebt(recordPayment(data, "gloan", toCentavos(500), "2026-11-09"), "gloan");
    expect(next.debts.some((d) => d.id === "gloan")).toBe(false);
    expect(next.payments).toHaveLength(0);
  });
});
