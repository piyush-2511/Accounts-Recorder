-- Voucher numbering, export batches, locking and unlock.
do $$
declare
  rec1 uuid := 'bbbbbbbb-0000-0000-0000-000000000001';
  adm uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  today date := (now() at time zone 'Asia/Kolkata')::date;
  e1 uuid := '40000000-0000-0000-0000-000000000001';
  e2 uuid := '40000000-0000-0000-0000-000000000002';
  e3 uuid := '40000000-0000-0000-0000-000000000003';
  batch uuid;
  n int;
begin
  perform test.login(rec1);
  insert into entries (id, entry_date, kind, category_id, source_id, amount, narration) values
    (e1, today - 3, 'expense', 1, 3, 300, 'Being Fuel Expense paid to Piyush'),
    (e2, today - 5, 'expense', 2, 3, 250, 'Being Fooding Expense paid to Mohit'),
    (e3, today - 1, 'income',  9, 1, 5000, 'Donation received');
  perform test.throws($q$select assign_voucher_numbers(current_date - 30, current_date)$q$, 'Only an admin');
  perform test.logout();

  perform test.login(adm);
  perform approve_entries(array[e1, e2]);
  perform test.eq((select count(*) from entries where status = 'pending'), 1::bigint, 'one still pending');
  n := assign_voucher_numbers(today - 30, today);
  perform test.eq(n, 2, 'two numbers assigned');
  -- numbers follow entry date order within the financial year
  perform test.is_true((select voucher_no from entries where id = e2) < (select voucher_no from entries where id = e1), 'older entry gets lower number');
  perform test.eq(assign_voucher_numbers(today - 30, today), 0, 'numbering is idempotent');

  perform test.throws(format($q$select finalize_export_batch(array[%L, %L]::uuid[], %L, %L, 'a', 'b', 'c')$q$, e1, e3, today - 30, today), 'no longer approved');
  batch := finalize_export_batch(array[e1, e2], today - 30, today, 'b/ledgers.xml', 'b/vouchers.xml', 'b/vouchers.xlsx');
  perform test.eq((select count(*) from entries where status = 'exported' and batch_id = batch), 2::bigint, 'entries exported');
  perform test.eq((select total_amount from export_batches where id = batch), 550.00::numeric, 'batch total');

  -- exported rows are locked, even for admin
  perform test.eq(test.affected(format($q$update entries set narration = 'edit after export' where id = %L$q$, e1)), 0, 'admin cannot edit exported');
  perform test.throws(format($q$select soft_delete_entry(%L)$q$, e1), 'locked');
  perform test.logout();

  -- a later approval continues the sequence
  perform test.login(adm);
  perform review_entry(e3, 'approve');
  perform assign_voucher_numbers(today - 30, today);
  perform test.eq((select voucher_no from entries where id = e3), 3, 'sequence continues without gaps');

  -- unlock returns entries to approved and keeps their numbers
  perform test.eq(unlock_batch(batch), 2, 'two entries unlocked');
  perform test.eq((select status from entries where id = e1), 'approved'::entry_status, 'back to approved');
  perform test.is_true((select voucher_no is not null and batch_id is null from entries where id = e1), 'number kept, batch cleared');
  perform test.throws(format($q$select unlock_batch(%L)$q$, batch), 'already unlocked');
  perform test.is_true((select count(*) >= 1 from audit_log where table_name = 'export_batches' and action = 'unlock'), 'unlock audited');
  perform test.logout();

  perform test.login(rec1);
  perform test.throws(format($q$select unlock_batch(%L)$q$, batch), 'Only an admin');
  perform test.logout();
end $$;
