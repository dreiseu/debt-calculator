import { describe, expect, it } from "vitest";
import { applyPayment, initialBalance, toCentavos, type AddOnDebt, type InstallmentDebt } from "@/lib/debt";
import {
  catchUpDebt,
  catchUpScheduledPayments,
  paymentsDueSoFar,
  startMonthOf,
  startMonthsFor,
} from "./schedule";
import { sampleFinanceData } from "./sample";

const today = new Date(2026, 10, 9); // Nov 9, 2026

const phone: InstallmentDebt = {
  id: "phone",
  name: "Phone on BillEase",
  kind: "installment",
  installmentAmount: toCentavos(1_500),
  installmentsRemaining: 12,
  totalInstallments: 12,
  firstPaymentDate: "2026-08-15",
  lateFee: 0,
};

const loan: AddOnDebt = {
  id: "loan",
  name: "Cash loan",
  kind: "add_on",
  principal: toCentavos(10_000),
  monthlyAddOnRate: 0.03,
  termMonths: 6,
  monthsPaid: 0,
  firstPaymentDate: "2026-10-31",
  lateFee: 0,
};

describe("startMonthOf", () => {
  it("is month 1 for debts already running or due this month", () => {
    expect(startMonthOf(phone, today)).toBe(1);
    expect(startMonthOf({ ...phone, firstPaymentDate: "2026-11-28" }, today)).toBe(1);
    expect(startMonthOf({ ...phone, firstPaymentDate: undefined }, today)).toBe(1);
  });

  it("counts calendar months ahead for debts that start later", () => {
    expect(startMonthOf({ ...phone, firstPaymentDate: "2026-12-01" }, today)).toBe(2);
    expect(startMonthOf({ ...phone, firstPaymentDate: "2027-01-15" }, today)).toBe(3);
    expect(startMonthsFor([phone, { ...loan, firstPaymentDate: "2027-01-15" }], today)).toEqual({ loan: 3 });
  });
});

describe("paymentsDueSoFar", () => {
  it("counts due dates up to and including today", () => {
    expect(paymentsDueSoFar("2026-08-15", today)).toBe(3); // Aug, Sep, Oct; Nov 15 not yet
    expect(paymentsDueSoFar("2026-08-09", today)).toBe(4); // Nov 9 is due today
    expect(paymentsDueSoFar("2026-12-01", today)).toBe(0);
  });

  it("treats a 31st due day as the last day of short months", () => {
    expect(paymentsDueSoFar("2026-01-31", new Date(2026, 1, 28))).toBe(2);
    expect(paymentsDueSoFar("2026-01-31", new Date(2026, 1, 27))).toBe(1);
  });
});

describe("catchUpDebt", () => {
  it("counts passed installments as paid", () => {
    const caught = catchUpDebt(phone, today) as InstallmentDebt;
    expect(caught.installmentsRemaining).toBe(9);
    expect(initialBalance(caught)).toBe(toCentavos(13_500));
  });

  it("counts passed add-on amortizations as paid", () => {
    expect((catchUpDebt(loan, today) as AddOnDebt).monthsPaid).toBe(1); // Oct 31
  });

  it("doesn't double-count a payment logged before its due date", () => {
    // Paid November's installment early, on Nov 9
    const paidEarly = applyPayment(catchUpDebt(phone, today), toCentavos(1_500)) as InstallmentDebt;
    expect(paidEarly.installmentsRemaining).toBe(8);
    // On Nov 20 the Nov 15 due date has passed: still 8 left, not 7
    expect((catchUpDebt(paidEarly, new Date(2026, 10, 20)) as InstallmentDebt).installmentsRemaining).toBe(8);
    // In December the next due date passes
    expect((catchUpDebt(paidEarly, new Date(2026, 11, 15)) as InstallmentDebt).installmentsRemaining).toBe(7);
  });

  it("never goes below zero or past the term", () => {
    const later = new Date(2030, 0, 1);
    expect((catchUpDebt(phone, later) as InstallmentDebt).installmentsRemaining).toBe(0);
    expect((catchUpDebt(loan, later) as AddOnDebt).monthsPaid).toBe(6);
  });

  it("leaves debts without a schedule alone", () => {
    const noTotal = { ...phone, totalInstallments: undefined };
    expect(catchUpDebt(noTotal, today)).toBe(noTotal);
    const card = sampleFinanceData.debts[0];
    expect(catchUpDebt({ ...card, firstPaymentDate: "2026-01-01" }, today).kind).toBe("revolving");
  });

  it("returns the same data object when nothing needs catching up", () => {
    expect(catchUpScheduledPayments(sampleFinanceData, today)).toBe(sampleFinanceData);
    const withPhone = { ...sampleFinanceData, debts: [phone] };
    expect(catchUpScheduledPayments(withPhone, today)).not.toBe(withPhone);
  });
});
