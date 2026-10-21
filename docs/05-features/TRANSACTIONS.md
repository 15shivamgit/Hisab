# Feature: Transactions

Status: Approved · Phase: 4 · Requirements: TXN-01…09

## Add / edit form

| Field | Control | Rules |
|---|---|---|
| Type | Segmented control: Expense / Income | Default from entry point. Changing type clears category if it no longer matches. |
| Amount | `AmountInput`, numeric keypad, auto-focus | `parseRupeesToPaise` (FR-1.5). Errors: "Enter an amount", "Amount must be more than ₹0", "Up to 2 decimal places", "Maximum is ₹1,00,00,000" |
| Category | Grid of chips (icon + name) for the selected type; last-used first | Required. Archived categories hidden (but shown if editing an old entry that uses one). "+ New" opens quick-create. |
| Date | Date field, default today; shortcuts "Today", "Yesterday" | Valid calendar date. Future allowed → shows hint "This will be counted on 25 Oct" |
| Payment method | Chips: Cash, UPI, Bank, Card, Other | Default = last used |
| Description | Single line, optional | ≤ 100 chars, trimmed, empty → null |
| Notes | Multiline, optional | ≤ 1000 chars |
| Receipts | Row of thumbnails + "Add receipt" | See RECEIPTS.md; max 5 |

- Save button always visible above the keyboard. Disabled while saving (no double-submit).
- Back with unsaved changes → "Discard changes?" dialog.
- After save: toast "Expense saved", return to previous screen.
- Zod schema in `src/features/transactions/schema.ts` is shared by form and service.

## List (TXN-04…08)

- Grouped by date with a day header: "Today", "Yesterday", "Mon, 19 Oct". Each group shows the day's net.
- Row: category icon, description (or category name), payment method, receipt 📎 icon if any, amount (green `+₹` income, default text `−₹` expense — colour plus sign, NFR-09).
- Future-dated rows grouped at the top under "Upcoming" with a badge.
- Search bar (debounced 300 ms) over description + notes, plus exact amount when the text is a valid amount (`450`, `1,250.50`). LIKE wildcards in user input are escaped. Placeholder: "Search notes or amount".
- Filter sheet: type, categories (multi), payment methods (multi), date range (This month / Last month / Custom). Active filters shown as removable chips + "Clear all".
- Sort menu: Newest, Oldest, Highest amount, Lowest amount.
- Summary bar for the current filter: count, income total, expense total (excluding future-dated).
- Pagination: 50 per page, infinite scroll.

## Detail

Shows all fields, receipts gallery, created/updated time. Actions: Edit, **Duplicate**, Delete.

**Duplicate (TXN-10):** opens the add form pre-filled with type, amount, category, payment method, description, and notes; date = today; receipts are not copied. Nothing is saved until the user taps Save. Handy for repeated expenses (rent, recharge) since recurring transactions are out of scope.

## Delete (TXN-03)

Dialog: "Delete this expense of ₹450? Its 2 receipts will also be deleted. This can't be undone." → `transactionService.delete`.

## Edge cases

| Case | Behaviour |
|---|---|
| Category archived after use | Old entries still show it; it is hidden from pickers |
| Entry opened from a deep link that was deleted | `NOT_FOUND` toast and go back |
| Very long description | Single line with ellipsis in list, full in detail |
| Amount input "1,00,000.5" | Accepted → 10000050 paise |
| Amount input ".5" | Accepted → 50 paise |
| Amount input "1.234" | Rejected |

## Acceptance

- Created, edited, and deleted transactions persist across app restart (force-stop and reopen).
- A transaction can be saved without receipts.
- Filters + search + sort combine correctly (repository tests).
- Searching `450` finds a ₹450.00 entry whose notes don't contain "450"; searching `abc` does not match amounts.
- Duplicate creates nothing until saved; the saved copy has today's date and no receipts.
- Category type mismatch is rejected by the DB trigger even if the UI is bypassed (repository test).
