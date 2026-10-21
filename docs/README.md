# Hisaab — Documentation

Hisaab is an offline, Android-first personal finance diary: income, expenses, receipts, budgets, and a simple udhaar (money given to / taken from friends) tracker.

This project is **spec-driven**. The documents in this folder are the source of truth. Code follows the docs. If code and docs disagree, fix the doc first (or in the same change) — never let them drift.

## Reading order

1. [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) — one-page summary of what is decided and what is open.
2. [CLAUDE.md](CLAUDE.md) — rules for AI agents (and humans) working on this repo.
3. [00-overview](00-overview/) — product overview, glossary, zero-cost policy.
4. [01-requirements](01-requirements/) — requirements and **financial rules** (read FINANCIAL_RULES.md before touching any money logic).
5. The relevant feature doc in [05-features](05-features/), plus [03-database](03-database/) and [04-api](04-api/).
6. [08-phases/DEVELOPMENT_PHASES.md](08-phases/DEVELOPMENT_PHASES.md) — what the current phase includes and its acceptance criteria.

## Folder map

| Folder | Contents |
|---|---|
| [00-overview](00-overview/) | Product overview, glossary, zero-cost policy |
| [01-requirements](01-requirements/) | Functional requirements, financial rules, non-functional requirements, out of scope |
| [02-architecture](02-architecture/) | Tech stack, architecture, project structure, decision log (ADRs), security & privacy |
| [03-database](03-database/) | SQLite schema, constraints, indexes, migrations |
| [04-api](04-api/) | Internal data API — repositories, services, pure libraries. **There is no network API.** |
| [05-features](05-features/) | One spec per feature: behaviour, validation, edge cases, acceptance criteria |
| [06-design](06-design/) | UI/UX guide, design tokens, screens and navigation |
| [07-content](07-content/) | UI copy, default categories, reminder message templates |
| [08-phases](08-phases/) | Development phases, workflow, phase report template, changelog |
| [09-config](09-config/) | Windows environment setup, app configuration, build and release |
| [10-testing](10-testing/) | Testing strategy, acceptance criteria, financial test cases, release checklist |

## Conventions

- **MUST / SHOULD / MAY** are used in the RFC 2119 sense.
- Requirement IDs (e.g. `TXN-03`, `UDH-07`) are referenced from tests and phase reports.
- **`Verify:`** marks a statement about a third-party library, platform rule, or limit that MUST be checked against current official documentation before implementation. These can change over time; record the verified result in the doc.
- Every doc starts with a status line: `Draft` → `Approved` → `Implemented`.
- Money is always written in examples as ₹ with Indian grouping (₹1,25,000.50) and stored as integer paise.
