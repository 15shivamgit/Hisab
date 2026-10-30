# UI/UX Guide

Status: Approved · Last updated: 2026-10-21

## Principles

1. **Fast entry.** Add expense in ≤ 3 taps + amount. Amount field focused first with the numeric keypad.
2. **Numbers first.** Amounts are the largest text on any card. Tabular (monospaced) digits for amounts.
3. **Never ambiguous about udhaar.** Always words + icon + colour: "You will get ₹7,000 ↓" / "You owe ₹6,000 ↑". Never just "+7000" or "−6000".
4. **Honest labels.** "Net (income − expense)", not "Balance".
5. **Calm.** Neutral surfaces, one primary colour, semantic colours only for meaning.
6. **Safe.** Destructive actions are red, need confirmation, and say exactly what will be lost.

## Navigation

Bottom tabs (5): **Home · Transactions · Udhaar · Reports · More**. Details in [SCREENS_AND_NAVIGATION.md](SCREENS_AND_NAVIGATION.md).

## Components (`src/components`)

| Component | Notes |
|---|---|
| `Screen` | Safe area, background, optional scroll, keyboard-avoiding |
| `Card` | Surface, radius `lg`, padding `md` |
| `Button` | Variants primary / secondary / ghost / danger; min height 48 dp; loading state |
| `Fab` | Floating "+" on list screens |
| `AmountText` | Formats paise; variants income/expense/neutral/willGet/owe; optional sign and icon |
| `AmountInput` | Large text, ₹ prefix, numeric keypad, Indian grouping while typing, error text |
| `DateField` | Shows "Today"/"Yesterday"/date; opens picker |
| `ChipGroup` | Single/multi select (categories, payment methods, filters) |
| `ListRow` | Icon, title, subtitle, trailing amount; min height 56 dp |
| `SectionHeader` | Day headers in lists |
| `ProgressBar` | Budget states normal/warning/over |
| `EmptyState` | Icon, title, message, action |
| `ErrorState` | Message, retry |
| `Skeleton` | Loading placeholders |
| `ConfirmDialog` | Title, body, confirm label, danger flag, optional typed confirmation |
| `Toast` | Short success/info messages, bottom, 3 s |
| `BottomSheet` | Filters, pickers (use a simple modal if no sheet library is approved) |

## Forms

- Labels above fields (not placeholder-only).
- Inline errors below the field in danger colour + icon; announced to screen readers.
- Save button pinned above the keyboard; never hidden. Implemented with `KeyboardAvoider` (a `KeyboardAvoidingView` that measures its own window position, because under a native header the stock one pads too little — Phase 10) and `FormFooter` (adds the bottom safe-area inset so the button is never under the 3-button navigation bar — Phase 10). Sheets use `Sheet`, which does both itself.
- Optional fields collapsed under "More details" (description, notes) on small screens.
- Unsaved-changes guard on back.

## States (every data screen)

| State | Pattern |
|---|---|
| Loading | Skeletons matching the final layout |
| Empty | `EmptyState` with a primary action |
| Error | `ErrorState` with retry; no raw error text |
| Success | Toast; navigate back |

## Accessibility

- Touch targets ≥ 48×48 dp.
- `accessibilityLabel` on every icon button ("Add expense", "Delete receipt").
- Amounts read naturally: "Expense, 450 rupees, Food, today".
- Support font scale up to 200%: rows wrap instead of truncating amounts.
- Contrast ≥ 4.5:1 for text, 3:1 for large text and UI components — in both themes.
- Never rely on colour alone (income/expense signs, udhaar words + icons, budget numbers).
- Respect "Remove animations" system setting (reduce motion).

## Formatting

- Money: `₹1,25,000.50`; compact cards may use `₹1.25L` only where space is tight — full value in detail and accessibility label.
- Dates: "21 Oct 2026"; lists use "Today", "Yesterday", "Mon, 19 Oct".
- Time: 12-hour with AM/PM.
