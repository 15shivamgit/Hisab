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

## Phase 8 implementation

- Screen `/budgets` (More → Budgets, or "Manage" / "Set a monthly budget" on the dashboard card). Empty state "No budgets set" → Set budget (overall).
- Overall card: amount, progress bar, numbers line, [Edit] / [Remove]. Category cards: icon, name, amount, progress bar, numbers line; tap → edit sheet (amount + Remove). "+ Add category budget" → sheet with chips of active expense categories that have no budget; when none are left: "Every expense category already has a budget."
- Numbers line: normal "₹4,000 of ₹10,000 · ₹6,000 left"; warning "₹8,200 of ₹10,000 · 82% used · ₹1,800 left"; over "₹11,200 of ₹10,000 · ₹1,200 over". Percent is rounded down, so 79.99% shows as 79% and stays normal.
- Remove asks for confirmation (UI_COPY.md § Confirmations); entries are never touched.
- Logic: `src/lib/budget.ts` (`budgetProgress`, integer maths: warning when `spent × 100 ≥ budget × 80`), `src/services/budgetService.ts` (`getOverview`, `dashboardCard`, `setOverall`, `setForCategory`, `remove`). Spent = this month's expense transactions up to today; udhaar lives in other tables and never counts.

## Acceptance

- Budget ₹10,000, expenses ₹7,999 → normal; ₹8,000 → warning; ₹10,000 → warning (100%); ₹10,001 → over.
- Removing a budget removes it from the dashboard.
- Month rollover: on 1st of the month spent resets to that month's expenses.
