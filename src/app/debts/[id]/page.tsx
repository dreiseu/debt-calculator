"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { DebtForm, kindLabels } from "@/components/debt-form";
import { useFinance } from "@/components/finance-provider";
import {
  Button,
  EmptyState,
  Field,
  MoneyInput,
  Peso,
  ProgressMeter,
  SectionTitle,
  TextInput,
} from "@/components/ui";
import { WhatIf } from "@/components/what-if";
import { initialBalance, initialState, minimumDue } from "@/lib/debt";
import { debtProgress, recordPayment, removeDebt } from "@/lib/finance/progress";
import { formatIsoDate, startsLater } from "@/lib/finance/schedule";
import { ordinal } from "@/lib/finance/summary";

const todayIso = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export default function DebtDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, ready, update } = useFinance();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number | undefined>();
  const [paymentDate, setPaymentDate] = useState(todayIso);
  const [justCleared, setJustCleared] = useState(false);

  if (!ready) return null;

  const debt = data.debts.find((d) => d.id === id);
  if (!debt) {
    return (
      <EmptyState title="This debt doesn't exist">
        It may have been deleted. <Link href="/debts" className="text-indigo underline">Back to debts</Link>
      </EmptyState>
    );
  }

  const progress = debtProgress(debt);
  const isCleared = initialBalance(debt) === 0;
  const payments = data.payments
    .filter((p) => p.debtId === debt.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const logPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAmount) return;
    update((d) => recordPayment(d, debt.id, paymentAmount, paymentDate));
    if (paymentAmount >= progress.remaining) setJustCleared(true);
    setPaymentAmount(undefined);
  };

  return (
    <>
      <Link href="/debts" className="text-sm text-indigo">
        All debts
      </Link>

      <header className="mt-3 mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{debt.name}</h1>
        <p className="mt-1 text-ink-muted">
          {kindLabels[debt.kind]}
          {debt.dueDay && `, due on the ${ordinal(debt.dueDay)}`}
        </p>
      </header>

      {justCleared && isCleared && (
        <section
          role="status"
          className="mb-8 animate-[celebrate_600ms_cubic-bezier(.2,.8,.2,1.2)] rounded-lg bg-mint px-6 py-8 text-surface"
        >
          <p className="font-display text-3xl font-bold tracking-tight">Paid off!</p>
          <p className="mt-2 max-w-prose">
            You cleared {debt.name}, all <Peso amount={progress.original} className="font-semibold text-surface" /> of
            it. Put what you were paying here toward your next debt to keep the momentum going.
          </p>
          <Link href="/plan" className="mt-4 inline-block font-semibold underline">
            See your payoff plan
          </Link>
        </section>
      )}

      <section className="flex flex-wrap items-end gap-x-10 gap-y-4">
        <div>
          <Peso amount={progress.remaining} className="block font-display text-4xl font-semibold tracking-tight" />
          <span className="text-sm text-ink-muted">left to pay</span>
        </div>
        {!isCleared && (
          <div>
            <Peso
              amount={minimumDue(debt, initialState(debt), true)}
              tone="ochre"
              className="block font-display text-xl font-semibold"
            />
            <span className="text-sm text-ink-muted">
              {startsLater(debt) ? `first payment, due ${formatIsoDate(debt.firstPaymentDate!)}` : "due this month"}
            </span>
          </div>
        )}
      </section>
      <div className="mt-4 max-w-md">
        <ProgressMeter fraction={progress.fraction} label={`${debt.name} paid off`} />
        <p className="mt-2 text-sm text-ink-muted">
          <Peso amount={progress.paid} tone="mint" className="font-semibold" /> paid of{" "}
          <Peso amount={progress.original} tone="muted" /> ({Math.floor(progress.fraction * 100)}%)
        </p>
      </div>

      {!isCleared && (
        <>
          <section className="mt-12">
            <SectionTitle>What if I pay…</SectionTitle>
            <div className="mt-4">
              <WhatIf key={`${debt.id}-${progress.remaining}`} debt={debt} />
            </div>
          </section>

          <section className="mt-12">
            <SectionTitle>Log a payment</SectionTitle>
            <form onSubmit={logPayment} className="mt-4 flex flex-wrap items-end gap-3">
              <div className="w-40">
                <Field label="Amount paid">
                  {(fieldId) => <MoneyInput id={fieldId} value={paymentAmount} onChange={setPaymentAmount} />}
                </Field>
              </div>
              <div className="w-44">
                <Field label="Date">
                  {(fieldId) => (
                    <TextInput
                      id={fieldId}
                      type="date"
                      value={paymentDate}
                      max={todayIso()}
                      onChange={(e) => setPaymentDate(e.target.value)}
                    />
                  )}
                </Field>
              </div>
              <Button type="submit" disabled={!paymentAmount}>
                Log payment
              </Button>
            </form>
            {debt.kind === "revolving" && (
              <p className="mt-2 max-w-prose text-xs text-ink-muted">
                Logged payments lower the balance right away. When your new statement arrives, update
                the balance so new interest and purchases are included.
              </p>
            )}
          </section>
        </>
      )}

      <section className="mt-12">
        <SectionTitle>Payment history</SectionTitle>
        {payments.length === 0 ? (
          <p className="mt-2 text-ink-muted">No payments logged yet.</p>
        ) : (
          <table className="mt-4 w-full max-w-lg text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink-muted">
                <th className="py-2 font-medium">Date</th>
                <th className="py-2 text-right font-medium">Paid</th>
                <th className="py-2 text-right font-medium">Balance after</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-line">
                  <td className="py-2">{formatDate(p.date)}</td>
                  <td className="py-2 text-right"><Peso amount={p.amount} tone="mint" /></td>
                  <td className="py-2 text-right"><Peso amount={p.balanceAfter} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-12 border-t border-line pt-6">
        {editing ? (
          <>
            <SectionTitle>Edit debt</SectionTitle>
            <div className="mt-4">
              <DebtForm
                debt={debt}
                onCancel={() => setEditing(false)}
                onSave={(saved) => {
                  update((d) => ({ ...d, debts: d.debts.map((x) => (x.id === saved.id ? saved : x)) }));
                  setEditing(false);
                }}
              />
            </div>
          </>
        ) : confirmDelete ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm">Delete {debt.name} and its payment history? This can&apos;t be undone.</p>
            <Button
              variant="danger"
              className="border border-berry"
              onClick={() => {
                update((d) => removeDebt(d, debt.id));
                router.push("/debts");
              }}
            >
              Delete debt
            </Button>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Keep it
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit or update balance
            </Button>
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          </div>
        )}
      </section>
    </>
  );
}
