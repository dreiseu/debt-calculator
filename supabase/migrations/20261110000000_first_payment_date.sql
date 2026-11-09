-- First payment date for every kind of debt, plus the total number of
-- installments so passed due dates can be counted as paid.
alter table public.debts
  add column first_payment_date date,
  add column total_installments integer check (total_installments > 0);
