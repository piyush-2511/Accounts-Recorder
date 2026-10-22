-- Test helpers (run after the migrations).
create schema test;
grant usage on schema test to authenticated, anon;

create function test.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  execute 'set local role authenticated';
end;
$$;

create function test.logout() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
end;
$$;

-- Passes only if the statement raises an error whose message contains p_like.
create function test.throws(p_sql text, p_like text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm ilike '%' || p_like || '%' then return; end if;
    raise exception 'expected error like [%] but got [%] for: %', p_like, sqlerrm, p_sql;
  end;
  raise exception 'expected error like [%] but statement succeeded: %', p_like, p_sql;
end;
$$;

-- Returns the number of rows a DML statement affected (RLS can silently filter rows to zero).
create function test.affected(p_sql text) returns int language plpgsql as $$
declare n int;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end;
$$;

create function test.eq(p_actual anyelement, p_expected anyelement, p_label text) returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAIL %: expected [%] got [%]', p_label, p_expected, p_actual;
  end if;
end;
$$;

create function test.is_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is not true then raise exception 'FAIL %', p_label; end if;
end;
$$;

grant execute on all functions in schema test to authenticated, anon;

-- Fixture people (created as superuser).
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin@test.org'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'rec1@test.org'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'rec2@test.org'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'inactive@test.org');
insert into public.profiles (id, full_name, email, role, is_active) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Admin User', 'admin@test.org', 'admin', true),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Recorder One', 'rec1@test.org', 'recorder', true),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Recorder Two', 'rec2@test.org', 'recorder', true),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'Inactive Rec', 'inactive@test.org', 'recorder', false);
