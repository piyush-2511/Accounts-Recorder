# Admin guide

* **Dashboard**: income, expense and net for this month and the financial year, a monthly chart and top spending. A banner shows how many entries wait for review.
* **Review**: oldest first. Open an entry, look at the voucher, then Approve or Reject (a note is required to reject). Checks flag possible duplicates, missing vouchers and unusually high amounts. Select several and approve in bulk. *Entries > Edit* lets you correct a field and approve in one step.
* **Export**: choose dates, review the preview and checks, generate. Download from *Export history*, import into Tally (`tally-import-runbook.md`).
* **Reports**: by category, programme, payee, payment source and recorder; budget vs actual with forecast; checks; a printable monthly report (save as PDF from the print dialog). CSV and Excel downloads on each table. Reports show approved and exported entries; tick *Include pending* to see everything.
* **Settings**: company name and voucher numbering, categories (with hidden Tally ledgers), payment sources, budgets, users.
* **Audit**: who changed what and when; cannot be edited.

## Reimbursements
* **Reimburse** (top menu) lists everyone who paid for the organisation personally and is owed money, with the oldest expense and any entries still waiting for your approval.
* Click **Reimburse** on a person, untick any expense you are not paying yet, choose the cash or bank account, the date and a reference (UTR or cheque number), then **Record reimbursement**. Do this when you actually pay.
* The reimbursement becomes a voucher in the next Tally export. **History** shows every reimbursement and lets you **void** one that is wrong (before it is exported).
* In *Settings > Users* you can set the Tally ledger name used for a person's reimbursements.

## Removing people and controlling what staff can enter

**Settings > Users > Delete user** works for staff and for other admins (not yourself, and not the last admin).
The person can no longer sign in. Everything they recorded stays, shown under their name only; their email is erased.
You cannot remove someone the organisation still owes money to: reimburse them first. A person who never did anything
(for example an invitation nobody accepted) is deleted completely.

**Settings > Users > Entry controls** decides, for each staff member:
- whether they can record new entries at all,
- whether they can record income,
- which payment sources (the "medium": cash, bank, paid by me...) they may use,
- which categories they may use,
- the highest amount per entry (larger amounts must be entered by an admin).

The recorder's New entry page shows only what is allowed, and the database refuses anything else.
Admins can edit or delete any entry that has not been exported from **Entries** (exported entries unlock with their batch).
