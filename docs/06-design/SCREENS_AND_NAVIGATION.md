# Screens and Navigation

Status: Approved · Last updated: 2026-10-21

Routes map to files in `app/` (see [../02-architecture/PROJECT_STRUCTURE.md](../02-architecture/PROJECT_STRUCTURE.md)).

## Map

```
Root stack
├─ onboarding (first run only)        → gate around the navigator, not a route (Phase 9)
├─ lock (when app lock active)         → gate + full-screen Modal, not a route (Phase 9)
├─ (tabs)
│  ├─ Home            /                → Dashboard
│  ├─ Transactions    /transactions    → list, search, filters (?categoryId=&type=&start=&end= from Reports/Dashboard, Phase 8)
│  ├─ Udhaar          /udhaar          → people list with balances
│  ├─ Reports         /reports
│  └─ More            /more            → settings hub
├─ /transaction/new?type=expense|income
├─ /transaction/[id]                   → detail
├─ /transaction/[id]/edit
├─ /receipt/[transactionId]?index=n    → full-screen viewer (modal)
├─ /person/new
├─ /person/[id]                        → ledger
├─ /person/[id]/edit
├─ /udhaar-entry/new?personId=&direction=gave|got
├─ /udhaar-entry/[id]/edit
├─ /categories
├─ /budgets
├─ /backup
├─ /export                             → Export CSV (Phase 6)
├─ /dev-tools                          → debug builds only (backup spike, crash test)
├─ /about                              → version, privacy, licences, diagnostics (Phase 9)
└─ /licenses                           → open-source licences (Phase 9)

Settings (theme, week start, reminders, app lock) live on the More tab itself; there is no `/settings` route.
```

## Screen inventory

| Screen | Phase | Primary action | Spec |
|---|---|---|---|
| Dashboard | 4/7/8 | Quick add | DASHBOARD.md |
| Transactions list | 4 | FAB add | TRANSACTIONS.md |
| Transaction form | 4/5 | Save | TRANSACTIONS.md, RECEIPTS.md |
| Transaction detail | 4/5 | Edit | TRANSACTIONS.md |
| Receipt viewer | 5 | Zoom / replace / delete | RECEIPTS.md |
| Categories | 4 | Add | CATEGORIES.md |
| Backup & restore | 6 | Create backup | BACKUP_AND_RESTORE.md |
| Export | 6 | Export CSV | REPORTS_AND_EXPORT.md |
| Udhaar people list | 7 | Add person | UDHAAR.md |
| Person form | 7 | Save | UDHAAR.md |
| Person ledger | 7 | I gave / I got / Remind | UDHAAR.md |
| Udhaar entry form | 7 | Save | UDHAAR.md |
| Budgets | 8 | Set budget | BUDGETS.md |
| Reports | 8 | Change period | REPORTS_AND_EXPORT.md |
| More / Settings / About | 9 | — | SETTINGS_AND_APP_LOCK.md |
| Onboarding | 9 | Get started | SETTINGS_AND_APP_LOCK.md |
| Lock | 9 | Unlock | SETTINGS_AND_APP_LOCK.md |

## Navigation rules

- Forms open as stack screens (full height) — easier with the keyboard than sheets.
- Receipt viewer is a modal.
- Android back: closes sheets/dialogs first, then the unsaved-changes guard, then pops.
- Notification tap → `/person/[id]` (after unlock if locked).
- Deep links are not exposed publicly in v1 (scheme reserved: `hisaab://`).
