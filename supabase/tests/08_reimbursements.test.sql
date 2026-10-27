-- Reimbursements: eligibility, locking, voiding, numbering, export and unlock.
do $$
declare
  adm  uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  rec1 uuid := 'bbbbbbbb-0000-0000-0000-000000000001';
  rec2 uuid := 'bbbbbbbb-0000-0000-0000-000000000002';
  today date := (now() at time zone 'Asia/Kolkata')::date;
  v_own  int := (select id from payment_sources where voucher_mode = 'reimbursable');
  v_loan int := (select id from payment_sources where label = 'Loan from Secretary');
  v_bank int := (select id from payment_sources where label = 'Bank');
  v_fuel int := (select id from categories where label in ('Fuel', 'Fuel Expenses') order by (label = 'Fuel Expenses') desc limit 1);
  v_don  int := (select id from categories where label in ('Donation','Donation - General') order by (label = 'Donation - General') desc limit 1);
  a uuid := '80000000-0000-0000-0000-000000000001';
  b uuid := '80000000-0000-0000-0000-000000000002';
  c uuid := '80000000-0000-0000-0000-000000000003';
  r1 uuid; r2 uuid; batch uuid; batch2 uuid;
begin
  -- 1. A recorder pays from their own pocket.
  perform test.login(rec1);
  insert into entries (id, entry_date, kind, category_id, source_id, amount, narration) values
    (a, today - 6, 'expense', v_fuel, v_own, 400, 'Fuel for van, paid by me'),
    (b, today - 5, 'expense', v_fuel, v_own, 250, 'Fuel again, paid by me'),
    (c, today - 4, 'expense', v_fuel, v_own, 100, 'Fuel third, paid by me');
  perform test.eq((select payable_ledger from entries where id = a), 'Recorder One - Reimbursable', 'payable ledger snapshot');
  perform test.throws(format($q$insert into entries (entry_date, kind, category_id, source_id, amount, narration) values (%L, 'income', %s, %s, 100, 'Donation via own pocket')$q$, today - 1, v_don, v_own), 'only be used for expenses');
  update entries set payable_ledger = 'Someone Else' where id = a;
  perform test.eq((select payable_ledger from entries where id = a), 'Recorder One - Reimbursable', 'payable ledger cannot be edited');
  perform test.throws(format($q$select reimburse_entries(%L, array[%L]::uuid[], %s, %L)$q$, rec1, a, v_bank, today), 'Only an admin');
  perform test.logout();

  -- 2. The admin approves some and reimburses them.
  perform test.login(adm);
  perform test.throws(format($q$select reimburse_entries(%L, array[%L]::uuid[], %s, %L)$q$, rec1, a, v_bank, today), 'cannot be reimbursed');
  perform approve_entries(array[a, b]);
  perform test.eq((select owed_count from reimbursement_summary() where person_id = rec1), 2, 'owed count');
  perform test.eq((select owed_total from reimbursement_summary() where person_id = rec1), 650::numeric, 'owed total');
  perform test.eq((select awaiting_count from reimbursement_summary() where person_id = rec1), 1, 'awaiting approval count');
  perform test.throws(format($q$select reimburse_entries(%L, array[%L, %L]::uuid[], %s, %L)$q$, rec1, a, b, v_loan, today), 'cash or bank');
  perform test.throws(format($q$select reimburse_entries(%L, array[%L, %L]::uuid[], %s, %L)$q$, rec1, a, b, v_bank, today + 1), 'future');
  perform test.throws(format($q$select reimburse_entries(%L, array[%L, %L]::uuid[], %s, %L)$q$, rec1, a, b, v_bank, today - 10), 'before the latest expense');
  perform test.throws(format($q$select reimburse_entries(%L, array[%L, %L]::uuid[], %s, %L)$q$, rec2, a, b, v_bank, today), 'cannot be reimbursed');
  r1 := reimburse_entries(rec1, array[a, b], v_bank, today - 1, 'UTR 12345', 'Monthly claim');
  perform test.eq((select amount from reimbursements where id = r1), 650::numeric, 'reimbursement amount');
  perform test.eq((select status from reimbursements where id = r1), 'recorded', 'reimbursement status');
  perform test.eq((select count(*) from entries where reimbursement_id = r1), 2::bigint, 'entries linked');
  perform test.throws(format($q$select reimburse_entries(%L, array[%L]::uuid[], %s, %L)$q$, rec1, a, v_bank, today), 'cannot be reimbursed');
  perform test.throws(format($q$update entries set amount = 999 where id = %L$q$, a), 'has been reimbursed');
  perform test.throws(format($q$update entries set reimbursement_id = null where id = %L$q$, a), 'cannot be changed directly');
  perform test.throws(format($q$select soft_delete_entry(%L)$q$, a), 'reimbursed');
  perform test.eq((select owed_count from reimbursement_summary() where person_id = rec1), 0, 'nothing left to reimburse');
  perform test.logout();

  perform test.login(rec1);
  perform test.eq((select count(*) from reimbursements), 1::bigint, 'person sees own reimbursement');
  perform test.eq(test.affected(format($q$update entries set reimbursement_id = null where id = %L$q$, a)), 0, 'recorder cannot unlink an approved expense');
  perform test.throws(format($q$update entries set reimbursement_id = %L where id = %L$q$, r1, c), 'cannot be changed directly');
  perform test.throws($q$delete from reimbursements$q$, 'permission denied');
  perform test.logout();
  perform test.login(rec2);
  perform test.eq((select count(*) from reimbursements), 0::bigint, 'other people see nothing');
  perform test.logout();

  -- 3. Numbering, export, unlock, void.
  perform test.login(adm);
  perform test.eq(assign_reimbursement_numbers(today - 30, today), 1, 'one reimbursement numbered');
  perform test.eq((select voucher_no from reimbursements where id = r1), 1, 'first number is 1');
  perform test.eq(assign_reimbursement_numbers(today - 30, today), 0, 'numbering is idempotent');
  perform assign_voucher_numbers(today - 30, today);
  perform test.throws($q$select finalize_export_batch('{}'::uuid[], '{}'::uuid[], current_date - 30, current_date, 'a', 'b', 'c')$q$, 'Nothing to export');
  batch := finalize_export_batch(array[a, b], array[r1], today - 30, today, 'b/l.xml', 'b/v.xml', 'b/v.xlsx');
  perform test.eq((select status from reimbursements where id = r1), 'exported', 'reimbursement exported');
  perform test.eq((select reimbursement_count from export_batches where id = batch), 1, 'batch reimbursement count');
  perform test.eq((select total_amount from export_batches where id = batch), 1300::numeric, 'batch total includes both');
  perform test.throws(format($q$select void_reimbursement(%L, 'wrong person paid')$q$, r1), 'Unlock the batch first');
  perform test.eq(unlock_batch(batch), 3, 'unlock returns entries and reimbursements');
  perform test.eq((select status from reimbursements where id = r1), 'recorded', 'reimbursement back to recorded');
  perform test.throws(format($q$select void_reimbursement(%L, 'no')$q$, r1), 'at least 5');
  perform void_reimbursement(r1, 'Paid the wrong person');
  perform test.eq((select status from reimbursements where id = r1), 'voided', 'voided');
  perform test.is_true((select voucher_no is null from reimbursements where id = r1), 'voided has no voucher number');
  perform test.eq((select count(*) from entries where reimbursement_id is not null), 0::bigint, 'entries released');
  perform test.throws(format($q$select void_reimbursement(%L, 'Paid the wrong person')$q$, r1), 'already voided');

  -- 4. Reimburse again and export only the reimbursement.
  r2 := reimburse_entries(rec1, array[a, b], v_bank, today, null, null);
  perform assign_reimbursement_numbers(today - 30, today);
  perform test.eq((select voucher_no from reimbursements where id = r2), 1, 'voided numbers are not reused as gaps: series restarts from the max');
  batch2 := finalize_export_batch('{}'::uuid[], array[r2], today - 30, today, 'c/l.xml', 'c/v.xml', 'c/v.xlsx');
  perform test.eq((select entry_count from export_batches where id = batch2), 0, 'reimbursement-only batch');
  perform test.is_true((select count(*) >= 3 from audit_log where table_name = 'reimbursements'), 'reimbursements are audited');
  perform test.logout();
end $$;
