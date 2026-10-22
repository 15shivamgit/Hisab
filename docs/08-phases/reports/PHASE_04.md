# Phase Report — Phase 4: Transactions, categories, basic dashboard

Date: 2026-10-22 · Branch: `main`

**Status: all acceptance criteria verified — awaiting owner approval.** The owner can now record income and expenses daily on the dev build.

## 1. What was implemented

- **Transactions (TXN-01…10):** add/edit form (type, amount with live Indian grouping, category chips with last-used first and "+ New" quick-create, date with Today/Yesterday and the Android date picker, payment method defaulting to the last used, description, notes), Save pinned at the bottom, "Discard changes?" guard, toasts. List grouped by day with the day's net and an "Upcoming" group for future-dated entries, summary bar, search over description/notes/exact amount (300 ms debounce), filter sheet (type, categories, payment methods, This month / Last month / Custom), sort (newest, oldest, highest, lowest), removable filter chips, infinite scroll (pages of 50), skeleton/empty/no-match/error states. Detail screen with Edit, Duplicate, Delete (confirmation says what will be lost).
- **Categories (CAT-01…05):** More → Categories with Expense/Income tabs, entry counts, Move up/Move down, edit sheet (name, 44 Material Symbols icons, 10 colours), archive/unarchive, delete only without entries (budget removed with it), "in use → Archive instead?" dialog, system "Other" protected.
- **Dashboard (DASH-01, 02, 07, 09; DASH-03 as a list):** month header, This month card (income, expense, net in green/red, "Udhaar not included" caption), `+ Expense` / `+ Income`, spending by category (top 5 with %), recent 5 non-future transactions, welcome card on first run.
- **Services:** `transactionService` (create/update/delete/duplicate), `categoryService` (create/update/archive/delete/move), `dashboardService.getSummary` — every write marks data changed and notifies screens.
- **Components:** Icon, CategoryIcon, AmountText, AmountInput, TextField, DateField, Chip, SegmentedControl, ListRow, Fab, ConfirmDialog, Sheet, Toast, Skeleton; hooks `useToday`.
- **Packages:** react-hook-form 7.90.0, @hookform/resolvers 5.9.2 (v6 fails to install — ERESOLVE), @react-native-community/datetimepicker 9.2.1 (all approved in TECH_STACK).

## 2. Files created or changed

| Area | Files |
|---|---|
| Routes | `src/app/(tabs)/{index,transactions,more,udhaar,reports}.tsx`, `src/app/transaction/{new,[id]}.tsx`, `src/app/transaction/[id]/edit.tsx`, `src/app/categories.tsx`, `src/app/_layout.tsx` (ToastProvider, header styles) |
| Features | `src/features/transactions/{TransactionsScreen,TransactionEditorScreen,TransactionDetailScreen}.tsx`, `components/{TransactionForm,TransactionRow,FilterSheet}.tsx`, `{schema,grouping,listFilter}.ts`; `src/features/categories/{CategoriesScreen.tsx,choices.ts,components/CategoryFormSheet.tsx}`; `src/features/dashboard/DashboardScreen.tsx` |
| Services / data | `src/services/{transactionService,categoryService,dashboardService}.ts`; repository additions (`summary`, `recentCategoryIds`, `lastPaymentMethod`, `listWithUsage`, `move`); `src/lib/money.ts` (`formatAmountInput`, `paiseToInputText`, `groupIndianDigits`), `src/lib/dates.ts` (`localDateToDate`, `formatTime12`, `formatDateTime`) |
| UI | `src/components/*` (14 new), `src/hooks/useToday.ts`, `src/content/strings.ts` |
| Tests | `src/lib/moneyInput.test.ts`, `src/features/transactions/listLogic.test.ts`, `src/features/transactions/components/TransactionForm.test.tsx`, `src/features/categories/choices.test.ts`, `src/services/phase4Services.repo.test.ts`, `src/test/{setup.ts,TestProviders.tsx}` |
| Removed | `src/components/PlaceholderScreen.tsx` |

## 3. Commands and tests actually executed

```
npx expo install react-hook-form @hookform/resolvers @react-native-community/datetimepicker
  → @hookform/resolvers 6.0.0: npm ERESOLVE (optional peer "effect"); installed react-hook-form + @hookform/resolvers@^5 with npm
npm run typecheck   → first run: 7 errors (StyleSheet.absoluteFillObject → absoluteFill, forwardRef typing, FlatList footer null, null-narrowing) → fixed → passed
npm run lint        → 1 error (setState inside an effect) + 1 warning → fixed → passed
npm test            → first run: 6 TransactionForm tests failed (no SafeAreaProvider in tests) → TestProviders added → 18 suites, 260 tests passed
npx expo run:android --no-bundler → BUILD SUCCESSFUL in 3m 31s
Metro: a stale server stopped answering ("Connecting to the development server…"); stopped it and restarted with --clear → "Android Bundled 19170ms (1550 modules)"
```

## 4. Test results

| Check | Result | Evidence |
|---|---|---|
| Unit/repo/service/component tests | ✅ | 260 passed (includes TXN-09 inline errors, archived-category rules, type switch, future-date hint, FIN-T01–T12, dashboard totals and future exclusion, service `markDataChanged` + notify) |
| Add expense on the phone (₹1250.50 → "1,250.50", Food & Dining, UPI) | ✅ | Toast "Expense saved"; dashboard updated live (net −₹1,250.50 in red; Food & Dining 100%) |
| Add income (Salary ₹50,000; payment defaulted to last used UPI) | ✅ | List: "2 entries", Today header with net ₹48,749.50 |
| Search by amount `1250.50` | ✅ | Only that entry |
| Detail → Edit amount to ₹1,300 → Save | ✅ | "Entry updated"; "Last updated" shown |
| Unsaved-changes guard | ✅ | "Discard changes?" on back; Keep editing / Discard both work (single tap) |
| Delete with confirmation | ✅ | "This expense of ₹1,300 will be deleted…" → "Entry deleted"; list and dashboard updated |
| Filter sheet (Income) and removable chip | ✅ | "Filters (1)", "× Income", "Clear all" |
| Duplicate | ✅ | Form pre-filled (₹50,000, Salary, Today, UPI); nothing saved until Save |
| Categories: list, entry counts, Move down / Move up | ✅ | Order changed and restored |
| Data persists after force-stop and restart | ✅ | Salary still there, deleted entry gone |
| Future-dated rule (FIN-T03/T04) | ✅ | Automated tests (picking a future date with the native picker was not driven on the phone) |

## 5. Known issues and risks

| ID | Priority | Description | Plan |
|---|---|---|---|
| P4-1 | — | Found and fixed on the phone: FAB drawn behind the list / octagon artefact (borderless ripple on a round view), FAB under the gesture bar on stack screens, duplicate category name on the detail card, ambiguous "Other" chips in the filter sheet | Fixed and re-checked on the phone |
| P4-2 | P3 | Category reorder uses Move up/Move down buttons instead of drag | Documented in CATEGORIES.md; drag can be added later on request |
| P4-3 | P3 | Day-header net counts only loaded rows, so it can grow when the next page of 50 loads | Acceptable; noted in `grouping.ts` |
| P4-4 | P3 | Not driven on the phone: category create/rename sheet, custom date range, sort sheet, quick-create from the form, very long lists (pagination) | Covered by code review/tests where possible; owner may try them while using the app |
| P4-5 | P3 | Dashboard category rows not tappable; no header settings shortcut | Phase 8 (Reports) / Phase 9 (More) |
| P4-6 | P3 | Test entries on the phone's **Hisaab Dev** app (Salary ₹50,000) | Dev app only; separate from the future real app. Delete any time |

## 6. Documentation updated

TECH_STACK (3 packages, resolvers v5 pin), CATEGORIES (move buttons, edit sheet), DASHBOARD (Phase 4 scope), REPOSITORIES (5 new functions), SERVICES_AND_LIBS (implemented services and signature style), DEVELOPMENT_PHASES, PROJECT_CONTEXT, CHANGELOG.

## 7. Exact next steps

1. Owner uses the app for a few days and reports anything odd.
2. Owner approves Phase 4.
3. Phase 5 — Receipts: camera/gallery picker, compression, storage, viewer with zoom, replace/delete, orphan sweep. Needs `expo-image-picker`, `expo-image-manipulator` (approved) and a pinch-zoom approach (needs approval: small library or our own on gesture-handler/reanimated).

## Owner approval

- [ ] Approved to start Phase 5 — (owner, date)
