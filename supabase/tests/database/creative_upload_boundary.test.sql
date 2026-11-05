begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (null, '65000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'upload-owner@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now());
insert into public.workspaces (id, name, slug, industry_key, created_by, creation_request_id)
values ('66000000-0000-4000-8000-000000000001', 'Upload Boundary Test', 'upload-boundary-test', 'professional_services', '65000000-0000-4000-8000-000000000001', '66100000-0000-4000-8000-000000000001');
insert into public.workspace_memberships (workspace_id, user_id, role)
values ('66000000-0000-4000-8000-000000000001', '65000000-0000-4000-8000-000000000001', 'owner');

select extensions.ok(not (select public from storage.buckets where id = 'workspace-creative-assets'), 'creative bucket remains private');
select extensions.ok(not has_table_privilege('authenticated', 'public.creative_assets', 'INSERT'), 'authenticated clients cannot forge creative asset metadata');
select extensions.ok(not exists (
  select 1 from pg_catalog.pg_policies policy
  where policy.schemaname = 'storage' and policy.tablename = 'objects'
    and policy.cmd = 'INSERT' and 'authenticated' = any(policy.roles::text[])
), 'authenticated users have no direct Storage INSERT policy for the creative bucket');
select extensions.ok(not exists (
  select 1 from pg_catalog.pg_policies policy
  where policy.schemaname = 'storage' and policy.tablename = 'objects'
    and policy.cmd = 'DELETE' and 'authenticated' = any(policy.roles::text[])
), 'authenticated users cannot directly remove creative Storage objects');
select extensions.ok(has_function_privilege('service_role', 'public.reserve_creative_asset_upload(uuid,uuid,uuid,uuid,text,text,text,integer,integer,integer)', 'EXECUTE'), 'server upload service can reserve quota');
select extensions.ok(not has_function_privilege('authenticated', 'public.reserve_creative_asset_upload(uuid,uuid,uuid,uuid,text,text,text,integer,integer,integer)', 'EXECUTE'), 'browser clients cannot reserve or forge uploads');

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '65000000-0000-4000-8000-000000000001', true);
select extensions.throws_ok(
  $$insert into storage.objects(bucket_id, name) values ('workspace-creative-assets', '66000000-0000-4000-8000-000000000001/67000000-0000-4000-8000-000000000001.png')$$,
  '42501', null, 'authenticated workspace owner cannot write directly to creative Storage'
);
reset role;

select * from extensions.finish();
rollback;
