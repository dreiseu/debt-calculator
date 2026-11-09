"use client";

import { useState } from "react";
import { formatPeso, type Centavos, type SimulationResult } from "@/lib/debt";
import { planMonthDate } from "@/lib/finance/future";

export interface DebtSeries {
  id: string;
  label: string;
  /** CSS color, e.g. "var(--chart-future)". */
  color: string;
  dashed?: boolean;
  result: SimulationResult;
}

const WIDTH = 640;
const HEIGHT = 240;
const PAD = { top: 16, right: 16, bottom: 28, left: 52 };

const monthLabel = (month: number, year: "numeric" | "2-digit" = "2-digit") =>
  planMonthDate(month).toLocaleDateString("en-PH", { month: "short", year });

const compactPeso = (amount: Centavos) =>
  amount >= 1_000_000_00
    ? `₱${Math.round(amount / 100_000_00) / 10}M`.replace(".0M", "M")
    : amount >= 1_000_00
      ? `₱${Math.round(amount / 1_000_00)}k`
      : `₱${Math.round(amount / 100)}`;

/** Total still owed at the start (index 0) and after each month. */
function owedByMonth(result: SimulationResult, startTotal: Centavos): Centavos[] {
  return [startTotal, ...result.months.map((m) => m.debts.reduce((s, d) => s + d.endBalance, 0))];
}

function niceMax(value: number) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= value / 4)! * magnitude;
  return Math.ceil(value / step) * step;
}

/**
 * Line chart of total debt over time, one line per plan. Hover or use the
 * arrow keys to read exact amounts for a month.
 */
export function DebtOverTimeChart({ series, startTotal }: { series: DebtSeries[]; startTotal: Centavos }) {
  const lines = series.map((s) => ({ ...s, values: owedByMonth(s.result, startTotal) }));
  const months = Math.max(...lines.map((l) => l.values.length - 1), 1);
  const yMax = niceMax(Math.max(...lines.flatMap((l) => l.values)));
  const [active, setActive] = useState<number | null>(null);

  const x = (i: number) => PAD.left + (i / months) * (WIDTH - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - v / yMax) * (HEIGHT - PAD.top - PAD.bottom);
  const valueAt = (values: number[], i: number) => (i < values.length ? values[i] : 0);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax);
  const xStep = months <= 8 ? 1 : months <= 18 ? 3 : months <= 48 ? 6 : 12;
  const xTicks = Array.from({ length: Math.floor(months / xStep) + 1 }, (_, i) => i * xStep);

  const pick = (clientX: number, rect: DOMRect) => {
    const svgX = ((clientX - rect.left) / rect.width) * WIDTH;
    const i = Math.round(((svgX - PAD.left) / (WIDTH - PAD.left - PAD.right)) * months);
    setActive(Math.min(months, Math.max(0, i)));
  };

  return (
    <figure>
      {lines.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-muted">
          {lines.map((l) => (
            <span key={l.id} className="flex items-center gap-1.5">
              <svg width="20" height="8" aria-hidden>
                <line x1="0" y1="4" x2="20" y2="4" stroke={l.color} strokeWidth="2" strokeDasharray={l.dashed ? "4 3" : undefined} />
              </svg>
              {l.label}
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full touch-none select-none focus:outline-none focus-visible:outline-2 focus-visible:outline-indigo"
          role="img"
          aria-label="Total debt over time"
          tabIndex={0}
          onPointerMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerDown={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") setActive((a) => Math.min(months, (a ?? -1) + 1));
            else if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? 1) - 1));
            else return;
            e.preventDefault();
          }}
        >
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--ink-muted)">
                {compactPeso(t)}
              </text>
            </g>
          ))}
          {xTicks.map((m) => (
            <text key={m} x={x(m)} y={HEIGHT - 8} textAnchor="middle" fontSize="11" fill="var(--ink-muted)">
              {m === 0 ? "Now" : monthLabel(m)}
            </text>
          ))}

          {active !== null && (
            <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke="var(--ink-muted)" strokeWidth={1} />
          )}

          {lines.map((l) => (
            <g key={l.id}>
              <polyline
                points={l.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
                fill="none"
                stroke={l.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeDasharray={l.dashed ? "6 4" : undefined}
              />
              {l.result.monthsToDebtFree !== null && (
                <circle
                  cx={x(l.values.length - 1)}
                  cy={y(0)}
                  r={4.5}
                  fill={l.color}
                  stroke="var(--paper)"
                  strokeWidth={2}
                />
              )}
              {active !== null && (
                <circle cx={x(active)} cy={y(valueAt(l.values, active))} r={4} fill={l.color} stroke="var(--paper)" strokeWidth={2} />
              )}
            </g>
          ))}
        </svg>

        {active !== null && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 w-60 rounded-md border border-line bg-surface p-2.5 text-xs shadow-lg"
            style={{
              left: `${(x(active) / WIDTH) * 100}%`,
              transform: `translateX(${active > months / 2 ? "calc(-100% - 12px)" : "12px"})`,
            }}
          >
            <p className="font-semibold">{active === 0 ? "Today" : monthLabel(active, "numeric")}</p>
            {lines.map((l) => (
              <p key={l.id} className="mt-1 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-ink-muted">
                  <span className="h-0.5 w-3" style={{ background: l.color }} />
                  {lines.length > 1 ? l.label : "Still owed"}
                </span>
                <span className="tabular-nums">{formatPeso(valueAt(l.values, active))}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      <figcaption className="mt-3 flex flex-col gap-1 text-sm">
        {lines.map((l) => (
          <span key={l.id} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: l.color }} aria-hidden />
            <span>
              {lines.length > 1 && <span className="text-ink-muted">{l.label}: </span>}
              {l.result.monthsToDebtFree === null
                ? "not debt-free within 50 years"
                : `debt-free in ${monthLabel(l.result.monthsToDebtFree, "numeric")}`}
            </span>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
