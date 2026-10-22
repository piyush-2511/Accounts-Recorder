-- 0006: row level security. Enabled on every table; no permissive defaults.

alter table public.profiles        enable row level security;
alter table public.app_settings    enable row level security;
alter table public.categories      enable row level security;
alter table public.payment_sources enable row level security;
alter table public.entries         enable row level security;
alter table public.export_batches  enable row level security;
alter table public.budgets         enable row level security;
alter table public.audit_log       enable row level security;

-- profiles: read own row (or all as admin); only admins change profiles.
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update_admin on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- app_settings: any active user reads (the form needs the limits); admins write.
create policy settings_select on public.app_settings for select to authenticated
  using (public.is_active_user());
create policy settings_insert_admin on public.app_settings for insert to authenticated
  with check (public.is_admin());
create policy settings_update_admin on public.app_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- categories and payment sources: active users read, admins write.
create policy categories_select on public.categories for select to authenticated
  using (public.is_active_user());
create policy categories_insert_admin on public.categories for insert to authenticated
  with check (public.is_admin());
create policy categories_update_admin on public.categories for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy sources_select on public.payment_sources for select to authenticated
  using (public.is_active_user());
create policy sources_insert_admin on public.payment_sources for insert to authenticated
  with check (public.is_admin());
create policy sources_update_admin on public.payment_sources for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- entries
create policy entries_select on public.entries for select to authenticated
  using ((created_by = auth.uid() and deleted_at is null and public.is_active_user()) or public.is_admin());

create policy entries_insert on public.entries for insert to authenticated
  with check (created_by = auth.uid() and public.is_active_user());

create policy entries_update on public.entries for update to authenticated
  using (
    (created_by = auth.uid() and deleted_at is null and status in ('pending', 'rejected') and public.is_active_user())
    or (public.is_admin() and status <> 'exported' and deleted_at is null)
  )
  with check (
    (created_by = auth.uid() and status in ('pending', 'rejected'))
    or public.is_admin()
  );
-- No DELETE policy: entries are never hard-deleted through the API.

-- export batches, budgets, audit log: admin only.
create policy batches_select_admin on public.export_batches for select to authenticated
  using (public.is_admin());

create policy budgets_select_admin on public.budgets for select to authenticated
  using (public.is_admin());
create policy budgets_insert_admin on public.budgets for insert to authenticated
  with check (public.is_admin());
create policy budgets_update_admin on public.budgets for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy budgets_delete_admin on public.budgets for delete to authenticated
  using (public.is_admin());

create policy audit_select_admin on public.audit_log for select to authenticated
  using (public.is_admin());

-- Table privileges: nothing for anon; authenticated gets only what policies can then narrow.
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on public.audit_log from authenticated;
grant select on public.audit_log to authenticated;
revoke insert, update, delete on public.export_batches from authenticated;
grant select on public.export_batches to authenticated;
revoke insert, delete on public.profiles from authenticated;

-- Defence in depth: the API role can never hard-delete or truncate.
revoke delete, truncate on all tables in schema public from authenticated;
grant delete on public.budgets to authenticated;
