"use client";

import Link from "next/link";
import { useState } from "react";
import { useFinance } from "@/components/finance-provider";
import { Button, Figure, Peso, ProgressMeter, SectionTitle } from "@/components/ui";
import { initialBalance, simulatePayoff } from "@/lib/debt";
import { milestones, overallProgress } from "@/lib/finance/progress";
import { sampleFinanceData } from "@/lib/finance/sample";
import { budgetWithFutureIncome, planMonthDate } from "@/lib/finance/future";
import { startMonthsFor } from "@/lib/finance/schedule";
import { formatMonthYear, summarize, upcomingDueDates } from "@/lib/finance/summary";
import { emptyFinanceData } from "@/lib/finance/types";

function Welcome() {
  const { replace } = useFinance();
  return (
    <section className="py-6 md:py-12">
      <h1 className="max-w-xl font-display text-4xl font-bold tracking-tight md:text-5xl">
        Find out when you&apos;ll be free of utang.
      </h1>
      <p className="mt-4 max-w-prose text-lg text-ink-muted">
        Add your income, expenses, credit cards and loans. You&apos;ll see what&apos;s left after
        each payment, which debt to pay first, and the month you&apos;ll owe nothing.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/budget" className="rounded-md bg-indigo px-4 py-2 text-sm font-semibold text-surface">
          Start with your budget
        </Link>
        <Button variant="secondary" onClick={() => replace(sampleFinanceData)}>
          Try it with sample data
        </Button>
      </div>
    </section>
  );
}

export default function OverviewPage() {
  const { data, ready, replace, email } = useFinance();
  const [confirmClear, setConfirmClear] = useState(false);
  if (!ready) return null;
  if (data.debts.length === 0 && data.incomes.length === 0) return <Welcome />;

  const summary = summarize(data);
  const progress = overallProgress(data.debts);
  const activeDebts = data.debts.filter((d) => initialBalance(d) > 0);
  const budget = Math.max(summary.availableForDebt, summary.totalMinimumDue);
  const plan = activeDebts.length
    ? simulatePayoff(activeDebts, {
        strategy: "avalanche",
        monthlyBudget: budgetWithFutureIncome(budget, data.futureIncome),
        startMonths: startMonthsFor(activeDebts),
      })
    : null;
  const upcoming = upcomingDueDates(data.debts, new Date()).slice(0, 4);
  const goals = milestones(data);

  return (
    <>
      <section>
        {plan === null ? (
          <h1 className="font-display text-4xl font-bold tracking-tight text-mint md:text-5xl">
            {data.debts.length ? "You're debt-free." : "Add your debts to see your payoff date."}
          </h1>
        ) : plan.monthsToDebtFree === null ? (
          <h1 className="font-display text-3xl font-bold tracking-tight text-berry md:text-4xl">
            At your current budget, your debt keeps growing.
          </h1>
        ) : (
          <>
            <p className="text-ink-muted">You could be debt-free by</p>
            <h1 className="font-display text-5xl font-bold tracking-tight text-indigo md:text-7xl">
              {formatMonthYear(planMonthDate(plan.monthsToDebtFree))}
            </h1>
            <p className="mt-2 text-ink-muted">
              Paying <Peso amount={budget} /> a month
              {data.futureIncome.length > 0 && " plus your future income"}.{" "}
              <Link href="/plan" className="text-indigo underline">See the plan</Link>
            </p>
          </>
        )}

        {progress.original > 0 && (
          <div className="mt-8 max-w-xl">
            <ProgressMeter fraction={progress.fraction} label="All debts paid off" />
            <p className="mt-2 text-sm text-ink-muted">
              <Peso amount={progress.paid} tone="mint" className="font-semibold" /> paid of{" "}
              <Peso amount={progress.original} tone="muted" />, {Math.floor(progress.fraction * 100)}% of
              the way there
            </p>
          </div>
        )}
      </section>

      <section className="mt-12 flex flex-wrap gap-x-10 gap-y-5 border-y border-line py-5">
        <Figure label="Still owed" amount={summary.totalDebt} />
        <Figure label="Due this month" amount={summary.totalMinimumDue} tone="ochre" />
        <Figure
          label="Left for debt after expenses"
          amount={summary.availableForDebt}
          tone={summary.canCoverMinimums ? "mint" : "berry"}
        />
      </section>

      <div className="mt-12 grid gap-12 md:grid-cols-2">
        <section>
          <SectionTitle>Coming up</SectionTitle>
          {upcoming.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">Add due days to your debts to see them here.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {upcoming.map(({ debt, date, daysLeft, minimumDue }) => (
                <li key={debt.id} className="flex items-baseline justify-between gap-4">
                  <div>
                    <Link href={`/debts/${debt.id}`} className="font-medium hover:underline">
                      {debt.name}
                    </Link>
                    <p className={`text-sm ${daysLeft <= 3 ? "font-semibold text-berry" : "text-ink-muted"}`}>
                      {daysLeft === 0 ? "Due today" : daysLeft === 1 ? "Due tomorrow" : `In ${daysLeft} days`},{" "}
                      {date.toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <Peso amount={minimumDue} tone="ochre" className="font-semibold" />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <SectionTitle>Milestones</SectionTitle>
          <ul className="mt-4 flex flex-col gap-2.5">
            {goals.map((m) => (
              <li key={m.id} className={`flex items-center gap-3 ${m.reached ? "" : "text-ink-muted"}`}>
                <span
                  aria-hidden
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                    m.reached ? "bg-mint text-surface" : "border border-line"
                  }`}
                >
                  {m.reached ? "✓" : ""}
                </span>
                <span className={m.reached ? "font-medium" : ""}>{m.label}</span>
                <span className="sr-only">{m.reached ? "(reached)" : "(not yet)"}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {data.emergencyFundTarget > 0 && (
        <section className="mt-12 max-w-md">
          <SectionTitle>Emergency fund</SectionTitle>
          <div className="mt-4">
            <ProgressMeter
              fraction={data.emergencyFund / data.emergencyFundTarget}
              label="Emergency fund progress"
            />
            <p className="mt-2 text-sm text-ink-muted">
              <Peso amount={data.emergencyFund} tone="mint" className="font-semibold" /> saved of your{" "}
              <Peso amount={data.emergencyFundTarget} tone="muted" /> goal
            </p>
          </div>
        </section>
      )}

      <footer className="mt-16 border-t border-line pt-5 text-sm">
        {confirmClear ? (
          <div className="flex flex-wrap items-center gap-3">
            <span>{email ? "Delete everything saved in your account?" : "Delete everything you've entered on this device?"}</span>
            <Button
              variant="danger"
              className="border border-berry"
              onClick={() => {
                replace(emptyFinanceData);
                setConfirmClear(false);
              }}
            >
              Delete all data
            </Button>
            <Button variant="secondary" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="danger" className="-ml-4" onClick={() => setConfirmClear(true)}>
            Start over
          </Button>
        )}
      </footer>
    </>
  );
}
