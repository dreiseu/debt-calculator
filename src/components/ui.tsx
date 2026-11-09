"use client";

import { useEffect, useId, useState } from "react";
import { formatPeso, toCentavos, type Centavos } from "@/lib/debt";

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <header className="mb-8">
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink md:text-4xl">
        {title}
      </h1>
      {children && <p className="mt-2 max-w-prose text-ink-muted">{children}</p>}
    </header>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-xl font-semibold tracking-tight">{children}</h2>;
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: (id: string) => React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-ink placeholder:text-ink-muted/60 focus:border-indigo focus:outline-none";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

const toText = (value: number | undefined, scale: number) =>
  value === undefined ? "" : String(Math.round((value / scale) * 1e6) / 1e6);

/**
 * Number input that keeps what the user typed (e.g. "12.") while reporting
 * parsed values, and re-syncs when the value changes from outside.
 */
function ScaledNumberInput({
  value,
  onChange,
  scale,
  prefix,
  suffix,
  ...rest
}: {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  scale: number;
  prefix?: string;
  suffix?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [text, setText] = useState(() => toText(value, scale));

  useEffect(() => {
    const parsed = text.trim() === "" ? undefined : Number(text) * scale;
    const same =
      parsed === value || (parsed !== undefined && value !== undefined && Math.abs(parsed - value) < 1e-6);
    if (!same) setText(toText(value, scale));
    // Only react to outside changes, not to typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, scale]);

  return (
    <div className="relative">
      {prefix && (
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-muted">
          {prefix}
        </span>
      )}
      <input
        {...rest}
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          const next = e.target.value.replace(/[^\d.]/g, "");
          setText(next);
          const number = Number(next);
          onChange(next === "" || Number.isNaN(number) ? undefined : number * scale);
        }}
        className={`${inputClass} ${prefix ? "pl-7" : ""} ${suffix ? "pr-14" : ""}`}
      />
      {suffix && (
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-ink-muted">
          {suffix}
        </span>
      )}
    </div>
  );
}

/** Peso amount input; value is in centavos. */
export function MoneyInput({
  value,
  onChange,
  ...rest
}: {
  value: Centavos | undefined;
  onChange: (value: Centavos | undefined) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <ScaledNumberInput
      {...rest}
      value={value}
      scale={100}
      prefix="₱"
      onChange={(v) => onChange(v === undefined ? undefined : toCentavos(v / 100))}
    />
  );
}

/** Percentage input; value is a fraction (0.03 = 3%). */
export function PercentInput({
  value,
  onChange,
  suffix = "%",
  ...rest
}: {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  suffix?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return <ScaledNumberInput {...rest} value={value} scale={0.01} suffix={suffix} onChange={onChange} />;
}

type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-indigo text-surface hover:opacity-90",
  secondary: "border border-line bg-surface text-ink hover:border-indigo",
  quiet: "text-indigo hover:bg-indigo-soft",
  danger: "text-berry hover:bg-berry-soft",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      {...props}
      className={`rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50 ${buttonVariants[variant]} ${className}`}
    />
  );
}

type Tone = "ink" | "mint" | "ochre" | "berry" | "muted";

const toneClass: Record<Tone, string> = {
  ink: "text-ink",
  mint: "text-mint",
  ochre: "text-ochre",
  berry: "text-berry",
  muted: "text-ink-muted",
};

export function Peso({ amount, tone = "ink", className = "" }: { amount: Centavos; tone?: Tone; className?: string }) {
  return <span className={`tabular-nums ${toneClass[tone]} ${className}`}>{formatPeso(amount)}</span>;
}

/** A labelled figure. Label sits under the value so the number leads. */
export function Figure({
  label,
  amount,
  tone = "ink",
  size = "md",
}: {
  label: string;
  amount: Centavos;
  tone?: Tone;
  size?: "md" | "lg";
}) {
  return (
    <div>
      <Peso
        amount={amount}
        tone={tone}
        className={`block font-display font-semibold tracking-tight ${size === "lg" ? "text-3xl md:text-4xl" : "text-xl"}`}
      />
      <span className="text-sm text-ink-muted">{label}</span>
    </div>
  );
}

/** Single-value meter: how much of something is done. */
export function ProgressMeter({ fraction, label }: { fraction: number; label: string }) {
  const percent = Math.floor(Math.min(1, Math.max(0, fraction)) * 100);
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-2 w-full overflow-hidden rounded-full bg-line"
    >
      <div className="h-full rounded-full bg-mint transition-[width] duration-500" style={{ width: `${percent}%` }} />
    </div>
  );
}

export function Notice({ tone, children }: { tone: "ochre" | "berry" | "mint"; children: React.ReactNode }) {
  const styles = {
    ochre: "border-ochre bg-ochre-soft",
    berry: "border-berry bg-berry-soft",
    mint: "border-mint bg-mint-soft",
  };
  return <div className={`rounded-md border-l-4 px-4 py-3 text-sm ${styles[tone]}`}>{children}</div>;
}

export function EmptyState({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line px-6 py-10">
      <p className="font-display text-lg font-semibold">{title}</p>
      <div className="mt-2 text-ink-muted">{children}</div>
    </div>
  );
}
