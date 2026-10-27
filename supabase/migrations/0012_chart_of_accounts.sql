-- 0012: align categories and payment sources with the organisation's Tally chart of accounts
-- (Ambedkar Foundation "List of Ledgers"). Group and ledger names below match Tally exactly.
-- Safe to re-run. Existing entries keep their category (rows are renamed, not replaced).

-- 1. Rename the original default categories so recorders see the Tally names.
update public.categories set label = 'Fuel Expenses'                       where kind = 'expense' and label = 'Fuel'                    and not exists (select 1 from public.categories c2 where c2.kind = 'expense' and c2.label = 'Fuel Expenses');
update public.categories set label = 'Fooding & Boarding Expenses'         where kind = 'expense' and label = 'Fooding'                 and not exists (select 1 from public.categories c2 where c2.kind = 'expense' and c2.label = 'Fooding & Boarding Expenses');
update public.categories set label = 'Salary & Staff Cost'                 where kind = 'expense' and label = 'Staff'                   and not exists (select 1 from public.categories c2 where c2.kind = 'expense' and c2.label = 'Salary & Staff Cost');
update public.categories set label = 'Travel Conveyance'                   where kind = 'expense' and label = 'Travel'                  and not exists (select 1 from public.categories c2 where c2.kind = 'expense' and c2.label = 'Travel Conveyance');
update public.categories set label = 'Stationary & Printing'               where kind = 'expense' and label = 'Printing and Stationery' and not exists (select 1 from public.categories c2 where c2.kind = 'expense' and c2.label = 'Stationary & Printing');
update public.categories set label = 'Programme Material / Kit Procurement' where kind = 'expense' and label = 'Programme Material'    and not exists (select 1 from public.categories c2 where c2.kind = 'expense' and c2.label = 'Programme Material / Kit Procurement');
update public.categories set label = 'Communication Expenses'              where kind = 'expense' and label = 'Communication'           and not exists (select 1 from public.categories c2 where c2.kind = 'expense' and c2.label = 'Communication Expenses');
update public.categories set label = 'Miscellaneous Expenses'              where kind = 'expense' and label = 'Other'                   and not exists (select 1 from public.categories c2 where c2.kind = 'expense' and c2.label = 'Miscellaneous Expenses');
update public.categories set label = 'Donation - General'                  where kind = 'income'  and label = 'Donation'                and not exists (select 1 from public.categories c2 where c2.kind = 'income'  and c2.label = 'Donation - General');

-- 2. Expense categories: every one posts to a ledger under the Tally group "Indirect Expenses".
insert into public.categories (label, kind, tally_ledger, tally_group, sort_order, is_active) values
  ('Audit Fees',                          'expense', 'Audit Fees',                          'Indirect Expenses', 10, true),
  ('Bank Charges',                        'expense', 'Bank Charges',                        'Indirect Expenses', 20, true),
  ('Communication Expenses',              'expense', 'Communication Expenses',              'Indirect Expenses', 30, true),
  ('Electricity Expenses',                'expense', 'Electricity Expenses',                'Indirect Expenses', 40, true),
  ('Fooding & Boarding Expenses',         'expense', 'Fooding & Boarding Expenses',         'Indirect Expenses', 50, true),
  ('Fuel Expenses',                       'expense', 'Fuel Expenses',                       'Indirect Expenses', 60, true),
  ('Office Rent',                         'expense', 'Office Rent',                         'Indirect Expenses', 70, true),
  ('Professional Fees',                   'expense', 'Professional Fees',                   'Indirect Expenses', 80, true),
  ('Programme Material / Kit Procurement','expense', 'Programme Material / Kit Procurement','Indirect Expenses', 90, true),
  ('Repair & Maintenance',                'expense', 'Repair & Maintenance',                'Indirect Expenses', 100, true),
  ('Salary & Staff Cost',                 'expense', 'Salary & Staff Cost',                 'Indirect Expenses', 110, true),
  ('Stationary & Printing',               'expense', 'Stationary & Printing',               'Indirect Expenses', 120, true),
  ('Training & Capacity Building',        'expense', 'Training & Capacity Building',        'Indirect Expenses', 130, true),
  ('Travel Conveyance',                   'expense', 'Travel Conveyance',                   'Indirect Expenses', 140, true),
  ('Miscellaneous Expenses',              'expense', 'Miscellaneous Expenses',              'Indirect Expenses', 990, true)
on conflict (label, kind) do update
  set tally_ledger = excluded.tally_ledger, tally_group = excluded.tally_group, sort_order = excluded.sort_order, is_active = true;

-- 3. Income categories: ledgers under "Indirect Incomes".
insert into public.categories (label, kind, tally_ledger, tally_group, sort_order, is_active) values
  ('Donation - General',                 'income', 'Donation - General',                 'Indirect Incomes', 10, true),
  ('Grant Income - Dhwani Foundation',   'income', 'Grant Income - Dhwani Foundation',   'Indirect Incomes', 20, true),
  ('Grant Income - Goonj',               'income', 'Grant Income - Goonj',               'Indirect Incomes', 30, true),
  ('Grant Income - WTPA',                'income', 'Grant Income - WTPA',                'Indirect Incomes', 40, true),
  ('Interest Income - Bank',             'income', 'Interest Income - Bank',             'Indirect Incomes', 50, true)
on conflict (label, kind) do update
  set tally_ledger = excluded.tally_ledger, tally_group = excluded.tally_group, sort_order = excluded.sort_order, is_active = true;

-- 4. Old default categories that have no ledger in the chart of accounts are hidden (history is kept).
update public.categories set is_active = false
 where (kind = 'income' and label in ('Grant', 'Other Income') and tally_ledger in ('Grant Received', 'Other Income'));

-- 5. Payment sources.
update public.payment_sources set tally_ledger = 'Bank A/c', tally_group = 'Bank Accounts'
 where label = 'Bank' and tally_ledger = 'Bank Account';
update public.payment_sources set tally_ledger = 'Loan From Secretary', tally_group = 'Unsecured Loans'
 where label = 'Loan from Secretary' and tally_ledger = 'Loan from Secretary';
-- Staff who pay personally: one payable ledger per person, kept under Sundry Creditors.
update public.payment_sources set tally_group = 'Sundry Creditors' where voucher_mode = 'reimbursable';

insert into public.payment_sources (label, tally_ledger, tally_group, voucher_mode, sort_order) values
  ('Secretary current account', 'Secretary- Current Account', 'Loans & Advances (Asset)', 'journal', 35)
on conflict (label) do nothing;

-- 6. Make PostgREST pick up the new tables/functions immediately (fixes "could not find the function in the schema cache").
notify pgrst, 'reload schema';
