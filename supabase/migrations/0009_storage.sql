-- 0009: Storage buckets and policies.
--   vouchers : private, 200 KB per file, JPEG / WebP / PDF. Path = {user_id}/{entry_id}/{random}.{ext}
--   exports  : private, admin only. Holds Tally XML / Excel files of each export batch.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('vouchers', 'vouchers', false, 204800,
     array['image/jpeg', 'image/webp', 'application/pdf']),
  ('exports', 'exports', false, 52428800,
     array['application/xml', 'text/xml', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- vouchers: recorders write inside their own folder; admins read everything.
create policy vouchers_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'vouchers'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_active_user()
  );

create policy vouchers_select on storage.objects for select to authenticated
  using (
    bucket_id = 'vouchers'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
      -- the owner of an entry can read its voucher even if an admin replaced the file
      or exists (select 1 from public.entries e where e.receipt_path = name and e.created_by = auth.uid())
    )
  );

-- A voucher attached to an approved or exported entry is evidence and cannot be removed by a recorder.
create policy vouchers_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'vouchers'
    and (
      public.is_admin()
      or (
        (storage.foldername(name))[1] = auth.uid()::text
        and not exists (
          select 1 from public.entries e
          where e.receipt_path = name and e.status in ('approved', 'exported')
        )
      )
    )
  );

-- exports: admin only.
create policy exports_select on storage.objects for select to authenticated
  using (bucket_id = 'exports' and public.is_admin());
create policy exports_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'exports' and public.is_admin());
create policy exports_delete on storage.objects for delete to authenticated
  using (bucket_id = 'exports' and public.is_admin());
