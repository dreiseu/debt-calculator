import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProfileRow, RowChanges, Rows, RowTable } from "./rows";

/** Reads everything the signed-in user owns (row-level security filters by user). */
export async function loadRows(supabase: SupabaseClient): Promise<Rows> {
  const [profile, budgetItems, futureIncomes, debts, payments] = await Promise.all([
    supabase.from("profiles").select("emergency_fund, emergency_fund_target").maybeSingle(),
    supabase.from("budget_items").select("id, type, name, amount, position"),
    supabase
      .from("future_incomes")
      .select("id, name, kind, amount, month, end_month, share_to_debt, position"),
    supabase
      .from("debts")
      .select(
        "id, name, kind, due_day, late_fee, original_balance, first_payment_date, position, balance, monthly_interest_rate, min_payment_rate, min_payment_floor, minimum_due_override, installment_amount, installments_remaining, total_installments, principal, monthly_add_on_rate, term_months, months_paid, paid_ahead",
      ),
    supabase.from("payments").select("id, debt_id, paid_on, amount, balance_after"),
  ]);

  const error = [profile, budgetItems, futureIncomes, debts, payments].find((r) => r.error)?.error;
  if (error) throw error;

  return {
    profile: (profile.data as ProfileRow | null) ?? { emergency_fund: 0, emergency_fund_target: 0 },
    budget_items: budgetItems.data ?? [],
    future_incomes: futureIncomes.data ?? [],
    debts: debts.data ?? [],
    payments: payments.data ?? [],
  } as Rows;
}

// Parents before children when writing, children before parents when deleting.
const upsertOrder: RowTable[] = ["budget_items", "future_incomes", "debts", "payments"];
const deleteOrder: RowTable[] = ["payments", "debts", "future_incomes", "budget_items"];

/** Writes a set of changes. Throws on the first failure so the caller can retry. */
export async function pushChanges(supabase: SupabaseClient, userId: string, changes: RowChanges) {
  if (changes.profile) {
    const { error } = await supabase
      .from("profiles")
      .upsert({ user_id: userId, ...changes.profile, updated_at: new Date().toISOString() });
    if (error) throw error;
  }
  for (const table of upsertOrder) {
    const rows: object[] | undefined = changes.upserts[table];
    if (!rows?.length) continue;
    const { error } = await supabase.from(table).upsert(rows);
    if (error) throw error;
  }
  for (const table of deleteOrder) {
    const ids = changes.deletes[table];
    if (!ids?.length) continue;
    const { error } = await supabase.from(table).delete().in("id", ids);
    if (error) throw error;
  }
}
