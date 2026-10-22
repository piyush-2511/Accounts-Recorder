-- 0008: reporting functions. SECURITY INVOKER: they run with the caller's RLS and only return
-- data to admins. Heavy aggregation stays in Postgres, never in the browser.

create or replace function public.counted_statuses(p_include_pending boolean) returns public.entry_status[]
language sql immutable as $$
  select case when p_include_pending
              then array['pending', 'approved', 'exported']::public.entry_status[]
              else array['approved', 'exported']::public.entry_status[] end;
$$;

create or replace function public.report_summary(p_from date, p_to date, p_include_pending boolean default false)
returns table (income numeric, expense numeric, entry_count bigint)
language sql stable as $$
  select coalesce(sum(e.amount) filter (where e.kind = 'income'), 0),
         coalesce(sum(e.amount) filter (where e.kind = 'expense'), 0),
         count(*)
  from public.entries e
  where public.is_admin() and e.deleted_at is null
    and e.entry_date between p_from and p_to
    and e.status = any (public.counted_statuses(p_include_pending));
$$;

create or replace function public.report_monthly(p_from date, p_to date, p_include_pending boolean default false)
returns table (month date, income numeric, expense numeric)
language sql stable as $$
  select m::date,
         coalesce(sum(e.amount) filter (where e.kind = 'income'), 0),
         coalesce(sum(e.amount) filter (where e.kind = 'expense'), 0)
  from generate_series(date_trunc('month', p_from)::timestamp, date_trunc('month', p_to)::timestamp, interval '1 month') m
  left join public.entries e
    on date_trunc('month', e.entry_date)::date = m::date
   and e.deleted_at is null
   and e.status = any (public.counted_statuses(p_include_pending))
   and public.is_admin()
  group by m
  order by m;
$$;

create or replace function public.report_group(
  p_dim text, p_from date, p_to date, p_include_pending boolean default false, p_recorder uuid default null
) returns table (label text, income numeric, expense numeric, entry_count bigint)
language sql stable as $$
  select case p_dim
           when 'category'  then c.label
           when 'programme' then coalesce(nullif(trim(e.programme), ''), '(none)')
           when 'payee'     then coalesce(nullif(trim(e.party), ''), '(none)')
           when 'source'    then s.label
           when 'recorder'  then p.full_name
         end as label,
         coalesce(sum(e.amount) filter (where e.kind = 'income'), 0),
         coalesce(sum(e.amount) filter (where e.kind = 'expense'), 0),
         count(*)
  from public.entries e
  join public.categories c on c.id = e.category_id
  join public.payment_sources s on s.id = e.source_id
  join public.profiles p on p.id = e.created_by
  where public.is_admin() and p_dim in ('category', 'programme', 'payee', 'source', 'recorder')
    and e.deleted_at is null
    and e.entry_date between p_from and p_to
    and e.status = any (public.counted_statuses(p_include_pending))
    and (p_recorder is null or e.created_by = p_recorder)
  group by 1
  order by coalesce(sum(e.amount) filter (where e.kind = 'expense'), 0) + coalesce(sum(e.amount) filter (where e.kind = 'income'), 0) desc, 1;
$$;

create or replace function public.report_budget_vs_actual(p_month date, p_include_pending boolean default false)
returns table (category_id int, label text, budget numeric, actual numeric)
language sql stable as $$
  select c.id, c.label, b.amount,
         coalesce((
           select sum(e.amount) from public.entries e
           where e.category_id = c.id and e.deleted_at is null
             and date_trunc('month', e.entry_date)::date = date_trunc('month', p_month)::date
             and e.status = any (public.counted_statuses(p_include_pending))
         ), 0)
  from public.categories c
  left join public.budgets b on b.category_id = c.id and b.month = date_trunc('month', p_month)::date
  where public.is_admin() and c.kind = 'expense' and (c.is_active or b.amount is not null)
  order by c.sort_order, c.label;
$$;

-- Average monthly expense per category over the N full months before p_ref (budget suggestions).
create or replace function public.report_avg_expense(p_ref date, p_months int default 3)
returns table (category_id int, avg_amount numeric)
language sql stable as $$
  select c.id,
         round(coalesce(sum(e.amount), 0) / greatest(p_months, 1), 2)
  from public.categories c
  left join public.entries e
    on e.category_id = c.id and e.deleted_at is null
   and e.status in ('approved', 'exported')
   and e.entry_date >= (date_trunc('month', p_ref) - make_interval(months => p_months))::date
   and e.entry_date <  date_trunc('month', p_ref)::date
  where public.is_admin() and c.kind = 'expense'
  group by c.id;
$$;

create or replace function public.report_flagged_entries(p_from date, p_to date)
returns table (
  entry_id uuid, entry_date date, amount numeric, kind public.entry_kind, category text, party text,
  recorder text, status public.entry_status, possible_duplicate boolean, no_voucher boolean, high_amount boolean
)
language sql stable as $$
  select e.id, e.entry_date, e.amount, e.kind, c.label, e.party, p.full_name, e.status,
         f.possible_duplicate, f.no_voucher, f.high_amount
  from public.entry_flags(array(
         select x.id from public.entries x
         where x.deleted_at is null and x.status <> 'rejected' and x.entry_date between p_from and p_to
       )) f
  join public.entries e on e.id = f.entry_id
  join public.categories c on c.id = e.category_id
  join public.profiles p on p.id = e.created_by
  where f.possible_duplicate or f.no_voucher or f.high_amount
  order by e.entry_date desc, e.created_at desc;
$$;

grant execute on function
  public.counted_statuses(boolean),
  public.report_summary(date, date, boolean),
  public.report_monthly(date, date, boolean),
  public.report_group(text, date, date, boolean, uuid),
  public.report_budget_vs_actual(date, boolean),
  public.report_avg_expense(date, int),
  public.report_flagged_entries(date, date)
to authenticated;
revoke execute on function
  public.counted_statuses(boolean),
  public.report_summary(date, date, boolean),
  public.report_monthly(date, date, boolean),
  public.report_group(text, date, date, boolean, uuid),
  public.report_budget_vs_actual(date, boolean),
  public.report_avg_expense(date, int),
  public.report_flagged_entries(date, date)
from public, anon;
