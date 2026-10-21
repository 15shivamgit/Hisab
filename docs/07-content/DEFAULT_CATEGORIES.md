# Default Categories

Status: Approved · Last updated: 2026-10-21

Seeded once on first launch by `categoryRepository.seedDefaultsIfEmpty`. Icons are MaterialCommunityIcons names; `Verify:` each icon name exists in the installed version.

## Expense

| # | Name | Icon | Colour |
|---|---|---|---|
| 1 | Food & Dining | `silverware-fork-knife` | cat.orange |
| 2 | Groceries | `cart` | cat.green |
| 3 | Transport | `bus` | cat.blue |
| 4 | Fuel | `gas-station` | cat.amber |
| 5 | Rent | `home-city` | cat.indigo |
| 6 | Bills & Recharge | `cellphone-wireless` | cat.teal |
| 7 | Shopping | `shopping` | cat.pink |
| 8 | Health | `medical-bag` | cat.red |
| 9 | Education | `school` | cat.purple |
| 10 | Entertainment | `movie-open` | cat.purple |
| 11 | Family | `account-group` | cat.blue |
| 12 | Gifts & Donations | `gift` | cat.pink |
| 13 | Travel | `airplane` | cat.teal |
| 14 | Personal Care | `face-man-shimmer` | cat.amber |
| 15 | Other | `dots-horizontal-circle` | cat.slate | *(system, `is_system = 1`)*

## Income

| # | Name | Icon | Colour |
|---|---|---|---|
| 1 | Salary | `briefcase` | cat.green |
| 2 | Business / Freelance | `laptop` | cat.blue |
| 3 | Pocket Money | `wallet` | cat.amber |
| 4 | Refund | `cash-refund` | cat.teal |
| 5 | Interest / Gift | `hand-coin` | cat.purple |
| 6 | Other | `dots-horizontal-circle` | cat.slate | *(system)*

Notes:
- "Refund" exists because refunds are recorded as income (FR-3.7).
- "Interest / Gift" exists for extra money a friend pays beyond the udhaar amount (FR-4.5).
- There is intentionally **no** "Loan" or "Udhaar" category — udhaar has its own section and must never be recorded as income/expense.
