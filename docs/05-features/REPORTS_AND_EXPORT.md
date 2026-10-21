# Feature: Reports and CSV Export

Status: Approved · Phase: 6 (CSV), 8 (reports) · Requirements: RPT-01…05

## Reports tab

- Period switcher: **Week · Month · Custom**. Arrows ◀ ▶ move to previous/next period; cannot go past the current period for Week/Month.
- Week uses the `week_start` setting.
- Summary: Income, Expense, Net (income − expense), Avg spend per day (expense ÷ days elapsed in the period up to today).
- **Category breakdown**: Expense / Income toggle; donut + list (amount, %, count). Tap a category → Transactions list filtered to it and the period.
- **Trend**: bar chart — daily bars for Week/Month, weekly bars for custom ranges > 31 days.
- "Upcoming in this period" line if future-dated transactions fall in the range (FR-3.2).
- Empty period: "No entries in this period."
- Caption: "Udhaar is not included."

## CSV export

From Reports (current period) and from More → Export.

### Transactions CSV (RPT-04)

`hisaab-transactions-2026-10-01_to_2026-10-31.csv`

| Column | Example |
|---|---|
| date | 2026-10-21 |
| type | expense |
| amount_inr | 450.00 |
| category | Food |
| payment_method | upi |
| description | Lunch |
| notes | With office team |
| receipts | 2 |
| id | 3f0c…  |

### Udhaar CSV (RPT-05)

`hisaab-udhaar-2026-10-21.csv` — columns: `date, person, direction (gave/got), amount_inr, payment_method, note, person_balance_after, id`.

### CSV rules

- UTF-8 **with BOM** so Excel shows ₹ and Hindi names correctly; comma separator; CRLF line endings; RFC 4180 quoting.
- Amounts as plain decimal rupees with 2 decimals (`1234.50`), no `₹`, no grouping — for spreadsheets.
- Formula-injection guard: text cells starting with `=`, `+`, `-`, `@` are prefixed with `'`.
- File written to `cache/exports`, then share sheet (save to Drive/Files, send via WhatsApp/email). Old exports in cache are cleared on next export.

## Acceptance

- Month report totals equal the dashboard for the current month.
- Week spanning 28 Dec – 3 Jan shows entries from both years.
- February 2028 month report covers 1–29 Feb.
- CSV opens in Excel / Google Sheets with correct ₹, Hindi text, and numbers as numbers.
