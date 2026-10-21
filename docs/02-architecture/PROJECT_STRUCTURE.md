# Project Structure

Status: Approved (adjusted in Phase 2 to the Expo SDK 58 template: routes live in `src/app/`) · Last updated: 2026-10-21

```
hisaab/
├─ CLAUDE.md                      # contains: @docs/CLAUDE.md and @AGENTS.md
├─ AGENTS.md                      # Expo's agent notes from the SDK 58 template (check versioned docs)
├─ app.config.ts                  # Expo config (dynamic: dev vs release, see APP_CONFIG.md)
├─ eas.json                       # only if EAS Free builds are used
├─ package.json                   # scripts + "jest" config (preset jest-expo)
├─ tsconfig.json                  # strict + noUncheckedIndexedAccess, alias "@/*" → "src/*"
├─ eslint.config.js               # flat config: eslint-config-expo + eslint-config-prettier
├─ .prettierrc / .prettierignore
├─ .gitattributes                 # LF line endings
├─ assets/images/                 # icon, adaptive icon (foreground + monochrome), splash
├─ e2e/                           # Maestro flows (*.yaml)
├─ docs/                          # this folder
└─ src/
   ├─ app/                        # Expo Router routes (thin)
   │  ├─ _layout.tsx              # root Stack + providers: theme, db init, lock gate
   │  ├─ (tabs)/
   │  │  ├─ _layout.tsx           # native bottom tabs
   │  │  ├─ index.tsx             # Dashboard
   │  │  ├─ transactions.tsx
   │  │  ├─ udhaar.tsx
   │  │  ├─ reports.tsx
   │  │  └─ more.tsx
   │  ├─ transaction/
   │  │  ├─ new.tsx               # ?type=income|expense
   │  │  ├─ [id].tsx              # detail
   │  │  └─ [id]/edit.tsx
   │  ├─ receipt/[transactionId].tsx  # full-screen viewer, ?index=
   │  ├─ person/
   │  │  ├─ new.tsx
   │  │  ├─ [id].tsx              # ledger
   │  │  └─ [id]/edit.tsx
   │  ├─ udhaar-entry/
   │  │  ├─ new.tsx               # ?personId=&direction=gave|got
   │  │  └─ [id]/edit.tsx
   │  ├─ categories.tsx
   │  ├─ budgets.tsx
   │  ├─ backup.tsx
   │  ├─ settings.tsx
   │  ├─ about.tsx
   │  ├─ onboarding.tsx
   │  └─ lock.tsx
   ├─ components/                 # shared UI: AppText, Screen, Button, Card, EmptyState,
   │                              # AmountText, AmountInput, DateField, Chip, ErrorState,
   │                              # ConfirmDialog, Toast…
   ├─ features/
   │  ├─ dashboard/
   │  ├─ transactions/            # components/, hooks/, schema.ts
   │  ├─ categories/
   │  ├─ receipts/
   │  ├─ udhaar/
   │  ├─ budgets/
   │  ├─ reports/
   │  ├─ backup/
   │  └─ settings/
   ├─ services/                   # transactionService, receiptService, udhaarService,
   │                              # reminderService, backupService, exportService,
   │                              # diagnosticsService, housekeeping
   ├─ db/
   │  ├─ client.ts                # DbClient interface + open/init
   │  ├─ adapters/expoSqlite.ts
   │  ├─ adapters/betterSqlite.ts # tests only
   │  ├─ migrations/
   │  │  ├─ index.ts              # ordered list
   │  │  └─ 0001_initial.ts
   │  ├─ repositories/            # one file per table group
   │  ├─ seed/defaultCategories.ts
   │  └─ changes.ts               # notifyChanged / subscribe
   ├─ lib/                        # pure: money.ts, dates.ts, balance.ts, budget.ts,
   │                              # csv.ts, ids.ts, errors.ts, paths.ts
   ├─ platform/                   # thin wrappers over expo modules (files, picker,
   │                              # notifications, auth, share) — fakeable in tests
   ├─ hooks/                      # useDbQuery, useToday, useAppState
   ├─ theme/                      # tokens.ts, ThemeProvider.tsx
   └─ content/                    # strings.ts, templates.ts (reminder messages)
```

Only `src/app/` holds routes — every file there becomes a screen. Keep components, hooks, and logic outside it.

## Conventions

| Item | Convention |
|---|---|
| Files | `camelCase.ts` for modules, `PascalCase.tsx` for components; route files follow Expo Router names |
| Tests | Co-located `*.test.ts(x)`; repository tests `*.repo.test.ts` (Node + better-sqlite3) |
| Imports | `@/…` alias for `src/`; no deep relative `../../..` |
| Types | Domain types in `src/db/types.ts` (`Paise`, `LocalDate`, `IsoDateTime`, models) |
| Exports | Named exports only, except route files (Expo Router needs a default export) |
| Formatting | Prettier: single quotes, width 100, trailing commas, LF |
| Secrets | None exist in the repo. Keystore and passwords are outside the project folder. |
