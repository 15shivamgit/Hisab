// Migration 2 — Phase 7. Tables: people, udhaar_entries (DATABASE_SCHEMA.md, ADR-004).
// A separate migration because udhaar is built after backup (ADR-015): backups made at
// schema 1 are upgraded on restore (src/services/backup/upgrade.ts).

import type { Migration } from '@/db/migrations/types';

const DATE_GLOB = "GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'";

export const migration0002: Migration = {
  version: 2,
  name: 'udhaar',
  statements: [
    `CREATE TABLE people (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 60),
      phone           TEXT CHECK (phone IS NULL OR length(phone) BETWEEN 6 AND 20),
      notes           TEXT CHECK (notes IS NULL OR length(notes) <= 500),
      return_by_date  TEXT CHECK (return_by_date IS NULL OR return_by_date ${DATE_GLOB}),
      archived_at     TEXT,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL
    )`,
    `CREATE INDEX ix_people_name ON people (name COLLATE NOCASE)`,

    `CREATE TABLE udhaar_entries (
      id              TEXT PRIMARY KEY,
      person_id       TEXT    NOT NULL REFERENCES people (id) ON DELETE RESTRICT,
      direction       TEXT    NOT NULL CHECK (direction IN ('gave', 'got')),
      amount_paise    INTEGER NOT NULL CHECK (amount_paise > 0 AND amount_paise <= 1000000000),
      entry_date      TEXT    NOT NULL CHECK (entry_date ${DATE_GLOB}),
      payment_method  TEXT    NOT NULL CHECK (payment_method IN ('cash', 'upi', 'bank_transfer', 'card', 'other')),
      note            TEXT    CHECK (note IS NULL OR length(note) <= 500),
      created_at      TEXT    NOT NULL,
      updated_at      TEXT    NOT NULL
    )`,
    `CREATE INDEX ix_udhaar_person_date ON udhaar_entries (person_id, entry_date, created_at)`,
    `CREATE INDEX ix_udhaar_date ON udhaar_entries (entry_date)`,
  ],
};
