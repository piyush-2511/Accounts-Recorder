# Tally import runbook

## 1. First time only: test on a test company
1. In TallyPrime create a company “Test Import” (or use a copy of your data).
2. In the app: Settings > General, set the company name to the test company’s exact name.
3. Approve 3–5 sample entries (include one cash, one bank, one loan/journal, one income).
4. Admin > Export: choose the dates, generate. Download `ledgers.xml` and `vouchers.xml`.
5. Import (below). Open Day Book: check dates, amounts, Dr/Cr sides and narration against the app.
6. If anything differs (for example Tally rejects UTF-8), change **XML file encoding** to UTF-16 in Settings > General, unlock the batch in Export history, and export again.
7. Only when it is right, set the real company name.

## 2. Every time
1. Admin > Export > pick the period > **Generate**. Each export locks its entries (status Exported).
2. Open TallyPrime with the right company loaded. Gateway of Tally > **Import** (Alt+O) > **Masters**; choose `ledgers.xml`. Behaviour for existing ledgers: *Ignore* / *Combine*. This creates any missing ledgers.
3. Same menu > **Import > Transactions** (Vouchers); choose `vouchers.xml`. Check the import log: *Created* equals the number of entries.
4. Reconcile: Day Book totals for the period should equal the batch total on the history page.

## 3. Mistakes
* Wrong data went in? Delete the imported vouchers in Tally (or use a backup), then in the app: Export history > **Unlock batch**. Entries return to Approved and can be corrected and re-exported. Voucher numbers are re-issued gap-free.
* Entries carry a GUID, so importing the same file twice updates rather than duplicates in most Tally versions. Do not rely on it; check the log.

## 4. How entries map
| App | Tally |
|---|---|
| Cash or bank source, expense | Payment voucher: Dr expense ledger, Cr cash/bank |
| Cash or bank source, income | Receipt voucher: Dr cash/bank, Cr income ledger |
| Journal source (e.g. Loan from Secretary) | Journal voucher: Dr expense, Cr the loan ledger (reverse for income) |
