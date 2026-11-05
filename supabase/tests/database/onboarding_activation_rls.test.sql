begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  (null, 'b2000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'onboarding-owner@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now()),
  (null, 'b2000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'onboarding-other@example.invalid', '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now());

insert into public.workspaces (id, name, slug, industry_key, created_by, creation_request_id)
values
  ('b3000000-0000-4000-8000-000000000001', 'Onboarding Workspace A', 'onboarding-workspace-a', 'professional_services', 'b2000000-0000-4000-8000-000000000001', 'b3100000-0000-4000-8000-000000000001'),
  ('b3000000-0000-4000-8000-000000000002', 'Onboarding Workspace B', 'onboarding-workspace-b', 'ecommerce_retail', 'b2000000-0000-4000-8000-000000000002', 'b3100000-0000-4000-8000-000000000002');
insert into public.workspace_memberships (workspace_id, user_id, role)
values
  ('b3000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'owner'),
  ('b3000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000002', 'owner');

select extensions.ok(not has_table_privilege('anon', 'public.user_onboarding_preferences', 'SELECT'), 'anonymous users cannot read onboarding drafts');
select extensions.ok(not has_table_privilege('authenticated', 'public.workspace_activation_events', 'INSERT'), 'activation milestones cannot be posted directly');
select extensions.ok(not has_column_privilege('authenticated', 'public.workspace_onboarding_progress', 'completed_at', 'UPDATE'), 'clients cannot set the onboarding completion timestamp');
select extensions.ok(not has_column_privilege('authenticated', 'public.workspace_onboarding_progress', 'version', 'UPDATE'), 'clients cannot alter onboarding version metadata');
select extensions.ok(has_function_privilege('authenticated', 'public.record_onboarding_event(uuid,text)', 'EXECUTE'), 'authenticated members can record the two supported self-attested events');
select extensions.ok(not has_function_privilege('anon', 'public.record_onboarding_event(uuid,text)', 'EXECUTE'), 'anonymous users cannot record onboarding events');
select extensions.ok((select p.prosecdef from pg_catalog.pg_proc p where p.oid = 'public.record_onboarding_event(uuid,text)'::regprocedure), 'the narrow event wrapper runs with its trusted implementation privileges');
select extensions.ok(not has_function_privilege('authenticated', 'tandem_internal.record_onboarding_event(uuid,text)', 'EXECUTE'), 'the internal onboarding event function is not directly callable');
select extensions.ok((select c.relrowsecurity from pg_catalog.pg_class c where c.oid = 'public.user_platform_tour_progress'::regclass), 'platform tour progress has row level security enabled');
select extensions.ok(not has_table_privilege('authenticated', 'public.user_platform_tour_progress', 'SELECT'), 'workspace users cannot query platform tour state directly');
select extensions.ok(not has_table_privilege('authenticated', 'public.user_platform_tour_progress', 'INSERT'), 'workspace users cannot write platform tour state directly');
select extensions.ok(has_table_privilege('service_role', 'public.user_platform_tour_progress', 'SELECT') and has_table_privilege('service_role', 'public.user_platform_tour_progress', 'INSERT') and has_table_privilege('service_role', 'public.user_platform_tour_progress', 'UPDATE'), 'the API service role can persist platform tour state after its capability check');

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', 'b2000000-0000-4000-8000-000000000001', true);
insert into public.user_onboarding_preferences (user_id, setup_path, draft)
values ('b2000000-0000-4000-8000-000000000001', 'business', '{"businessName":"Northstar"}'::jsonb);
insert into public.workspace_onboarding_progress (workspace_id, setup_data, current_step, last_completed_step)
values ('b3000000-0000-4000-8000-000000000001', '{"mainOffering":"Consulting"}'::jsonb, 2, 1);
insert into public.user_product_tour_progress (user_id, workspace_id, tour_id, step_index, status)
values ('b2000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', 'owner-overview', 1, 'running');
select extensions.is((select pg_catalog.count(*)::integer from public.user_onboarding_preferences), 1, 'a user can read their own saved setup draft');
select extensions.is((select pg_catalog.count(*)::integer from public.workspace_onboarding_progress), 1, 'an authorized owner can read their workspace progress');
select extensions.is((select pg_catalog.count(*)::integer from public.user_product_tour_progress), 1, 'tour progress is visible to its user in an authorized workspace');
select extensions.throws_ok(
  $$update public.workspace_onboarding_progress set completed_at = pg_catalog.now() where workspace_id = 'b3000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'an authenticated owner cannot set completion directly'
);
select extensions.throws_ok(
  $$insert into public.workspace_onboarding_progress (workspace_id, completed_at) values ('b3000000-0000-4000-8000-000000000002', pg_catalog.now())$$,
  '42501', null, 'an authenticated user cannot insert a forged completion timestamp'
);
select extensions.throws_ok(
  $$insert into public.user_onboarding_preferences (user_id, setup_path, draft) values ('b2000000-0000-4000-8000-000000000002', 'business', '{}'::jsonb)$$,
  '42501', null, 'a user cannot create another user’s onboarding draft'
);
select extensions.throws_ok(
  $$insert into public.user_product_tour_progress (user_id, workspace_id, tour_id, step_index, status) values ('b2000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000002', 'owner-overview', 1, 'running')$$,
  '42501', null, 'a user cannot save tour progress for another tenant'
);
select public.record_onboarding_event('b3000000-0000-4000-8000-000000000001', 'demo_mode_reviewed');
select extensions.is((select pg_catalog.count(*)::integer from public.workspace_activation_events where event_key = 'demo_mode_reviewed'), 1, 'the allowed demo mode acknowledgement is recorded once');
select public.record_onboarding_event('b3000000-0000-4000-8000-000000000001', 'demo_mode_reviewed');
select extensions.is((select pg_catalog.count(*)::integer from public.workspace_activation_events where event_key = 'demo_mode_reviewed'), 1, 'repeated acknowledgements do not duplicate activation events');
select extensions.throws_ok(
  $$select public.record_onboarding_event('b3000000-0000-4000-8000-000000000001', 'report_viewed')$$,
  '22023', null, 'a report milestone requires real saved demo analytics'
);
select extensions.throws_ok(
  $$insert into public.workspace_activation_events (workspace_id, event_key, idempotency_key) values ('b3000000-0000-4000-8000-000000000001', 'first_campaign_created', 'forged')$$,
  '42501', null, 'a user cannot directly forge a protected activation milestone'
);
reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', 'b2000000-0000-4000-8000-000000000002', true);
insert into public.user_onboarding_preferences (user_id, setup_path, draft)
values ('b2000000-0000-4000-8000-000000000002', 'business', '{"businessName":"Harbor Goods"}'::jsonb);
select extensions.is((select pg_catalog.count(*)::integer from public.user_onboarding_preferences), 1, 'a second user sees only their own onboarding draft');
select extensions.is((select pg_catalog.count(*)::integer from public.workspace_onboarding_progress), 0, 'a second tenant cannot read another workspace’s setup progress');
select extensions.is((select pg_catalog.count(*)::integer from public.user_product_tour_progress), 0, 'a second tenant cannot read another user’s tour state');
select extensions.throws_ok(
  $$select public.record_onboarding_event('b3000000-0000-4000-8000-000000000001', 'demo_mode_reviewed')$$,
  '42501', null, 'a second tenant cannot write activation events for another workspace'
);
reset role;

select * from extensions.finish();
rollback;
