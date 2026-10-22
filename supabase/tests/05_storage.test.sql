-- Voucher files: private per-user folders, admin read, evidence protection.
do $$
declare
  rec1 uuid := 'bbbbbbbb-0000-0000-0000-000000000001';
  rec2 uuid := 'bbbbbbbb-0000-0000-0000-000000000002';
  adm uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  d date := (now() at time zone 'Asia/Kolkata')::date - 1;
  path text := 'bbbbbbbb-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/a.jpg';
begin
  perform test.is_true((select file_size_limit = 204800 from storage.buckets where id = 'vouchers'), 'bucket limit is 200 KB');
  perform test.is_true((select not public from storage.buckets where id = 'vouchers'), 'bucket is private');

  perform test.login(rec1);
  insert into storage.objects (bucket_id, name, owner) values ('vouchers', path, rec1);
  perform test.throws($q$insert into storage.objects (bucket_id, name) values ('vouchers', 'bbbbbbbb-0000-0000-0000-000000000002/x/a.jpg')$q$, 'row-level security');
  perform test.throws($q$insert into storage.objects (bucket_id, name) values ('exports', 'b/vouchers.xml')$q$, 'row-level security');
  insert into entries (id, entry_date, kind, category_id, source_id, amount, narration, receipt_path, receipt_size, receipt_mime)
  values ('50000000-0000-0000-0000-000000000001', d, 'expense', 1, 1, 100, 'Entry with a voucher file', path, 120000, 'image/jpeg');
  perform test.logout();

  perform test.login(rec2);
  perform test.eq((select count(*) from storage.objects), 0::bigint, 'other recorder cannot see the file');
  perform test.logout();

  perform test.login(adm);
  perform test.eq((select count(*) from storage.objects), 1::bigint, 'admin can see the file');
  perform review_entry('50000000-0000-0000-0000-000000000001', 'approve');
  perform test.logout();

  perform test.login(rec1);
  perform test.eq(test.affected(format($q$delete from storage.objects where name = %L$q$, path)), 0, 'recorder cannot delete evidence of an approved entry');
  perform test.logout();

  perform test.login(adm);
  perform test.eq(test.affected(format($q$delete from storage.objects where name = %L$q$, path)), 1, 'admin can delete');
  perform test.logout();
end $$;
