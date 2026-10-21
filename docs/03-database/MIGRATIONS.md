# Migrations

Status: Approved · Last updated: 2026-10-21

## Format

```ts
// src/db/migrations/0001_initial.ts
export const migration0001: Migration = {
  version: 1,
  name: 'initial',
  statements: [ /* CREATE TABLE …, CREATE INDEX …, CREATE TRIGGER … */ ],
};
```

`src/db/migrations/index.ts` exports an ordered array. Versions are consecutive integers starting at 1.

## Runner rules

1. Read `MAX(version)` from `schema_migrations` (create the table first if missing).
2. If the DB version is **higher** than the app knows (user installed an older APK over a newer one), stop and show: "This data was created by a newer version of Hisaab. Please install the latest version." Do not touch data.
3. For each pending migration, in order: run all statements **and** insert into `schema_migrations` inside **one exclusive transaction**. On failure, roll back and show the startup error screen.
4. After migrations, run `PRAGMA foreign_key_check;` — any rows returned is a bug; log the error code and show the startup error screen.

## Rules for writing migrations

- Never edit a migration that has shipped in any APK (even to friends). Add a new one.
- SQLite cannot drop/alter many constraints in place: use the "create new table → copy → drop old → rename" pattern with `PRAGMA foreign_keys = OFF` around it (outside the transaction, per SQLite docs), then `foreign_key_check`.
- Every migration gets a repository test: migrate an empty DB to latest, and migrate a DB seeded at the previous version with sample data to latest.
- Backup `schemaVersion` = latest migration version. Restore of an older backup maps the data forward via `src/services/backup/upgrade.ts` (one function per version step). Restore of a newer backup is rejected.

## Planned migrations

| Version | Phase | Content |
|---|---|---|
| 1 | 3 | `schema_migrations`, `app_settings`, `categories`, `transactions`, `transaction_attachments`, `budgets` |
| 2 | 7 | `people`, `udhaar_entries` |

Udhaar tables come in a separate migration because udhaar is built after backup (ADR-015). This also exercises the migration and backup-upgrade path before friends use the app.
