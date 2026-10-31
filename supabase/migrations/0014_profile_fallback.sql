-- 0014: people created straight in the Supabase dashboard (Authentication > Add user) have no "full_name" metadata,
-- so 0010 skipped their profile and the app treated them as a disabled account. Now every login gets a profile:
-- the name falls back to the first part of the email, and an admin can correct it in Settings > Users.
-- The role is still always 'recorder'; promote admins with the create-admin script or Settings > Users.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  if new.email is null then
    return new;
  end if;
  v_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
  if v_name is null or length(v_name) < 2 then
    v_name := nullif(split_part(new.email, '@', 1), '');
  end if;
  if v_name is null or length(v_name) < 2 then
    v_name := new.email;
  end if;
  insert into public.profiles (id, full_name, email, role)
  values (new.id, left(v_name, 120), new.email, 'recorder')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Repair people who already exist without a profile.
insert into public.profiles (id, full_name, email, role)
select u.id,
       left(coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), nullif(split_part(u.email, '@', 1), ''), u.email), 120),
       u.email, 'recorder'
from auth.users u
where u.email is not null
  and not exists (select 1 from public.profiles p where p.id = u.id)
  and not exists (select 1 from public.profiles p where lower(p.email) = lower(u.email))
on conflict (id) do nothing;
