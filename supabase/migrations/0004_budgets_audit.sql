-- 0004: budgets and the append-only audit log.

create table public.budgets (
  category_id int  not null references public.categories (id) on delete cascade,
  month       date not null check (month = date_trunc('month', month)::date),
  amount      numeric(12,2) not null check (amount >= 0),
  updated_at  timestamptz not null default now(),
  primary key (category_id, month)
);
create trigger budgets_set_updated_at before update on public.budgets
  for each row execute function public.set_updated_at();

create table public.audit_log (
  id         bigserial primary key,
  at         timestamptz not null default now(),
  actor      uuid,
  table_name text not null,
  row_id     text not null,
  action     text not null,
  old_data   jsonb,
  new_data   jsonb
);
create index audit_log_at_idx  on public.audit_log (at desc);
create index audit_log_row_idx on public.audit_log (table_name, row_id);

-- Audit rows can never be changed or removed.
create or replace function public.audit_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_log is append-only' using errcode = '42501';
end;
$$;
create trigger audit_log_no_change before update or delete on public.audit_log
  for each row execute function public.audit_immutable();

create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_new jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_ref jsonb := coalesce(v_new, v_old);
  v_id  text;
  v_action text := lower(tg_op);
begin
  v_id := coalesce(v_ref ->> 'id', v_ref ->> 'key', (v_ref ->> 'category_id') || '/' || (v_ref ->> 'month'));

  if tg_table_name = 'entries' and tg_op = 'UPDATE' then
    if (v_new ->> 'deleted_at') is not null and (v_old ->> 'deleted_at') is null then
      v_action := 'soft_delete';
    elsif (v_new ->> 'status') is distinct from (v_old ->> 'status') then
      v_action := 'status:' || (v_new ->> 'status');
    end if;
  end if;

  -- Do not record no-op updates (e.g. only updated_at changed).
  if tg_op = 'UPDATE' and (v_old - 'updated_at') = (v_new - 'updated_at') then
    return null;
  end if;

  insert into public.audit_log (actor, table_name, row_id, action, old_data, new_data)
  values (auth.uid(), tg_table_name, v_id, v_action, v_old, v_new);
  return null;
end;
$$;
