# Feature: Udhaar (money with friends)

Status: Approved · Phase: 7 · Requirements: UDH-01…12 · Decisions: ADR-004, ADR-005 · Rules: FINANCIAL_RULES.md §4

## Concept

A simple history of money between the user and each friend. Every entry is either:

- **I gave** — money went from me to the friend (I lent, or I returned what I had taken).
- **I got** — money came to me from the friend (I borrowed, or they returned what they had taken).

Balance per friend = total gave − total got.

| Balance | Shown as |
|---|---|
| > 0 | **You will get ₹X** (green, ↓) — "Rahul owes you" |
| < 0 | **You owe ₹X** (orange-red, ↑) — "You owe Rahul" |
| = 0 | **Settled** (grey, ✓) |

No interest, no loan statuses, no schedules. Udhaar is never income or expense (UDH-12).

### Worked example

| Date | Entry | Balance after | Shown |
|---|---|---|---|
| 1 Oct | I gave Rahul ₹10,000 | +10,000 | You will get ₹10,000 |
| 10 Oct | I got from Rahul ₹3,000 | +7,000 | You will get ₹7,000 |
| 15 Oct | I gave Rahul ₹2,000 (top-up) | +9,000 | You will get ₹9,000 |
| 30 Oct | I got from Rahul ₹9,000 | 0 | Settled |

| Date | Entry | Balance after | Shown |
|---|---|---|---|
| 5 Oct | I got from Amit ₹8,000 (borrowed) | −8,000 | You owe ₹8,000 |
| 20 Oct | I gave Amit ₹2,000 (returned part) | −6,000 | You owe ₹6,000 |

## Screens

### Udhaar tab (people list) — UDH-10

- Top summary: "You will get ₹A" | "You owe ₹B".
- Search by name; filter chips: All · You will get · You owe · Settled · Overdue; sort: Amount (default), Name, Recent activity.
- Row: initials avatar, name, last entry date, balance label + amount, badge "Overdue" / "Due 25 Oct".
- FAB "+ Add person". Archived people under "Show archived".
- Empty state: "Keep track of money you give to or take from friends." [Add person]

### Person picker (from dashboard "I gave" / "I got")

- List of active people with balances, search by name, and **"+ Add person"** at the top.
- If there are no people yet, the Add person form opens directly; after saving, the entry form opens for that person.

### Add / edit person — UDH-01

| Field | Rules |
|---|---|
| Name | Required, 1–60 chars, trimmed. Exact duplicate → warning (not error): "You already have a 'Rahul'. Add a phone number or note to tell them apart." |
| Phone | Optional; digits, spaces, `+`, `-` allowed in input, stored normalised (digits with optional leading `+`, 6–20 chars). Used for WhatsApp/SMS. |
| Notes | Optional, ≤ 500 chars |

### Person ledger — UDH-03, UDH-04, UDH-07

- Header: name, balance label (large), return-by date chip ("Return by 25 Oct" / "Overdue since 20 Oct" / "Set return date").
- Buttons: **I gave** | **I got** | **Remind** (shown when balance ≠ 0).
- Entries newest first: date, "You gave" / "You got", amount, note, payment method, running balance after that entry.
- Menu: Edit person, Archive (only when settled), Delete (only when no entries).

### Add / edit entry — UDH-02, UDH-05, UDH-06

| Field | Rules |
|---|---|
| Direction | From the button pressed; switchable in the form |
| Amount | `parseRupeesToPaise`; same limits as transactions |
| Date | Default today; **future dates rejected** (FR-4.12) |
| Payment method | Chips, default Cash |
| Note | Optional, ≤ 500 chars; placeholder e.g. "For hospital bill" |

- Live preview under the amount: "After this: You will get ₹7,000".
- **Flip warning** (FR-4.6): if the entry changes the sign of the balance → dialog: "Rahul currently owes you ₹7,000. After this entry, you will owe Rahul ₹1,000. Is that correct?" [Change amount] [Yes, save].
- Delete entry → "Delete this entry of ₹3,000? Rahul's balance will change to ₹10,000 (you will get)." 
- When the balance becomes 0 and a return-by date exists → "Rahul is settled. Remove the return date?" [Keep] [Remove].

## Return-by date and reminders — UDH-07, UDH-08

- Set from the person ledger chip. Date must be today or later when set.
- First time with reminders on → request POST_NOTIFICATIONS. If denied: the date still works for in-app badges; a note says notifications are off.
- `reminderService.reconcile()` schedules one local notification per eligible person at `reminder_time` on the return-by date. If that time today has already passed when set for today, no notification is scheduled (in-app badge only).
- Notification text: [../07-content/MESSAGE_TEMPLATES.md](../07-content/MESSAGE_TEMPLATES.md). Tapping opens the person ledger.
- Overdue persists in-app until settled or the date is changed. No repeated notifications in v1.
- Notifications use the Android channel `udhaar-reminders` ("Udhaar reminders"), created by `reminderService.ensureChannel()` on startup.
- Triggers are inexact date triggers (no exact-alarm permission); arriving a few minutes late is acceptable.
- Scheduled reminders must survive a phone reboot. `Verify:` expo-notifications reschedules after boot on the current SDK; `reconcile()` on every app start is the fallback. **Checked 2026-10-28 (source):** expo-notifications 58.1.6 declares `RECEIVE_BOOT_COMPLETED` and a receiver for `BOOT_COMPLETED` / `REBOOT` / `QUICKBOOT_POWERON` / `MY_PACKAGE_REPLACED` that re-schedules stored notifications; Expo docs: "used to set up scheduled notifications when the device (re)starts". Reconcile also runs on every app start.

**Implemented (Phase 7):** `src/services/reminderService.ts` (`reconcile` cancels all and re-schedules; DATE trigger on channel `udhaar-reminders`, `bestEffort` = inexact delivery), `src/platform/notifications.ts`. Reconcile runs at startup and after every udhaar/person change, restore, and delete-all. The permission is asked when a return-by date is set, not at startup; if denied, the date is saved and a dialog offers "Open settings". Tapping a reminder opens the person ledger (cold start and while running). Checked on the owner's phone 2026-10-28: prompt, deny path, notification at the reminder time ("Udhaar reminder — Test Rahul was to return ₹7,000 today.", brand colour, ₹ icon, channel `udhaar-reminders`), tap → ledger, reminder cancelled once settled.

## Remind via WhatsApp / SMS / share — UDH-09

"Remind" sheet:
- **WhatsApp** (if phone set): open `https://wa.me/<digits>?text=<encoded>`. Indian 10-digit numbers get `91` prefixed. If WhatsApp isn't installed, the link opens the browser/Play Store page — acceptable; or fall back to the share sheet.
- **SMS** (if phone set): `sms:<number>?body=<encoded>` — the SMS app sends it; the app needs no SMS permission.
- **Share…**: React Native `Share.share({ message })`.
- **Copy text**.
- The message is previewed and editable before sending. Templates differ for "you will get" vs "you owe" (the second is a "I'll return soon" note to self/friend).
- `Verify:` Android 11+ package visibility — opening `https://` and `sms:` links via `Linking.openURL` without `canOpenURL` checks needs no `<queries>`; confirm behaviour. **Implemented without `canOpenURL`** (`RemindSheet`); a failure shows "Couldn't open that app. Try Share instead." WhatsApp/SMS were not opened on the owner's phone during testing (a dummy number could belong to a real person); URL formats are unit-tested (`src/lib/phone.test.ts`). Share was opened: the system sheet shows the text with Android's own **Copy** button, which covers "Copy text" without a clipboard library.

## Archive / delete — UDH-11

- Archive allowed only when settled. Archived people are hidden from the list and pickers, still included in CSV and backup.
- Delete allowed only when the person has no entries ("Delete Rahul?").

## Acceptance

- Gave ₹10,000 then got ₹3,000 → "You will get ₹7,000".
- Got ₹8,000 then gave ₹2,000 → "You owe ₹6,000".
- Multiple partial returns → correct running balances and history.
- Udhaar entries never change dashboard income/expense, budgets, or reports (repository + service tests).
- Future-dated entry rejected.
- Person with entries cannot be deleted (UI and repository).
- Reminder fires on an emulator for a person with a date set to today + time in 2 minutes (manual test).
- Reminder scheduled for tomorrow still fires after a phone reboot (manual test).
