-- 0011: reimbursements. Staff (or admins) pay for the organisation from their own pocket by choosing the
-- payment source "Paid by me (reimburse later)". The expense posts as a Journal voucher
-- (Dr expense / Cr that person's payable ledger). Later an admin records the reimbursement, which settles
-- the payable (Dr payable ledger / Cr cash or bank) and goes into the next Tally export.

-- 1. A new kind of payment source -------------------------------------------------------------------
alter table public.payment_sources drop constraint payment_sources_voucher_mode_check;
alter table public.payment_sources add constraint payment_sources_voucher_mode_check
  check (voucher_mode in ('payment_receipt', 'journal', 'reimbursable'));

insert into public.payment_sources (label, tally_ledger, tally_group, voucher_mode, sort_order) values
  -- tally_ledger is only a placeholder here: the real ledger is one per person (profiles.reimbursement_ledger).
  ('Paid by me (reimburse later)', 'Staff Reimbursement Payable', 'Sundry Creditors', 'reimbursable', 25);

insert into public.app_settings (key, value) values
  ('reimbursement_voucher_type', to_jsonb('Payment'::text))   -- 'Payment' (recommended) or 'Journal'
on conflict (key) do nothing;

-- 2. Per-person payable ledger name ----------------------------------------------------------------
alter table public.profiles add column reimbursement_ledger text
  check (reimbursement_ledger is null or (length(trim(reimbursement_ledger)) between 1 and 100 and reimbursement_ledger !~ '[[:cntrl:]]'));

-- 3. Reimbursements -----------------------------------------------------------------------------------
create table public.reimbursements (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references public.profiles (id),
  source_id   int  not null references public.payment_sources (id),   -- cash or bank it was paid from
  paid_on     date not null,
  amount      numeric(12,2) not null check (amount > 0),
  entry_count int  not null check (entry_count > 0),
  reference   text check (reference is null or length(reference) <= 60),   -- UTR / cheque / receipt no.
  note        text check (note is null or length(note) <= 300),
  status      text not null default 'recorded' check (status in ('recorded', 'exported', 'voided')),
  batch_id    uuid references public.export_batches (id),
  voucher_no  int check (voucher_no is null or voucher_no > 0),
  voucher_fy  int generated always as (public.fy_of(paid_on)) stored,
  created_by  uuid not null references public.profiles (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  voided_at   timestamptz,
  voided_by   uuid references public.profiles (id),
  void_reason text,
  constraint reimbursements_exported_has_batch check (status <> 'exported' or (batch_id is not null and voucher_no is not null)),
  constraint reimbursements_voided_has_reason  check (status <> 'voided' or (length(trim(coalesce(void_reason, ''))) >= 5 and voucher_no is null and batch_id is null))
);
create unique index reimbursements_voucher_no_key on public.reimbursements (voucher_fy, voucher_no) where voucher_no is not null;
create index reimbursements_person_idx on public.reimbursements (person_id, paid_on desc);
create index reimbursements_batch_idx  on public.reimbursements (batch_id) where batch_id is not null;
create trigger reimbursements_set_updated_at before update on public.reimbursements
  for each row execute function public.set_updated_at();
create trigger audit_reimbursements after insert or update or delete on public.reimbursements
  for each row execute function public.audit_row();

alter table public.entries add column payable_ledger   text;
alter table public.entries add column reimbursement_id uuid references public.reimbursements (id);
create index entries_reimbursement_idx on public.entries (reimbursement_id) where reimbursement_id is not null;
create index entries_owed_idx on public.entries (created_by) where reimbursement_id is null and deleted_at is null;

alter table public.export_batches add column reimbursement_count int not null default 0;
alter table public.export_batches drop constraint export_batches_entry_count_check;
alter table public.export_batches add constraint export_batches_has_vouchers check (entry_count + reimbursement_count > 0);

-- RLS: admins see everything; a person sees only their own reimbursements. All writes go through the functions below.
alter table public.reimbursements enable row level security;
create policy reimbursements_select on public.reimbursements for select to authenticated
  using (public.is_admin() or (person_id = auth.uid() and public.is_active_user()));
revoke all on public.reimbursements from anon, authenticated;
grant select on public.reimbursements to authenticated;

-- 4. Snapshot the payable ledger name onto each reimbursable expense ------------------------------
-- Renaming a person later must not split their balance in Tally, so the name is fixed when the expense is recorded.
create or replace function public.entries_payable_snapshot() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_mode text;
begin
  select voucher_mode into v_mode from public.payment_sources where id = new.source_id;
  if v_mode = 'reimbursable' then
    if tg_op = 'INSERT' or new.source_id is distinct from old.source_id or old.payable_ledger is null then
      select coalesce(nullif(trim(p.reimbursement_ledger), ''), left(trim(p.full_name), 80) || ' - Reimbursable')
        into new.payable_ledger from public.profiles p where p.id = new.created_by;
    else
      new.payable_ledger := old.payable_ledger;
    end if;
  else
    new.payable_ledger := null;
  end if;
  return new;
end;
$$;
create trigger entries_payable_trg before insert or update on public.entries
  for each row execute function public.entries_payable_snapshot();

-- 5. Guard: reimbursed expenses are frozen; only expenses can be reimbursable ---------------------------
create or replace function public.entries_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_uid      uuid    := auth.uid();
  v_priv     boolean := coalesce(current_setting('app.privileged', true), '') = 'on';
  v_is_admin boolean := public.is_admin();
  v_max      numeric := public.setting_numeric('max_amount');
  v_req      numeric := public.setting_numeric('voucher_required_above');
  v_today    date    := (now() at time zone 'Asia/Kolkata')::date;
  v_cat      public.categories%rowtype;
  v_src      public.payment_sources%rowtype;
  v_resubmit boolean := false;
  v_changed  boolean;
begin
  if v_uid is null then
    v_priv := true;
  end if;

  if tg_op = 'INSERT' then
    new.status          := 'pending';
    new.review_note     := null;
    new.reviewed_by     := null;
    new.reviewed_at     := null;
    new.batch_id        := null;
    new.voucher_no      := null;
    new.deleted_at      := null;
    new.reimbursement_id := null;
    if v_uid is not null then
      new.created_by := v_uid;
    end if;
    v_changed := true;
  else
    if new.id <> old.id or new.created_by <> old.created_by then
      raise exception 'id and created_by cannot be changed' using errcode = '42501';
    end if;

    if not v_priv then
      if old.deleted_at is not null then
        raise exception 'This entry has been deleted' using errcode = '42501';
      end if;
      if old.status = 'exported' then
        raise exception 'Exported entries are locked' using errcode = '42501';
      end if;
      if not v_is_admin and old.status not in ('pending', 'rejected') then
        raise exception 'Only pending or rejected entries can be edited' using errcode = '42501';
      end if;

      if new.status is distinct from old.status then
        if old.status = 'rejected' and new.status = 'pending' and v_uid = old.created_by then
          v_resubmit := true;
          new.review_note := null;
          new.reviewed_by := null;
          new.reviewed_at := null;
        else
          raise exception 'Status can only be changed through the review workflow' using errcode = '42501';
        end if;
      elsif new.review_note is distinct from old.review_note
         or new.reviewed_by is distinct from old.reviewed_by
         or new.reviewed_at is distinct from old.reviewed_at then
        raise exception 'Review fields can only be changed through the review workflow' using errcode = '42501';
      end if;

      if new.batch_id is distinct from old.batch_id
         or new.voucher_no is distinct from old.voucher_no
         or new.deleted_at is distinct from old.deleted_at
         or new.reimbursement_id is distinct from old.reimbursement_id then
        raise exception 'Export, delete and reimbursement fields cannot be changed directly' using errcode = '42501';
      end if;

      if old.reimbursement_id is not null
         and (new.amount is distinct from old.amount or new.source_id is distinct from old.source_id
              or new.kind is distinct from old.kind or new.entry_date is distinct from old.entry_date) then
        raise exception 'This expense has been reimbursed. Void the reimbursement before changing the amount, date or payment source.' using errcode = '42501';
      end if;
    end if;

    if new.entry_date is distinct from old.entry_date
       and new.voucher_no is not null
       and public.fy_of(new.entry_date) <> public.fy_of(old.entry_date) then
      new.voucher_no := null;
    end if;

    v_changed := new.entry_date is distinct from old.entry_date
              or new.kind        is distinct from old.kind
              or new.category_id is distinct from old.category_id
              or new.source_id   is distinct from old.source_id
              or new.amount      is distinct from old.amount
              or new.receipt_path is distinct from old.receipt_path;
    new.updated_at := now();
  end if;

  if v_changed then
    select * into v_cat from public.categories where id = new.category_id;
    select * into v_src from public.payment_sources where id = new.source_id;
    if not found or v_cat.id is null then
      raise exception 'Unknown category or payment source' using errcode = '23514';
    end if;
    if v_cat.kind <> new.kind then
      raise exception 'Category "%" is not an % category', v_cat.label, new.kind using errcode = '23514';
    end if;
    if v_src.voucher_mode = 'reimbursable' and new.kind <> 'expense' then
      raise exception '"%" can only be used for expenses', v_src.label using errcode = '23514';
    end if;
    if not v_priv and tg_op = 'INSERT' and (not v_cat.is_active or not v_src.is_active) then
      raise exception 'Category or payment source is no longer active' using errcode = '23514';
    end if;
    if new.entry_date > v_today then
      raise exception 'Entry date cannot be in the future' using errcode = '23514';
    end if;
    if new.entry_date < date '2000-01-01' then
      raise exception 'Entry date is too old' using errcode = '23514';
    end if;
    if v_max is not null and new.amount > v_max then
      raise exception 'Amount exceeds the limit of %', v_max using errcode = '23514';
    end if;
    if v_req is not null and new.amount > v_req and new.receipt_path is null then
      raise exception 'A voucher is required for amounts above %', v_req using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

-- 6. Reimbursement workflow ----------------------------------------------------------------------------
create or replace function public.reimburse_entries(
  p_person uuid, p_entry_ids uuid[], p_source_id int, p_paid_on date, p_reference text default null, p_note text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_src   public.payment_sources%rowtype;
  v_ids   uuid[];
  v_ok    int;
  v_total numeric;
  v_last  date;
  v_id    uuid;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can record a reimbursement' using errcode = '42501';
  end if;
  select array_agg(distinct x) into v_ids from unnest(coalesce(p_entry_ids, '{}')) x;
  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception 'Select at least one expense to reimburse' using errcode = '23514';
  end if;
  if array_length(v_ids, 1) > 500 then
    raise exception 'Select at most 500 expenses at a time' using errcode = '23514';
  end if;
  if not exists (select 1 from public.profiles where id = p_person) then
    raise exception 'Person not found' using errcode = 'P0002';
  end if;
  select * into v_src from public.payment_sources where id = p_source_id and is_active;
  if not found or v_src.voucher_mode <> 'payment_receipt' then
    raise exception 'Choose the cash or bank source the money was paid from' using errcode = '23514';
  end if;
  if p_paid_on is null or p_paid_on > v_today then
    raise exception 'The payment date cannot be in the future' using errcode = '23514';
  end if;

  -- Lock the rows so two admins cannot reimburse the same expense twice.
  perform 1 from public.entries where id = any (v_ids) order by id for update;

  select count(*), coalesce(sum(e.amount), 0), max(e.entry_date) into v_ok, v_total, v_last
  from public.entries e join public.payment_sources s on s.id = e.source_id
  where e.id = any (v_ids) and e.created_by = p_person and e.kind = 'expense' and s.voucher_mode = 'reimbursable'
    and e.status in ('approved', 'exported') and e.deleted_at is null and e.reimbursement_id is null;
  if v_ok <> array_length(v_ids, 1) then
    raise exception 'Some selected expenses cannot be reimbursed (already reimbursed, not approved yet, or not this person''s). Refresh and try again.' using errcode = '23514';
  end if;
  if p_paid_on < v_last then
    raise exception 'The payment date cannot be before the latest expense date (%)', v_last using errcode = '23514';
  end if;

  insert into public.reimbursements (person_id, source_id, paid_on, amount, entry_count, reference, note, created_by)
  values (p_person, p_source_id, p_paid_on, v_total, v_ok, nullif(trim(coalesce(p_reference, '')), ''), nullif(trim(coalesce(p_note, '')), ''), auth.uid())
  returning id into v_id;

  perform set_config('app.privileged', 'on', true);
  update public.entries set reimbursement_id = v_id where id = any (v_ids);
  perform set_config('app.privileged', 'off', true);
  return v_id;
end;
$$;

-- Undo a reimbursement that has not been imported into Tally (unlock its export batch first if it has).
create or replace function public.void_reimbursement(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_row public.reimbursements%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can void a reimbursement' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'A reason of at least 5 characters is required' using errcode = '23514';
  end if;
  select * into v_row from public.reimbursements where id = p_id for update;
  if not found then
    raise exception 'Reimbursement not found' using errcode = 'P0002';
  end if;
  if v_row.status = 'voided' then
    raise exception 'This reimbursement is already voided' using errcode = '23514';
  end if;
  if v_row.status = 'exported' then
    raise exception 'This reimbursement is in an export batch. Unlock the batch first.' using errcode = '23514';
  end if;

  perform set_config('app.privileged', 'on', true);
  update public.entries set reimbursement_id = null where reimbursement_id = p_id;
  perform set_config('app.privileged', 'off', true);
  update public.reimbursements
     set status = 'voided', voucher_no = null, batch_id = null, voided_at = now(), voided_by = auth.uid(), void_reason = trim(p_reason)
   where id = p_id;
end;
$$;

-- Reimbursement vouchers use their own gap-free series per financial year (shown in Tally as R-1, R-2, ...).
create or replace function public.assign_reimbursement_numbers(p_from date, p_to date) returns int
language plpgsql security definer set search_path = public as $$
declare
  r       record;
  v_next  int;
  v_count int := 0;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can export' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('voucher_numbers'));
  for r in
    select id, voucher_fy from public.reimbursements
    where status = 'recorded' and voucher_no is null and paid_on between p_from and p_to
    order by paid_on, created_at, id
  loop
    select coalesce(max(voucher_no), 0) + 1 into v_next from public.reimbursements where voucher_fy = r.voucher_fy;
    update public.reimbursements set voucher_no = v_next where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Export batches now hold entries AND reimbursements.
drop function public.finalize_export_batch(uuid[], date, date, text, text, text);
create or replace function public.finalize_export_batch(
  p_entry_ids uuid[], p_reimbursement_ids uuid[], p_date_from date, p_date_to date,
  p_ledgers_path text, p_xml_path text, p_xlsx_path text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_batch   uuid;
  v_count   int := coalesce(array_length(p_entry_ids, 1), 0);
  v_rcount  int := coalesce(array_length(p_reimbursement_ids, 1), 0);
  v_total   numeric := 0;
  v_rtotal  numeric := 0;
  v_ok      int;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can export' using errcode = '42501';
  end if;
  if v_count + v_rcount = 0 then
    raise exception 'Nothing to export' using errcode = '23514';
  end if;

  if v_count > 0 then
    select count(*), coalesce(sum(amount), 0) into v_ok, v_total from public.entries
    where id = any (p_entry_ids) and status = 'approved' and deleted_at is null and voucher_no is not null;
    if v_ok <> v_count then
      raise exception 'Some entries are no longer approved. Refresh and try again.' using errcode = '23514';
    end if;
  end if;
  if v_rcount > 0 then
    select count(*), coalesce(sum(amount), 0) into v_ok, v_rtotal from public.reimbursements
    where id = any (p_reimbursement_ids) and status = 'recorded' and voucher_no is not null;
    if v_ok <> v_rcount then
      raise exception 'Some reimbursements have changed. Refresh and try again.' using errcode = '23514';
    end if;
  end if;

  insert into public.export_batches (created_by, date_from, date_to, entry_count, reimbursement_count, total_amount, ledgers_path, xml_path, xlsx_path)
  values (auth.uid(), p_date_from, p_date_to, v_count, v_rcount, v_total + v_rtotal, p_ledgers_path, p_xml_path, p_xlsx_path)
  returning id into v_batch;

  if v_count > 0 then
    perform set_config('app.privileged', 'on', true);
    update public.entries set status = 'exported', batch_id = v_batch where id = any (p_entry_ids);
    perform set_config('app.privileged', 'off', true);
  end if;
  if v_rcount > 0 then
    update public.reimbursements set status = 'exported', batch_id = v_batch where id = any (p_reimbursement_ids);
  end if;
  return v_batch;
end;
$$;

create or replace function public.unlock_batch(p_batch_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count  int;
  v_rcount int;
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

  with upd as (
    update public.reimbursements set status = 'recorded', batch_id = null
    where batch_id = p_batch_id and status = 'exported'
    returning 1
  )
  select count(*) into v_rcount from upd;

  update public.export_batches set unlocked_at = now(), unlocked_by = auth.uid() where id = p_batch_id;
  insert into public.audit_log (actor, table_name, row_id, action, new_data)
  values (auth.uid(), 'export_batches', p_batch_id::text, 'unlock', jsonb_build_object('entries_returned', v_count, 'reimbursements_returned', v_rcount));
  return v_count + v_rcount;
end;
$$;

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
  if v_row.reimbursement_id is not null then
    raise exception 'This expense has been reimbursed. Void the reimbursement first.' using errcode = '42501';
  end if;
  if not public.is_admin() and not (v_row.created_by = auth.uid() and v_row.status in ('pending', 'rejected') and public.is_active_user()) then
    raise exception 'You cannot delete this entry' using errcode = '42501';
  end if;

  perform set_config('app.privileged', 'on', true);
  update public.entries set deleted_at = now() where id = p_id;
  perform set_config('app.privileged', 'off', true);
end;
$$;

-- Who is owed what (admin only; runs with the caller's RLS).
create or replace function public.reimbursement_summary()
returns table (person_id uuid, full_name text, email text, owed_count int, owed_total numeric, oldest date, awaiting_count int, awaiting_total numeric)
language sql stable security invoker set search_path = public as $$
  select p.id, p.full_name, p.email,
    (count(*) filter (where e.status in ('approved', 'exported')))::int,
    coalesce(sum(e.amount) filter (where e.status in ('approved', 'exported')), 0),
    min(e.entry_date) filter (where e.status in ('approved', 'exported')),
    (count(*) filter (where e.status = 'pending'))::int,
    coalesce(sum(e.amount) filter (where e.status = 'pending'), 0)
  from public.entries e
  join public.payment_sources s on s.id = e.source_id and s.voucher_mode = 'reimbursable'
  join public.profiles p on p.id = e.created_by
  where public.is_admin() and e.deleted_at is null and e.reimbursement_id is null
    and e.kind = 'expense' and e.status in ('pending', 'approved', 'exported')
  group by p.id, p.full_name, p.email
  order by 5 desc, p.full_name;
$$;

revoke execute on function
  public.reimburse_entries(uuid, uuid[], int, date, text, text), public.void_reimbursement(uuid, text),
  public.assign_reimbursement_numbers(date, date),
  public.finalize_export_batch(uuid[], uuid[], date, date, text, text, text),
  public.reimbursement_summary(), public.entries_payable_snapshot()
from public, anon;
grant execute on function
  public.reimburse_entries(uuid, uuid[], int, date, text, text), public.void_reimbursement(uuid, text),
  public.assign_reimbursement_numbers(date, date),
  public.finalize_export_batch(uuid[], uuid[], date, date, text, text, text),
  public.reimbursement_summary()
to authenticated;
