# Design Tokens

Status: Approved (Q4: sky blue brand colour) · Last updated: 2026-10-21

Defined in `src/theme/tokens.ts`. Components use tokens only — no hard-coded colours or sizes. Contrast of every text/background pair must be verified (≥ 4.5:1) when final colours are chosen.

## Brand

| Item | Value | Notes |
|---|---|---|
| Brand sky blue | `#0EA5E9` | Icon, splash, illustrations. **Never** for text or text-bearing buttons on white (contrast only 2.8:1). |
| Icon background | gradient `#38BDF8` → `#0284C7`; solid `#0284C7` for the adaptive icon background | |
| App icon | White ledger book (bahi-khata) with a sky-blue ₹ on the page, light-blue spine on the left | Concept: [app-icon-concept.svg](app-icon-concept.svg). Final PNGs (`icon.png` 1024², `adaptive-icon.png` foreground inside the 66% safe zone) made in Phase 2. |

## Colour — semantic

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#F8FAFC` | `#0B1220` | Screen background |
| `surface` | `#FFFFFF` | `#111827` | Cards, sheets |
| `surfaceAlt` | `#F1F5F9` | `#1F2937` | Inputs, chips |
| `border` | `#E2E8F0` | `#334155` | Dividers (dark differs from `surfaceAlt` so input edges stay visible) |
| `text` | `#0F172A` | `#F1F5F9` | Primary text |
| `textMuted` | `#475569` | `#94A3B8` | Secondary text |
| `primary` | `#0369A1` | `#38BDF8` | Buttons, links, selected. Sky blue; light theme uses a deeper sky so text passes contrast (white on `#0369A1` ≈ 6.0:1; `#38BDF8` on dark `bg` ≈ 8.7:1) |
| `onPrimary` | `#FFFFFF` | `#082F49` | Text on primary (`#082F49` on `#38BDF8` ≈ 6.5:1) |
| `income` | `#15803D` | `#4ADE80` | Income amounts |
| `expense` | `text` | `text` | Expense amounts use normal text + "−" sign (avoid a red screen) |
| `willGet` | `#15803D` | `#4ADE80` | "You will get" |
| `owe` | `#C2410C` | `#FB923C` | "You owe" |
| `settled` | `#64748B` | `#94A3B8` | Settled |
| `warning` | `#B45309` | `#FBBF24` | Budget ≥ 80%, due soon |
| `danger` | `#B91C1C` | `#F87171` | Over budget, overdue, destructive |
| `focus` | `#2563EB` | `#60A5FA` | Focus rings |

## Colour — categories

`cat.red #DC2626`, `cat.orange #EA580C`, `cat.amber #D97706`, `cat.green #16A34A`, `cat.teal #0D9488`, `cat.blue #2563EB`, `cat.indigo #4F46E5`, `cat.purple #9333EA`, `cat.pink #DB2777`, `cat.slate #475569`. In dark theme, category colours are used for icon backgrounds at 20% opacity with the full colour icon.

## Spacing (4 dp base)

`xs 4 · sm 8 · md 16 · lg 24 · xl 32 · xxl 48`

## Radius

`sm 6 · md 10 · lg 16 · full 999`

## Typography

System font (Roboto on Android). Amounts use `fontVariant: ['tabular-nums']`.

| Token | Size / line height | Weight | Use |
|---|---|---|---|
| `display` | 34 / 40 | 700 | Big amount on dashboard / ledger header |
| `title` | 22 / 28 | 600 | Screen titles |
| `heading` | 18 / 24 | 600 | Card titles |
| `body` | 16 / 22 | 400 | Default |
| `bodyStrong` | 16 / 22 | 600 | Row amounts |
| `caption` | 13 / 18 | 400 | Secondary info |
| `label` | 14 / 20 | 500 | Form labels, chips |

## Icons

`@expo/vector-icons` (MaterialCommunityIcons) — bundled with Expo, no network. Size 24 default, 20 in chips.

## Elevation

Light: subtle shadow on cards (elevation 1–2). Dark: no shadow; use `surface` contrast and `border`.

## Motion

150–250 ms ease-out for transitions; disabled when reduce-motion is on.
