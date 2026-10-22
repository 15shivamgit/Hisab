export interface Migration {
  /** Consecutive integers starting at 1. Never edit a migration that has shipped. */
  version: number;
  name: string;
  /** Static SQL only (no parameters). Run in order inside one transaction. */
  statements: readonly string[];
}
