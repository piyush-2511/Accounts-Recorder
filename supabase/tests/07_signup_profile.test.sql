-- New auth users get a recorder profile; metadata can never grant admin.
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000a1', 'new@example.org', '{"full_name":"New Person","role":"admin"}');
do $$
begin
  if (select role from public.profiles where id = '00000000-0000-0000-0000-0000000000a1') is distinct from 'recorder' then
    raise exception 'FAIL: signup profile missing or role not recorder';
  end if;
end $$;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a2', 'noname@example.org');
do $$
begin
  if exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-0000000000a2') then
    raise exception 'FAIL: profile created without a name';
  end if;
end $$;
