# UI Copy

Status: Approved (Q2: English) · Last updated: 2026-10-21

All strings live in `src/content/strings.ts`, keyed by screen. This doc is the reference; the code is the implementation. Tone: short, friendly, plain. No jargon ("transaction" is OK in the tab name; prefer "entry" in messages).

## Labels

| Key | Text |
|---|---|
| tab.home | Home |
| tab.transactions | Transactions |
| tab.udhaar | Udhaar |
| tab.reports | Reports |
| tab.more | More |
| quick.addExpense | Expense |
| quick.addIncome | Income |
| quick.gave | I gave |
| quick.got | I got |
| dash.net | Net (income − expense) |
| dash.netCaption | Based on your entries. Udhaar not included. |
| udhaar.willGet | You will get |
| udhaar.owe | You owe |
| udhaar.settled | Settled |
| udhaar.gaveRow | You gave |
| udhaar.gotRow | You got |
| udhaar.overdue | Overdue |
| udhaar.dueIn | Due in {days} days |
| udhaar.returnBy | Return by {date} |
| txn.upcoming | Upcoming |
| txn.countedOn | This will be counted on {date} |
| txn.duplicate | Duplicate |
| txn.searchPlaceholder | Search notes or amount |
| udhaar.addPerson | + Add person |
| lock.screenshotNote | While app lock is on, screenshots of Hisaab are blocked. |
| about.copyDiagnostics | Copy diagnostic info |
| about.version | Version {versionName} ({versionCode}) |

## Empty states

| Screen | Title | Message | Action |
|---|---|---|---|
| Dashboard (first run) | Welcome to Hisaab | Add your first expense to get started. | Add expense |
| Transactions | No entries yet | Your income and expenses will show here. | Add entry |
| Transactions (filtered) | Nothing matches | Try changing the filters. | Clear filters |
| Udhaar | No one here yet | Keep track of money you give to or take from friends. | Add person |
| Ledger | No entries with {name} | Record money you gave or got. | I gave / I got |
| Reports | No entries in this period | — | — |
| Budgets | No budgets set | Set a monthly limit to see how much you can still spend. | Set budget |

## Confirmations

| Action | Title | Body | Confirm |
|---|---|---|---|
| Delete transaction | Delete this entry? | This {type} of {amount} will be deleted{receipts? " with its {n} receipts"}. This can't be undone. | Delete |
| Delete receipt | Delete this receipt? | The photo will be removed from this entry. | Delete |
| Discard form | Discard changes? | Your changes won't be saved. | Discard |
| Delete category (no entries) | Delete "{name}"? | This category will be removed{budget? " along with its monthly budget"}. | Delete |
| Category in use | "{name}" is in use | It's used by {n} entries. Archive it instead? It will be hidden for new entries. | Archive |
| Remove budget (Phase 8) | Remove the {name} budget? ("overall" for the monthly budget) | Your entries stay. Only the budget is removed. | Remove |
| Delete udhaar entry | Delete this entry? | {name}'s balance will change to {newBalanceLabel}. | Delete |
| Flip warning | Check this amount | {name} currently {currentLabel}. After this entry, {newLabel}. Is that correct? | Yes, save / Change amount |
| Settled | {name} is settled 🎉 | Remove the return date? | Remove / Keep |
| Restore | Restore this backup? | Backup from {date} ({backupCounts}). This will replace all current data on this phone ({currentCounts}). Your current data will be saved as a safety backup first. Type RESTORE to continue. | Restore |
| Delete all data | Delete all data? | This permanently deletes all entries, receipts, people and budgets on this phone. This can't be undone. Type DELETE to continue. (+ "Create backup first") | Delete everything |

Typed confirmations show a field labelled "Type RESTORE" / "Type DELETE"; the confirm button stays disabled until the word matches (any case).

## Budgets and reports (Phase 8)

| Key | Text |
|---|---|
| budgets numbers | ₹{spent} of ₹{budget} · ₹{left} left / · {n}% used · ₹{left} left / · ₹{over} over |
| budgets.exceedHint | Your category budgets add up to more than your overall budget. |
| budgets.rules | The same budget applies every month. Udhaar and future-dated entries don't count. |
| budgets.allHaveBudgets | Every expense category already has a budget. |
| budgets.saved / removed (toasts) | Budget saved · Budget removed |
| budgets dashboard card | Budget · Manage · Set a monthly budget |
| reports periods | Week · Month · Custom (From / To) |
| reports summary | Income · Expense · Net · Avg spend per day |
| reports.entries | {n} entry / {n} entries |
| reports.upcoming | Upcoming in this period: {n} entries (₹{amount}) — counted on their dates. |
| reports.noData | No {expense\|income} in this period. |
| reports.udhaarNote | Udhaar is not included. |
| reports.exportCsv | Export this period as CSV |
| reports donut "Other" | Other |

## Udhaar (Phase 7)

| Key | Text |
|---|---|
| udhaar.filters | All · You will get · You owe · Settled · Overdue |
| udhaar.sort | Sort: Amount · Name · Recent |
| udhaar.lastEntry / noEntriesYet | Last entry {date} · No entries yet |
| udhaar.overdueSince / setReturnDate | Overdue since {date} · Set return date |
| udhaar.dueToday / dueIn | Due today · Due in {n} days |
| udhaar.menu | Edit person · Clear return date · Archive / Unarchive · Delete person |
| udhaar.archiveOnlySettled | Only a settled person can be archived. |
| udhaar.deleteOnlyEmpty | A person with entries can only be archived. |
| udhaar.deletePerson | Delete {name}? — This person has no entries. They will be removed from Hisaab. |
| udhaar.notUdhaarNote | Udhaar is not income or expense. |
| udhaarEntry.afterThis | After this: {You will get ₹X / You owe ₹X / Settled} |
| udhaarEntry.flip | Check this amount — {name} currently: {label}. After this entry: {label}. Is that correct? [Change amount] [Yes, save] |
| udhaarEntry.delete | Delete this entry? — This entry of {amount} will be deleted. {name}'s balance will change to {label}. |
| udhaarEntry.settled | {name} is settled 🎉 — Remove the return date? [Keep] [Remove] |
| person.phoneHint | Used for WhatsApp and SMS reminders. |
| returnBy.notificationsOff | Notifications are off for Hisaab, so this date shows only inside the app. You can turn them on in Settings. [Close] [Open settings] |
| remind.noPhone | Add a phone number to send by WhatsApp or SMS. |
| remind.couldNotOpen | Couldn't open that app. Try Share instead. |
| dash.willGetFrom / oweTo | from {n} people · to {n} people |
| exportCsv.udhaar | Udhaar — All udhaar entries, with each person's balance after every entry. [Export udhaar CSV] · No udhaar entries yet. |

## Backup, export, nudge (Phase 6)

| Key | Text |
|---|---|
| more.data / more.dangerZone | Data · Danger zone |
| backup.lastBackup | Last backup: {date, time} |
| backup.never | You have never made a backup. |
| backup.counts | {n} entries · {n} receipts · ~{size} MB |
| backup.create / creating | Create backup · Creating backup… |
| backup.missingReceipts | {n} receipts are missing and won't be in the backup. |
| backup.restore / checking / restoring | Restore from backup… · Checking backup… · Restoring… |
| backup.undo / undoHint | Undo last restore · Brings back the data you had before the last restore. |
| backup.technicalDetails | Show technical details |
| exportCsv.intro | Save your entries as a spreadsheet file (Excel, Google Sheets). |
| exportCsv periods | This month · Last month · All entries · Custom (From / To) |
| exportCsv.nothing | No entries in this period. |
| exportCsv.note | Udhaar export comes with the Udhaar feature. |
| deleteAll.backupFirst / done | Create backup first · All data deleted |
| nudge.never / daysAgo / action | You haven't backed up yet. · Last backup {n} days ago. · Back up now |

## Errors

| Code | Message |
|---|---|
| amount.required | Enter an amount |
| amount.zero | Amount must be more than ₹0 |
| amount.decimals | Use up to 2 decimal places |
| amount.max | Maximum is ₹1,00,00,000 |
| amount.invalid | Enter a valid amount |
| date.invalid | Choose a valid date |
| date.future.udhaar | Udhaar can't be in the future. Use "Return by" for expected returns. |
| category.required | Choose a category |
| category.duplicate | A category named "{name}" already exists |
| person.name.required | Enter a name |
| person.duplicate (warning) | You already have a "{name}". Add a phone number or note to tell them apart. |
| storage.full | Not enough free space on your phone. |
| backup.notHisaab | This is not a Hisaab backup file. |
| backup.newer | This backup was made by a newer version of Hisaab. Please update the app. |
| backup.damaged | This backup file is damaged. Your data was not changed. |
| restore.failed | Restore failed. Your data was not changed. |
| generic | Something went wrong. Please try again. |

## Startup (Phase 3)

| Key | Text |
|---|---|
| startup.loading | Opening your data… |
| startup.errorTitle | Hisaab couldn't start |
| startup.errorMessage | Something went wrong while opening your data. Nothing was deleted. |
| startup.dbNewerTitle | Please update Hisaab |
| startup.dbNewerMessage | This data was created by a newer version of Hisaab. Please install the latest version. |
| startup.shareDiagnostics | Share diagnostic info |
| common.tryAgain | Try again |

## Toasts

`Expense saved` · `Income saved` · `Entry updated` · `Entry deleted` · `Receipt added` · `Backup created` · `Backup restored` · `CSV exported` · `Copied`

## Warnings (persistent text)

- Backup screen: "If you uninstall Hisaab or lose this phone, your data is gone unless you have a backup file saved outside the app."
- Backup privacy: "Anyone with this file can see your data and receipts. Keep it private."
- About: "Each phone has its own separate data. Nothing is shared between phones."
