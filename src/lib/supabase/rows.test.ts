import { describe, expect, it } from "vitest";
import { toCentavos } from "@/lib/debt";
import { recordPayment, removeDebt, withFreshIds } from "@/lib/finance/progress";
import { sampleFinanceData } from "@/lib/finance/sample";
import { diffRows, emptyRows, fromRows, hasChanges, toRows } from "./rows";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("rows", () => {
  it("round-trips every kind of data through database rows", () => {
    expect(fromRows(toRows(sampleFinanceData))).toEqual(sampleFinanceData);
  });

  it("round-trips first payment dates and installment totals", () => {
    const debts = sampleFinanceData.debts.map((d) =>
      d.kind === "installment"
        ? { ...d, firstPaymentDate: "2026-06-28", totalInstallments: 12 }
        : { ...d, firstPaymentDate: "2027-01-15" },
    );
    const data = { ...sampleFinanceData, debts };
    expect(fromRows(toRows(data))).toEqual(data);
  });

  it("stores empty optional fields as null, not undefined", () => {
    const rows = toRows(sampleFinanceData);
    const installment = rows.debts.find((d) => d.kind === "installment")!;
    expect(installment.balance).toBeNull();
    expect(installment.due_day).toBe(28);
    expect(Object.values(installment)).not.toContain(undefined);
  });

  it("keeps list order through the position column", () => {
    const rows = toRows(sampleFinanceData);
    const shuffled = { ...rows, debts: [...rows.debts].reverse(), budget_items: [...rows.budget_items].reverse() };
    expect(fromRows(shuffled).debts.map((d) => d.id)).toEqual(sampleFinanceData.debts.map((d) => d.id));
    expect(fromRows(shuffled).expenses.map((e) => e.id)).toEqual(sampleFinanceData.expenses.map((e) => e.id));
  });
});

describe("diffRows", () => {
  const before = toRows(sampleFinanceData);

  it("finds nothing when nothing changed", () => {
    expect(hasChanges(diffRows(before, toRows(sampleFinanceData)))).toBe(false);
  });

  it("sends only the rows a payment touched", () => {
    const after = toRows(recordPayment(sampleFinanceData, "spaylater", toCentavos(500), "2026-11-09"));
    const changes = diffRows(before, after);
    expect(changes.upserts.debts?.map((d) => d.id)).toEqual(["spaylater"]);
    expect(changes.upserts.payments).toHaveLength(1);
    expect(changes.upserts.budget_items).toBeUndefined();
    expect(changes.profile).toBeNull();
  });

  it("lists removed rows for deletion", () => {
    const changes = diffRows(before, toRows(removeDebt(sampleFinanceData, "gloan")));
    expect(changes.deletes.debts).toEqual(["gloan"]);
    expect(changes.deletes.payments).toEqual(["p4"]);
  });

  it("detects profile changes", () => {
    const changes = diffRows(before, toRows({ ...sampleFinanceData, emergencyFund: 1 }));
    expect(changes.profile).toEqual({ emergency_fund: 1, emergency_fund_target: sampleFinanceData.emergencyFundTarget });
  });

  it("uploads everything when moving guest data into an empty account", () => {
    const changes = diffRows(emptyRows, toRows(sampleFinanceData));
    expect(changes.upserts.debts).toHaveLength(sampleFinanceData.debts.length);
    expect(changes.upserts.payments).toHaveLength(sampleFinanceData.payments.length);
  });
});

describe("withFreshIds", () => {
  it("gives every row a UUID and keeps payments linked to their debts", () => {
    const fresh = withFreshIds(sampleFinanceData);
    const all = [...fresh.incomes, ...fresh.expenses, ...fresh.futureIncome, ...fresh.debts, ...fresh.payments];
    expect(all.every((row) => UUID.test(row.id))).toBe(true);
    const debtIds = new Set(fresh.debts.map((d) => d.id));
    expect(fresh.payments.every((p) => debtIds.has(p.debtId))).toBe(true);
    expect(fresh.payments).toHaveLength(sampleFinanceData.payments.length);
  });
});
