# Feature: Dashboard

Status: Approved · Phase: 4 (basic), 7 (udhaar cards), 8 (budgets, charts) · Requirements: DASH-01…09

## Layout (top to bottom)

1. **Header** — month name ("October 2026"), settings shortcut.
2. **Backup nudge** (conditional, DASH-08; exact rule in BACKUP_AND_RESTORE.md § Backup reminder) — "Last backup 12 days ago. Back up now" → Backup screen. Dismiss hides it for 3 days (`backup_nudge_dismissed_until`).
3. **This month card** (DASH-01)
   - Income ₹X · Expense ₹Y
   - "Net (income − expense)": ₹Z, green if ≥ 0, red if < 0
   - Caption: "Based on your entries. Udhaar not included." (DASH-09)
4. **Quick actions** (DASH-07) — four large buttons: `+ Expense`, `+ Income`, `I gave`, `I got`. The udhaar buttons open a person picker (with "+ Add person"; if nobody exists yet, the Add person form opens directly — see UDHAAR.md), then the entry form.
5. **Udhaar card** (DASH-05, DASH-06)
   - "You will get ₹A · from N people" (green, ↓)
   - "You owe ₹B · to M people" (red/orange, ↑)
   - Up to 3 rows: overdue first (red badge "Overdue"), then due within 7 days ("Due in 3 days"). "See all" → Udhaar tab.
   - Hidden entirely until the user has at least one person.
6. **Budget card** (DASH-04) — overall progress bar + up to 3 category budgets with the highest percentage. "Manage" → Budgets. Empty: "Set a monthly budget".
7. **Spending by category** (DASH-03) — donut chart + top 5 list with amount and %. Tap → Reports filtered to that category.
8. **Recent transactions** (DASH-02) — last 5 (not future-dated). "See all" → Transactions tab.

**Phase 7:** quick actions `I gave` / `I got` (→ person picker, or Add person when nobody exists yet) and the udhaar card (`UdhaarCard`: totals with counts, up to 3 people — overdue first, then due soon — and "See all"); hidden until the first person, shown on the first-run screen too.

**Phase 6:** backup nudge added under the header (`BackupNudge`, rule in `src/services/backupNudge.ts`).

**Phase 4 implementation:** header (month name), This month card, quick actions `+ Expense` / `+ Income`, spending by category as a top-5 list with % (the donut comes in Phase 8; rows are not tappable until Reports exists), recent transactions with "See all", welcome card on first run, skeleton loading, error with retry. Not yet: settings shortcut in the header (More tab is one tap away), backup nudge (Phase 6), udhaar card and buttons (Phase 7), budget card (Phase 8).

## Data

`dashboardService.getSummary(today)` in one call; refreshed via `useDbQuery` on `transactions`, `categories`, `budgets`, `people`, `udhaar_entries`, `app_settings`.

## States

| State | Behaviour |
|---|---|
| Loading | Skeleton cards (no spinners over blank screen) |
| First run, no data | Welcome card: "Add your first expense" + quick actions; other cards hidden |
| Error | ErrorState with retry |

## Acceptance

- Totals match the Reports screen for the same month.
- A future-dated expense in this month does not change the totals until its date.
- Udhaar entries never change the This-month card.
- Rotating the date past midnight (app in background → foreground next day) refreshes "today".
