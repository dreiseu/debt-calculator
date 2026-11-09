-- Utang Tracker schema.
-- Money is stored in integer centavos (bigint), rates as fractions (0.03 = 3%).
-- Every table is owned by one user and protected by row-level security.

-- Settings that exist once per user.
create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  emergency_fund bigint not null default 0 check (emergency_fund >= 0),
  emergency_fund_target bigint not null default 0 check (emergency_fund_target >= 0),
  updated_at timestamptz not null default now()
);

-- Monthly income sources and expenses.
create table public.budget_items (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  type text not null check (type in ('income', 'expense')),
  name text not null default '',
  amount bigint not null default 0 check (amount >= 0),
  position integer not null default 0
);

-- Income expected later: bonuses, raises, 13th month pay.
create table public.future_incomes (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null default '',
  kind text not null check (kind in ('one_time', 'monthly', 'yearly')),
  amount bigint not null default 0 check (amount >= 0),
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  end_month text check (end_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  share_to_debt double precision not null default 1 check (share_to_debt between 0 and 1),
  position integer not null default 0,
  constraint end_after_start check (end_month >= month)
);

-- Credit cards and loans. Columns used depend on kind; the checks below
-- make sure each kind has the fields it needs.
create table public.debts (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (length(trim(name)) > 0),
  kind text not null check (kind in ('revolving', 'installment', 'add_on')),
  due_day smallint check (due_day between 1 and 31),
  late_fee bigint not null default 0 check (late_fee >= 0),
  original_balance bigint check (original_balance >= 0),
  position integer not null default 0,
  created_at timestamptz not null default now(),

  -- revolving
  balance bigint check (balance >= 0),
  monthly_interest_rate double precision check (monthly_interest_rate >= 0),
  min_payment_rate double precision check (min_payment_rate >= 0),
  min_payment_floor bigint check (min_payment_floor >= 0),
  minimum_due_override bigint check (minimum_due_override >= 0),

  -- installment
  installment_amount bigint check (installment_amount > 0),
  installments_remaining integer check (installments_remaining >= 0),

  -- add_on
  principal bigint check (principal > 0),
  monthly_add_on_rate double precision check (monthly_add_on_rate >= 0),
  term_months integer check (term_months > 0),
  months_paid integer check (months_paid >= 0),

  -- installment and add_on
  paid_ahead bigint check (paid_ahead >= 0),

  constraint revolving_fields check (
    kind <> 'revolving' or (
      balance is not null and monthly_interest_rate is not null
      and min_payment_rate is not null and min_payment_floor is not null
    )
  ),
  constraint installment_fields check (
    kind <> 'installment' or (installment_amount is not null and installments_remaining is not null)
  ),
  constraint add_on_fields check (
    kind <> 'add_on' or (
      principal is not null and monthly_add_on_rate is not null
      and term_months is not null and months_paid is not null and months_paid <= term_months
    )
  )
);

-- Payments the user actually made.
create table public.payments (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  debt_id uuid not null references public.debts on delete cascade,
  paid_on date not null,
  amount bigint not null check (amount > 0),
  balance_after bigint not null check (balance_after >= 0),
  created_at timestamptz not null default now()
);

create index budget_items_user_idx on public.budget_items (user_id);
create index future_incomes_user_idx on public.future_incomes (user_id);
create index debts_user_idx on public.debts (user_id);
create index payments_user_idx on public.payments (user_id);
create index payments_debt_idx on public.payments (debt_id);

-- Signed-in users reach these tables through the Data API; anonymous visitors don't.
-- Explicit so it works even when "automatically expose new tables" is off.
grant select, insert, update, delete
  on public.profiles, public.budget_items, public.future_incomes, public.debts, public.payments
  to authenticated;
revoke all
  on public.profiles, public.budget_items, public.future_incomes, public.debts, public.payments
  from anon;

-- Row-level security: each user can only see and change their own rows.
do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'budget_items', 'future_incomes', 'debts', 'payments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "Owners manage their rows" on public.%I for all to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)',
      t
    );
  end loop;
end $$;

-- A payment may only point at a debt the same user owns.
create function public.payment_debt_owned() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.debts d where d.id = new.debt_id and d.user_id = new.user_id) then
    raise exception 'Debt % does not belong to this user', new.debt_id;
  end if;
  return new;
end $$;

create trigger payments_debt_owned
  before insert or update on public.payments
  for each row execute function public.payment_debt_owned();
