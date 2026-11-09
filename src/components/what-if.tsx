"use client";

import { useState } from "react";
import {
  initialBalance,
  initialState,
  minimumDue,
  projectNextMonth,
  simulatePayoff,
  type Debt,
} from "@/lib/debt";
import { planMonthDate } from "@/lib/finance/future";
import { formatMonthYear } from "@/lib/finance/summary";
import { Field, MoneyInput, Notice, Peso } from "./ui";

function payoffSummary(months: number | null) {
  if (months === null) return "not within 50 years";
  const date = formatMonthYear(planMonthDate(months));
  return `${months} ${months === 1 ? "month" : "months"} (${date})`;
}

/** "If I pay ₱X, what's left?" for a single debt, this month and every month. */
export function WhatIf({ debt }: { debt: Debt }) {
  const minDue = minimumDue(debt, initialState(debt), true);
  const balance = initialBalance(debt);
  const [payment, setPayment] = useState<number | undefined>(minDue);
  const amount = payment ?? 0;

  const thisMonth = projectNextMonth(debt, amount);
  const everyMonth = simulatePayoff([debt], { strategy: "avalanche", monthlyBudget: amount });
  const minimumOnly = simulatePayoff([debt], { strategy: "avalanche", monthlyBudget: "minimum" });
  const interestSaved = minimumOnly.totalInterest - everyMonth.totalInterest;

  const chip = (label: string, value: number) => (
    <button
      type="button"
      onClick={() => setPayment(value)}
      aria-pressed={amount === value}
      className={`rounded-full border px-3 py-1 text-sm ${
        amount === value ? "border-indigo bg-indigo-soft text-indigo" : "border-line text-ink-muted hover:text-ink"
      }`}
    >
      {label} <Peso amount={value} tone={amount === value ? "ink" : "muted"} />
    </button>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="max-w-xs">
        <Field label="If I pay">
          {(id) => <MoneyInput id={id} value={payment} onChange={setPayment} />}
        </Field>
        <div className="mt-2 flex flex-wrap gap-2">
          {chip("Minimum", minDue)}
          {balance !== minDue && chip("Full balance", balance)}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <div>
          <dt className="text-sm text-ink-muted">Interest added</dt>
          <dd><Peso amount={thisMonth.interest} tone={thisMonth.interest ? "berry" : "ink"} className="font-semibold" /></dd>
        </div>
        <div>
          <dt className="text-sm text-ink-muted">Late fee</dt>
          <dd><Peso amount={thisMonth.lateFee} tone={thisMonth.lateFee ? "berry" : "ink"} className="font-semibold" /></dd>
        </div>
        <div className="col-span-2">
          <dt className="text-sm text-ink-muted">Left to pay next month</dt>
          <dd><Peso amount={thisMonth.endBalance} className="font-display text-2xl font-semibold" /></dd>
        </div>
      </dl>

      {thisMonth.lateFee > 0 && (
        <Notice tone="berry">
          This is below the <Peso amount={minDue} className="font-semibold" /> minimum, so a late fee
          is added and the unpaid part carries over to next month&apos;s bill.
        </Notice>
      )}

      {amount > 0 && balance > 0 && (
        <div className="border-t border-line pt-4 text-sm leading-relaxed">
          <p>
            Paying <Peso amount={amount} className="font-semibold" /> every month clears this in{" "}
            <strong>{payoffSummary(everyMonth.monthsToDebtFree)}</strong>
            {everyMonth.totalInterest > 0 && (
              <>
                , with <Peso amount={everyMonth.totalInterest} tone="berry" className="font-semibold" /> in
                interest
              </>
            )}
            .
          </p>
          {debt.kind === "revolving" && (
            <p className="mt-1 text-ink-muted">
              Paying only the minimum takes {payoffSummary(minimumOnly.monthsToDebtFree)}
              {interestSaved > 0 && (
                <>
                  {" "}and costs <Peso amount={interestSaved} tone="berry" /> more in interest
                </>
              )}
              .
            </p>
          )}
          {debt.kind !== "revolving" && (
            <p className="mt-1 text-ink-muted">
              Fixed installments usually don&apos;t lower the total when paid early, so paying extra
              only finishes it sooner.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
