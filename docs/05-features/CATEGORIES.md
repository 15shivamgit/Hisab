# Feature: Categories

Status: Approved · Phase: 3 (seed), 4 (management) · Requirements: CAT-01…05

Default list: [../07-content/DEFAULT_CATEGORIES.md](../07-content/DEFAULT_CATEGORIES.md).

## Screen (More → Categories)

- Two tabs: Expense / Income.
- Each row: icon, name, usage count, drag handle (reorder → `sort_order`).
- "Archived" section collapsed at the bottom.
- "+ Add category" → sheet with name, icon picker (fixed icon set), colour picker (category colour tokens).

## Rules

| Rule | Behaviour |
|---|---|
| Name 1–30 chars, trimmed | Inline error |
| Unique per type, case-insensitive | "A category named 'Food' already exists" |
| Rename | Allowed; old transactions show the new name |
| Change type | Only if it has no transactions and no budget (a DB trigger also blocks it) |
| Delete (no transactions) | Confirm → deleted. If it has a budget, the dialog says so and the budget is removed too |
| Delete used | Dialog: "'Food' is used by 34 entries. Archive it instead? It will be hidden from new entries but old entries keep it." → Archive |
| System "Other" | Cannot be deleted, archived, or renamed — it is the guaranteed fallback category for each type |
| Unarchive | Allowed any time |

## Acceptance

- First launch creates the default categories exactly once (re-running seed does nothing).
- Deleting a used category is impossible via UI and via repository (RESTRICT).
- A category with a budget but no transactions can be deleted; its budget disappears.
- Changing the type of a category with transactions or a budget is rejected by the DB trigger.
