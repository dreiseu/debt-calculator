# Utang Tracker

A debt calculator and payoff planner for Filipino credit card and lending-app debt. Enter your
income, expenses, credit cards and loans to see what's left after each payment, which debt to pay
first (Avalanche or Snowball), and the month you'll be debt-free.

- **Three debt types:** credit cards and credit lines (monthly interest on the balance), fixed
  installments (BillEase, SLoan), and add-on rate loans, with the real monthly rate revealed
- **What-if calculator:** pay any amount and see interest, late fees and what's left
- **Payoff plan:** Avalanche vs Snowball, payoff timeline, and a debt-over-time chart that includes
  future income like 13th month pay and raises
- **Progress tracking:** payment log, milestones, emergency fund goal
- **Guest mode or account:** works instantly in the browser; sign up to save to Supabase

Built with Next.js, TypeScript, Tailwind CSS, Supabase (Postgres + Auth) and Vitest. All money math
runs in integer centavos.

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. Without Supabase keys the app runs in guest mode and saves to the
browser.

```bash
npm test
```

## Connect Supabase (accounts and cloud saving)

1. Create a free project at [supabase.com](https://supabase.com/dashboard).
2. In the project, open **SQL Editor**, paste the contents of
   [`supabase/migrations/20261109000000_init.sql`](supabase/migrations/20261109000000_init.sql) and
   click **Run**. This creates the tables and row-level security policies.
3. Open **Authentication → Sign In / Providers → Email** and turn off **Confirm email**. Supabase's
   built-in email service only delivers to your own team's addresses, so confirmation emails would
   never reach other users. (To keep confirmation on, set up custom SMTP first.)
4. Open **Authentication → URL Configuration** and set **Site URL** to `http://localhost:3000`
   (change it to your Vercel URL when you deploy).
5. Open **Project Settings → API Keys** and copy the **Project URL** and the **publishable key**
   into `.env.local`:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

   The legacy `anon` key works too. Never put the `service_role` or secret key here.
6. Restart `npm run dev`.

### Local Supabase instead (optional)

With Docker running, `npx supabase start` runs Supabase on your machine and applies the migration.
Use the API URL and publishable key it prints.

## How the data is stored

| Table | What it holds |
|---|---|
| `profiles` | Emergency fund saved and goal |
| `budget_items` | Monthly income and expenses |
| `future_incomes` | One-time, monthly and yearly future income |
| `debts` | Credit cards and loans; check constraints require the right fields for each kind |
| `payments` | Logged payments, linked to a debt the same user owns |

Every table has row-level security so users only ever see their own rows. The app saves only the
rows that changed, shortly after you stop typing.
