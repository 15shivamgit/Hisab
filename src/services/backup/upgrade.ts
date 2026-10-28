// Maps data.json from an older schema version to the current one, in memory
// (MIGRATIONS.md). One step per version.

import { LATEST_SCHEMA_VERSION } from '@/db/migrations';

type Step = (data: Record<string, unknown>) => Record<string, unknown>;

/** Key = the version a step upgrades *to*. */
const STEPS: Record<number, Step> = {
  // Schema 2 (Phase 7) added people and udhaar entries; schema-1 backups have none.
  2: (data) => ({ ...data, people: [], udhaarEntries: [] }),
};

export function upgradeData(
  fromVersion: number,
  data: Record<string, unknown>,
): Record<string, unknown> {
  let result = data;
  for (let version = fromVersion + 1; version <= LATEST_SCHEMA_VERSION; version++) {
    const step = STEPS[version];
    if (!step) throw new Error(`No upgrade step to schema ${version}`);
    result = step(result);
  }
  return result;
}
