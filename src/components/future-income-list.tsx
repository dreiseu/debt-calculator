"use client";

import { useFinance } from "./finance-provider";
import { Button, Field, MoneyInput, PercentInput, SectionTitle, SelectInput, TextInput } from "./ui";
import { monthKey, type FutureIncome, type FutureIncomeKind } from "@/lib/finance/future";
import { newId } from "@/lib/finance/progress";

const kindOptions: Record<FutureIncomeKind, { label: string; monthLabel: string }> = {
  one_time: { label: "Once", monthLabel: "Month" },
  monthly: { label: "Every month", monthLabel: "Starting" },
  yearly: { label: "Every year", monthLabel: "First time" },
};

/** Bonuses, raises and 13th month pay the plan can count on later. */
export function FutureIncomeList() {
  const { data, update } = useFinance();
  const items = data.futureIncome;
  const thisMonth = monthKey(new Date());

  const setItems = (change: (items: FutureIncome[]) => FutureIncome[]) =>
    update((d) => ({ ...d, futureIncome: change(d.futureIncome) }));

  const edit = (id: string, patch: Partial<FutureIncome>) =>
    setItems((list) => list.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  const add = () =>
    setItems((list) => [
      ...list,
      { id: newId(), name: "", kind: "one_time", amount: 0, month: thisMonth, shareToDebt: 1 },
    ]);

  return (
    <section className="mt-10">
      <SectionTitle>Future income</SectionTitle>
      <p className="mt-1 max-w-prose text-sm text-ink-muted">
        Money you expect later, like 13th month pay, a bonus or a raise. Your payoff plan adds the
        share you&apos;ll put toward debt to that month&apos;s payments.
      </p>

      <ul className="mt-4 flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.id} className="rounded-lg border border-line bg-surface p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name">
                {(id) => (
                  <TextInput
                    id={id}
                    value={item.name}
                    placeholder="e.g. 13th month pay"
                    onChange={(e) => edit(item.id, { name: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Amount">
                {(id) => (
                  <MoneyInput id={id} value={item.amount} onChange={(amount) => edit(item.id, { amount: amount ?? 0 })} />
                )}
              </Field>
              <Field label="How often">
                {(id) => (
                  <SelectInput
                    id={id}
                    value={item.kind}
                    onChange={(e) => edit(item.id, { kind: e.target.value as FutureIncomeKind })}
                  >
                    {(Object.keys(kindOptions) as FutureIncomeKind[]).map((kind) => (
                      <option key={kind} value={kind}>
                        {kindOptions[kind].label}
                      </option>
                    ))}
                  </SelectInput>
                )}
              </Field>
              <Field label="Put toward debt" hint="The rest is yours to keep or save.">
                {(id) => (
                  <PercentInput
                    id={id}
                    value={item.shareToDebt}
                    onChange={(share) => edit(item.id, { shareToDebt: Math.min(1, Math.max(0, share ?? 0)) })}
                  />
                )}
              </Field>
              <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                <Field label={kindOptions[item.kind].monthLabel}>
                  {(id) => (
                    <TextInput
                      id={id}
                      type="month"
                      min={thisMonth}
                      value={item.month}
                      onChange={(e) => e.target.value && edit(item.id, { month: e.target.value })}
                    />
                  )}
                </Field>
                {item.kind === "monthly" ? (
                  <Field label="Until">
                    {(id) => (
                      <TextInput
                        id={id}
                        type="month"
                        min={item.month}
                        value={item.endMonth ?? ""}
                        onChange={(e) => edit(item.id, { endMonth: e.target.value || undefined })}
                      />
                    )}
                  </Field>
                ) : (
                  <span />
                )}
              </div>
              <div className="flex items-end justify-end sm:col-span-2">
                <Button
                  variant="danger"
                  aria-label={`Remove ${item.name || "future income"}`}
                  onClick={() => setItems((list) => list.filter((i) => i.id !== item.id))}
                >
                  Remove
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <Button variant="quiet" className="mt-3 -ml-2" onClick={add}>
        Add future income
      </Button>
    </section>
  );
}
