# Phase Report — Phase 8: Budgets and reports

Date: 2026-10-28 · Branch: `main`

**Status: acceptance criteria verified on the owner's phone (exceptions in § 5) — awaiting owner approval.**

## 1. What was implemented

- **Budgets (BUD-01…04, FIN-B*):**
  - `src/lib/budget.ts`: `budgetProgress` with integer maths. Normal < 80 %, warning 80–100 % inclusive, over > 100 %. Percent is rounded down.
  - `budgetService`: overview (overall + category lines, categories still without a budget, "more than overall" flag), dashboard card data, and set / update / remove. Every write runs `markDataChanged` inside its transaction.
  - Budgets screen `/budgets` (More → Budgets, or from the dashboard card):
    - empty state, overall card (Edit / Remove), category cards (tap to edit);
    - "+ Add category budget" (only active expense categories that have no budget);
    - "more than overall" hint, rules caption;
    - remove confirmation.
  - The numbers line always shows amounts, never colour alone, e.g. "₹8,940 of ₹10,000 · 89% used · ₹1,060 left", or "… · ₹820 over".
- **Dashboard (DASH-03, DASH-04):**
  - Budget card: overall plus the top 3 category budgets by percent, and "Manage". Empty: "Set a monthly budget".
  - Spending by category: donut (top 5 + grey "Other", month expense in the centre) above the top-5 list. The rows can be tapped.
- **Reports tab (RPT-01…03, FIN-R*):**
  - Week / Month / Custom; ◀ ▶ (▶ disabled at the current period); From / To for Custom.
  - Summary: income, expense, net, average spend per day.
  - Expense / Income breakdown: donut + rows with amount, % and entry count. Tapping a row opens Transactions filtered to that category, type and period.
  - Trend: daily bars up to 31 days, weekly bars beyond that.
  - "Upcoming in this period" line, empty state, "Udhaar is not included.", and "Export this period as CSV".
- **Transactions** accepts route params `categoryId`, `type`, `start`, `end` and applies them as filters.
- **Charts (ADR-018):** our own `DonutChart` (react-native-svg circles) and `BarChart` (Views), plus `ProgressBar`. Each has an accessibility label or value.
- **Fix found on the phone:** `Sheet` (a `Modal`) did not move up for the keyboard, so the keyboard covered the amount field and Save. It is now wrapped in `KeyboardAvoidingView`. This affects every sheet, including the Phase 4 category sheet.

## 2. Files created or changed

| File | Change |
|---|---|
| `src/lib/budget.ts`, `budget.test.ts` | New: progress rule + FIN-B01…04 |
| `src/services/budgetService.ts` | New |
| `src/services/reportService.ts` | New: report, `periodFor`, `stepPeriod` |
| `src/services/reports.repo.test.ts` | New: FIN-B05…08, FIN-R01…04, rollover, dashboard card, weekly trend, udhaar excluded |
| `src/services/dashboardService.ts` | `budgets` in the summary |
| `src/components/charts/DonutChart.tsx`, `BarChart.tsx`, `charts.test.tsx` | New charts + component tests |
| `src/components/ProgressBar.tsx` | New |
| `src/components/Sheet.tsx` | Keyboard avoidance |
| `src/features/budgets/BudgetsScreen.tsx`, `src/app/budgets.tsx` | New screen + route |
| `src/features/reports/ReportsScreen.tsx`, `src/app/(tabs)/reports.tsx` | New Reports tab |
| `src/features/dashboard/DashboardScreen.tsx`, `components/BudgetCard.tsx` | Budget card, donut, tappable rows |
| `src/features/transactions/TransactionsScreen.tsx` | Filters from route params |
| `src/app/(tabs)/more.tsx` | Budgets row |
| `src/content/strings.ts` | `budgets`, `reports` copy |
| `package.json` | `react-native-svg` 15.16.0 |

## 3. Commands and tests actually executed

```
npx tsc --noEmit    → exit 0
npm run lint        → exit 0 (expo lint + prettier --check)
npx jest            → 34 suites, 406 passed, 0 failed
npx expo prebuild --platform android --clean
android> gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a → BUILD SUCCESSFUL (19 m 27 s)
adb install -r app-debug.apk → Success (com.shivambgs15.hisaab.dev, data kept)
```

## 4. Test results

Phone: vivo V2205, Android 14, dev build with Metro. The owner's real entries were viewed but not changed. The two test budgets were removed afterwards.

| Check | Result | Evidence |
|---|---|---|
| Unit/repo/component tests | ✅ | 406/406 |
| Budget states on device | ✅ | Overall ₹10,000 vs ₹8,940 → amber "89% used · ₹1,060 left"; Rent ₹7,000 vs ₹7,820 → red full bar "₹820 over"; Rent ₹20,000 → normal "₹12,180 left" |
| "More than overall" hint | ✅ | Shown with Rent ₹20,000 > overall ₹10,000 |
| Add category budget: expense categories only | ✅ | Sheet listed 15 expense categories, no income categories |
| Remove with confirmation; removed from dashboard | ✅ | "Remove the overall budget?" / "Remove the Rent budget?" → "Budget removed"; dashboard back to "Set a monthly budget" |
| DASH-03 donut + tap | ✅ | Donut Rent 87 % / Food & Dining 12 %; tap → Transactions with Expense, Food & Dining, 1–31 Oct (2 entries, ₹1,120) |
| DASH-04 budget card | ✅ | Overall + Rent lines, Manage |
| Month report = dashboard | ✅ | Both ₹50,000 / ₹8,940 / ₹41,060; avg/day ₹319.28 (= 8,940 ÷ 28) |
| Week report | ✅ | 19–25 Oct (Monday start), avg ₹160 (= 1,120 ÷ 7), single-slice donut drawn as a full ring |
| Custom > 31 days → weekly bars | ✅ | 1 Sep – 31 Oct: "Weekly" bars; avg ₹154.13 (= 8,940 ÷ 58) |
| Income breakdown | ✅ | Salary 100 %, green donut and bars |
| Light and dark theme | ✅ | Screenshots of Reports (light) and dashboard/budgets (dark) |
| Font scale 150 % | ✅ with P3 | Budget card and donut centre fit; category icons clipped (P8-1) |
| Sheet above keyboard | ✅ after fix | Before: keyboard covered amount + Save. After: sheet lifts |
| Export this period as CSV on device | ⏭ not run | Same `exportService.transactionsCsv` as More → Export (verified in Phase 6); not opened here |

## 5. Known issues and risks

| ID | Priority | Description | Plan |
|---|---|---|---|
| P8-1 | P3 | At font scale 150 %, Material Symbols icons (`expo-symbols` `SymbolView`) grow with the font and get clipped inside their round category backgrounds. Exists since Phase 4. | Phase 9 polish |
| P8-2 | P3 (dev only) | After changing system font scale or theme, the Activity is recreated and the dev LogBox shows "configured linking in multiple places" / "multiple navigation containers". The app kept working. | Check in a release build in Phase 10 |
| P8-3 | Info | Dashboard category tap opens filtered Transactions, not "Reports filtered" (spec), because Reports has no category filter. | Owner to confirm |
| P8-4 | Info | Category percentages are rounded down, so they can add up to 99 %. | Accept |
| P7-1 | P3 | Release manifest still has ShortcutBadger / install-referrer permissions | Phase 11 |

## 6. Documentation updated

BUDGETS, REPORTS_AND_EXPORT, DASHBOARD (Phase 8 notes + deviation), TECH_STACK (react-native-svg 15.16.0), DECISIONS (ADR-018), SERVICES_AND_LIBS, SCREENS_AND_NAVIGATION (Transactions params), UI_COPY (remove-budget confirmation, Phase 8 copy), DEVELOPMENT_PHASES, PROJECT_CONTEXT, CHANGELOG.

## 7. Exact next steps

1. Owner reviews and approves Phase 8 (and the P8-3 deviation).
2. Phase 9: settings, app lock, onboarding, polish (including P8-1).

## Owner approval

- [ ] Approved to start Phase 9 — (owner, date)
