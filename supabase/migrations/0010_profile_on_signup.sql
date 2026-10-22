-- 0010: every new auth user gets a profile.
-- The role is ALWAYS 'recorder' here. Metadata is user-controllable, so it is never trusted for roles:
-- the app promotes an invited user to admin afterwards with the service role.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_name text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
begin
  if v_name is null or new.email is null then
    return new;  -- no usable name: the app shows "account not set up" and an admin can fix it
  end if;
  insert into public.profiles (id, full_name, email, role)
  values (new.id, left(v_name, 120), new.email, 'recorder')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
