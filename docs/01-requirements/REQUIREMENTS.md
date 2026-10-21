# Functional Requirements

Status: Approved · Last updated: 2026-10-21

Each requirement has an ID used in tests and phase reports. Feature docs in [../05-features](../05-features/) hold the detailed behaviour. Money rules are in [FINANCIAL_RULES.md](FINANCIAL_RULES.md).

## Dashboard — `DASH` ([spec](../05-features/DASHBOARD.md))

| ID | Requirement |
|---|---|
| DASH-01 | Show current month income, expense, and recorded cash flow (income − expense), counting only entries dated today or earlier. |
| DASH-02 | Show up to 5 most recent transactions with a link to the full list. |
| DASH-03 | Show category-wise spending for the current month (chart + top categories). |
| DASH-04 | Show overall budget progress and up to 3 category budgets with the highest percentage used. |
| DASH-05 | Show udhaar totals: "You will get" (sum of positive balances, count of people) and "You owe" (sum of negative balances, count of people). |
| DASH-06 | Show overdue and due-in-next-7-days udhaar people. |
| DASH-07 | Quick actions: Add expense, Add income, Udhaar gave, Udhaar got. |
| DASH-08 | Show a backup nudge when data changed since the last backup and either no backup was ever made (with ≥ 10 entries) or the last backup is older than 7 days. Dismissible for 3 days. |
| DASH-09 | Clearly label that udhaar is not included in income/expense. |

## Transactions — `TXN` ([spec](../05-features/TRANSACTIONS.md))

| ID | Requirement |
|---|---|
| TXN-01 | Create a transaction: type (income/expense), amount, category (matching type), date, payment method; optional description and notes. |
| TXN-02 | Edit any field of a transaction. |
| TXN-03 | Delete a transaction after confirmation; its receipts are deleted too. |
| TXN-04 | List transactions grouped by date, newest first, with infinite scroll. |
| TXN-05 | Search by description, notes, and exact amount (typing `450` or `450.00` finds ₹450.00 entries). |
| TXN-06 | Filter by type, category, payment method, date range. |
| TXN-07 | Sort by date or amount, ascending or descending. |
| TXN-08 | Future-dated transactions show an "Upcoming" badge and are excluded from totals until their date. |
| TXN-09 | Validation errors are shown inline next to the field. |
| TXN-10 | Duplicate a transaction: opens a new form pre-filled from it with today's date and no receipts. |

## Categories — `CAT` ([spec](../05-features/CATEGORIES.md))

| ID | Requirement |
|---|---|
| CAT-01 | Default income and expense categories are created on first launch. |
| CAT-02 | Create, rename, recolour, and re-icon categories. |
| CAT-03 | Names are unique per type (case-insensitive). |
| CAT-04 | A category in use cannot be deleted; it can be archived (hidden from pickers, kept on old entries). |
| CAT-05 | The "Other" category of each type cannot be deleted, archived, or renamed. |

## Receipts — `RCP` ([spec](../05-features/RECEIPTS.md))

| ID | Requirement |
|---|---|
| RCP-01 | Attach images from camera or gallery; transactions without receipts are allowed. |
| RCP-02 | Up to 5 receipts per transaction. |
| RCP-03 | Images are compressed and copied into app-private storage; temporary picker URIs are never stored. |
| RCP-04 | Full-screen preview with pinch-zoom and swipe between receipts. |
| RCP-05 | Replace and delete individual receipts. |
| RCP-06 | Handle permission denial, unsupported files, oversized files, missing files, and low storage with clear messages. |
| RCP-07 | Unreferenced receipt files are cleaned up safely. |

## Udhaar — `UDH` ([spec](../05-features/UDHAAR.md))

| ID | Requirement |
|---|---|
| UDH-01 | Add a person with name (required), phone (optional), notes (optional). No contacts permission. |
| UDH-02 | Add an udhaar entry for a person: direction (gave/got), amount, date, payment method, optional note. |
| UDH-03 | Show each person's balance as "You will get ₹X", "You owe ₹X", or "Settled". |
| UDH-04 | Show the person's full entry history, newest first, with a running balance. |
| UDH-05 | Edit and delete entries (with confirmation); balance updates automatically. |
| UDH-06 | Warn before an entry flips the balance direction (e.g. friend returns more than owed). |
| UDH-07 | Optional return-by date per person; overdue badge when passed and balance ≠ 0. |
| UDH-08 | Local notification on the return-by date at the reminder time, if enabled and permitted. |
| UDH-09 | Share a reminder message via the share sheet, WhatsApp, or SMS. |
| UDH-10 | People list: search by name; filter All / You will get / You owe / Settled / Overdue; sort by amount or name. |
| UDH-11 | Archive a settled person; a person with entries cannot be deleted. |
| UDH-12 | Udhaar never affects income, expense, cash flow, budgets, or category reports. |

## Budgets — `BUD` ([spec](../05-features/BUDGETS.md))

| ID | Requirement |
|---|---|
| BUD-01 | Set one overall monthly budget. |
| BUD-02 | Set a monthly budget per expense category. |
| BUD-03 | Show spent, remaining, and percentage for the current month; warning at 80%, over-budget at >100%. |
| BUD-04 | Remove a budget. |

## Reports & export — `RPT` ([spec](../05-features/REPORTS_AND_EXPORT.md))

| ID | Requirement |
|---|---|
| RPT-01 | Weekly, monthly, and custom date-range reports. |
| RPT-02 | Totals: income, expense, cash flow; category breakdown; daily/weekly trend chart. |
| RPT-03 | Navigate to previous/next period. |
| RPT-04 | Export transactions for a range as CSV. |
| RPT-05 | Export udhaar entries as CSV. |

## Backup & restore — `BAK` ([spec](../05-features/BACKUP_AND_RESTORE.md))

| ID | Requirement |
|---|---|
| BAK-01 | Create a full backup file (all data + receipts) and save/share it outside the app. |
| BAK-02 | Restore from a backup file, replacing all current data after explicit confirmation. |
| BAK-03 | Validate the file completely before changing anything. |
| BAK-04 | Create an automatic safety backup of current data before restore. |
| BAK-05 | A failed or interrupted restore leaves either the old data or the new data — never a mix. |
| BAK-06 | Show last backup date; remind when outdated. |
| BAK-07 | Warn that uninstalling the app deletes all data unless a backup file exists outside the app. |

## Settings & security — `SET` ([spec](../05-features/SETTINGS_AND_APP_LOCK.md))

| ID | Requirement |
|---|---|
| SET-01 | Theme: system / light / dark. |
| SET-02 | Optional app lock using device biometrics or device PIN; lock on launch and after a configurable background timeout. Returning within 5 minutes from a system screen the app opened itself (camera, gallery, share sheet, WhatsApp/SMS, file picker) does not lock (ADR-016). |
| SET-03 | Reminder settings: on/off and time. |
| SET-04 | Week start day. |
| SET-05 | Manage categories and budgets. |
| SET-06 | Delete all data, with a typed confirmation. |
| SET-07 | About screen: version, privacy statement ("Your data never leaves this phone"), licences. |
| SET-08 | First-run onboarding explaining offline storage and backups. |
| SET-09 | Local error log without personal data, and "Copy diagnostic info" in About so a friend can send it to the owner. |
