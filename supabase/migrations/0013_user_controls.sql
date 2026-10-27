-- 0013: remove people without losing their records, and per-person controls over what a recorder may enter.

-- 1. A profile no longer disappears when its login is deleted. The record of who entered what stays,
--    holding only the person's name (no email, no login).
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles add column deleted_at timestamptz;
alter table public.profiles add column deleted_by uuid;

-- 2. Controls an admin can set for each recorder. NULL lists mean "everything is allowed".
alter table public.profiles add column can_record        boolean not null default true;   -- may create new entries at all
alter table public.profiles add column can_record_income boolean not null default true;
alter table public.profiles add column allowed_source_ids   int[];                        -- payment sources they may use
alter table public.profiles add column allowed_category_ids int[];                        -- categories they may use
alter table public.profiles add column max_entry_amount numeric(12,2) check (max_entry_amount is null or max_entry_amount > 0);

-- Checks a recorder's new or changed entry against their controls. Admins are never restricted.
create or replace function public.assert_recorder_allowed(
  p_uid uuid, p_is_insert boolean, p_kind text, p_category int, p_source int, p_amount numeric,
  p_cat_changed boolean, p_src_changed boolean, p_amt_changed boolean
) returns void language plpgsql security definer set search_path = public as $$
declare
  p public.profiles%rowtype;
begin
  select * into p from public.profiles where id = p_uid;
  if not found or p.role = 'admin' then
    return;
  end if;
  if p_is_insert and not p.can_record then
    raise exception 'Your account is not allowed to record new entries. Please contact your administrator.' using errcode = '42501';
  end if;
  if (p_is_insert or p_cat_changed) and p_kind = 'income' and not p.can_record_income then
    raise exception 'Your account is not allowed to record income.' using errcode = '42501';
  end if;
  if (p_is_insert or p_src_changed) and p.allowed_source_ids is not null and not (p_source = any (p.allowed_source_ids)) then
    raise exception 'Your account is not allowed to use this payment source.' using errcode = '42501';
  end if;
  if (p_is_insert or p_cat_changed) and p.allowed_category_ids is not null and not (p_category = any (p.allowed_category_ids)) then
    raise exception 'Your account is not allowed to use this category.' using errcode = '42501';
  end if;
  if (p_is_insert or p_amt_changed) and p.max_entry_amount is not null and p_amount > p.max_entry_amount then
    raise exception 'Your limit per entry is %. Ask your administrator for approval of larger amounts.', p.max_entry_amount using errcode = '23514';
  end if;
end;
$$;
revoke execute on function public.assert_recorder_allowed(uuid, boolean, text, int, int, numeric, boolean, boolean, boolean) from public, anon, authenticated;

-- 3. The entry guard, now also enforcing the controls above.
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
  v_cat_chg  boolean := true;
  v_src_chg  boolean := true;
  v_amt_chg  boolean := true;
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

    v_cat_chg := new.category_id is distinct from old.category_id or new.kind is distinct from old.kind;
    v_src_chg := new.source_id is distinct from old.source_id;
    v_amt_chg := new.amount is distinct from old.amount;
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
    if not v_priv and not v_is_admin and v_uid is not null then
      perform public.assert_recorder_allowed(v_uid, tg_op = 'INSERT', new.kind::text, new.category_id, new.source_id, new.amount, v_cat_chg, v_src_chg, v_amt_chg);
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

-- 4. Removing a person. They can no longer sign in; everything they recorded stays under their name.
--    A person who never recorded or reviewed anything (for example an unaccepted invitation) is deleted outright.
create or replace function public.remove_user(p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_row    public.profiles%rowtype;
  v_owed   numeric;
  v_admins int;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can remove a person' using errcode = '42501';
  end if;
  select * into v_row from public.profiles where id = p_id for update;
  if not found or v_row.deleted_at is not null then
    raise exception 'Person not found' using errcode = 'P0002';
  end if;
  if p_id = auth.uid() then
    raise exception 'You cannot remove your own account' using errcode = '42501';
  end if;
  if v_row.role = 'admin' and v_row.is_active then
    select count(*) into v_admins from public.profiles where role = 'admin' and is_active and deleted_at is null and id <> p_id;
    if v_admins = 0 then
      raise exception 'This is the only active admin. Make someone else an admin first.' using errcode = '23514';
    end if;
  end if;
  select coalesce(sum(amount), 0) into v_owed from public.entries e
   where e.created_by = p_id and e.deleted_at is null and e.reimbursement_id is null and e.kind = 'expense'
     and e.status in ('approved', 'exported')
     and exists (select 1 from public.payment_sources s where s.id = e.source_id and s.voucher_mode = 'reimbursable');
  if v_owed > 0 then
    raise exception 'The organisation still owes % to this person. Reimburse them first.', v_owed using errcode = '23514';
  end if;

  begin
    delete from public.profiles where id = p_id;      -- works only when nothing refers to this person
    return 'deleted';
  exception when foreign_key_violation then
    update public.profiles
       set deleted_at = now(), deleted_by = auth.uid(), is_active = false, role = 'recorder',
           email = 'removed-' || id || '@removed.invalid', can_record = false
     where id = p_id;
    return 'retired';
  end;
end;
$$;
revoke execute on function public.remove_user(uuid) from public, anon;
grant execute on function public.remove_user(uuid) to authenticated;

notify pgrst, 'reload schema';
