-- Report functions, flags, soft delete and audit immutability.
do $$
declare
  rec1 uuid := 'bbbbbbbb-0000-0000-0000-000000000001';
  adm uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  today date := (now() at time zone 'Asia/Kolkata')::date;
  a uuid := '60000000-0000-0000-0000-000000000001';
  b uuid := '60000000-0000-0000-0000-000000000002';
  c uuid := '60000000-0000-0000-0000-000000000003';
  dup uuid := '60000000-0000-0000-0000-000000000004';
  s record;
begin
  perform test.login(rec1);
  insert into entries (id, entry_date, kind, category_id, source_id, amount, party, programme, narration) values
    (a, today - 2, 'expense', 1, 1, 300, 'Piyush', 'Health camp', 'Being Fuel Expense paid to Piyush'),
    (b, today - 2, 'expense', 2, 1, 200, 'Mohit',  'Health camp', 'Being Fooding Expense paid to Mohit'),
    (c, today - 2, 'income',  9, 2, 1000, 'Donor',  null,          'Donation received'),
    (dup, today - 2, 'expense', 1, 1, 300, 'piyush', 'Health camp', 'Being Fuel Expense paid to Piyush again');
  perform test.eq(possible_duplicate_count(today - 2, 300, 1, 'Piyush'), 2, 'duplicate count helper');
  perform test.eq((select count(*) from suggest_values('party', 'piy')), 1::bigint, 'suggestions are case-insensitive and distinct per value');
  perform test.logout();

  perform test.login(adm);
  perform approve_entries(array[a, b, c]);

  select * into s from report_summary(today - 10, today, false);
  perform test.eq(s.income, 1000::numeric, 'summary income (approved only)');
  perform test.eq(s.expense, 500::numeric, 'summary expense excludes pending duplicate');
  select * into s from report_summary(today - 10, today, true);
  perform test.eq(s.expense, 800::numeric, 'including pending adds the duplicate');

  perform test.eq((select expense from report_group('category', today - 10, today) where label = 'Fuel Expenses'), 300::numeric, 'category report');
  perform test.eq((select count(*) from report_group('programme', today - 10, today)), 2::bigint, 'programme report groups (none)');
  perform test.eq((select count(*) from report_group('nonsense', today - 10, today)), 0::bigint, 'unknown dimension returns nothing');
  perform test.eq((select count(*) from report_monthly(today - 70, today)), 3::bigint, 'monthly series has a row per month');

  perform test.is_true((select possible_duplicate from entry_flags(array[a]) ), 'duplicate flagged');
  perform test.is_true((select no_voucher from entry_flags(array[b])), 'missing voucher flagged');
  perform test.is_true((select count(*) >= 2 from report_flagged_entries(today - 10, today)), 'flagged report lists entries');

  perform soft_delete_entry(dup);
  perform test.eq((select count(*) from entries where id = dup and deleted_at is not null), 1::bigint, 'soft deleted');
  perform test.is_true((select not possible_duplicate from entry_flags(array[a])), 'deleted entry no longer a duplicate');
  perform test.logout();

  -- non-admins get no report data
  perform test.login(rec1);
  select * into s from report_summary(today - 10, today, true);
  perform test.eq(s.expense, 0::numeric, 'recorder gets zero summary');
  perform test.eq((select count(*) from report_group('category', today - 10, today, true)), 0::bigint, 'recorder gets no group rows');
  perform test.logout();

  -- audit log is append-only, even for the table owner
  perform test.throws($q$update audit_log set action = 'x'$q$, 'append-only');
  perform test.throws($q$delete from audit_log$q$, 'append-only');
end $$;
