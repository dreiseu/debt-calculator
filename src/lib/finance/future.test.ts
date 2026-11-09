import { describe, expect, it } from "vitest";
import { toCentavos } from "@/lib/debt";
import { budgetWithFutureIncome, futureIncomeIn, planMonthDate, type FutureIncome } from "./future";

const bonus: FutureIncome = {
  id: "bonus", name: "Bonus", kind: "one_time", amount: toCentavos(10_000), month: "2027-03", shareToDebt: 1,
};
const thirteenth: FutureIncome = {
  id: "13th", name: "13th month", kind: "yearly", amount: toCentavos(30_000), month: "2026-12", shareToDebt: 0.5,
};
const sideJob: FutureIncome = {
  id: "side", name: "Side job", kind: "monthly", amount: toCentavos(3_000), month: "2027-01", endMonth: "2027-06", shareToDebt: 1,
};

describe("future income", () => {
  it("counts one-time income only in its month", () => {
    expect(futureIncomeIn([bonus], "2027-03")).toBe(toCentavos(10_000));
    expect(futureIncomeIn([bonus], "2027-04")).toBe(0);
  });

  it("repeats yearly income every year from its first month, at its debt share", () => {
    expect(futureIncomeIn([thirteenth], "2026-11")).toBe(0);
    expect(futureIncomeIn([thirteenth], "2026-12")).toBe(toCentavos(15_000));
    expect(futureIncomeIn([thirteenth], "2027-12")).toBe(toCentavos(15_000));
    expect(futureIncomeIn([thirteenth], "2027-06")).toBe(0);
  });

  it("adds monthly income from its start through its end month", () => {
    expect(futureIncomeIn([sideJob], "2026-12")).toBe(0);
    expect(futureIncomeIn([sideJob], "2027-01")).toBe(toCentavos(3_000));
    expect(futureIncomeIn([sideJob], "2027-06")).toBe(toCentavos(3_000));
    expect(futureIncomeIn([sideJob], "2027-07")).toBe(0);
  });

  it("treats plan month 1 as the current calendar month", () => {
    const today = new Date(2026, 10, 9);
    expect(planMonthDate(1, today)).toEqual(new Date(2026, 10, 1));
    expect(planMonthDate(3, today)).toEqual(new Date(2027, 0, 1));
  });

  it("builds a month-by-month budget on top of the regular amount", () => {
    const budget = budgetWithFutureIncome(toCentavos(5_000), [thirteenth, sideJob], new Date(2026, 10, 9));
    expect(budget(1)).toBe(toCentavos(5_000)); // Nov 2026
    expect(budget(2)).toBe(toCentavos(20_000)); // Dec 2026: + half of 13th month
    expect(budget(3)).toBe(toCentavos(8_000)); // Jan 2027: + side job
  });
});
