begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(14);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values
  (null, '10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'rls-a@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{"full_name":"Test User A"}'::jsonb, pg_catalog.now(), pg_catalog.now()),
  (null, '20000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'rls-b@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{"full_name":"Test User B"}'::jsonb, pg_catalog.now(), pg_catalog.now());

select extensions.ok(
  not has_table_privilege('anon', 'public.profiles', 'SELECT'),
  'anonymous role has no profile SELECT grant'
);
select extensions.ok(
  not has_table_privilege('service_role', 'public.profiles', 'SELECT'),
  'application service role has no profile SELECT grant'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.profiles', 'INSERT'),
  'authenticated role cannot create or reassign profile rows directly'
);
select extensions.ok(
  not has_column_privilege('authenticated', 'public.profiles', 'user_id', 'UPDATE'),
  'authenticated role cannot update profile ownership'
);
select extensions.ok(
  not has_column_privilege('authenticated', 'public.profiles', 'id', 'UPDATE'),
  'authenticated role cannot update the profile primary key'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.profiles', 'DELETE'),
  'authenticated role cannot delete profile rows'
);

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select extensions.is((select pg_catalog.count(*)::integer from public.profiles), 1, 'user A sees only one profile');
select extensions.is(
  (select full_name from public.profiles where user_id = '10000000-0000-4000-8000-000000000001'),
  'Test User A',
  'user A can read their own profile'
);
select extensions.is(
  (select pg_catalog.count(*)::integer from public.profiles where user_id = '20000000-0000-4000-8000-000000000002'),
  0,
  'user A cannot read user B profile'
);
update public.profiles
set full_name = 'Should Not Change'
where user_id = '20000000-0000-4000-8000-000000000002';
select extensions.is(
  (select full_name from public.profiles where user_id = '20000000-0000-4000-8000-000000000002'),
  null::text,
  'user A cannot update user B profile'
);
update public.profiles
set full_name = 'Updated User A'
where user_id = '10000000-0000-4000-8000-000000000001';
select extensions.is(
  (select full_name from public.profiles where user_id = '10000000-0000-4000-8000-000000000001'),
  'Updated User A',
  'user A can update their own permitted profile field'
);

select pg_catalog.set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select extensions.is((select pg_catalog.count(*)::integer from public.profiles), 1, 'user B sees only one profile');
select extensions.is(
  (select full_name from public.profiles where user_id = '20000000-0000-4000-8000-000000000002'),
  'Test User B',
  'user B can read their own profile'
);
select extensions.is(
  (select pg_catalog.count(*)::integer from public.profiles where user_id = '10000000-0000-4000-8000-000000000001'),
  0,
  'user B cannot read user A profile'
);

reset role;
delete from auth.users where id in (
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002'
);

select * from extensions.finish();
rollback;
