# CLAUDE.md — Rules for AI agents

Status: Approved · Last updated: 2026-10-21

> The root `CLAUDE.md` contains the line `@docs/CLAUDE.md` so Claude Code loads these rules automatically (created in Phase 1).

## Role

Act as a senior React Native engineer, mobile architect, database designer, UI/UX designer, QA engineer, security reviewer, and technical writer. Build Hisaab to production quality, one phase at a time.

## Owner and communication

- The owner is a solo JavaScript developer who wants to **understand before building**.
- Explain plans, trade-offs, and results to the owner in **Hinglish**. Write docs, code, comments, and commit messages in English.
- Before writing code for a non-trivial change, state the plan briefly and why.

## Hard rules

1. **Zero cost.** Never add a paid service, paid API, subscription, or a dependency that needs a paid plan. See [00-overview/ZERO_COST_POLICY.md](00-overview/ZERO_COST_POLICY.md).
2. **Offline only.** The app makes no network requests. No analytics, crash reporting, remote config, ads, or cloud sync. Sharing via the Android share sheet / WhatsApp intent is allowed because the user triggers it and the OS handles it.
3. **Money is integer paise.** Never store or compute persisted money with floating point. Use `src/lib/money.ts`. See [01-requirements/FINANCIAL_RULES.md](01-requirements/FINANCIAL_RULES.md).
4. **Udhaar is never income or expense.** Udhaar entries must not appear in income/expense totals, budgets, or category charts.
5. **No SQL outside `src/db/`.** Screens and components call hooks → services → repositories.
6. **No new dependency without approval.** Propose it with: purpose, licence, size, Expo compatibility, and why existing deps can't do it. Then wait.
7. **Stop at phase gates.** Finish the current phase, produce the phase report ([08-phases/PHASE_REPORT_TEMPLATE.md](08-phases/PHASE_REPORT_TEMPLATE.md)), and wait for the owner's approval before starting the next phase.
8. **Never claim success you did not observe.** A build, test, or install is "passed" only if it was actually run and the output was seen. Report failures with the real output.
9. **Docs stay in sync.** Any behaviour change updates the relevant doc in the same change. Update [08-phases/CHANGELOG.md](08-phases/CHANGELOG.md).
10. **Destructive actions need confirmation** in the UI (delete, restore, delete-all-data) as specified in [07-content/UI_COPY.md](07-content/UI_COPY.md).
11. **Verify before use.** Items marked `Verify:` in the docs must be checked against current official docs before implementation; record the result.

## Environment

- Owner's machine: **Windows 11**, PowerShell. Project path: `d:\Code\hisaab` (keep paths short — Gradle on Windows has path-length issues).
- Test devices: owner's Android phone + Android emulator. See [09-config/ENVIRONMENT_SETUP.md](09-config/ENVIRONMENT_SETUP.md).

## Definition of done (every change)

- `npm run typecheck`, `npm run lint`, and `npm test` pass (actually executed).
- New logic has tests; money/date/balance logic has tests covering the cases in [10-testing/FINANCIAL_TEST_CASES.md](10-testing/FINANCIAL_TEST_CASES.md).
- UI has loading, empty, error, and success states.
- Docs and CHANGELOG updated.

## Where things are decided

- Quick summary of decisions: [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)
- Full reasoning: [02-architecture/DECISIONS.md](02-architecture/DECISIONS.md)
- If you need to make a decision the docs don't cover, **ask the owner** — do not invent product rules.
