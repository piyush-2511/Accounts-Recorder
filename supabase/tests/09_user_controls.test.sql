-- Removing people keeps their records; per-recorder controls are enforced by the database.
do $$
declare
  adm  uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  rec1 uuid := 'bbbbbbbb-0000-0000-0000-000000000001';
  rec2 uuid := 'bbbbbbbb-0000-0000-0000-000000000002';
  fresh uuid := 'cccccccc-0000-0000-0000-000000000009';
  today date := (now() at time zone 'Asia/Kolkata')::date;
  v_cash int := (select id from payment_sources where label = 'Cash');
  v_bank int := (select id from payment_sources where label = 'Bank');
  v_own  int := (select id from payment_sources where voucher_mode = 'reimbursable');
  v_fuel int := (select id from categories where label = 'Fuel Expenses');
  v_rent int := (select id from categories where label = 'Office Rent');
  v_don  int := (select id from categories where label = 'Donation - General');
  a uuid := '90000000-0000-0000-0000-000000000001';
  e uuid := '90000000-0000-0000-0000-000000000002';
  res text;
begin
  -- Controls: allowed sources, categories, income, amount cap and "may record at all".
  perform test.login(adm);
  update profiles set allowed_source_ids = array[v_cash], allowed_category_ids = array[v_fuel], can_record_income = false, max_entry_amount = 500 where id = rec2;
  perform test.logout();

  perform test.login(rec2);
  insert into entries (id, entry_date, kind, category_id, source_id, amount, narration) values (a, today, 'expense', v_fuel, v_cash, 300, 'Allowed fuel');
  perform test.throws(format($q$insert into entries (entry_date, kind, category_id, source_id, amount, narration) values (%L, 'expense', %s, %s, 100, 'Bank not allowed')$q$, today, v_fuel, v_bank), 'payment source');
  perform test.throws(format($q$insert into entries (entry_date, kind, category_id, source_id, amount, narration) values (%L, 'expense', %s, %s, 100, 'Rent not allowed')$q$, today, v_rent, v_cash), 'category');
  perform test.throws(format($q$insert into entries (entry_date, kind, category_id, source_id, amount, narration) values (%L, 'income', %s, %s, 100, 'Income not allowed')$q$, today, v_don, v_cash), 'income');
  perform test.throws(format($q$insert into entries (entry_date, kind, category_id, source_id, amount, narration) values (%L, 'expense', %s, %s, 900, 'Too large')$q$, today, v_fuel, v_cash), 'limit per entry');
  -- Editing only the narration still works, even for a field that is no longer allowed elsewhere.
  update entries set narration = 'Allowed fuel, edited' where id = a;
  perform test.eq((select narration from entries where id = a), 'Allowed fuel, edited', 'narration edit allowed');
  perform test.throws(format($q$update entries set amount = 900 where id = %L$q$, a), 'limit per entry');
  perform test.logout();

  perform test.login(adm);
  update profiles set can_record = false where id = rec2;
  perform test.logout();
  perform test.login(rec2);
  perform test.throws(format($q$insert into entries (entry_date, kind, category_id, source_id, amount, narration) values (%L, 'expense', %s, %s, 100, 'Switched off')$q$, today, v_fuel, v_cash), 'not allowed to record');
  perform test.logout();

  -- Admins are never restricted, and a recorder cannot change their own controls.
  perform test.login(adm);
  insert into entries (id, entry_date, kind, category_id, source_id, amount, narration) values (e, today, 'income', v_don, v_bank, 5000, 'Admin records anything');
  perform test.logout();
  perform test.login(rec1);
  perform test.eq(test.affected(format($q$update profiles set can_record = true, allowed_source_ids = null, max_entry_amount = null where id = %L$q$, rec2)), 0, 'recorder cannot edit controls');
  perform test.logout();

  -- Removing people.
  perform test.login(adm);
  perform test.throws(format($q$select remove_user(%L)$q$, adm), 'own account');
  perform test.logout();
  perform test.login(rec1);
  perform test.throws(format($q$select remove_user(%L)$q$, rec2), 'Only an admin');
  perform test.logout();

  -- A person with history is retired: login gone, entries and name stay.
  perform test.login(adm);
  res := remove_user(rec2);
  perform test.eq(res, 'retired', 'person with entries is retired');
  perform test.eq((select count(*) from entries where created_by = rec2), 1::bigint, 'entries kept');
  perform test.eq((select full_name from profiles where id = rec2), 'Recorder Two', 'name kept');
  perform test.is_true((select not is_active and deleted_at is not null and email like 'removed-%' from profiles where id = rec2), 'retired profile has no email or login');
  perform test.throws(format($q$select remove_user(%L)$q$, rec2), 'not found');
  perform test.logout();

  -- A person who never did anything is deleted outright.
  insert into auth.users (id, email) values (fresh, 'fresh@test.org');
  insert into profiles (id, full_name, email) values (fresh, 'Fresh Invite', 'fresh@test.org') on conflict (id) do nothing;
  perform test.login(adm);
  perform test.eq(remove_user(fresh), 'deleted', 'unused account is deleted');
  perform test.eq((select count(*) from profiles where id = fresh), 0::bigint, 'profile gone');

  -- Owed money blocks removal until reimbursed.
  perform test.logout();
  perform test.login(rec1);
  insert into entries (id, entry_date, kind, category_id, source_id, amount, narration) values ('90000000-0000-0000-0000-000000000003', today, 'expense', v_fuel, v_own, 120, 'Paid by me');
  perform test.logout();
  perform test.login(adm);
  perform approve_entries(array['90000000-0000-0000-0000-000000000003']::uuid[]);
  perform test.throws(format($q$select remove_user(%L)$q$, rec1), 'still owes');
  perform test.logout();
end $$;
