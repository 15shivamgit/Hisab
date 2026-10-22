import { randomUUID } from 'expo-crypto';

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** New primary key: lowercase UUID v4 (DATABASE_SCHEMA.md § Conventions). */
export function newId(): string {
  return randomUUID().toLowerCase();
}

export function isUuid(value: string): boolean {
  return UUID_V4_RE.test(value);
}
