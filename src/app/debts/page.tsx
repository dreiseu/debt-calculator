"use client";

import Link from "next/link";
import { useState } from "react";
import { DebtForm, kindLabels } from "@/components/debt-form";
import { useFinance } from "@/components/finance-provider";
import { Button, EmptyState, PageHeader, Peso, ProgressMeter } from "@/components/ui";
import { initialBalance, initialState, minimumDue } from "@/lib/debt";
import { debtProgress } from "@/lib/finance/progress";
import { ordinal, summarize } from "@/lib/finance/summary";

export default function DebtsPage() {
  const { data, ready, update } = useFinance();
  const [adding, setAdding] = useState(false);
  if (!ready) return null;

  const summary = summarize(data);
  const active = data.debts.filter((d) => initialBalance(d) > 0);
  const cleared = data.debts.filter((d) => initialBalance(d) === 0);

  return (
    <>
      <PageHeader title="Debts">
        Your credit cards and loans. Tap one to log a payment or see what&apos;s left if you pay a
        certain amount.
      </PageHeader>

      {data.debts.length > 0 && (
        <p className="mb-6 text-ink-muted">
          You owe <Peso amount={summary.totalDebt} className="font-semibold" /> in total.{" "}
          <Peso amount={summary.totalMinimumDue} tone="ochre" className="font-semibold" /> is due
          this month.
        </p>
      )}

      {adding ? (
        <section className="mb-10 rounded-lg border border-line bg-surface p-5">
          <h2 className="mb-4 font-display text-xl font-semibold">Add a debt</h2>
          <DebtForm
            onCancel={() => setAdding(false)}
            onSave={(debt) => {
              update((d) => ({ ...d, debts: [...d.debts, debt] }));
              setAdding(false);
            }}
          />
        </section>
      ) : (
        <Button className="mb-8" onClick={() => setAdding(true)}>
          Add debt
        </Button>
      )}

      {data.debts.length === 0 && !adding && (
        <EmptyState title="No debts yet">
          Add each credit card and loan with its current balance. You can find these in your
          banking or lending app.
        </EmptyState>
      )}

      <ul className="divide-y divide-line border-y border-line">
        {active.map((debt) => {
          const progress = debtProgress(debt);
          return (
            <li key={debt.id}>
              <Link
                href={`/debts/${debt.id}`}
                className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 py-4 hover:bg-surface md:px-2"
              >
                <div>
                  <p className="font-semibold">{debt.name}</p>
                  <p className="text-sm text-ink-muted">
                    {kindLabels[debt.kind]}
                    {debt.dueDay && `, due on the ${ordinal(debt.dueDay)}`}
                  </p>
                </div>
                <div className="text-right">
                  <Peso amount={progress.remaining} className="font-display text-lg font-semibold" />
                  <p className="text-sm text-ink-muted">
                    <Peso amount={minimumDue(debt, initialState(debt), true)} tone="ochre" /> due
                  </p>
                </div>
                <div className="col-span-2 flex items-center gap-3">
                  <ProgressMeter fraction={progress.fraction} label={`${debt.name} paid off`} />
                  <span className="w-20 shrink-0 text-right text-xs text-ink-muted">
                    {Math.floor(progress.fraction * 100)}% paid
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {cleared.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-lg font-semibold text-mint">Paid off</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {cleared.map((debt) => (
              <li key={debt.id}>
                <Link
                  href={`/debts/${debt.id}`}
                  className="inline-block rounded-full bg-mint-soft px-3 py-1 text-sm text-mint"
                >
                  {debt.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

