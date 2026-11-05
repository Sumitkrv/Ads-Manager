begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 (null,'94000000-0000-4000-8000-000000000001','authenticated','authenticated','tracking-owner@example.invalid','',pg_catalog.now(),'{}','{}',pg_catalog.now(),pg_catalog.now()),
 (null,'94000000-0000-4000-8000-000000000002','authenticated','authenticated','tracking-viewer@example.invalid','',pg_catalog.now(),'{}','{}',pg_catalog.now(),pg_catalog.now()),
 (null,'94000000-0000-4000-8000-000000000003','authenticated','authenticated','tracking-other@example.invalid','',pg_catalog.now(),'{}','{}',pg_catalog.now(),pg_catalog.now());
insert into public.workspaces(id,name,slug,industry_key,created_by,creation_request_id) values
 ('94100000-0000-4000-8000-000000000001','Tracking tenant A','tracking-tenant-a','real_estate','94000000-0000-4000-8000-000000000001','94200000-0000-4000-8000-000000000001'),
 ('94100000-0000-4000-8000-000000000002','Tracking tenant B','tracking-tenant-b','ecommerce_retail','94000000-0000-4000-8000-000000000003','94200000-0000-4000-8000-000000000002');
insert into public.workspace_memberships(workspace_id,user_id,role) values
 ('94100000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001','owner'),
 ('94100000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000002','viewer'),
 ('94100000-0000-4000-8000-000000000002','94000000-0000-4000-8000-000000000003','owner');
insert into public.campaigns(id,workspace_id,name,platform,objective,lifecycle_status,revision,brief,plan,generation_mode,created_by_user_id)
values('94300000-0000-4000-8000-000000000001','94100000-0000-4000-8000-000000000001','Tracking campaign','google_ads','lead_generation','needs_review',3,'{}'::jsonb,'{}'::jsonb,'simulation','94000000-0000-4000-8000-000000000001');

select extensions.ok(not has_table_privilege('anon','public.workspace_integration_configs','SELECT'),'anonymous integration configuration reads are denied');
select extensions.ok(not has_table_privilege('authenticated','public.integration_configuration_audit','INSERT'),'authenticated users cannot forge tracking audit entries');
select extensions.ok(not has_table_privilege('authenticated','public.tracking_test_runs','UPDATE'),'synthetic test results are immutable after creation');
select extensions.ok(not has_table_privilege('authenticated','public.conversion_goals','DELETE'),'tracking definitions cannot be destructively deleted through direct table access');
select extensions.ok(not has_column_privilege('authenticated','public.workspace_integration_configs','updated_by_user_id','UPDATE'),'tracking actors cannot be rewritten by clients');
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','94000000-0000-4000-8000-000000000001',true);
select extensions.ok((select coalesce((features->>'tracking.planning')::boolean,false) from public.billing_workspace_summary('94100000-0000-4000-8000-000000000001') features),'tracking planning is available as a baseline feature on existing plans');
insert into public.workspace_integration_configs(workspace_id,provider,account_identifier,business_label,website_url)
values('94100000-0000-4000-8000-000000000001','google_ads','123-456-7890','North Star Realty','https://example.test');
insert into public.integration_readiness_responses(workspace_id,provider,requirement_id,completed,note)
values('94100000-0000-4000-8000-000000000001','google_ads','account_owner',true,'Owner identified internally');
insert into public.conversion_goals(id,workspace_id,name,category,event_name,industry)
values('94400000-0000-4000-8000-000000000001','94100000-0000-4000-8000-000000000001','Property inquiry','lead','PropertyInquiry','real_estate');
insert into public.conversion_event_definitions(id,workspace_id,event_key,display_name,source_type,expected_parameters)
values('94500000-0000-4000-8000-000000000001','94100000-0000-4000-8000-000000000001','LEAD_FORM_SUBMITTED','Lead form submitted','website','{"lead_source":{"type":"string","required":true}}');
insert into public.conversion_event_mappings(workspace_id,event_definition_id,provider,provider_event_name,status)
values('94100000-0000-4000-8000-000000000001','94500000-0000-4000-8000-000000000001','ga4','generate_lead','draft');
insert into public.utm_templates(id,workspace_id,name,destination_url,source,medium,campaign,goal_id)
values('94600000-0000-4000-8000-000000000001','94100000-0000-4000-8000-000000000001','Spring search','https://example.test/lead','google','cpc','spring','94400000-0000-4000-8000-000000000001');
insert into public.campaign_tracking_configs(workspace_id,campaign_id,goal_id,utm_template_id)
values('94100000-0000-4000-8000-000000000001','94300000-0000-4000-8000-000000000001','94400000-0000-4000-8000-000000000001','94600000-0000-4000-8000-000000000001');
insert into public.workspace_tracking_plans(workspace_id,name,destination_website,provider,installation_method,privacy_checklist)
values('94100000-0000-4000-8000-000000000001','Local plan','https://example.test','ga4','google_tag_ga4','{"privacyNoticeReviewed":false,"consentPlanningReviewed":false,"jurisdictionReviewNeeded":true,"dataMinimizationReviewed":false,"sensitiveFieldsExcluded":false,"retentionReviewed":false,"thirdPartySharingReviewed":false}');
insert into public.tracking_test_runs(workspace_id,goal_id,event_definition_id,result,synthetic_preview)
values('94100000-0000-4000-8000-000000000001','94400000-0000-4000-8000-000000000001','94500000-0000-4000-8000-000000000001','pass','{"label":"SIMULATED EVENT — NOT SENT TO PROVIDER","parameters":{"lead_source":"fixture"}}');

select extensions.is((select count(*)::integer from public.workspace_integration_configs),1,'owner saves provider preparation metadata');
select extensions.is((select count(*)::integer from public.integration_readiness_responses where completed),1,'readiness response persists as a user-reported item');
select extensions.is((select count(*)::integer from public.conversion_goals),1,'workspace conversion goal persists');
select extensions.is((select count(*)::integer from public.conversion_event_mappings),1,'event mapping persists without a provider connection');
select extensions.is((select count(*)::integer from public.campaign_tracking_configs),1,'campaign measurement link persists as a separate sidecar');
select extensions.is((select lifecycle_status||':'||revision::text||':'||coalesce(approved_revision::text,'null') from public.campaigns where id='94300000-0000-4000-8000-000000000001'),'needs_review:3:null','tracking association leaves campaign revision and approval state unchanged');
select extensions.is((select delivery_status from public.tracking_test_runs limit 1),'not_sent','synthetic test result is explicitly not sent');
select extensions.is((select count(*)::integer from public.integration_configuration_audit where workspace_id='94100000-0000-4000-8000-000000000001'),8,'configuration changes create an append-only audit history');
select extensions.throws_ok($$insert into public.workspace_integration_configs(workspace_id,provider,account_identifier) values('94100000-0000-4000-8000-000000000001','meta_ads','oauth_token=never')$$,'23514',null,'integration metadata rejects credential-like values');
select extensions.throws_ok($$insert into public.integration_readiness_responses(workspace_id,provider,requirement_id,completed,note) values('94100000-0000-4000-8000-000000000001','google_ads','policy_review',true,'Google confirmed')$$,'23514',null,'readiness notes cannot claim provider verification');
select extensions.throws_ok($$insert into public.campaign_tracking_configs(workspace_id,campaign_id) values('94100000-0000-4000-8000-000000000001','94300000-0000-4000-8000-000000000099')$$,'23503',null,'a guessed campaign UUID cannot be linked without a valid workspace campaign');
reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','94000000-0000-4000-8000-000000000002',true);
select extensions.is((select count(*)::integer from public.workspace_integration_configs),1,'workspace viewer can read authorized member configuration');
update public.workspace_integration_configs set business_label='unauthorized edit' where workspace_id='94100000-0000-4000-8000-000000000001';
select extensions.is((select business_label from public.workspace_integration_configs where workspace_id='94100000-0000-4000-8000-000000000001'),'North Star Realty','viewer update is blocked by row-level policy');
insert into public.conversion_goals(workspace_id,name,category,event_name) values('94100000-0000-4000-8000-000000000001','Viewer goal','lead','ViewerGoal');
select extensions.is((select count(*)::integer from public.conversion_goals),1,'viewer cannot insert goal definitions');
select extensions.throws_ok($$insert into public.integration_configuration_audit(workspace_id,entity_type,entity_id,action) values('94100000-0000-4000-8000-000000000001','forged','94400000-0000-4000-8000-000000000001','record_created')$$,'42501',null,'viewer cannot forge audit activity');
select extensions.is((select count(*)::integer from public.workspace_integration_configs where workspace_id='94100000-0000-4000-8000-000000000002'),0,'viewer cannot read another workspace configuration');
reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','94000000-0000-4000-8000-000000000003',true);
select extensions.is((select count(*)::integer from public.conversion_goals),0,'independent tenant cannot read another workspace goals');
select extensions.is((select count(*)::integer from public.tracking_test_runs),0,'synthetic event history is tenant isolated');
reset role;

select * from extensions.finish();
rollback;
