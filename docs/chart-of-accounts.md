# Chart of accounts used by the app

Source: the organisation's Tally "List of Ledgers". Migration `0012_chart_of_accounts.sql` loads it into the app.
Group and ledger names must match Tally exactly; if you rename one in Tally, change it in Settings too.

## Expense categories (ledger under group "Indirect Expenses")
Audit Fees, Bank Charges, Communication Expenses, Electricity Expenses, Fooding & Boarding Expenses, Fuel Expenses,
Miscellaneous Expenses, Office Rent, Professional Fees, Programme Material / Kit Procurement, Repair & Maintenance,
Salary & Staff Cost, Stationary & Printing, Training & Capacity Building, Travel Conveyance.

## Income categories (ledger under group "Indirect Incomes")
Donation - General, Grant Income - Dhwani Foundation, Grant Income - Goonj, Grant Income - WTPA, Interest Income - Bank.

## Payment sources
| Source in the app | Tally ledger | Tally group | Voucher |
|---|---|---|---|
| Cash | Cash | Cash-in-Hand | Payment / Receipt |
| Bank | Bank A/c | Bank Accounts | Payment / Receipt |
| Loan from Secretary | Loan From Secretary | Unsecured Loans | Journal |
| Secretary current account | Secretary- Current Account | Loans & Advances (Asset) | Journal |
| Paid by me (reimburse later) | one ledger per person, "<Name> - Reimbursable" | Sundry Creditors | Journal, then a Payment when reimbursed |

Not used by the recorder (balance-sheet items you post in Tally yourself): Advance To Staff, Grant Receivable - Goonj / WTPA,
Audit Fee Payable, Salary Payable, Statutory Dues Payable, Dhwani Travel Grant, Depreciation.
The old default categories "Grant" and "Other Income" are hidden because they have no ledger in this chart; their history is kept.
