-- 0007: workflow functions (review, numbering, export, unlock, delete, helpers).

create or replace function public.review_entry(p_entry_id uuid, p_decision text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_row public.entries%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can review entries' using errcode = '42501';
  end if;
  if p_decision not in ('approve', 'reject') then
    raise exception 'Decision must be approve or reject' using errcode = '22023';
  end if;

  select * into v_row from public.entries where id = p_entry_id and deleted_at is null for update;
  if not found then
    raise exception 'Entry not found' using errcode = 'P0002';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'Only pending entries can be reviewed (this one is %)', v_row.status using errcode = '23514';
  end if;
  if p_decision = 'reject' and length(trim(coalesce(p_note, ''))) < 5 then
    raise exception 'A rejection note of at least 5 characters is required' using errcode = '23514';
  end if;

  perform set_config('app.privileged', 'on', true);
  update public.entries set
    status      = case when p_decision = 'approve' then 'approved'::public.entry_status else 'rejected'::public.entry_status end,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    review_note = case when p_decision = 'reject' then trim(p_note) else nullif(trim(coalesce(p_note, '')), '') end
  where id = p_entry_id;
  perform set_config('app.privileged', 'off', true);
end;
$$;

-- Approve many pending entries at once. Returns the number approved.
create or replace function public.approve_entries(p_ids uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can review entries' using errcode = '42501';
  end if;
  perform set_config('app.privileged', 'on', true);
  with upd as (
    update public.entries set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), review_note = null
    where id = any (p_ids) and status = 'pending' and deleted_at is null
    returning 1
  )
  select count(*) into v_count from upd;
  perform set_config('app.privileged', 'off', true);
  return v_count;
end;
$$;

-- Gap-free voucher numbers per financial year, assigned (once) to approved entries at export time.
create or replace function public.assign_voucher_numbers(p_from date, p_to date) returns int
language plpgsql security definer set search_path = public as $$
declare
  r        record;
  v_next   int;
  v_start  int := coalesce(public.setting_numeric('voucher_start_number'), 1)::int;
  v_count  int := 0;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can export' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('voucher_numbers'));
  perform set_config('app.privileged', 'on', true);
  for r in
    select id, voucher_fy from public.entries
    where status = 'approved' and deleted_at is null and voucher_no is null
      and entry_date between p_from and p_to
    order by entry_date, created_at, id
  loop
    select coalesce(max(voucher_no), v_start - 1) + 1 into v_next from public.entries where voucher_fy = r.voucher_fy;
    update public.entries set voucher_no = v_next where id = r.id;
    v_count := v_count + 1;
  end loop;
  perform set_config('app.privileged', 'off', true);
  return v_count;
end;
$$;

-- Atomically record an export batch and lock its entries.
create or replace function public.finalize_export_batch(
  p_entry_ids uuid[], p_date_from date, p_date_to date,
  p_ledgers_path text, p_xml_path text, p_xlsx_path text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_batch uuid;
  v_count int;
  v_total numeric;
  v_ok    int;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can export' using errcode = '42501';
  end if;
  v_count := coalesce(array_length(p_entry_ids, 1), 0);
  if v_count = 0 then
    raise exception 'Nothing to export' using errcode = '23514';
  end if;

  select count(*), coalesce(sum(amount), 0) into v_ok, v_total from public.entries
  where id = any (p_entry_ids) and status = 'approved' and deleted_at is null and voucher_no is not null;
  if v_ok <> v_count then
    raise exception 'Some entries are no longer approved. Refresh and try again.' using errcode = '23514';
  end if;

  insert into public.export_batches (created_by, date_from, date_to, entry_count, total_amount, ledgers_path, xml_path, xlsx_path)
  values (auth.uid(), p_date_from, p_date_to, v_count, v_total, p_ledgers_path, p_xml_path, p_xlsx_path)
  returning id into v_batch;

  perform set_config('app.privileged', 'on', true);
  update public.entries set status = 'exported', batch_id = v_batch where id = any (p_entry_ids);
  perform set_config('app.privileged', 'off', true);
  return v_batch;
end;
$$;

-- Return a batch's entries to Approved (after a failed Tally import). Voucher numbers are kept.
create or replace function public.unlock_batch(p_batch_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can unlock a batch' using errcode = '42501';
  end if;
  if not exists (select 1 from public.export_batches where id = p_batch_id and unlocked_at is null) then
    raise exception 'Batch not found or already unlocked' using errcode = 'P0002';
  end if;

  perform set_config('app.privileged', 'on', true);
  with upd as (
    update public.entries set status = 'approved', batch_id = null
    where batch_id = p_batch_id and status = 'exported'
    returning 1
  )
  select count(*) into v_count from upd;
  perform set_config('app.privileged', 'off', true);

  update public.export_batches set unlocked_at = now(), unlocked_by = auth.uid() where id = p_batch_id;
  insert into public.audit_log (actor, table_name, row_id, action, new_data)
  values (auth.uid(), 'export_batches', p_batch_id::text, 'unlock', jsonb_build_object('entries_returned', v_count));
  return v_count;
end;
$$;

-- Soft delete: the owner (while pending/rejected) or an admin (anything not exported).
create or replace function public.soft_delete_entry(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_row public.entries%rowtype;
begin
  select * into v_row from public.entries where id = p_id and deleted_at is null for update;
  if not found then
    raise exception 'Entry not found' using errcode = 'P0002';
  end if;
  if v_row.status = 'exported' then
    raise exception 'Exported entries are locked' using errcode = '42501';
  end if;
  if not public.is_admin() and not (v_row.created_by = auth.uid() and v_row.status in ('pending', 'rejected') and public.is_active_user()) then
    raise exception 'You cannot delete this entry' using errcode = '42501';
  end if;

  perform set_config('app.privileged', 'on', true);
  update public.entries set deleted_at = now() where id = p_id;
  perform set_config('app.privileged', 'off', true);
end;
$$;

-- Form helpers -------------------------------------------------------------

create or replace function public.possible_duplicate_count(
  p_date date, p_amount numeric, p_category_id int, p_party text, p_exclude uuid default null
) returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.entries e
  where public.is_active_user()
    and e.deleted_at is null and e.status <> 'rejected'
    and e.entry_date = p_date and e.amount = p_amount and e.category_id = p_category_id
    and lower(coalesce(e.party, '')) = lower(coalesce(p_party, ''))
    and (p_exclude is null or e.id <> p_exclude);
$$;

create or replace function public.suggest_values(p_field text, p_q text default '') returns setof text
language sql stable security definer set search_path = public as $$
  select v from (
    select (array_agg(raw order by raw))[1] as v, count(*) as n
    from (
      select trim(case p_field when 'party' then e.party when 'programme' then e.programme end) as raw
      from public.entries e
      where public.is_active_user() and p_field in ('party', 'programme') and e.deleted_at is null
    ) x
    where raw is not null and raw <> ''
    group by lower(raw)
  ) t
  where v ilike '%' || replace(replace(coalesce(p_q, ''), '%', ''), '_', '') || '%'
  order by n desc, v
  limit 10;
$$;

-- Review flags (admin only; runs with the caller's RLS).
create or replace function public.entry_flags(p_ids uuid[])
returns table (entry_id uuid, possible_duplicate boolean, no_voucher boolean, high_amount boolean)
language sql stable security invoker set search_path = public as $$
  select e.id,
    exists (
      select 1 from public.entries o
      where o.id <> e.id and o.deleted_at is null and o.status <> 'rejected'
        and o.entry_date = e.entry_date and o.amount = e.amount and o.category_id = e.category_id
        and lower(coalesce(o.party, '')) = lower(coalesce(e.party, ''))
    ) as possible_duplicate,
    (e.receipt_path is null) as no_voucher,
    coalesce(
      (select count(*) >= 5 and e.amount > 3 * percentile_cont(0.5) within group (order by o.amount)
         from public.entries o
        where o.id <> e.id and o.category_id = e.category_id and o.deleted_at is null
          and o.status in ('approved', 'exported') and o.entry_date >= e.entry_date - 180 and o.entry_date <= e.entry_date),
      false
    ) as high_amount
  from public.entries e
  where public.is_admin() and e.id = any (p_ids);
$$;

-- Grants -------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.is_admin(), public.is_active_user(), public.setting_numeric(text), public.setting_text(text), public.fy_of(date),
  public.review_entry(uuid, text, text), public.approve_entries(uuid[]),
  public.assign_voucher_numbers(date, date),
  public.finalize_export_batch(uuid[], date, date, text, text, text),
  public.unlock_batch(uuid), public.soft_delete_entry(uuid),
  public.possible_duplicate_count(date, numeric, int, text, uuid),
  public.suggest_values(text, text), public.entry_flags(uuid[])
to authenticated;
