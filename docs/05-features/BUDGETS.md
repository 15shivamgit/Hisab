# Feature: Budgets

Status: Approved · Phase: 8 · Requirements: BUD-01…04 · Rules: FINANCIAL_RULES.md §5

## Screen (More → Budgets, or from the dashboard card)

- **Overall monthly budget** card: amount, spent this month, remaining, progress bar. [Set] / [Edit] / [Remove].
- **Category budgets** list: each expense category with a budget → progress bar; "+ Add category budget" → pick an expense category without a budget → amount.
- Hint if the sum of category budgets > overall: "Your category budgets add up to more than your overall budget."

## Progress states

| State | Condition | Visual |
|---|---|---|
| Normal | spent < 80% | Primary colour bar |
| Warning | 80% ≤ spent ≤ 100% | Amber bar + "80% used" |
| Over | spent > 100% | Red bar, full width + "₹1,200 over" |

Text always includes numbers ("₹8,200 of ₹10,000"), never colour alone.

## Rules

- Only expense categories. Amount > 0, same max as transactions.
- Same budget applies every month (no per-month history in v1).
- Future-dated expenses don't count (FR-3.2). Udhaar never counts.

## Acceptance

- Budget ₹10,000, expenses ₹7,999 → normal; ₹8,000 → warning; ₹10,000 → warning (100%); ₹10,001 → over.
- Removing a budget removes it from the dashboard.
- Month rollover: on 1st of the month spent resets to that month's expenses.
