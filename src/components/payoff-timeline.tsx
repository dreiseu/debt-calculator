import type { Debt, SimulationResult } from "@/lib/debt";
import { planMonthDate } from "@/lib/finance/future";
import { Peso } from "./ui";

const shortMonth = (monthsFromNow: number) =>
  planMonthDate(monthsFromNow).toLocaleDateString("en-PH", {
    month: "short",
    year: "2-digit",
  });

function tickStep(totalMonths: number) {
  if (totalMonths <= 8) return 1;
  if (totalMonths <= 18) return 3;
  if (totalMonths <= 48) return 6;
  return 12;
}

/**
 * One row per debt on a shared month axis. The pale stretch is when the debt
 * only gets its minimum; the solid stretch is when the plan's extra money is
 * aimed at it, ending on the month it's paid off.
 */
export function PayoffTimeline({ debts, result }: { debts: Debt[]; result: SimulationResult }) {
  const total = result.monthsToDebtFree ?? 0;
  if (total === 0) return null;

  const rows = result.payoffOrder
    .map((id) => debts.find((d) => d.id === id))
    .filter((d): d is Debt => d !== undefined)
    .map((debt) => {
      const months = result.months.flatMap((m) =>
        m.debts.filter((d) => d.debtId === debt.id).map((d) => ({ month: m.month, ...d })),
      );
      const focus = months.find((m) => m.payment > m.minimumDue && m.endBalance > 0) ?? months.at(-1);
      return {
        debt,
        payoffMonth: result.payoffMonth[debt.id] ?? total,
        focusStart: focus?.month ?? 1,
        interest: months.reduce((sum, m) => sum + m.interest, 0),
      };
    });

  const step = tickStep(total);
  const ticks = Array.from({ length: Math.floor(total / step) + 1 }, (_, i) => i * step);
  const pct = (month: number) => `${(month / total) * 100}%`;

  return (
    <figure>
      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded-sm bg-indigo-soft" /> Paying the minimum
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded-sm bg-mint" /> Getting your extra money
        </span>
      </div>

      <ol className="flex flex-col gap-4">
        {rows.map(({ debt, payoffMonth, focusStart, interest }) => (
          <li
            key={debt.id}
            tabIndex={0}
            className="group relative grid grid-cols-[minmax(0,1fr)] gap-1 focus:outline-none sm:grid-cols-[9rem_minmax(0,1fr)_4.5rem] sm:items-center sm:gap-3"
          >
            <span className="truncate text-sm font-medium">{debt.name}</span>
            <div className="relative h-3">
              <div
                className="absolute inset-y-0 rounded-l-[4px] bg-indigo-soft"
                style={{ left: 0, width: pct(focusStart - 1) }}
              />
              <div
                className="absolute inset-y-0 rounded-r-[4px] bg-mint group-hover:brightness-110"
                style={{
                  left: `calc(${pct(focusStart - 1)} + ${focusStart > 1 ? 2 : 0}px)`,
                  width: `calc(${pct(payoffMonth - focusStart + 1)} - ${focusStart > 1 ? 2 : 0}px)`,
                  borderTopLeftRadius: focusStart > 1 ? 0 : 4,
                  borderBottomLeftRadius: focusStart > 1 ? 0 : 4,
                }}
              />
            </div>
            <span className="text-xs text-ink-muted sm:text-right">{shortMonth(payoffMonth)}</span>

            <div
              role="tooltip"
              className="pointer-events-none absolute top-full left-0 z-10 mt-1 hidden w-64 rounded-md border border-line bg-surface p-3 text-xs shadow-lg group-hover:block group-focus:block sm:left-36"
            >
              <p className="font-semibold">{debt.name}</p>
              <p className="mt-1 text-ink-muted">
                {focusStart > 1
                  ? `Minimum only until month ${focusStart - 1}, then extra money from month ${focusStart}.`
                  : "Gets your extra money from month 1."}
              </p>
              <p className="mt-1">
                Paid off in month {payoffMonth} ({shortMonth(payoffMonth)}),{" "}
                <Peso amount={interest} tone={interest ? "berry" : "muted"} /> interest.
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="relative mt-3 h-5 text-[11px] text-ink-muted sm:ml-[9.75rem] sm:mr-[5.25rem]">
        {ticks.map((m) => (
          <span
            key={m}
            className="absolute -translate-x-1/2 whitespace-nowrap first:translate-x-0"
            style={{ left: pct(m) }}
          >
            {m === 0 ? "Now" : shortMonth(m)}
          </span>
        ))}
      </div>
      <figcaption className="sr-only">
        Payoff timeline: {rows.map((r) => `${r.debt.name} paid off in month ${r.payoffMonth}`).join("; ")}.
      </figcaption>
    </figure>
  );
}
