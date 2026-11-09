"use client";

import Link from "next/link";
import { useState } from "react";
import { useFinance } from "@/components/finance-provider";
import { DebtOverTimeChart } from "@/components/debt-over-time-chart";
import { PayoffTimeline } from "@/components/payoff-timeline";
import { EmptyState, Field, MoneyInput, Notice, PageHeader, Peso, SectionTitle } from "@/components/ui";
import {
  compareStrategies,
  formatPeso,
  initialBalance,
  simulatePayoff,
  type SimulationResult,
  type Strategy,
} from "@/lib/debt";
import { budgetWithFutureIncome, planMonthDate } from "@/lib/finance/future";
import { formatMonthYear, summarize } from "@/lib/finance/summary";

const strategies: Record<Strategy, { name: string; description: string }> = {
  avalanche: {
    name: "Avalanche",
    description: "Extra money goes to the highest interest rate first. Costs the least overall.",
  },
  snowball: {
    name: "Snowball",
    description: "Extra money goes to the smallest balance first. Debts disappear sooner, which keeps you going.",
  },
};

const debtFreeLabel = (result: SimulationResult) =>
  result.monthsToDebtFree === null
    ? "Not within 50 years"
    : formatMonthYear(planMonthDate(result.monthsToDebtFree));

export default function PlanPage() {
  const { data, ready } = useFinance();
  const [budgetInput, setBudgetInput] = useState<number | undefined>();
  const [strategy, setStrategy] = useState<Strategy>("avalanche");
  const [includeFuture, setIncludeFuture] = useState(true);
  if (!ready) return null;

  const debts = data.debts.filter((d) => initialBalance(d) > 0);
  const summary = summarize(data);

  if (debts.length === 0) {
    return (
      <>
        <PageHeader title="Payoff plan" />
        <EmptyState title="Nothing to plan yet">
          <Link href="/debts" className="text-indigo underline">Add your debts</Link> and{" "}
          <Link href="/budget" className="text-indigo underline">your budget</Link> to see when
          you&apos;ll be debt-free.
        </EmptyState>
      </>
    );
  }

  const suggestedBudget = Math.max(summary.availableForDebt, summary.totalMinimumDue);
  const budget = budgetInput ?? suggestedBudget;
  const hasFuture = data.futureIncome.length > 0;
  const useFuture = hasFuture && includeFuture;
  const plans = compareStrategies(
    debts,
    useFuture ? budgetWithFutureIncome(budget, data.futureIncome) : budget,
  );
  const chosen = plans[strategy];
  const currentIncomeOnly = useFuture
    ? simulatePayoff(debts, { strategy, monthlyBudget: budget })
    : null;
  const monthsSooner =
    currentIncomeOnly && chosen.monthsToDebtFree !== null
      ? (currentIncomeOnly.monthsToDebtFree ?? Infinity) - chosen.monthsToDebtFree
      : 0;
  const shortfall = summary.totalMinimumDue - budget;
  const savedVsMinimum = plans.minimumOnly.totalInterest - chosen.totalInterest;

  return (
    <>
      <PageHeader title="Payoff plan">
        Pay every minimum, then put everything left toward one debt at a time. When it&apos;s gone,
        its payment rolls into the next.
      </PageHeader>

      <div className="max-w-xs">
        <Field
          label="I can pay toward debts each month"
          hint={
            summary.availableForDebt > 0
              ? `Your budget leaves ${formatPeso(summary.availableForDebt)} after expenses.`
              : "Set up your budget to get a suggestion."
          }
        >
          {(id) => <MoneyInput id={id} value={budget} onChange={setBudgetInput} />}
        </Field>
      </div>

      {hasFuture && (
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeFuture}
            onChange={(e) => setIncludeFuture(e.target.checked)}
            className="h-4 w-4 accent-[var(--indigo)]"
          />
          Add my future income ({data.futureIncome.length}{" "}
          {data.futureIncome.length === 1 ? "entry" : "entries"} on the{" "}
          <Link href="/budget" className="text-indigo underline">Budget</Link> page)
        </label>
      )}

      {shortfall > 0 && (
        <div className="mt-4">
          <Notice tone="berry">
            This is <Peso amount={shortfall} className="font-semibold" /> short of your combined
            minimum dues (<Peso amount={summary.totalMinimumDue} />). The plan below includes the late
            fees that would cause.
          </Notice>
        </div>
      )}

      <fieldset className="mt-8">
        <legend className="sr-only">Payoff strategy</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(strategies) as Strategy[]).map((key) => {
            const plan = plans[key];
            const selected = strategy === key;
            return (
              <label
                key={key}
                className={`cursor-pointer rounded-lg border-2 p-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-indigo ${
                  selected ? "border-indigo bg-surface" : "border-line hover:border-ink-muted"
                }`}
              >
                <input
                  type="radio"
                  name="strategy"
                  value={key}
                  checked={selected}
                  onChange={() => setStrategy(key)}
                  className="sr-only"
                />
                <span className="font-display text-lg font-semibold">{strategies[key].name}</span>
                <span className="mt-1 block text-sm text-ink-muted">{strategies[key].description}</span>
                <span className="mt-4 block font-display text-2xl font-semibold tracking-tight">
                  {debtFreeLabel(plan)}
                </span>
                <span className="text-sm text-ink-muted">
                  debt-free, with <Peso amount={plan.totalInterest} tone="berry" /> interest
                </span>
              </label>
            );
          })}
        </div>
        {plans.avalanche.totalInterest !== plans.snowball.totalInterest && (
          <p className="mt-3 text-sm text-ink-muted">
            Avalanche saves{" "}
            <Peso amount={plans.snowball.totalInterest - plans.avalanche.totalInterest} tone="mint" /> over
            Snowball. Snowball is worth it if quick wins help you stick to the plan.
          </p>
        )}
      </fieldset>

      <section className="mt-12">
        <SectionTitle>Total still owed</SectionTitle>
        {currentIncomeOnly && (
          <p className="mt-1 max-w-prose text-sm text-ink-muted">
            {monthsSooner === Infinity
              ? "Your future income is what makes this plan work. Without it you wouldn't be debt-free."
              : monthsSooner > 0
                ? `Your future income makes you debt-free ${monthsSooner} ${monthsSooner === 1 ? "month" : "months"} sooner and saves ${formatPeso(Math.max(0, currentIncomeOnly.totalInterest - chosen.totalInterest))} in interest.`
                : "Your future income arrives after you'd already be debt-free, so it doesn't change the date."}
          </p>
        )}
        <div className="mt-5">
          <DebtOverTimeChart
            startTotal={summary.totalDebt}
            series={[
              {
                id: "plan",
                label: currentIncomeOnly ? "With future income" : "Still owed",
                color: "var(--chart-future)",
                result: chosen,
              },
              ...(currentIncomeOnly
                ? [
                    {
                      id: "current",
                      label: "Current income only",
                      color: "var(--chart-current)",
                      dashed: true,
                      result: currentIncomeOnly,
                    },
                  ]
                : []),
            ]}
          />
        </div>
      </section>

      {chosen.monthsToDebtFree !== null ? (
        <section className="mt-12">
          <SectionTitle>When each debt is cleared</SectionTitle>
          <div className="mt-5">
            <PayoffTimeline debts={debts} result={chosen} />
          </div>
          {savedVsMinimum > 0 && (
            <p className="mt-6 text-sm">
              Compared with paying only minimums ({debtFreeLabel(plans.minimumOnly).toLowerCase()}), this
              plan saves <Peso amount={savedVsMinimum} tone="mint" className="font-semibold" /> in
              interest.
            </p>
          )}
        </section>
      ) : (
        <div className="mt-8">
          <Notice tone="berry">
            At this amount your balances keep growing, so you&apos;d never be debt-free. Raise your monthly
            payment above <Peso amount={summary.totalMinimumDue} className="font-semibold" /> to make progress.
          </Notice>
        </div>
      )}

      <section className="mt-12">
        <SectionTitle>Order to pay them off</SectionTitle>
        <ol className="mt-4 flex flex-col gap-2">
          {chosen.payoffOrder.map((id, i) => {
            const debt = debts.find((d) => d.id === id)!;
            return (
              <li key={id} className="flex gap-3">
                <span className="w-6 shrink-0 font-display font-semibold text-indigo">{i + 1}</span>
                <span>
                  <Link href={`/debts/${id}`} className="font-medium hover:underline">{debt.name}</Link>
                  <span className="text-ink-muted">
                    {" "}paid off in month {chosen.payoffMonth[id]}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <details className="mt-12">
        <summary className="cursor-pointer font-display text-lg font-semibold">Month-by-month schedule</summary>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink-muted">
                <th className="py-2 font-medium">Month</th>
                <th className="py-2 text-right font-medium">Paid</th>
                <th className="py-2 text-right font-medium">Interest</th>
                <th className="py-2 text-right font-medium">Late fees</th>
                <th className="py-2 text-right font-medium">Still owed</th>
              </tr>
            </thead>
            <tbody>
              {chosen.months.slice(0, 120).map((m) => {
                const interest = m.debts.reduce((s, d) => s + d.interest, 0);
                const fees = m.debts.reduce((s, d) => s + d.lateFee, 0);
                const owed = m.debts.reduce((s, d) => s + d.endBalance, 0);
                return (
                  <tr key={m.month} className="border-b border-line">
                    <td className="py-2">{formatMonthYear(planMonthDate(m.month))}</td>
                    <td className="py-2 text-right"><Peso amount={m.totalPayment} /></td>
                    <td className="py-2 text-right"><Peso amount={interest} tone={interest ? "berry" : "muted"} /></td>
                    <td className="py-2 text-right"><Peso amount={fees} tone={fees ? "berry" : "muted"} /></td>
                    <td className="py-2 text-right"><Peso amount={owed} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {chosen.months.length > 120 && (
            <p className="mt-2 text-xs text-ink-muted">Showing the first 10 years.</p>
          )}
        </div>
      </details>
    </>
  );
}
