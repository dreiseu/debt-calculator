"use client";

import { useState } from "react";
import {
  addOnEffectiveMonthlyRate,
  addOnMonthlyPayment,
  formatPeso,
  initialBalance,
  initialState,
  minimumDue,
  toCentavos,
  type Debt,
} from "@/lib/debt";
import { newId } from "@/lib/finance/progress";
import { formatIsoDate, parseIsoDate, paymentsDueSoFar } from "@/lib/finance/schedule";
import { Button, Field, MoneyInput, Notice, PercentInput, TextInput } from "./ui";

type Kind = Debt["kind"];

export const kindLabels: Record<Kind, string> = {
  revolving: "Credit card or credit line",
  installment: "Fixed monthly installments",
  add_on: "Loan with add-on rate",
};

const kindHints: Record<Kind, string> = {
  revolving: "Interest is charged each month on what's left. Credit cards, SPayLater, GGives limits.",
  installment: "Same amount every month for a set number of months. BillEase, SLoan, Atome.",
  add_on: "A flat % of the original amount per month. Many cash loans and GLoan.",
};

/** Form values; undefined means the field is empty. */
interface Draft {
  kind: Kind;
  name: string;
  dueDay?: number;
  firstPaymentDate?: string;
  lateFee?: number;
  balance?: number;
  monthlyInterestRate?: number;
  minPaymentRate?: number;
  minPaymentFloor?: number;
  minimumDueOverride?: number;
  installmentAmount?: number;
  installmentsRemaining?: number;
  totalInstallments?: number;
  principal?: number;
  monthlyAddOnRate?: number;
  termMonths?: number;
  monthsPaid?: number;
}

const defaults: Draft = {
  kind: "revolving",
  name: "",
  lateFee: toCentavos(850),
  monthlyInterestRate: 0.03,
  minPaymentRate: 0.03,
  minPaymentFloor: toCentavos(500),
  monthsPaid: 0,
};

function toDraft(debt: Debt): Draft {
  return { ...defaults, ...debt } as Draft;
}

/** Builds a Debt from the draft, or returns the first problem to fix. */
function build(draft: Draft, id: string, existing?: Debt): Debt | string {
  if (!draft.name.trim()) return "Give this debt a name.";
  if (draft.dueDay !== undefined && (draft.dueDay < 1 || draft.dueDay > 31)) {
    return "Due day must be between 1 and 31.";
  }
  const base = {
    id,
    name: draft.name.trim(),
    dueDay: draft.dueDay,
    firstPaymentDate: draft.firstPaymentDate || undefined,
    lateFee: draft.lateFee ?? 0,
  };
  // With a first payment date, installments whose due date has passed count as paid.
  const dueSoFar = base.firstPaymentDate ? paymentsDueSoFar(base.firstPaymentDate) : 0;

  let debt: Debt;
  switch (draft.kind) {
    case "revolving":
      if (!draft.balance) return "Enter the current balance.";
      if (draft.monthlyInterestRate === undefined) return "Enter the monthly interest rate.";
      debt = {
        ...base,
        kind: "revolving",
        balance: draft.balance,
        monthlyInterestRate: draft.monthlyInterestRate,
        minPaymentRate: draft.minPaymentRate ?? 0,
        minPaymentFloor: draft.minPaymentFloor ?? 0,
        minimumDueOverride: draft.minimumDueOverride,
      };
      break;
    case "installment": {
      if (!draft.installmentAmount) return "Enter the monthly installment.";
      const before = existing?.kind === "installment" ? existing : undefined;
      if (base.firstPaymentDate) {
        if (!draft.totalInstallments) return "Enter the total number of installments.";
        const total = Math.round(draft.totalInstallments);
        let left = Math.max(0, total - dueSoFar);
        // Keep payments logged ahead of schedule.
        if (before?.totalInstallments === total) left = Math.min(left, before.installmentsRemaining);
        debt = {
          ...base,
          kind: "installment",
          installmentAmount: draft.installmentAmount,
          installmentsRemaining: left,
          totalInstallments: total,
          paidAhead: left === before?.installmentsRemaining ? before.paidAhead : undefined,
        };
      } else {
        if (!draft.installmentsRemaining) return "Enter how many installments are left.";
        debt = {
          ...base,
          kind: "installment",
          installmentAmount: draft.installmentAmount,
          installmentsRemaining: Math.round(draft.installmentsRemaining),
          paidAhead: before?.paidAhead,
        };
      }
      break;
    }
    case "add_on":
      if (!draft.principal) return "Enter the amount you borrowed.";
      if (draft.monthlyAddOnRate === undefined) return "Enter the monthly add-on rate.";
      if (!draft.termMonths) return "Enter the loan term in months.";
      if (!base.firstPaymentDate && (draft.monthsPaid ?? 0) > draft.termMonths) {
        return "Months paid can't be more than the term.";
      }
      const term = Math.round(draft.termMonths);
      const before = existing?.kind === "add_on" ? existing : undefined;
      const monthsPaid = base.firstPaymentDate
        ? Math.min(term, Math.max(dueSoFar, before?.termMonths === term ? before.monthsPaid : 0))
        : Math.round(draft.monthsPaid ?? 0);
      debt = {
        ...base,
        kind: "add_on",
        principal: draft.principal,
        monthlyAddOnRate: draft.monthlyAddOnRate,
        termMonths: term,
        monthsPaid,
        paidAhead: monthsPaid === before?.monthsPaid ? before.paidAhead : undefined,
      };
      break;
  }

  // Progress counts from the full loan when its schedule is known.
  const fullAmount =
    debt.kind === "installment" && debt.totalInstallments
      ? debt.installmentAmount * debt.totalInstallments
      : debt.kind === "add_on" && debt.firstPaymentDate
        ? addOnMonthlyPayment(debt) * debt.termMonths
        : 0;
  debt.originalBalance = Math.max(existing?.originalBalance ?? 0, initialBalance(debt), fullAmount);
  return debt;
}

export function DebtForm({
  debt,
  onSave,
  onCancel,
}: {
  debt?: Debt;
  onSave: (debt: Debt) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => (debt ? toDraft(debt) : defaults));
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const preview = build(draft, debt?.id ?? "preview", debt);
  const previewDebt = typeof preview === "string" ? null : preview;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = build(draft, debt?.id ?? newId(), debt);
    if (typeof result === "string") setError(result);
    else onSave(result);
  };

  const estimatedMinimum =
    draft.kind === "revolving" && draft.balance
      ? Math.min(
          draft.balance,
          Math.max(
            Math.round(draft.balance * (draft.minPaymentRate ?? 0)),
            draft.minPaymentFloor ?? 0,
          ),
        )
      : null;

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <fieldset>
        <legend className="text-sm font-medium">Type of debt</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {(Object.keys(kindLabels) as Kind[]).map((kind) => (
            <label
              key={kind}
              className={`cursor-pointer rounded-md border px-3 py-2.5 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-indigo ${
                draft.kind === kind ? "border-indigo bg-indigo-soft" : "border-line bg-surface"
              }`}
            >
              <input
                type="radio"
                name="kind"
                value={kind}
                checked={draft.kind === kind}
                onChange={() =>
                  set({ kind, lateFee: kind === "revolving" ? toCentavos(850) : draft.lateFee })
                }
                className="sr-only"
              />
              <span className="font-semibold">{kindLabels[kind]}</span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-muted">{kindHints[draft.kind]}</p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          {(id) => (
            <TextInput
              id={id}
              value={draft.name}
              placeholder="e.g. BPI credit card"
              onChange={(e) => set({ name: e.target.value })}
            />
          )}
        </Field>
        <Field label="Due day of the month" hint="Used for reminders.">
          {(id) => (
            <TextInput
              id={id}
              inputMode="numeric"
              value={draft.dueDay ?? ""}
              placeholder="e.g. 15"
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                set({ dueDay: Number.isNaN(n) ? undefined : n });
              }}
            />
          )}
        </Field>
        <Field
          label="First payment date"
          hint={
            draft.firstPaymentDate && parseIsoDate(draft.firstPaymentDate) > new Date()
              ? "Nothing is due before this date, and your plan starts paying it then."
              : "Optional. When the first payment is or was due."
          }
        >
          {(id) => (
            <TextInput
              id={id}
              type="date"
              value={draft.firstPaymentDate ?? ""}
              onChange={(e) => set({ firstPaymentDate: e.target.value || undefined })}
            />
          )}
        </Field>
      </div>

      {draft.kind === "revolving" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Current balance">
            {(id) => <MoneyInput id={id} value={draft.balance} onChange={(balance) => set({ balance })} />}
          </Field>
          <Field label="Interest rate per month" hint="Most PH credit cards charge 3%.">
            {(id) => (
              <PercentInput
                id={id}
                value={draft.monthlyInterestRate}
                onChange={(monthlyInterestRate) => set({ monthlyInterestRate })}
              />
            )}
          </Field>
          <Field
            label="Minimum due on your statement"
            hint={
              estimatedMinimum !== null
                ? `Leave blank to use our estimate of ${formatPeso(estimatedMinimum)}.`
                : "Leave blank and we'll estimate it."
            }
          >
            {(id) => (
              <MoneyInput
                id={id}
                value={draft.minimumDueOverride}
                onChange={(minimumDueOverride) => set({ minimumDueOverride })}
              />
            )}
          </Field>
          <Field label="Late payment fee">
            {(id) => <MoneyInput id={id} value={draft.lateFee} onChange={(lateFee) => set({ lateFee })} />}
          </Field>
          <details className="sm:col-span-2">
            <summary className="cursor-pointer text-sm text-indigo">How the minimum is estimated</summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="Percent of balance">
                {(id) => (
                  <PercentInput
                    id={id}
                    value={draft.minPaymentRate}
                    onChange={(minPaymentRate) => set({ minPaymentRate })}
                  />
                )}
              </Field>
              <Field label="Or at least">
                {(id) => (
                  <MoneyInput
                    id={id}
                    value={draft.minPaymentFloor}
                    onChange={(minPaymentFloor) => set({ minPaymentFloor })}
                  />
                )}
              </Field>
            </div>
          </details>
        </div>
      )}

      {draft.kind === "installment" && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Monthly installment">
            {(id) => (
              <MoneyInput
                id={id}
                value={draft.installmentAmount}
                onChange={(installmentAmount) => set({ installmentAmount })}
              />
            )}
          </Field>
          {draft.firstPaymentDate ? (
            <Field
              label="Total installments"
              hint={
                previewDebt?.kind === "installment"
                  ? `${previewDebt.installmentsRemaining} left. Passed due dates count as paid.`
                  : "The full number of months, e.g. 12."
              }
            >
              {(id) => (
                <TextInput
                  id={id}
                  inputMode="numeric"
                  value={draft.totalInstallments ?? ""}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    set({ totalInstallments: Number.isNaN(n) ? undefined : n });
                  }}
                />
              )}
            </Field>
          ) : (
            <Field label="Installments left">
              {(id) => (
                <TextInput
                  id={id}
                  inputMode="numeric"
                  value={draft.installmentsRemaining ?? ""}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    set({ installmentsRemaining: Number.isNaN(n) ? undefined : n });
                  }}
                />
              )}
            </Field>
          )}
          <Field label="Late payment fee">
            {(id) => <MoneyInput id={id} value={draft.lateFee} onChange={(lateFee) => set({ lateFee })} />}
          </Field>
        </div>
      )}

      {draft.kind === "add_on" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount borrowed">
            {(id) => <MoneyInput id={id} value={draft.principal} onChange={(principal) => set({ principal })} />}
          </Field>
          <Field label="Add-on rate per month">
            {(id) => (
              <PercentInput
                id={id}
                value={draft.monthlyAddOnRate}
                onChange={(monthlyAddOnRate) => set({ monthlyAddOnRate })}
              />
            )}
          </Field>
          <Field label="Term">
            {(id) => (
              <TextInput
                id={id}
                inputMode="numeric"
                value={draft.termMonths ?? ""}
                placeholder="months"
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  set({ termMonths: Number.isNaN(n) ? undefined : n });
                }}
              />
            )}
          </Field>
          {draft.firstPaymentDate ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Months already paid</span>
              <p className="py-2 text-ink">
                {previewDebt?.kind === "add_on" ? previewDebt.monthsPaid : "–"}
              </p>
              <p className="text-xs text-ink-muted">Counted from the first payment date.</p>
            </div>
          ) : (
            <Field label="Months already paid">
              {(id) => (
                <TextInput
                  id={id}
                  inputMode="numeric"
                  value={draft.monthsPaid ?? ""}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    set({ monthsPaid: Number.isNaN(n) ? undefined : n });
                  }}
                />
              )}
            </Field>
          )}
          <Field label="Late payment fee">
            {(id) => <MoneyInput id={id} value={draft.lateFee} onChange={(lateFee) => set({ lateFee })} />}
          </Field>
        </div>
      )}

      {previewDebt?.kind === "add_on" && (
        <Notice tone="ochre">
          You pay {formatPeso(addOnMonthlyPayment(previewDebt))} a month. A{" "}
          {(previewDebt.monthlyAddOnRate * 100).toFixed(2)}% add-on rate works out to about{" "}
          <strong>
            {(addOnEffectiveMonthlyRate(previewDebt.monthlyAddOnRate, previewDebt.termMonths) * 100).toFixed(2)}%
            per month
          </strong>{" "}
          in real interest, because the rate is charged on the full amount even as you pay it down.
        </Notice>
      )}

      {previewDebt && (
        <p className="text-sm text-ink-muted">
          Remaining: <strong className="text-ink">{formatPeso(initialBalance(previewDebt))}</strong>,
          {previewDebt.firstPaymentDate && parseIsoDate(previewDebt.firstPaymentDate) > new Date()
            ? `first payment on ${formatIsoDate(previewDebt.firstPaymentDate)}: `
            : "due this month: "}
          <strong className="text-ochre">
            {formatPeso(minimumDue(previewDebt, initialState(previewDebt), true))}
          </strong>
        </p>
      )}

      {error && <Notice tone="berry">{error}</Notice>}

      <div className="flex gap-2">
        <Button type="submit">{debt ? "Save changes" : "Add debt"}</Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
