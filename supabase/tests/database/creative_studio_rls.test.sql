begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  (null, '61000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'creative-owner@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now()),
  (null, '61000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'creative-other@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now()),
  (null, '61000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'creative-editor@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now()),
  (null, '61000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'creative-viewer@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now()),
  (null, '61000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'creative-admin@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now());

insert into public.workspaces (id, name, slug, industry_key, created_by, creation_request_id)
values
  ('62000000-0000-4000-8000-000000000001', 'Creative Tenant One', 'creative-tenant-one', 'professional_services', '61000000-0000-4000-8000-000000000001', '62100000-0000-4000-8000-000000000001'),
  ('62000000-0000-4000-8000-000000000002', 'Creative Tenant Two', 'creative-tenant-two', 'ecommerce_retail', '61000000-0000-4000-8000-000000000002', '62100000-0000-4000-8000-000000000002');
insert into public.workspace_memberships (workspace_id, user_id, role)
values
  ('62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001', 'owner'),
  ('62000000-0000-4000-8000-000000000002', '61000000-0000-4000-8000-000000000002', 'owner'),
  ('62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000003', 'editor'),
  ('62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000004', 'viewer'),
  ('62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000005', 'admin');

insert into public.campaigns (id, workspace_id, name, platform, objective, lifecycle_status, revision, approved_revision, brief, plan, generation_mode, created_by_user_id)
values
  ('63000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000001', 'Tenant One Campaign', 'meta_ads', 'traffic', 'approved_for_demo', 1, 1, '{}'::jsonb, '{}'::jsonb, 'simulation', '61000000-0000-4000-8000-000000000001'),
  ('63000000-0000-4000-8000-000000000002', '62000000-0000-4000-8000-000000000002', 'Tenant Two Campaign', 'google_ads', 'website_traffic', 'draft', 1, null, '{}'::jsonb, null, 'none', '61000000-0000-4000-8000-000000000002');

insert into public.creative_assets (id, workspace_id, asset_type, original_filename, storage_path, mime_type, size_bytes, width, height, uploader_user_id)
values
  ('64000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000001', 'image', 'tenant-one.png', '62000000-0000-4000-8000-000000000001/64000000-0000-4000-8000-000000000001.png', 'image/png', 128, 10, 10, '61000000-0000-4000-8000-000000000001'),
  ('64000000-0000-4000-8000-000000000002', '62000000-0000-4000-8000-000000000002', 'image', 'tenant-two.png', '62000000-0000-4000-8000-000000000002/64000000-0000-4000-8000-000000000002.png', 'image/png', 128, 10, 10, '61000000-0000-4000-8000-000000000002');

select extensions.ok(not (select public from storage.buckets where id = 'workspace-creative-assets'), 'creative asset bucket is private');
select extensions.ok(not has_table_privilege('anon', 'public.creative_projects', 'SELECT'), 'anonymous users cannot read creative projects');
select extensions.ok(not has_table_privilege('authenticated', 'public.creative_projects', 'INSERT'), 'creative project creation is limited to the guarded RPC');
select extensions.ok(has_function_privilege('authenticated', 'public.create_creative_project(uuid,text,jsonb,text,text,text)', 'EXECUTE'), 'authenticated members can call the guarded create RPC');
select extensions.ok(not has_function_privilege('anon', 'public.create_creative_project(uuid,text,jsonb,text,text,text)', 'EXECUTE'), 'anonymous callers cannot create creative projects');
select extensions.ok((select p.prosecdef from pg_catalog.pg_proc p where p.oid = 'public.save_creative_project(uuid,uuid,integer,text,jsonb,text,text,text)'::regprocedure), 'save RPC runs with guarded definer privileges');
select extensions.ok((select exists (select 1 from pg_catalog.unnest(p.proconfig) setting(value) where setting.value like 'search_path=%' and pg_catalog.replace(setting.value, '"', '') = 'search_path=') from pg_catalog.pg_proc p where p.oid = 'public.create_creative_project(uuid,text,jsonb,text,text,text)'::regprocedure), 'creative create RPC pins an empty search path');
select extensions.ok(not tandem_internal.creative_document_is_valid(null), 'database rejects a null creative document');
select extensions.ok(not tandem_internal.creative_document_is_valid('{"version":1,"width":9000,"height":9000,"background":{"kind":"solid","color":"#112233"},"elements":[]}'::jsonb), 'database rejects unsafe canvas dimensions');

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000001', true);
select extensions.is((select pg_catalog.count(*)::integer from public.creative_assets), 1, 'tenant owner sees only workspace-owned asset metadata');
select extensions.is((select pg_catalog.count(*)::integer from public.creative_assets where id = '64000000-0000-4000-8000-000000000002'), 0, 'tenant owner cannot read a guessed asset from another workspace');
select extensions.is((select pg_catalog.count(*)::integer from public.creative_projects), 0, 'new workspace starts without fabricated designs');
select pg_catalog.set_config('creative.test_project', public.create_creative_project(
  '62000000-0000-4000-8000-000000000001', 'Campaign artwork',
  '{"version":1,"width":1080,"height":1080,"background":{"kind":"solid","color":"#172033"},"elements":[]}'::jsonb,
  'professional_services', 'meta_ads', null
) ->> 'id', true);
select extensions.is((select pg_catalog.count(*)::integer from public.creative_projects), 1, 'owner can create a persistent editable design');
select extensions.throws_ok(
  $$select public.create_creative_project('62000000-0000-4000-8000-000000000002', 'Cross tenant attempt', '{"version":1,"width":1080,"height":1080,"background":{"kind":"solid","color":"#172033"},"elements":[]}'::jsonb, 'ecommerce_retail', 'meta_ads', null)$$,
  '42501', null, 'workspace owner cannot create a project in another tenant'
);
select extensions.throws_ok(
  $$select public.create_creative_project('62000000-0000-4000-8000-000000000001', 'Invalid document', '{"version":1,"width":1080,"height":1080,"background":{"kind":"solid","color":"#172033"},"elements":[{"id":"74000000-0000-4000-8000-000000000001","type":"text","x":"script","y":0,"width":100,"height":100}]}'::jsonb, 'professional_services', 'meta_ads', null)$$,
  '22023', null, 'guarded project creation validates structured creative content'
);
insert into public.workspace_brand_kits (workspace_id, display_name, primary_color, secondary_color, industry_key, updated_by_user_id)
values ('62000000-0000-4000-8000-000000000001', 'Tenant One Brand', '#18233A', '#8297F5', 'professional_services', (select auth.uid()));
insert into public.creative_campaign_links (workspace_id, campaign_id, creative_id)
values ('62000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000001', current_setting('creative.test_project')::uuid);
select extensions.is((select lifecycle_status from public.campaigns where id = '63000000-0000-4000-8000-000000000001'), 'generated_simulation', 'attaching creative invalidates prior campaign approval');
select extensions.is((select approved_revision from public.campaigns where id = '63000000-0000-4000-8000-000000000001'), null::integer, 'creative attachment clears stale campaign approval');
reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000003', true);
select extensions.is((select pg_catalog.count(*)::integer from public.creative_projects), 1, 'workspace editor can read workspace creative projects');
select extensions.throws_ok(
  $$select public.review_creative_project('62000000-0000-4000-8000-000000000001', current_setting('creative.test_project')::uuid, 1, 'approved', '')$$,
  '42501', null, 'editor cannot approve creative work'
);
select extensions.is((select pg_catalog.count(*)::integer from public.creative_assets where workspace_id = '62000000-0000-4000-8000-000000000002'), 0, 'editor cannot read another workspace assets');
select extensions.is((select pg_catalog.count(*)::integer from public.workspace_brand_kits), 1, 'workspace editor can read its brand kit');
update public.workspace_brand_kits set display_name = 'Editor takeover' where workspace_id = '62000000-0000-4000-8000-000000000001';
reset role;
select extensions.is((select display_name from public.workspace_brand_kits where workspace_id = '62000000-0000-4000-8000-000000000001'), 'Tenant One Brand', 'editor cannot update workspace brand identity');

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000004', true);
select extensions.is((select pg_catalog.count(*)::integer from public.creative_projects), 1, 'viewer can read safe workspace creative metadata');
select extensions.throws_ok(
  $$select public.create_creative_project('62000000-0000-4000-8000-000000000001', 'Viewer attempt', '{"version":1,"width":1080,"height":1080,"background":{"kind":"solid","color":"#172033"},"elements":[]}'::jsonb, 'professional_services', null, null)$$,
  '42501', null, 'viewer cannot create or edit creative records'
);
select pg_catalog.set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000002', true);
select extensions.is((select pg_catalog.count(*)::integer from public.creative_projects), 0, 'second tenant cannot inspect first tenant creative projects');
select extensions.is((select pg_catalog.count(*)::integer from public.creative_assets), 1, 'second tenant can see only its own asset metadata');
select extensions.is((select pg_catalog.count(*)::integer from public.creative_campaign_links), 0, 'creative attachment records are tenant isolated');
reset role;

select * from extensions.finish();
rollback;
