# Workflow

Status: Approved · Last updated: 2026-10-21

## Per task

1. **Read** the relevant docs (feature spec, FINANCIAL_RULES, schema, API).
2. **Plan** — short plan to the owner (Hinglish): what will change, files, risks. Wait if it touches money rules, schema, dependencies, or backup format.
3. **Spec first** — if behaviour isn't in the docs or must change, update the doc first.
4. **Implement** in small steps; keep the app runnable.
5. **Test** — write/extend tests; run `npm run typecheck && npm run lint && npm test`.
6. **Verify on device** for anything UI, files, notifications, or permissions.
7. **Docs + CHANGELOG** updated.
8. **Commit** with a clear message (only when the owner asks or has approved committing for the phase).

## Git

- Single branch `main` — **no phase or feature branches** (owner decision 2026-10-21). Commit and push to `main`.
- Remote: `https://github.com/15shivamgit/Hisab.git`. This machine's active GitHub login is a different account (`shivam-quark`); push as `15shivamgit` without changing the global login:
  ```powershell
  $env:GH_TOKEN = (gh auth token -u 15shivamgit); git -c credential.helper= -c "credential.helper=!gh auth git-credential" push
  ```
- Commit messages: `feat(transactions): add filter sheet`, `fix(backup): reject zip entries with ..`, `docs: update UDHAAR flip warning`, `test: …`, `chore: …`.
- Never commit keystores, passwords, `credentials.json`, real backup files, or real personal data.
- Optional free remote: private GitHub repo (source backup only).

## Change control

| Change | Needs |
|---|---|
| New dependency | Owner approval (CLAUDE.md rule 6) + TECH_STACK.md update |
| Schema change | New migration + DATABASE_SCHEMA.md + backup `schemaVersion` bump + upgrade function + tests |
| Money/udhaar rule change | FINANCIAL_RULES.md update + owner approval + new test cases |
| Backup format change | `formatVersion` bump + reader for previous versions |
| New permission | SECURITY_AND_PRIVACY.md update + owner approval |

## Defect priority

| P | Meaning | Example |
|---|---|---|
| P1 | Data loss/corruption, wrong money totals, crash on launch | Restore leaves partial data |
| P2 | Feature broken, no workaround | Can't attach receipts |
| P3 | Cosmetic or has workaround | Misaligned icon |
