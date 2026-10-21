# Default Categories

Status: Approved · Last updated: 2026-10-21

Seeded once on first launch by `categoryRepository.seedDefaultsIfEmpty`. Icons are **Material Symbols** names rendered with `expo-symbols` (owner decision 2026-10-21, Option A). Every name below was checked against the installed `expo-symbols` 58.0.4 symbol list; a Phase 3 test must assert that every seeded icon (and every icon in the category icon picker) exists in that list.

## Expense

| # | Name | Icon | Colour |
|---|---|---|---|
| 1 | Food & Dining | `restaurant` | cat.orange |
| 2 | Groceries | `shopping_cart` | cat.green |
| 3 | Transport | `directions_bus` | cat.blue |
| 4 | Fuel | `local_gas_station` | cat.amber |
| 5 | Rent | `home` | cat.indigo |
| 6 | Bills & Recharge | `smartphone` | cat.teal |
| 7 | Shopping | `shopping_bag` | cat.pink |
| 8 | Health | `medical_services` | cat.red |
| 9 | Education | `school` | cat.purple |
| 10 | Entertainment | `movie` | cat.purple |
| 11 | Family | `groups` | cat.blue |
| 12 | Gifts & Donations | `card_giftcard` | cat.pink |
| 13 | Travel | `flight` | cat.teal |
| 14 | Personal Care | `spa` | cat.amber |
| 15 | Other | `more_horiz` | cat.slate | *(system, `is_system = 1`)*

## Income

| # | Name | Icon | Colour |
|---|---|---|---|
| 1 | Salary | `work` | cat.green |
| 2 | Business / Freelance | `laptop` | cat.blue |
| 3 | Pocket Money | `account_balance_wallet` | cat.amber |
| 4 | Refund | `currency_exchange` | cat.teal |
| 5 | Interest / Gift | `savings` | cat.purple |
| 6 | Other | `more_horiz` | cat.slate | *(system)*

Notes:
- "Refund" exists because refunds are recorded as income (FR-3.7).
- "Interest / Gift" exists for extra money a friend pays beyond the udhaar amount (FR-4.5).
- There is intentionally **no** "Loan" or "Udhaar" category — udhaar has its own section and must never be recorded as income/expense.
