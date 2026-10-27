-- Recorders only see and touch their own entries; anon and inactive users get nothing.
do $$
declare
  d date := (now() at time zone 'Asia/Kolkata')::date - 1;
  rec1 uuid := 'bbbbbbbb-0000-0000-0000-000000000001';
  rec2 uuid := 'bbbbbbbb-0000-0000-0000-000000000002';
  inactive uuid := 'bbbbbbbb-0000-0000-0000-000000000003';
  adm uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
begin
  perform test.login(rec1);
  insert into entries (id, entry_date, kind, category_id, source_id, amount, party, narration)
  values ('10000000-0000-0000-0000-000000000001', d, 'expense',
          (select id from categories where label = 'Fuel Expenses'), (select id from payment_sources where label = 'Cash'),
          300, 'Piyush', 'Being Fuel Expense paid to Piyush');
  perform test.eq((select count(*) from entries), 1::bigint, 'rec1 sees own entry');
  perform test.eq((select status from entries), 'pending'::entry_status, 'new entries are pending');
  perform test.eq((select created_by from entries), rec1, 'created_by forced to caller');
  perform test.logout();

  perform test.login(rec2);
  perform test.eq((select count(*) from entries), 0::bigint, 'rec2 sees nothing');
  perform test.eq(test.affected($q$update entries set narration = 'hacked narration' where id = '10000000-0000-0000-0000-000000000001'$q$), 0, 'rec2 cannot update rec1 row');
  perform test.throws($q$delete from entries where id = '10000000-0000-0000-0000-000000000001'$q$, 'permission denied');
  perform test.eq((select count(*) from profiles), 1::bigint, 'rec2 sees only own profile');
  perform test.logout();
end $$;

do $$
declare
  rec1 uuid := 'bbbbbbbb-0000-0000-0000-000000000001';
  rec2 uuid := 'bbbbbbbb-0000-0000-0000-000000000002';
  inactive uuid := 'bbbbbbbb-0000-0000-0000-000000000003';
  adm uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  d date := (now() at time zone 'Asia/Kolkata')::date - 1;
begin
  perform test.login(rec2);
  insert into entries (id, entry_date, kind, category_id, source_id, amount, narration, created_by)
  values ('10000000-0000-0000-0000-000000000009', d, 'expense', 1, 1, 10, 'spoofed owner attempt', rec1);
  perform test.eq((select created_by from entries where id = '10000000-0000-0000-0000-000000000009'), rec2, 'spoofed created_by is overwritten');
  perform test.logout();

  perform test.login(inactive);
  perform test.throws($q$insert into entries (entry_date, kind, category_id, source_id, amount, narration)
     values (current_date - 1, 'expense', 1, 1, 10, 'inactive user')$q$, 'row-level security');
  perform test.eq((select count(*) from categories), 0::bigint, 'inactive user sees no categories');
  perform test.logout();

  perform test.login(adm);
  perform test.eq((select count(*) from entries), 2::bigint, 'admin sees all entries');
  perform test.eq((select count(*) from profiles), 4::bigint, 'admin sees all profiles');
  perform test.logout();

  execute 'set local role anon';
  perform test.throws('select * from entries', 'permission denied');
  perform test.throws('select * from audit_log', 'permission denied');
  execute 'reset role';
end $$;
