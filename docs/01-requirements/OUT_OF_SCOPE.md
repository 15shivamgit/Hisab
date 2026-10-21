# Out of Scope (v1)

Status: Approved · Last updated: 2026-10-21

These are intentionally **not** built in v1. An agent MUST NOT implement them without the owner's approval and a doc update.

| Item | Why |
|---|---|
| Cloud sync, login, accounts, multi-device, family/shared ledgers | Offline, zero-cost, single-user product |
| Loan management with interest, EMIs, statuses, due schedules | Owner wants a simple udhaar history only (ADR-004) |
| Bank accounts, wallets, opening balances, transfers, reconciliation | Keeps the model simple; dashboard shows recorded cash flow only (ADR-006) |
| Recurring transactions | Possible v2 (`recurring_rules` table) |
| OCR / automatic receipt reading | Needs paid APIs or heavy on-device models |
| PDF receipts | Images only in v1 (ADR-008) |
| SMS / bank-message parsing | Privacy-sensitive permission; Play policy restrictions |
| Phone contacts import | Avoids contacts permission; manual names are enough |
| Multiple currencies | INR only |
| Backup **merge** | Replace-only restore is safer and simpler (ADR-009) |
| CSV import | CSV is export-only; backup/restore is the way to move data |
| Encrypted backup files, SQLCipher database encryption | Possible v2; v1 relies on Android file-based encryption and app lock, and warns about backup file privacy |
| Home-screen widgets, Wear OS, tablets layouts | Not needed for v1 |
| iOS build | Android only |
| Play Store publication | Optional future; costs US$25 |
| Splitting bills among friends | Different product (Splitwise-like) |
