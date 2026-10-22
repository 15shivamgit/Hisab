# Phase Report — Phase 3: Database foundation

Date: 2026-10-22 · Branch: `main`

**Status: all acceptance criteria verified — awaiting owner approval.**

## 1. What was implemented

- **`src/lib`** (pure): `money.ts` (parse/format/CSV/assert, FR-1.x), `dates.ts` (local dates, month/week ranges, shifting, clamping, formatting, FR-2.x), `ids.ts`, `paths.ts` (safe receipt paths), `errors.ts` (`AppError` with `code` + `detail`, new code `DB_NEWER`), `clock.ts`.
- **`DbClient`** with `createDbClient`: one connection, all operations serialized, `BEGIN IMMEDIATE` transactions on that connection (**ADR-017** — expo-sqlite's exclusive transactions open a separate connection where foreign keys would be off). Drivers: expo-sqlite (app), better-sqlite3 (tests).
- **Migrations:** runner (`schema_migrations` owned by the runner, newer-DB refusal, one transaction per migration, FK check) and **migration 0001** with every table, index, and trigger from DATABASE_SCHEMA.md (incl. `trg_categories_type_locked`, both budget triggers).
- **Repositories:** settings (Zod-validated, corrupted values fall back to defaults, portable vs device-only, `markDataChanged`), categories (unique per type, system "Other" rules, archive, delete only without transactions, seed), transactions (validation, list with filters / search incl. exact amount / allowlisted sort / pagination, totals that skip future-dated entries, upcoming), attachments (max 5, path from id), budgets (single overall, expense-only).
- **Default category seed** with Material Symbols icons (Option A).
- **App wiring:** `startupService` (open → PRAGMAs → migrate → seed), `StartupGate` (loading / error with "Try again" and "Share diagnostic info" / `DB_NEWER` message), `DatabaseProvider` + `useDb`, `notifyChanged` + `useDbQuery`, `ErrorState` component.
- **Diagnostics:** `diagnosticsService` error log (last 50, code/detail/where only) + shareable report; `platform/files.ts` (expo-file-system new API), `platform/deviceInfo.ts`.
- **Test infrastructure:** TZ = Asia/Kolkata global setup, expo-crypto mock, `createTestDb`, `fixedClock`, in-memory files.

## 2. Files created or changed

| Area | Files |
|---|---|
| Lib | `src/lib/{money,dates,ids,paths,errors,clock}.ts` |
| DB | `src/db/{client,types,changes,sqlErrors,init}.ts`, `src/db/adapters/{expoSqlite,betterSqlite}.ts`, `src/db/migrations/{types,index,runner,0001_initial}.ts`, `src/db/repositories/{settings,category,transaction,attachment,budget}Repository.ts`, `src/db/seed/defaultCategories.ts` |
| App | `src/services/{startupService,diagnosticsService,diagnostics}.ts`, `src/platform/{files,deviceInfo}.ts`, `src/hooks/{DatabaseContext.tsx,useDbQuery.ts}`, `src/features/startup/StartupGate.tsx`, `src/components/ErrorState.tsx`, `src/content/strings.ts`, `src/app/_layout.tsx` |
| Tests | `src/lib/{money,dates,idsAndPaths}.test.ts`, `src/db/client.repo.test.ts`, `src/db/migrations/migrations.repo.test.ts`, `src/db/repositories/{categoryRepository,transactionRepository,budgetAttachmentSettings}.repo.test.ts`, `src/services/diagnosticsService.test.ts`, `src/hooks/useDbQuery.test.tsx`, `src/test/{globalSetup.js,setup.ts,testDb.ts,memoryFiles.ts}` |
| Config | `package.json` (expo-sqlite, expo-crypto, expo-file-system, zod; dev: better-sqlite3, @types/better-sqlite3; Jest globalSetup/setupFiles) |
| Docs | DECISIONS (ADR-017), PROJECT_CONTEXT, ARCHITECTURE, DATABASE_SCHEMA, MIGRATIONS, REPOSITORIES, SERVICES_AND_LIBS, TECH_STACK, UI_COPY, TESTING_STRATEGY, ENVIRONMENT_SETUP, CHANGELOG |

## 3. Commands and tests actually executed

```
npx jest src/lib                 → 3 suites, 91 tests passed
npx jest src/db                  → first run: 2 failed / 69 passed (see below); after fixes: 5 suites, 72 passed
npm run typecheck                → passed
npm run lint                     → passed (after `prettier --write` on 8 files)
npm test                         → 13 suites, 212 tests passed
node -e "require('better-sqlite3')..." → loads on Windows/Node 24, SQLite 3.53.4
npx expo run:android --no-bundler → attempt 1: "Expo stopped waiting for the ADB device property/boot query"
                                    (adb took 4 s per command; after adb restart the phone needed re-authorising)
                                  → attempt 2: BUILD SUCCESSFUL in 8m 12s, installed on vivo V2205
adb shell pm clear com.shivambgs15.hisaab.dev → fresh first launch; "Android Bundled 30807ms (1395 modules)"
adb run-as … cat files/SQLite/hisaab.db → copied and inspected with better-sqlite3 (read-only)
force-stop + relaunch → Home screen; DB re-inspected
```

First `src/db` run failures and fixes:
1. Icon test could not `require('expo-symbols/src/android/symbols.json')` (package `exports`) → test reads the file from disk.
2. A transaction with a non-existent category reported `CATEGORY_TYPE_MISMATCH` (SQLite runs the type trigger before the FK check) → repositories now check category existence/type first (`CATEGORY_NOT_FOUND`); same for budgets.

## 4. Test results

| Check | Result | Evidence |
|---|---|---|
| Repository tests run against real SQLite (better-sqlite3) in Jest | ✅ | `*.repo.test.ts`, 72 tests |
| Money/date tests cover FIN-M01–M16 and FIN-D01–D10 | ✅ | `money.test.ts`, `dates.test.ts` (test names start with the IDs) |
| Migrations idempotent; newer-DB-than-app check works | ✅ | `migrations.repo.test.ts` (+ failing migration rolls back, numbering, data kept) |
| Category type trigger and FK RESTRICT proven by tests | ✅ | FIN-T07, FIN-T09, FIN-T11 (repository and raw SQL) |
| Seed runs once | ✅ | Tests (`seeded` 21 then 0) and on the phone after restart |
| Also covered | ✅ | FIN-T01–T06, FIN-T10, FIN-T12, FIN-B05, FIN-B08; transactions roll back and don't interleave; diagnostics never store messages |
| On the phone (fresh install) | ✅ | `files/SQLite/hisaab.db`: schema v1; 6 tables, 7 indexes (incl. `ux_budgets_overall ((1))`), 5 triggers; 15 + 6 categories, one system "Other" each; first icons `restaurant`, `shopping_cart`, `directions_bus`; `journal_mode` = wal; no diagnostics log (no startup errors) |
| On the phone after force-stop + relaunch | ✅ | Home screen shown (startup passed on the existing DB); still 1 migration and 21 categories |

## 5. Known issues and risks

| ID | Priority | Description | Plan |
|---|---|---|---|
| P3-1 | P3 | `adb reverse` was dropped once (USB hiccup) → dev build showed "Failed to connect to localhost:8081" | Re-run `adb reverse tcp:8081 tcp:8081` and reload; noted in ENVIRONMENT_SETUP.md |
| P3-2 | P3 | "Copy diagnostic info" (UI_COPY/SET-09) needs a clipboard; Phase 3 uses the share sheet ("Share diagnostic info") with no new dependency | Decide before Phase 7/9: share-only, or approve `expo-clipboard` (also wanted for udhaar "Copy text") |
| P3-3 | P3 | `useDbQuery` opts out of React Compiler (`'use no memo'`) because of its dynamic dependency list | Fine; revisit only if profiling shows a need |
| P3-4 | — | Device SQLite version not recorded (only proven that every schema feature used works there) | Add to the diagnostic report in Phase 9 (`SELECT sqlite_version()`) |

## 6. Documentation updated

ADR-017 (DECISIONS, PROJECT_CONTEXT); ARCHITECTURE (DbClient/transactions, `DB_NEWER`, startup implementation, `detail`); DATABASE_SCHEMA (budget index verified); MIGRATIONS (runner owns `schema_migrations`); REPOSITORIES and SERVICES_AND_LIBS (actual signatures); TECH_STACK (new packages, better-sqlite3 verify); TESTING_STRATEGY (TZ verified, helpers); UI_COPY (startup strings); ENVIRONMENT_SETUP (`npm install -D`, adb reverse); CHANGELOG.

## 7. Exact next steps

1. Owner reviews and approves Phase 3.
2. Phase 4 — transactions, categories, basic dashboard: transaction form (AmountInput, DateField, category chips, payment method), list with search/filter/sort, detail/edit/delete, categories screen, dashboard "This month" card + recent transactions + category list. Uses `transactionService`/`categoryService` with `markDataChanged` + `notifyChanged`.
3. Phase 4 needs `react-hook-form` + `@hookform/resolvers` (approved in TECH_STACK) and the date picker `@react-native-community/datetimepicker` (approved) → one more dev build.

## Owner approval

- [ ] Approved to start Phase 4 — (owner, date)
