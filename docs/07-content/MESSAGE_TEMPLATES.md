# Message Templates

Status: Approved (Q2: English) · Last updated: 2026-10-21

Implemented in `src/content/templates.ts`. Placeholders: `{name}`, `{amount}` (formatted `₹7,000`), `{date}` (`25 Oct`).

## Reminder messages (share / WhatsApp / SMS) — editable before sending

### Friend owes the user (balance > 0)

**English (default)**
> Hi {name}, just a gentle reminder about the {amount} I gave you. Please return it when you can. Thanks!

**With return-by date**
> Hi {name}, just a reminder about the {amount}. You had said you'd return it by {date}. Thanks!

**Hinglish (not used in v1 — Q2 = English; kept for a future translation)**
> Hi {name}, bas yaad dila raha tha — {amount} jo maine diye the, jab ho sake wapas kar dena. Thanks!

### User owes the friend (balance < 0)

> Hi {name}, I haven't forgotten the {amount} I owe you. I'll return it soon. Thanks for your help!

## Local notifications

| Situation | App lock off | App lock on |
|---|---|---|
| Return-by date reached, friend owes user | **Udhaar reminder** — {name} was to return {amount} today. | **Hisaab** — You have an udhaar reminder. |
| Return-by date reached, user owes friend | **Udhaar reminder** — You planned to return {amount} to {name} today. | **Hisaab** — You have an udhaar reminder. |

## Backup nudge (dashboard)

- Never backed up: "You haven't made a backup yet. Back up now so you don't lose your data."
- Old backup: "Last backup was {days} days ago. Back up now."
