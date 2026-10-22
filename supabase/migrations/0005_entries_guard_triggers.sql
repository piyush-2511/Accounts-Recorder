-- 0005: business-rule guard on entries + audit/updated_at triggers.
--
-- Privileged transitions (review, export, unlock, soft delete) run inside SECURITY DEFINER
-- functions that set the transaction-local flag `app.privileged`. Direct writes through the
-- API (PostgREST) can never set it, so a recorder cannot change status or review fields.

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
  -- No auth.uid() means a trusted server-side (service role) or migration context.
  if v_uid is null then
    v_priv := true;
  end if;

  if tg_op = 'INSERT' then
    new.status      := 'pending';
    new.review_note := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.batch_id    := null;
    new.voucher_no  := null;
    new.deleted_at  := null;
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
         or new.deleted_at is distinct from old.deleted_at then
        raise exception 'Export and delete fields cannot be changed directly' using errcode = '42501';
      end if;
    end if;

    -- If the date moves to another financial year, the voucher number no longer applies.
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

create trigger entries_guard_trg before insert or update on public.entries
  for each row execute function public.entries_guard();

-- Audit triggers.
create trigger audit_entries         after insert or update or delete on public.entries         for each row execute function public.audit_row();
create trigger audit_categories      after insert or update or delete on public.categories      for each row execute function public.audit_row();
create trigger audit_payment_sources after insert or update or delete on public.payment_sources for each row execute function public.audit_row();
create trigger audit_budgets         after insert or update or delete on public.budgets         for each row execute function public.audit_row();
create trigger audit_app_settings    after insert or update or delete on public.app_settings    for each row execute function public.audit_row();
create trigger audit_profiles        after insert or update or delete on public.profiles        for each row execute function public.audit_row();
create trigger audit_export_batches  after insert or update or delete on public.export_batches  for each row execute function public.audit_row();
