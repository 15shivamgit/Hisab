# Testing Strategy

Status: Approved · Last updated: 2026-10-21

## Levels

| Level | Tool | What | Where |
|---|---|---|---|
| Unit | Jest | `src/lib/*` pure functions (money, dates, balance, budget, csv, paths) | `*.test.ts` |
| Repository | Jest + better-sqlite3 adapter | SQL, constraints, triggers, migrations, aggregates | `*.repo.test.ts` |
| Service | Jest + real repos (better-sqlite3) + fake platform (in-memory files, fake notifications, fake clock) | Use cases: create with receipts, delete cleanup, flip warning, backup validate/restore, reconcile reminders | `*.service.test.ts` |
| Component | Jest + React Native Testing Library | Forms: validation messages, disabled submit, dialogs | `*.test.tsx` |
| E2E | Maestro (local CLI, emulator) | Critical user journeys | `e2e/*.yaml` |
| Manual device | Checklist | Camera, notifications, share sheet, app lock, airplane mode, install/update | ACCEPTANCE_CRITERIA.md |

## Test infrastructure

- **Fresh DB per test:** `createTestDb()` opens an in-memory better-sqlite3 DB, applies all migrations, seeds default categories.
- **Clock injection:** services and hooks get `now()` from a `Clock`; tests use `fixedClock('2026-10-21T10:00:00+05:30')`. No `Date.now()` in business code.
- **Timezone:** Jest runs with `TZ=Asia/Kolkata` (set in `src/test/globalSetup.js`) plus specific tests for UTC-midnight edges. Verified 2026-10-22 on Windows + Node 24: `process.env.TZ` set in globalSetup takes effect in workers (test "Jest runs in Asia/Kolkata").
- **Test helpers (Phase 3):** `src/test/testDb.ts` — `createTestDb()`, `fixedClock()`, `TEST_NOW` (2026-10-21 10:00 IST), `TEST_TODAY`; `src/test/setup.ts` mocks `expo-crypto` with Node's crypto; `src/test/memoryFiles.ts` is the in-memory `TextFileStore`.
- **Fake platform:** `src/platform` interfaces have in-memory fakes in `src/test/`.
- **Fixtures:** `src/test/fixtures/backups/` — valid v1, valid v2, tampered checksum, zip-slip, extra file, newer version, truncated, not-a-zip.
- **Builders:** `aTransaction({...})`, `aPerson()`, `anEntry()` for readable tests.
- **Dev data generator** (dev variant only): Developer screen generates N transactions, M receipts, P people for performance and backup spikes.

## Coverage goals

| Area | Goal |
|---|---|
| `src/lib/money.ts`, `dates.ts`, `balance.ts`, `budget.ts` | 100% lines and branches |
| Repositories | ≥ 90% lines |
| Backup validation | Every check in BACKUP_AND_RESTORE.md has a failing fixture |
| Overall | Reported, not enforced |

## Maestro flows (Phase 10)

1. `add-expense.yaml` — add, see on dashboard, edit amount, delete.
2. `filters.yaml` — create 3 entries, filter by category and search.
3. `udhaar.yaml` — add person, gave 10,000, got 3,000 → "You will get ₹7,000"; flip warning appears for got 8,000.
4. `budget.yaml` — set budget, add expense, see warning state.
5. `persistence.yaml` — add entry, stop app, relaunch, entry present.

Camera, gallery, share sheet, notifications, and biometric prompts are tested manually (system UI is unreliable to automate).

## Commands

```
npm run typecheck
npm run lint
npm test                 # unit + repo + service + component
npm run test:coverage
maestro test e2e/        # emulator running, release-like build installed
```

## Reporting

Phase reports include the real command output summary. Failing or skipped tests are listed with reasons — never hidden.
