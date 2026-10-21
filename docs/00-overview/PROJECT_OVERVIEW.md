# Project Overview

Status: Approved · Last updated: 2026-10-21

## Problem

Small daily spending, cash and UPI payments, and informal money given to or taken from friends are easy to forget. Existing apps often need an account, push cloud sync, show ads, or bundle features (loans with interest, business ledgers) that a single person does not need.

## Product

Hisaab is a private money diary that lives only on the user's phone.

| Area | What the user can do |
|---|---|
| Transactions | Record income and expenses with amount, category, date, payment method, description, notes |
| Receipts | Attach photos (camera or gallery) to an expense or income entry; view and zoom later |
| Udhaar | Keep a history of money given to and taken from friends, including partial returns; see who owes whom |
| Budgets | Set a monthly overall budget and per-category budgets; see progress |
| Reports | Weekly, monthly, and custom-range summaries; category breakdown; trends |
| Export & backup | Export CSV; create a full backup file (data + receipts) and restore it |
| Privacy | Optional app lock with fingerprint / face / device PIN |

## Users

| User | Situation |
|---|---|
| Owner | Daily user; builds and installs the APK |
| Friends (a few) | Install the same APK on their own phones. **Each phone has completely separate data.** Nothing is shared between phones. |

## Goals

- Recording an expense takes under 10 seconds from the home screen.
- Works fully offline, always.
- The user always knows the data lives only on this phone and how to back it up.
- Clear, unambiguous udhaar labels: "You will get" vs "You owe".
- ₹0 total cost.

## Non-goals (v1)

See [../01-requirements/OUT_OF_SCOPE.md](../01-requirements/OUT_OF_SCOPE.md). Highlights: no cloud sync, no multi-device, no shared/family accounts, no loan interest, no bank accounts or transfers, no OCR, no iOS.

## Honest claims

The app and any store listing MUST NOT claim:
- multi-device sync or shared accounts,
- that the dashboard figure is a real bank balance,
- that data survives uninstalling the app (it does not, unless the user has a backup file outside the app).
