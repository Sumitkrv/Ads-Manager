begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (null, '51000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'ads-owner@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now()),
  (null, '51000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'ads-other-owner@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now()),
  (null, '51000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'ads-editor@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now()),
  (null, '51000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'ads-viewer@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now()),
  (null, '51000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'ads-admin@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now());

select extensions.ok(not has_table_privilege('anon', 'public.advertising_connections', 'SELECT'), 'anonymous users cannot read advertising connections');
select extensions.ok(not has_table_privilege('anon', 'public.advertising_accounts', 'SELECT'), 'anonymous users cannot read advertising accounts');
select extensions.ok(has_column_privilege('authenticated', 'public.advertising_connections', 'provider_identity_reference', 'SELECT'), 'workspace members can read safe connection metadata');
select extensions.ok(not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'advertising_connections' and column_name in ('access_token', 'refresh_token', 'credential_reference')), 'public connection metadata contains no token or credential reference columns');
select extensions.ok(not has_table_privilege('authenticated', 'public.advertising_connections', 'INSERT'), 'authenticated users cannot insert connection rows directly');
select extensions.ok(not has_table_privilege('authenticated', 'public.advertising_accounts', 'UPDATE'), 'account selection uses a permission-checked RPC');
select extensions.ok(not has_table_privilege('authenticated', 'tandem_internal.advertising_credentials', 'SELECT'), 'authenticated users have no direct credential table privilege');
select extensions.ok(not has_table_privilege('service_role', 'tandem_internal.advertising_credentials', 'SELECT'), 'the API service role has no direct credential table grant');
select extensions.ok(has_function_privilege('authenticated', 'public.start_advertising_oauth_attempt(uuid,uuid,text,text,text,text,text,timestamptz)', 'EXECUTE'), 'authenticated users can start a permission-checked OAuth attempt');
select extensions.ok(not has_function_privilege('anon', 'public.start_advertising_oauth_attempt(uuid,uuid,text,text,text,text,text,timestamptz)', 'EXECUTE'), 'anonymous users cannot start OAuth attempts');
select extensions.ok(not has_function_privilege('authenticated', 'public.consume_advertising_oauth_attempt(text,text)', 'EXECUTE'), 'authenticated clients cannot consume callback state');
select extensions.ok(has_function_privilege('service_role', 'public.consume_advertising_oauth_attempt(text,text)', 'EXECUTE'), 'only the server service role can consume callback state');
select extensions.ok(not has_function_privilege('authenticated', 'public.get_advertising_credential(uuid,uuid,uuid)', 'EXECUTE'), 'authenticated clients cannot retrieve encrypted credentials');
select extensions.ok(has_function_privilege('service_role', 'public.get_advertising_credential(uuid,uuid,uuid)', 'EXECUTE'), 'the callback service can use the guarded credential RPC');
select extensions.ok((select p.prosecdef from pg_catalog.pg_proc p where p.oid = 'public.finalize_advertising_oauth(uuid,uuid,uuid,text,text,text[],text,text,text,timestamptz,jsonb)'::regprocedure), 'callback finalization uses a narrowly granted security definer');
select extensions.ok((select exists (select 1 from pg_catalog.unnest(p.proconfig) setting(value) where setting.value like 'search_path=%' and pg_catalog.replace(setting.value, '"', '') = 'search_path=') from pg_catalog.pg_proc p where p.oid = 'public.finalize_advertising_oauth(uuid,uuid,uuid,text,text,text[],text,text,text,timestamptz,jsonb)'::regprocedure), 'callback finalization pins an empty search path');

insert into public.workspaces (id, name, slug, industry_key, created_by, creation_request_id)
values
  ('52000000-0000-4000-8000-000000000001', 'Ads Tenant One', 'ads-tenant-one', 'professional_services', '51000000-0000-4000-8000-000000000001', '52100000-0000-4000-8000-000000000001'),
  ('52000000-0000-4000-8000-000000000002', 'Ads Tenant Two', 'ads-tenant-two', 'ecommerce_retail', '51000000-0000-4000-8000-000000000002', '52100000-0000-4000-8000-000000000002');
insert into public.workspace_memberships (workspace_id, user_id, role)
values
  ('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', 'owner'),
  ('52000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000002', 'owner'),
  ('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000003', 'editor'),
  ('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000004', 'viewer'),
  ('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000005', 'admin');

insert into public.advertising_connections (
  id, workspace_id, provider, connection_status, connected_by_user_id,
  provider_identity_reference, granted_scopes, verified_at
)
values ('53000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000001', 'google_ads', 'accounts_available',
  '51000000-0000-4000-8000-000000000001', 'provider-user-ref', array['https://www.googleapis.com/auth/adwords'], pg_catalog.now());

insert into public.advertising_accounts (
  id, workspace_id, connection_id, provider, external_account_id, external_account_name,
  account_status, currency, timezone, selected, last_synced_at
)
values ('54000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000001',
  '53000000-0000-4000-8000-000000000001', 'google_ads', '1234567890', 'Verified account',
  'ENABLED', 'USD', 'America/New_York', false, pg_catalog.now());

insert into tandem_internal.advertising_credentials (
  connection_id, encryption_context_id, encryption_algorithm, key_version, ciphertext, expires_at
)
values (
  '53000000-0000-4000-8000-000000000001',
  '55000000-0000-4000-8000-000000000001', 'aes-256-gcm', 'v1', 'not-a-real-token', pg_catalog.now() + interval '1 hour'
);

insert into public.advertising_connections (
  id, workspace_id, provider, connection_status, connected_by_user_id,
  provider_identity_reference, granted_scopes, verified_at
)
values ('53000000-0000-4000-8000-000000000002', '52000000-0000-4000-8000-000000000002', 'google_ads', 'accounts_available',
  '51000000-0000-4000-8000-000000000002', 'other-provider-ref', array['https://www.googleapis.com/auth/adwords'], pg_catalog.now());

insert into public.advertising_accounts (
  id, workspace_id, connection_id, provider, external_account_id, external_account_name
)
values ('54000000-0000-4000-8000-000000000002', '52000000-0000-4000-8000-000000000002',
  '53000000-0000-4000-8000-000000000002', 'google_ads', '1234567890', 'Same provider account in another tenant');

select extensions.is(
  (select pg_catalog.count(*)::integer from public.advertising_accounts where external_account_id = '1234567890'),
  2,
  'the same external account may be independently linked in two workspace scopes'
);

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000001', true);
select extensions.is((select pg_catalog.count(*)::integer from public.advertising_connections), 1, 'an owner sees their workspace connection');
select extensions.is((select pg_catalog.count(*)::integer from public.advertising_accounts), 1, 'an owner sees their workspace account');
select extensions.throws_ok(
  $$select * from tandem_internal.advertising_credentials$$,
  '42501', null, 'an owner cannot read even encrypted credentials'
);
select extensions.is(
  (select public.select_advertising_accounts('52000000-0000-4000-8000-000000000001', '53000000-0000-4000-8000-000000000001', array['54000000-0000-4000-8000-000000000001'::uuid])),
  'connected',
  'an owner can select a verified workspace account'
);
select extensions.throws_ok(
  $$select public.select_advertising_accounts('52000000-0000-4000-8000-000000000001', '53000000-0000-4000-8000-000000000001', array['54000000-0000-4000-8000-000000000099'::uuid])$$,
  '42501', null, 'a guessed account UUID is rejected'
);
select extensions.throws_ok(
  $$select public.select_advertising_accounts('52000000-0000-4000-8000-000000000002', '53000000-0000-4000-8000-000000000001', array['54000000-0000-4000-8000-000000000001'::uuid])$$,
  '42501', null, 'a connection from another workspace cannot be managed'
);
reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000002', true);
select extensions.is((select pg_catalog.count(*)::integer from public.advertising_connections), 1, 'another owner sees only their own workspace connection');
select extensions.is((select pg_catalog.count(*)::integer from public.advertising_accounts), 1, 'another owner sees only their own workspace account');
select extensions.is((select pg_catalog.count(*)::integer from public.advertising_accounts where external_account_name = 'Verified account'), 0, 'workspace B cannot read workspace A account metadata');
reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000003', true);
select extensions.is((select pg_catalog.count(*)::integer from public.advertising_connections), 1, 'editors can view permitted integration metadata');
select extensions.throws_ok(
  $$select public.select_advertising_accounts((select id from public.workspaces where slug = 'ads-tenant-one'), '53000000-0000-4000-8000-000000000001', array['54000000-0000-4000-8000-000000000001'::uuid])$$,
  '42501', null, 'editors cannot manage provider account selection'
);
reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000004', true);
select extensions.is((select pg_catalog.count(*)::integer from public.advertising_accounts), 1, 'viewers can see safe account metadata');
select extensions.throws_ok(
  $$select public.unlink_advertising_connection((select id from public.workspaces where slug = 'ads-tenant-one'), '53000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'viewers cannot disconnect provider access'
);
reset role;

select extensions.is((select connection_status from public.advertising_connections where id = '53000000-0000-4000-8000-000000000001'), 'connected', 'account selection updates the connection state');
select * from extensions.finish();
rollback;
