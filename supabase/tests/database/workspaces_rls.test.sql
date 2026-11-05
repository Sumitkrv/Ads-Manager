begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (null, '31000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'tenant-a@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now()),
  (null, '31000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'tenant-b@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now()),
  (null, '31000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'tenant-c@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now()),
  (null, '31000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'tenant-editor@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now()),
  (null, '31000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'tenant-viewer@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now()),
  (null, '31000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'tenant-admin@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now());

select extensions.ok(not has_table_privilege('anon', 'public.workspaces', 'SELECT'), 'anonymous users cannot read workspaces');
select extensions.ok(not has_table_privilege('anon', 'public.workspace_memberships', 'SELECT'), 'anonymous users cannot read memberships');
select extensions.ok(has_column_privilege('authenticated', 'public.workspace_memberships', 'user_id', 'SELECT'), 'authenticated users can read the membership fields needed for their own workspace list');
select extensions.ok(not has_column_privilege('authenticated', 'public.workspaces', 'creation_request_id', 'SELECT'), 'idempotency keys are not selectable from the workspace table');
select extensions.ok(not has_table_privilege('authenticated', 'public.workspaces', 'INSERT'), 'authenticated users cannot insert workspace rows directly');
select extensions.ok(not has_table_privilege('authenticated', 'public.workspaces', 'UPDATE'), 'workspace settings are changed only through the validated RPC');
select extensions.ok(not has_table_privilege('authenticated', 'public.workspace_memberships', 'INSERT'), 'authenticated users cannot insert memberships directly');
select extensions.ok(not has_table_privilege('authenticated', 'public.workspace_memberships', 'UPDATE'), 'authenticated users cannot change membership roles directly');
select extensions.ok(not has_table_privilege('authenticated', 'public.workspace_memberships', 'DELETE'), 'authenticated users cannot remove memberships directly');
select extensions.ok(not has_column_privilege('authenticated', 'public.workspaces', 'created_by', 'UPDATE'), 'workspace owner identity cannot be reassigned');
select extensions.ok(not has_column_privilege('authenticated', 'public.workspaces', 'slug', 'UPDATE'), 'workspace slug cannot be reassigned through a client update');
select extensions.ok(has_function_privilege('authenticated', 'public.create_workspace(text,text,text,text,text,text,text,uuid)', 'EXECUTE'), 'authenticated users can call the validated creation operation');
select extensions.ok(not has_function_privilege('anon', 'public.create_workspace(text,text,text,text,text,text,text,uuid)', 'EXECUTE'), 'anonymous users cannot call workspace creation');
select extensions.ok(has_function_privilege('authenticated', 'public.update_workspace_settings(uuid,text,text,text,text,text,text)', 'EXECUTE'), 'authenticated users can call the permission-checked settings operation');
select extensions.ok(not has_function_privilege('anon', 'public.update_workspace_settings(uuid,text,text,text,text,text,text)', 'EXECUTE'), 'anonymous users cannot call workspace settings updates');
select extensions.ok(not has_schema_privilege('anon', 'tandem_internal', 'USAGE'), 'anonymous users cannot access the private implementation schema');
select extensions.ok(not has_function_privilege('anon', 'tandem_internal.create_workspace_privileged(text,text,text,text,text,text,text,uuid)', 'EXECUTE'), 'anonymous users cannot execute the private creation implementation');
select extensions.ok(has_function_privilege('authenticated', 'tandem_internal.create_workspace_privileged(text,text,text,text,text,text,text,uuid)', 'EXECUTE'), 'the invoker wrapper can execute the private creation implementation');
select extensions.ok(has_function_privilege('authenticated', 'tandem_internal.update_workspace_settings_privileged(uuid,text,text,text,text,text,text)', 'EXECUTE'), 'the invoker wrapper can execute the private settings implementation');
select extensions.ok(not has_function_privilege('anon', 'tandem_internal.has_workspace_role(uuid,text[])', 'EXECUTE'), 'role helper is not executable by anonymous users');
select extensions.ok(not (select p.prosecdef from pg_catalog.pg_proc as p where p.oid = 'public.create_workspace(text,text,text,text,text,text,text,uuid)'::regprocedure), 'public creation RPC runs as security invoker');
select extensions.ok(not (select p.prosecdef from pg_catalog.pg_proc as p where p.oid = 'public.update_workspace_settings(uuid,text,text,text,text,text,text)'::regprocedure), 'public settings RPC runs as security invoker');
select extensions.ok((select p.prosecdef from pg_catalog.pg_proc as p where p.oid = 'tandem_internal.create_workspace_privileged(text,text,text,text,text,text,text,uuid)'::regprocedure), 'private creation implementation owns the privileged context');
select extensions.ok((select p.prosecdef from pg_catalog.pg_proc as p where p.oid = 'tandem_internal.update_workspace_settings_privileged(uuid,text,text,text,text,text,text)'::regprocedure), 'private settings implementation owns the privileged context');
select extensions.ok((select exists (select 1 from pg_catalog.unnest(p.proconfig) as setting(value) where setting.value like 'search_path=%') from pg_catalog.pg_proc as p where p.oid = 'public.create_workspace(text,text,text,text,text,text,text,uuid)'::regprocedure), 'public creation wrapper pins its search path');
select extensions.ok((select exists (select 1 from pg_catalog.unnest(p.proconfig) as setting(value) where setting.value like 'search_path=%') from pg_catalog.pg_proc as p where p.oid = 'public.update_workspace_settings(uuid,text,text,text,text,text,text)'::regprocedure), 'public settings wrapper pins its search path');
select extensions.ok((select exists (select 1 from pg_catalog.unnest(p.proconfig) as setting(value) where setting.value like 'search_path=%') from pg_catalog.pg_proc as p where p.oid = 'tandem_internal.create_workspace_privileged(text,text,text,text,text,text,text,uuid)'::regprocedure), 'private creation implementation pins its search path');
select extensions.ok((select exists (select 1 from pg_catalog.unnest(p.proconfig) as setting(value) where setting.value like 'search_path=%') from pg_catalog.pg_proc as p where p.oid = 'tandem_internal.update_workspace_settings_privileged(uuid,text,text,text,text,text,text)'::regprocedure), 'private settings implementation pins its search path');

set local role anon;
select extensions.throws_ok(
  $$select * from public.create_workspace('Anonymous Business', 'anonymous-business', 'professional_services', null, null, null, 'UTC', '40000000-0000-4000-8000-000000000001'::uuid)$$,
  '42501', null, 'anonymous RPC calls cannot create a workspace'
);
select extensions.throws_ok(
  $$select * from public.update_workspace_settings('00000000-0000-4000-8000-000000000001'::uuid, 'Anonymous Rename', 'professional_services', null, null, null, 'UTC')$$,
  '42501', null, 'anonymous RPC calls cannot update workspace settings'
);
select extensions.throws_ok(
  $$select * from tandem_internal.create_workspace_privileged('Anonymous Business', 'anonymous-business', 'professional_services', null, null, null, 'UTC', '40000000-0000-4000-8000-000000000001'::uuid)$$,
  '42501', null, 'anonymous users cannot invoke a private implementation function'
);
reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000001', true);
select id from public.create_workspace('Northwind Studio', 'tenant-northwind', 'professional_services', null, null, 'US', 'America/New_York', '41000000-0000-4000-8000-000000000001'::uuid);
select id from public.create_workspace('Northwind Retail', 'tenant-northwind-retail', 'ecommerce_retail', null, 'https://northwind.example', 'US', 'America/New_York', '41000000-0000-4000-8000-000000000002'::uuid);
select extensions.ok(
  exists (
    select 1 from public.workspace_memberships as membership
    join public.workspaces as workspace on workspace.id = membership.workspace_id
    where workspace.slug = 'tenant-northwind'
      and membership.user_id = (select auth.uid())
      and membership.role = 'owner'
  ),
  'workspace creator is assigned owner by the database'
);
select extensions.is(
  (select pg_catalog.count(*)::integer from public.workspaces where created_by = (select auth.uid())),
  2,
  'one user can create multiple workspaces'
);
select extensions.is(
  (select w.id from public.create_workspace('Northwind Studio', 'tenant-northwind', 'professional_services', null, null, 'US', 'America/New_York', '41000000-0000-4000-8000-000000000001'::uuid) as w),
  (select id from public.workspaces where slug = 'tenant-northwind'),
  'a retry with the same request id and fields is idempotent'
);
select extensions.throws_ok(
  $$select * from public.create_workspace('Changed Name', 'tenant-northwind', 'professional_services', null, null, 'US', 'America/New_York', '41000000-0000-4000-8000-000000000001'::uuid)$$,
  '22023', null, 'a request id cannot be reused for different workspace details'
);
select extensions.throws_ok(
  $$select * from public.create_workspace('Another Company', 'tenant-northwind', 'professional_services', null, null, 'US', 'America/New_York', '41000000-0000-4000-8000-000000000003'::uuid)$$,
  '23505', null, 'a duplicate workspace slug is rejected'
);
select extensions.throws_ok(
  $$select * from public.create_workspace('Invalid Industry', 'invalid-industry', 'not_an_industry', null, null, 'US', 'UTC', '41000000-0000-4000-8000-000000000004'::uuid)$$,
  '22023', null, 'an unsupported industry is rejected'
);
select extensions.throws_ok(
  $$select * from public.create_workspace('x', 'Bad Slug', 'professional_services', null, null, 'US', 'UTC', '41000000-0000-4000-8000-000000000005'::uuid)$$,
  '22023', null, 'an invalid name and slug are rejected'
);
select extensions.is(
  (select pg_catalog.count(*)::integer from public.workspaces where slug in ('invalid-industry', 'bad-slug')),
  0,
  'failed creation leaves no partial workspace rows'
);
select extensions.is(
  (select pg_catalog.count(*)::integer from public.workspace_memberships as m join public.workspaces as w on w.id = m.workspace_id where w.slug in ('invalid-industry', 'bad-slug')),
  0,
  'failed creation leaves no partial membership rows'
);

reset role;
insert into public.workspace_memberships (workspace_id, user_id, role)
select id, '31000000-0000-4000-8000-000000000004', 'editor' from public.workspaces where slug = 'tenant-northwind';
insert into public.workspace_memberships (workspace_id, user_id, role)
select id, '31000000-0000-4000-8000-000000000005', 'viewer' from public.workspaces where slug = 'tenant-northwind';
insert into public.workspace_memberships (workspace_id, user_id, role)
select id, '31000000-0000-4000-8000-000000000006', 'admin' from public.workspaces where slug = 'tenant-northwind';

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000002', true);
select id from public.create_workspace('Bluebird Commerce', 'tenant-bluebird', 'ecommerce_retail', null, null, 'GB', 'Europe/London', '42000000-0000-4000-8000-000000000001'::uuid);
select extensions.is((select pg_catalog.count(*)::integer from public.workspaces where slug = 'tenant-northwind'), 0, 'workspace B cannot read workspace A');
select extensions.is((select pg_catalog.count(*)::integer from public.workspace_memberships where user_id = '31000000-0000-4000-8000-000000000001'), 0, 'workspace B cannot inspect workspace A memberships');
select extensions.throws_ok(
  $$update public.workspace_memberships set role = 'admin' where workspace_id = (select id from public.workspaces where slug = 'tenant-northwind')$$,
  '42501', null, 'workspace B cannot modify workspace A memberships'
);
select extensions.throws_ok(
  $$select * from public.create_workspace('Invalid Custom Industry', 'bad-custom-industry', 'other', null, null, null, 'UTC', '42000000-0000-4000-8000-000000000002'::uuid)$$,
  '22023', null, 'custom industries require a label'
);

select pg_catalog.set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000003', true);
select extensions.is((select pg_catalog.count(*)::integer from public.workspaces), 0, 'a user with no memberships cannot read any workspace');
select extensions.is((select pg_catalog.count(*)::integer from public.workspace_memberships), 0, 'a user with no memberships cannot inspect member rows');

select pg_catalog.set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000001', true);
select extensions.is((select pg_catalog.count(*)::integer from public.workspaces where slug = 'tenant-bluebird'), 0, 'workspace A cannot read workspace B');
select extensions.throws_ok(
  $$select * from public.update_workspace_settings((select id from public.workspaces where slug = 'tenant-bluebird'), 'Unauthorized Rename', 'ecommerce_retail', null, null, 'GB', 'Europe/London')$$,
  '42501', null, 'workspace A cannot update workspace B settings'
);
select extensions.is((select pg_catalog.count(*)::integer from public.workspace_memberships where user_id = '31000000-0000-4000-8000-000000000002'), 0, 'workspace A cannot inspect workspace B memberships');

select pg_catalog.set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000004', true);
select extensions.is((select pg_catalog.count(*)::integer from public.workspace_memberships), 1, 'editor can read only their own membership');
select extensions.throws_ok(
  $$select * from public.update_workspace_settings((select id from public.workspaces where slug = 'tenant-northwind'), 'Editor Rename', 'professional_services', null, null, 'US', 'America/New_York')$$,
  '42501', null, 'editor cannot edit business settings'
);
select extensions.throws_ok(
  $$update public.workspace_memberships set role = 'admin' where user_id = (select auth.uid())$$,
  '42501', null, 'editor cannot assign a privileged role'
);

select pg_catalog.set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000005', true);
select extensions.throws_ok(
  $$select * from public.update_workspace_settings((select id from public.workspaces where slug = 'tenant-northwind'), 'Northwind Studio', 'professional_services', null, 'https://viewer-change.example', 'US', 'America/New_York')$$,
  '42501', null, 'viewer cannot edit business settings'
);
select extensions.throws_ok(
  $$update public.workspace_memberships set role = 'owner' where user_id = (select auth.uid())$$,
  '42501', null, 'viewer cannot change their role'
);

select pg_catalog.set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000006', true);
select id from public.update_workspace_settings(
  (select id from public.workspaces where slug = 'tenant-northwind'),
  'Northwind Studio', 'professional_services', null, 'https://admin-update.example', 'US', 'America/New_York'
);
select extensions.throws_ok(
  $$update public.workspace_memberships set role = 'owner' where user_id = '31000000-0000-4000-8000-000000000006'$$,
  '42501', null, 'admin cannot claim workspace ownership'
);
select extensions.throws_ok(
  $$update public.workspaces set created_by = (select auth.uid()) where slug = 'tenant-northwind'$$,
  '42501', null, 'admin cannot reassign workspace ownership'
);

reset role;
select extensions.is((select name from public.workspaces where slug = 'tenant-northwind'), 'Northwind Studio', 'workspace name remains unchanged by editor and viewer');
select extensions.is((select website_url from public.workspaces where slug = 'tenant-northwind'), 'https://admin-update.example', 'owner and admin settings update persists');
select extensions.ok(
  exists (
    select 1 from public.workspace_memberships m join public.workspaces w on w.id = m.workspace_id
    where w.slug = 'tenant-northwind' and m.user_id = '31000000-0000-4000-8000-000000000006' and m.role = 'admin'
  ),
  'admin role remains unchanged after attempted escalation'
);

update public.workspace_memberships as membership
set role = 'admin'
from public.workspaces as workspace
where workspace.id = membership.workspace_id
  and workspace.slug = 'tenant-northwind-retail'
  and membership.user_id = '31000000-0000-4000-8000-000000000001';

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000001', true);
select extensions.throws_ok(
  $$select * from public.create_workspace('Northwind Retail', 'tenant-northwind-retail', 'ecommerce_retail', null, 'https://northwind.example', 'US', 'America/New_York', '41000000-0000-4000-8000-000000000002'::uuid)$$,
  '42501', null, 'a former owner cannot replay a request after owner role downgrade'
);
reset role;
select extensions.is(
  (select membership.role from public.workspace_memberships as membership join public.workspaces as workspace on workspace.id = membership.workspace_id where workspace.slug = 'tenant-northwind-retail' and membership.user_id = '31000000-0000-4000-8000-000000000001'),
  'admin',
  'an idempotent retry does not restore the former owner role'
);

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000001', true);
select id from public.create_workspace(
  'Northwind Removal', 'tenant-northwind-removal', 'professional_services', null, null, 'US', 'America/New_York',
  '43000000-0000-4000-8000-000000000003'::uuid
);
reset role;

delete from public.workspace_memberships as membership
using public.workspaces as workspace
where workspace.id = membership.workspace_id
  and workspace.slug = 'tenant-northwind-removal'
  and membership.user_id = '31000000-0000-4000-8000-000000000001';

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000001', true);
select extensions.throws_ok(
  $$select * from public.create_workspace('Northwind Removal', 'tenant-northwind-removal', 'professional_services', null, null, 'US', 'America/New_York', '43000000-0000-4000-8000-000000000003'::uuid)$$,
  '42501', null, 'a former owner cannot replay a request after membership removal'
);
reset role;
select extensions.is(
  (select pg_catalog.count(*)::integer from public.workspace_memberships as membership join public.workspaces as workspace on workspace.id = membership.workspace_id where workspace.slug = 'tenant-northwind-removal' and membership.user_id = '31000000-0000-4000-8000-000000000001'),
  0,
  'a replay does not recreate the removed membership'
);

select * from extensions.finish();
rollback;
