# Project Structure

Status: Approved (adjust in Phase 2 to match the actual template) · Last updated: 2026-10-21

```
hisaab/
├─ CLAUDE.md                      # contains: @docs/CLAUDE.md
├─ app.config.ts                  # Expo config (dynamic: dev vs release, see APP_CONFIG.md)
├─ eas.json                       # only if EAS Free builds are used
├─ package.json
├─ tsconfig.json                  # strict: true, paths alias "@/*" → "src/*"
├─ .eslintrc / eslint.config.js
├─ .prettierrc
├─ jest.config.js
├─ app/                           # Expo Router routes (thin)
│  ├─ _layout.tsx                 # providers: theme, db init, lock gate
│  ├─ (tabs)/
│  │  ├─ _layout.tsx              # bottom tabs
│  │  ├─ index.tsx                # Dashboard
│  │  ├─ transactions.tsx
│  │  ├─ udhaar.tsx
│  │  ├─ reports.tsx
│  │  └─ more.tsx
│  ├─ transaction/
│  │  ├─ new.tsx                  # ?type=income|expense
│  │  ├─ [id].tsx                 # detail
│  │  └─ [id]/edit.tsx
│  ├─ receipt/[transactionId].tsx # full-screen viewer, ?index=
│  ├─ person/
│  │  ├─ new.tsx
│  │  ├─ [id].tsx                 # ledger
│  │  └─ [id]/edit.tsx
│  ├─ udhaar-entry/
│  │  ├─ new.tsx                  # ?personId=&direction=gave|got
│  │  └─ [id]/edit.tsx
│  ├─ categories.tsx
│  ├─ budgets.tsx
│  ├─ backup.tsx
│  ├─ settings.tsx
│  ├─ about.tsx
│  ├─ onboarding.tsx
│  └─ lock.tsx
├─ src/
│  ├─ components/                 # shared UI: Button, Card, AmountText, AmountInput,
│  │                              # DateField, Chip, EmptyState, ErrorState, ConfirmDialog, Toast…
│  ├─ features/
│  │  ├─ dashboard/
│  │  ├─ transactions/            # components/, hooks/, schema.ts
│  │  ├─ categories/
│  │  ├─ receipts/
│  │  ├─ udhaar/
│  │  ├─ budgets/
│  │  ├─ reports/
│  │  ├─ backup/
│  │  └─ settings/
│  ├─ services/                   # transactionService, receiptService, udhaarService,
│  │                              # reminderService, backupService, exportService, housekeeping
│  ├─ db/
│  │  ├─ client.ts                # DbClient interface + open/init
│  │  ├─ adapters/expoSqlite.ts
│  │  ├─ adapters/betterSqlite.ts # tests only
│  │  ├─ migrations/
│  │  │  ├─ index.ts              # ordered list
│  │  │  └─ 0001_initial.ts
│  │  ├─ repositories/            # one file per table group
│  │  ├─ seed/defaultCategories.ts
│  │  └─ changes.ts               # notifyChanged / subscribe
│  ├─ lib/                        # pure: money.ts, dates.ts, balance.ts, budget.ts,
│  │                              # csv.ts, ids.ts, errors.ts, paths.ts
│  ├─ platform/                   # thin wrappers over expo modules (files, picker,
│  │                              # notifications, auth, share) — fakeable in tests
│  ├─ hooks/                      # useDbQuery, useToday, useAppState
│  ├─ theme/                      # tokens.ts, ThemeProvider.tsx
│  └─ content/                    # strings.ts, templates.ts (reminder messages)
├─ assets/                        # icon, adaptive icon, splash
├─ e2e/                           # Maestro flows (*.yaml)
└─ docs/                          # this folder
```

## Conventions

| Item | Convention |
|---|---|
| Files | `camelCase.ts` for modules, `PascalCase.tsx` for components |
| Tests | Co-located `*.test.ts(x)`; repository tests `*.repo.test.ts` (Node + better-sqlite3) |
| Imports | `@/…` alias for `src/`; no deep relative `../../..` |
| Types | Domain types in `src/db/types.ts` (`Paise`, `LocalDate`, `IsoDateTime`, models) |
| Exports | Named exports only |
| Secrets | None exist in the repo. Keystore and passwords are outside the project folder. |
