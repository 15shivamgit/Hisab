# Financial Rules

Status: Approved · Last updated: 2026-10-21

**This is the single source of truth for all money logic.** Any code that stores, calculates, or displays money MUST follow these rules. Test cases: [../10-testing/FINANCIAL_TEST_CASES.md](../10-testing/FINANCIAL_TEST_CASES.md).

## 1. Money representation

| Rule | Detail |
|---|---|
| FR-1.1 | Currency is INR only. |
| FR-1.2 | All persisted amounts are **integer paise** (`INTEGER` in SQLite, `number` in TS, always `Number.isInteger`). |
| FR-1.3 | Stored amounts are always positive. Direction comes from `type` (income/expense) or `direction` (gave/got), never from a negative sign. |
| FR-1.4 | Minimum amount: ₹0.01 (1 paise). Maximum per entry: ₹1,00,00,000 (1 crore = `1_000_000_000` paise). Sums stay far below `Number.MAX_SAFE_INTEGER`. |
| FR-1.5 | User input is parsed by `parseRupeesToPaise(text)`: accepts digits, optional Indian/international commas, at most 2 decimals. Rejects empty, zero, negative, >2 decimals, letters, and values above the max. **No `parseFloat` → `* 100`** (float error); parse integer and fraction parts as strings. |
| FR-1.6 | Display uses `formatPaise(paise)` with `en-IN` grouping: `₹1,25,000.50`. Whole rupees MAY hide `.00` in compact views (`₹1,25,000`). |
| FR-1.7 | Percentages (budgets) are computed from integers and rounded down for display; colour thresholds use the exact integer comparison. |

## 2. Dates and time

| Rule | Detail |
|---|---|
| FR-2.1 | Business dates (`txn_date`, `entry_date`, `return_by_date`) are **local calendar dates** stored as `YYYY-MM-DD` text. No time, no timezone. |
| FR-2.2 | Audit timestamps (`created_at`, `updated_at`) are UTC ISO 8601 strings (`2026-10-21T08:15:30.123Z`). |
| FR-2.3 | "Today" = the device's local calendar date, computed once per screen render via `todayLocal()`. |
| FR-2.4 | Month range = first day to last day of the month, inclusive. Correct for 28/29/30/31-day months and leap years (2024, 2028; 2100 is not a leap year). |
| FR-2.5 | Week range = 7 days starting on the configured week-start day (default Monday), inclusive. Weeks may span two months or two years. |
| FR-2.6 | Custom range requires `start ≤ end`; both valid dates. |
| FR-2.7 | Date validation rejects impossible dates (`2026-02-30`, `2026-13-01`). Validate with a real calendar check, not just a regex. |
| FR-2.8 | Range queries compare `YYYY-MM-DD` strings (lexicographic order = chronological order). |

## 3. Transactions, totals, cash flow

| Rule | Detail |
|---|---|
| FR-3.1 | `income(period)` = sum of income transactions with `start ≤ txn_date ≤ min(end, today)`. Same for `expense(period)`. |
| FR-3.2 | **Future-dated** transactions (`txn_date > today`) are allowed (e.g. planned rent). They are listed with an "Upcoming" badge and **excluded from all totals, budgets, and charts** until their date arrives. Reports for a period that includes future days MAY show a separate "Upcoming in this period" total. |
| FR-3.3 | `recordedCashFlow(period)` = `income − expense`. Labelled "Recorded cash flow" or "Net (income − expense)". It may be negative. Never labelled "balance" or "money in bank". |
| FR-3.4 | All totals are derived from rows at query time. No stored running totals. |
| FR-3.5 | A transaction's category type must equal the transaction type. |
| FR-3.6 | **No accounts and no transfers** in v1. Moving money between the user's own bank/UPI/cash is simply not recorded. |
| FR-3.7 | Refunds: record as **income** with category "Refund" (simple, explicit). They do not reduce expense totals. |

## 4. Udhaar

The udhaar model is a **per-person ledger**. There are no loans, no interest, no statuses. See [../05-features/UDHAAR.md](../05-features/UDHAAR.md).

| Rule | Detail |
|---|---|
| FR-4.1 | Each entry has `direction`: `gave` (money from user to person) or `got` (money from person to user), and a positive `amount_paise`. |
| FR-4.2 | `balance(person)` = Σ `gave` − Σ `got`. Always derived; never stored. |
| FR-4.3 | Balance > 0 → "You will get ₹|balance|". Balance < 0 → "You owe ₹|balance|". Balance = 0 → "Settled". |
| FR-4.4 | **Udhaar is never income or expense.** Lending, borrowing, and every return are excluded from income, expense, cash flow, budgets, category charts, and the transactions list. |
| FR-4.5 | Interest is out of scope. If a friend pays extra as thanks/interest and the user wants it counted as income, the user records the extra part as a normal income transaction (category "Interest / Gift"), and only the returned amount as an udhaar `got` entry. |
| FR-4.6 | Over-return: if a new entry would change the sign of the balance (e.g. balance +₹7,000, entry `got` ₹8,000 → −₹1,000), the app shows a confirmation explaining the new state ("You will owe Rahul ₹1,000"). The user may continue or correct the amount. |
| FR-4.7 | Top-up: giving more money to someone who already owes the user is just another `gave` entry. Balance increases. |
| FR-4.8 | Corrections: entries can be edited or deleted (with confirmation). Because the balance is derived, it is always consistent with the visible history. |
| FR-4.9 | Dashboard totals: `youWillGet` = Σ of positive person balances; `youOwe` = Σ of |negative person balances|. These are **not netted** against each other. |
| FR-4.10 | Overdue: `return_by_date < today` AND balance ≠ 0. Due soon: `today ≤ return_by_date ≤ today + 7 days` AND balance ≠ 0. |
| FR-4.11 | When a person's balance becomes 0, the app offers to clear the return-by date (and cancels the reminder). |
| FR-4.12 | Udhaar entry dates MUST NOT be after today. Future-dated udhaar entries are rejected — money with a friend is recorded when it actually moves. Use the return-by date for expected future returns. |

## 5. Budgets

| Rule | Detail |
|---|---|
| FR-5.1 | Budgets are monthly and repeat every month with the same amount until changed. |
| FR-5.2 | Overall budget compares against total expense of the current month (FR-3.1). |
| FR-5.3 | Category budget compares against expense in that category for the current month. Only expense categories can have budgets. |
| FR-5.4 | Budget amount must be > 0. "No budget" means no row (there is no zero budget). |
| FR-5.5 | Progress = `spent / budget`. States: normal (< 80%), warning (≥ 80% and ≤ 100%), over (> 100%). Remaining = `budget − spent`, shown as "₹X over" when negative. |
| FR-5.6 | Sum of category budgets may exceed the overall budget; the UI shows a gentle hint, not an error. |
| FR-5.7 | Archived categories keep their budgets hidden; budgets on archived categories are not shown in progress. |

## 6. Rounding and aggregation

- All aggregation is integer addition in SQL (`SUM(amount_paise)`) or in TS with integers.
- `SUM` of no rows returns `NULL` in SQL — always `COALESCE(SUM(...), 0)`.
- Averages (e.g. "avg per day" in reports) are computed as integer division rounded half-up for display only; never stored.
