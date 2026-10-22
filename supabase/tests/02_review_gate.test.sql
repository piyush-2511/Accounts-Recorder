-- Only the review functions can change status; rejection needs a note; resubmit clears it.
do $$
declare
  d date := (now() at time zone 'Asia/Kolkata')::date - 1;
  rec1 uuid := 'bbbbbbbb-0000-0000-0000-000000000001';
  adm uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  e1 uuid := '20000000-0000-0000-0000-000000000001';
begin
  perform test.login(rec1);
  -- a recorder cannot insert an already-approved entry: status is forced to pending
  insert into entries (id, entry_date, kind, category_id, source_id, amount, narration, status)
  values (e1, d, 'expense', 1, 1, 250, 'Being Fooding Expense paid to Mohit', 'approved');
  perform test.eq((select status from entries where id = e1), 'pending'::entry_status, 'status forced to pending on insert');

  perform test.throws($q$update entries set status = 'approved' where id = '20000000-0000-0000-0000-000000000001'$q$, 'review workflow');
  perform test.throws($q$update entries set review_note = 'looks fine to me' where id = '20000000-0000-0000-0000-000000000001'$q$, 'review');
  perform test.throws($q$select review_entry('20000000-0000-0000-0000-000000000001', 'approve')$q$, 'Only an admin');
  perform test.throws($q$select approve_entries(array['20000000-0000-0000-0000-000000000001']::uuid[])$q$, 'Only an admin');
  perform test.logout();

  perform test.login(adm);
  perform test.throws($q$select review_entry('20000000-0000-0000-0000-000000000001', 'reject', 'bad')$q$, 'at least 5');
  perform review_entry(e1, 'reject', 'Voucher is unreadable, please retake');
  perform test.eq((select status from entries where id = e1), 'rejected'::entry_status, 'rejected');
  perform test.throws($q$select review_entry('20000000-0000-0000-0000-000000000001', 'approve')$q$, 'Only pending');
  perform test.logout();

  -- recorder fixes the rejected entry and resubmits
  perform test.login(rec1);
  perform test.eq((select review_note from entries where id = e1), 'Voucher is unreadable, please retake', 'recorder sees note');
  update entries set status = 'pending', narration = 'Being Fooding Expense paid to Mohit (fixed)' where id = e1;
  perform test.eq((select status from entries where id = e1), 'pending'::entry_status, 'resubmitted');
  perform test.is_true((select review_note is null and reviewed_by is null from entries where id = e1), 'review fields cleared on resubmit');
  perform test.logout();

  perform test.login(adm);
  perform review_entry(e1, 'approve');
  perform test.eq((select status from entries where id = e1), 'approved'::entry_status, 'approved');
  perform test.is_true((select reviewed_by = adm and reviewed_at is not null from entries where id = e1), 'reviewer recorded');
  perform test.logout();

  -- approved entries are frozen for the recorder
  perform test.login(rec1);
  perform test.eq(test.affected($q$update entries set narration = 'changed after approval' where id = '20000000-0000-0000-0000-000000000001'$q$), 0, 'recorder cannot edit approved');
  perform test.throws($q$select soft_delete_entry('20000000-0000-0000-0000-000000000001')$q$, 'cannot delete');
  perform test.logout();

  -- audit trail captured the workflow
  perform test.login(adm);
  perform test.is_true((select count(*) >= 3 from audit_log where table_name = 'entries' and row_id = e1::text and action like 'status:%'), 'status changes audited');
  perform test.logout();
end $$;
