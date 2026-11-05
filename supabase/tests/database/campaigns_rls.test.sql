begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  (null, '61000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'campaign-owner@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now()),
  (null, '61000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'campaign-other@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now()),
  (null, '61000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'campaign-editor@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now()),
  (null, '61000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'campaign-viewer@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now()),
  (null, '61000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'campaign-admin@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now());

insert into public.workspaces (id, name, slug, industry_key, created_by, creation_request_id)
values
  ('62000000-0000-4000-8000-000000000001', 'Campaign Tenant One', 'campaign-tenant-one', 'professional_services', '61000000-0000-4000-8000-000000000001', '62100000-0000-4000-8000-000000000001'),
  ('62000000-0000-4000-8000-000000000002', 'Campaign Tenant Two', 'campaign-tenant-two', 'ecommerce_retail', '61000000-0000-4000-8000-000000000002', '62100000-0000-4000-8000-000000000002');
insert into public.workspace_memberships (workspace_id, user_id, role)
values
  ('62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001', 'owner'),
  ('62000000-0000-4000-8000-000000000002', '61000000-0000-4000-8000-000000000002', 'owner'),
  ('62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000003', 'editor'),
  ('62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000004', 'viewer'),
  ('62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000005', 'admin');

insert into public.campaigns(id, workspace_id, name, platform, objective, lifecycle_status, revision, brief, plan, generation_mode, created_by_user_id)
values
  ('63000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000001', 'Tenant One Draft', 'google_ads', 'website_traffic', 'needs_review', 1, '{}'::jsonb, '{}'::jsonb, 'simulation', '61000000-0000-4000-8000-000000000001'),
  ('63000000-0000-4000-8000-000000000002', '62000000-0000-4000-8000-000000000002', 'Tenant Two Draft', 'meta_ads', 'traffic', 'draft', 1, '{}'::jsonb, null, 'none', '61000000-0000-4000-8000-000000000002');

select extensions.ok(not has_table_privilege('anon', 'public.campaigns', 'SELECT'), 'anonymous users cannot read campaign metadata');
select extensions.ok(not has_table_privilege('authenticated', 'public.campaigns', 'INSERT'), 'campaign writes must use permission-checked RPC functions');
select extensions.ok(not has_table_privilege('authenticated', 'public.demo_publish_attempts', 'INSERT'), 'clients cannot create publishing attempts directly');
select extensions.ok(not has_table_privilege('authenticated', 'public.demo_campaign_analytics', 'UPDATE'), 'clients cannot alter stored simulation reports directly');
select extensions.ok(has_function_privilege('authenticated', 'public.create_campaign(jsonb)', 'EXECUTE'), 'authenticated members may call the role-checked create RPC');
select extensions.ok(not has_function_privilege('anon', 'public.create_campaign(jsonb)', 'EXECUTE'), 'anonymous users cannot call campaign creation');
select extensions.ok((select p.prosecdef from pg_catalog.pg_proc p where p.oid = 'public.simulate_campaign_publish(uuid,uuid,integer,text,bigint,jsonb)'::regprocedure), 'demo publishing uses a guarded security definer');
select extensions.ok((select exists (select 1 from pg_catalog.unnest(p.proconfig) setting(value) where setting.value like 'search_path=%' and pg_catalog.replace(setting.value, '"', '') = 'search_path=') from pg_catalog.pg_proc p where p.oid = 'public.simulate_campaign_publish(uuid,uuid,integer,text,bigint,jsonb)'::regprocedure), 'demo publishing pins an empty search path');
select extensions.ok((select exists (select 1 from pg_catalog.pg_trigger where tgrelid = 'public.campaigns'::regclass and tgname = 'campaigns_normalize_plan_before_write' and not tgisinternal)), 'JSON null draft plans normalize before campaign constraints');

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000001', true);
select extensions.is((select pg_catalog.count(*)::integer from public.campaigns), 1, 'tenant one owner sees only tenant one campaigns');
select extensions.is((select pg_catalog.count(*)::integer from public.campaigns where id = '63000000-0000-4000-8000-000000000002'), 0, 'tenant one cannot read a guessed tenant two campaign UUID');
select extensions.is((select pg_catalog.count(*)::integer from public.campaign_revisions), 0, 'campaign history is hidden unless it belongs to a member campaign');
select extensions.throws_ok(
  $$select public.archive_campaign('63000000-0000-4000-8000-000000000002', '62000000-0000-4000-8000-000000000001')$$,
  'P0002', null, 'a guessed campaign in another workspace cannot be archived'
);
select extensions.is(
  public.decide_campaign_review('63000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000001', 'approved_for_demo', 'approved') ->> 'lifecycle_status',
  'approved_for_demo',
  'owner approval applies only to the current tenant campaign'
);
select extensions.is((select lifecycle_status from public.campaigns where id = '63000000-0000-4000-8000-000000000001'), 'approved_for_demo', 'approval is recorded as a campaign lifecycle state');
select extensions.is(
  public.simulate_campaign_publish(
    '63000000-0000-4000-8000-000000000001',
    '62000000-0000-4000-8000-000000000001',
    1,
    'success',
    77,
    pg_catalog.jsonb_build_object(
      'label', 'Simulated Data — Not Actual Ad Performance',
      'scenario', 'average',
      'days', '[]'::jsonb
    )
  ) ->> 'published_externally',
  'false',
  'demo publishing uses one consistent attempt id and remains non-external'
);
select extensions.is(
  (select pg_catalog.count(*)::integer from public.demo_campaign_analytics where campaign_id = '63000000-0000-4000-8000-000000000001'),
  1,
  'successful demo publishing persists its analytics through the attempt foreign key'
);
select public.decide_campaign_review('63000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000001', 'reopened', 'edit requested');
select extensions.is((select lifecycle_status from public.campaigns where id = '63000000-0000-4000-8000-000000000001'), 'generated_simulation', 'reopen returns to a valid editable draft state');
select public.submit_campaign_review('63000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000001', 1, 'resubmitted');
select public.save_campaign(
  '63000000-0000-4000-8000-000000000001',
  '62000000-0000-4000-8000-000000000001',
  1,
  jsonb_build_object('name', 'Revised tenant draft', 'platform', 'google_ads', 'objective', 'website_traffic', 'brief', '{}'::jsonb, 'plan', '{}'::jsonb)
);
select extensions.is((select lifecycle_status from public.campaigns where id = '63000000-0000-4000-8000-000000000001'), 'generated_simulation', 'editing a submitted revision invalidates review and returns it to editing');
select extensions.is((select approved_revision from public.campaigns where id = '63000000-0000-4000-8000-000000000001'), null::integer, 'saving a changed revision clears stale approval');
reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000003', true);
select extensions.is((select pg_catalog.count(*)::integer from public.campaigns), 1, 'editors can read their workspace campaigns');
select extensions.ok(
  public.create_campaign(jsonb_build_object('workspace_id', '62000000-0000-4000-8000-000000000001', 'name', 'Editor Draft', 'platform', 'google_ads', 'objective', 'website_traffic', 'brief', '{}'::jsonb, 'plan', 'null'::jsonb)) ->> 'id' is not null,
  'editors can create an ordinary draft in their workspace'
);
select extensions.throws_ok(
  $$select public.decide_campaign_review('63000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000001', 'approved_for_demo', '')$$,
  '42501', null, 'editors cannot approve a campaign'
);
reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000004', true);
select extensions.is((select pg_catalog.count(*)::integer from public.campaigns), 2, 'viewers can read safe campaign information');
select extensions.throws_ok(
  $$select public.create_campaign(jsonb_build_object('workspace_id', '62000000-0000-4000-8000-000000000001', 'name', 'Viewer Draft', 'platform', 'google_ads', 'objective', 'website_traffic', 'brief', '{}'::jsonb, 'plan', 'null'::jsonb))$$,
  '42501', null, 'viewers cannot create campaign drafts'
);
select extensions.throws_ok(
  $$select public.simulate_campaign_publish('63000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000001', 1, 'success', 1, '{}'::jsonb)$$,
  '42501', null, 'viewers cannot simulate publishing'
);
reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000005', true);
select extensions.is((select pg_catalog.count(*)::integer from public.campaigns), 2, 'admins can read their workspace campaigns');
select extensions.ok((select tandem_internal.has_campaign_permission('62000000-0000-4000-8000-000000000001', 'approve')), 'admins have centralized campaign approval capability');
select extensions.is((select pg_catalog.count(*)::integer from public.campaigns where workspace_id = '62000000-0000-4000-8000-000000000002'), 0, 'admins cannot read another workspace campaign');
reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000002', true);
select extensions.is((select pg_catalog.count(*)::integer from public.campaigns), 1, 'second tenant sees only its own campaign');
select extensions.is((select pg_catalog.count(*)::integer from public.campaigns where id = '63000000-0000-4000-8000-000000000001'), 0, 'second tenant cannot read the first tenant draft');
reset role;

select * from extensions.finish();
rollback;
