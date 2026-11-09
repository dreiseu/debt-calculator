"use client";

import { useFinance } from "@/components/finance-provider";
import { FutureIncomeList } from "@/components/future-income-list";
import {
  Button,
  Field,
  Figure,
  MoneyInput,
  Notice,
  PageHeader,
  ProgressMeter,
  SectionTitle,
  TextInput,
} from "@/components/ui";
import { formatPeso } from "@/lib/debt";
import { newId } from "@/lib/finance/progress";
import { summarize } from "@/lib/finance/summary";
import type { FinanceData, LineItem } from "@/lib/finance/types";

type ListKey = "incomes" | "expenses";

function LineItemList({
  listKey,
  title,
  addLabel,
  placeholder,
}: {
  listKey: ListKey;
  title: string;
  addLabel: string;
  placeholder: string;
}) {
  const { data, update } = useFinance();
  const items = data[listKey];

  const setItems = (change: (items: LineItem[]) => LineItem[]) =>
    update((d: FinanceData) => ({ ...d, [listKey]: change(d[listKey]) }));

  const edit = (id: string, patch: Partial<LineItem>) =>
    setItems((list) => list.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  return (
    <section className="mt-10">
      <SectionTitle>{title}</SectionTitle>
      <ul className="mt-4 flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id} className="grid grid-cols-[1fr_8.5rem_auto] items-center gap-2">
            <TextInput
              aria-label={`${title} name`}
              value={item.name}
              placeholder={placeholder}
              onChange={(e) => edit(item.id, { name: e.target.value })}
            />
            <MoneyInput
              aria-label={`Monthly amount for ${item.name || "this item"}`}
              value={item.amount}
              onChange={(amount) => edit(item.id, { amount: amount ?? 0 })}
            />
            <Button
              variant="danger"
              aria-label={`Remove ${item.name || "item"}`}
              className="px-2"
              onClick={() => setItems((list) => list.filter((i) => i.id !== item.id))}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <Button
        variant="quiet"
        className="mt-3 -ml-2"
        onClick={() => setItems((list) => [...list, { id: newId(), name: "", amount: 0 }])}
      >
        {addLabel}
      </Button>
    </section>
  );
}

export default function BudgetPage() {
  const { data, ready, update } = useFinance();
  if (!ready) return null;

  const summary = summarize(data);
  const fundFraction =
    data.emergencyFundTarget > 0 ? data.emergencyFund / data.emergencyFundTarget : 0;

  return (
    <>
      <PageHeader title="Budget">
        Enter monthly amounts. What&apos;s left after expenses is what you can put toward debt.
      </PageHeader>

      <div className="flex flex-wrap gap-x-10 gap-y-4 border-y border-line py-5">
        <Figure label="Monthly income" amount={summary.totalIncome} />
        <Figure label="Monthly expenses" amount={summary.totalExpenses} />
        <Figure
          label="Left for debt each month"
          amount={summary.availableForDebt}
          tone={summary.availableForDebt >= 0 ? "mint" : "berry"}
        />
      </div>

      {summary.availableForDebt < 0 && (
        <div className="mt-4">
          <Notice tone="berry">
            Your expenses are {formatPeso(-summary.availableForDebt)} more than your income.
            Trim an expense or add income before planning debt payments.
          </Notice>
        </div>
      )}

      <LineItemList
        listKey="incomes"
        title="Income"
        addLabel="Add income"
        placeholder="e.g. Salary"
      />
      <FutureIncomeList />
      <LineItemList
        listKey="expenses"
        title="Expenses"
        addLabel="Add expense"
        placeholder="e.g. Rent"
      />

      <section className="mt-12">
        <SectionTitle>Emergency fund</SectionTitle>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">
          Savings for surprises, so a sudden expense doesn&apos;t go on a credit card. A common
          goal is 3–6 months of expenses.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Saved so far">
            {(id) => (
              <MoneyInput
                id={id}
                value={data.emergencyFund}
                onChange={(v) => update((d) => ({ ...d, emergencyFund: v ?? 0 }))}
              />
            )}
          </Field>
          <Field
            label="Goal"
            hint={
              summary.totalExpenses > 0
                ? `3 months of your expenses is ${formatPeso(summary.totalExpenses * 3)}.`
                : undefined
            }
          >
            {(id) => (
              <MoneyInput
                id={id}
                value={data.emergencyFundTarget}
                onChange={(v) => update((d) => ({ ...d, emergencyFundTarget: v ?? 0 }))}
              />
            )}
          </Field>
        </div>
        {data.emergencyFundTarget > 0 && (
          <div className="mt-5 max-w-md">
            <ProgressMeter fraction={fundFraction} label="Emergency fund progress" />
            <p className="mt-2 text-sm text-ink-muted">
              {Math.round(Math.min(1, fundFraction) * 100)}% of your goal
              {summary.emergencyFundMonths !== null &&
                `, enough for ${summary.emergencyFundMonths.toFixed(1)} months of expenses`}
            </p>
          </div>
        )}
      </section>
    </>
  );
}
