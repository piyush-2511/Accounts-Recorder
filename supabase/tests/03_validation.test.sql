-- Business rules enforced by the database, independent of the UI.
do $$
declare
  rec1 uuid := 'bbbbbbbb-0000-0000-0000-000000000001';
  adm uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  d date := (now() at time zone 'Asia/Kolkata')::date - 1;
begin
  perform test.login(rec1);
  perform test.throws(format($q$insert into entries (entry_date, kind, category_id, source_id, amount, narration)
     values (%L, 'expense', 1, 1, 10, 'future dated entry')$q$, d + 5), 'future');
  perform test.throws(format($q$insert into entries (entry_date, kind, category_id, source_id, amount, narration)
     values (%L, 'income', 1, 1, 10, 'income against expense category')$q$, d), 'not an income category');
  perform test.throws(format($q$insert into entries (entry_date, kind, category_id, source_id, amount, narration)
     values (%L, 'expense', 1, 1, 0, 'zero amount entry')$q$, d), 'check');
  perform test.throws(format($q$insert into entries (entry_date, kind, category_id, source_id, amount, narration)
     values (%L, 'expense', 1, 1, 2000000, 'over the limit')$q$, d), 'exceeds the limit');
  perform test.throws(format($q$insert into entries (entry_date, kind, category_id, source_id, amount, narration, receipt_path, receipt_size, receipt_mime)
     values (%L, 'expense', 1, 1, 10, 'too large voucher', 'x/y/z.jpg', 204801, 'image/jpeg')$q$, d), 'check');
  perform test.throws(format($q$insert into entries (entry_date, kind, category_id, source_id, amount, narration, receipt_path)
     values (%L, 'expense', 1, 1, 10, 'path without size', 'x/y/z.jpg')$q$, d), 'entries_receipt_consistent');
  perform test.logout();

  -- admin turns on "voucher required above 1000"
  perform test.login(adm);
  update app_settings set value = to_jsonb(1000) where key = 'voucher_required_above';
  perform test.logout();

  perform test.login(rec1);
  perform test.throws(format($q$insert into entries (entry_date, kind, category_id, source_id, amount, narration)
     values (%L, 'expense', 1, 1, 1500, 'big spend without voucher')$q$, d), 'voucher is required');
  insert into entries (entry_date, kind, category_id, source_id, amount, narration, receipt_path, receipt_size, receipt_mime)
  values (d, 'expense', 1, 1, 1500, 'big spend with voucher', 'bbbbbbbb-0000-0000-0000-000000000001/e/a.jpg', 150000, 'image/jpeg');
  insert into entries (entry_date, kind, category_id, source_id, amount, narration)
  values (d, 'expense', 1, 1, 999.50, 'small spend without voucher');
  perform test.logout();

  -- recorders cannot change settings
  perform test.login(rec1);
  perform test.eq(test.affected($q$update app_settings set value = 'null'::jsonb where key = 'voucher_required_above'$q$), 0, 'recorder cannot change settings');
  perform test.logout();
end $$;
