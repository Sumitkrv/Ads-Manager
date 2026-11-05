begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
 (null,'a1000000-0000-4000-8000-000000000001','authenticated','authenticated','billing-owner@example.invalid','',pg_catalog.now(),'{}','{}',pg_catalog.now(),pg_catalog.now()),
 (null,'a1000000-0000-4000-8000-000000000002','authenticated','authenticated','billing-other@example.invalid','',pg_catalog.now(),'{}','{}',pg_catalog.now(),pg_catalog.now());
insert into public.workspaces(id,name,slug,industry_key,created_by,creation_request_id)
values
 ('a1100000-0000-4000-8000-000000000001','Billing tenant one','billing-tenant-one','professional_services','a1000000-0000-4000-8000-000000000001','a1200000-0000-4000-8000-000000000001'),
 ('a1100000-0000-4000-8000-000000000002','Billing tenant two','billing-tenant-two','ecommerce_retail','a1000000-0000-4000-8000-000000000002','a1200000-0000-4000-8000-000000000002');
insert into public.workspace_memberships(workspace_id,user_id,role) values
 ('a1100000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','owner'),
 ('a1100000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000002','owner');

select extensions.is((select plan_id from public.workspace_subscriptions where workspace_id='a1100000-0000-4000-8000-000000000001'),'free_trial','new workspace receives its own trial subscription');
select extensions.ok(not has_table_privilege('authenticated','public.workspace_subscriptions','SELECT'),'workspace members cannot directly read or forge subscription rows');
select extensions.ok(not has_table_privilege('authenticated','public.workspace_usage_events','INSERT'),'workspace members cannot submit arbitrary usage events');
select extensions.ok(not has_table_privilege('authenticated','public.workspace_subscriptions','UPDATE'),'workspace owners cannot directly change their plan or status');
select extensions.ok(not has_table_privilege('authenticated','public.report_exports','INSERT'),'CSV export usage cannot be forged with direct table inserts');
select extensions.ok(not has_function_privilege('authenticated','public.billing_simulate_plan_activation(uuid,uuid)','EXECUTE'),'authenticated users cannot grant themselves a demo plan');
select extensions.ok(has_function_privilege('anon','public.billing_public_plans()','EXECUTE'),'public pricing uses a read-only catalog function');

insert into public.subscription_plans(id,display_name,description,is_public,is_active,sort_order,current_version)
values('billing_test','Billing Test','Test-only bounded quota',false,true,999,1);
insert into public.subscription_plan_versions(plan_id,version,currency,monthly_price_minor,annual_price_minor,trial_days,features,limits)
values('billing_test',1,'USD',0,0,0,'{"campaigns.create":true,"billing.manage":true}'::jsonb,'{"campaigns_per_month":1,"active_campaigns":1}'::jsonb);
update public.subscription_plan_versions set
  features=features||'{"campaigns.generate":true,"reports.export_csv":true}'::jsonb,
  limits=limits||'{"campaign_generation_ops_per_month":2,"csv_exports_per_month":1,"saved_reports":2}'::jsonb
where plan_id='billing_test' and version=1;
update public.workspace_subscriptions set plan_id='billing_test',plan_version=1,status='active_demo',trial_ends_at=null
where workspace_id='a1100000-0000-4000-8000-000000000001';
insert into public.campaigns(id,workspace_id,name,platform,objective,brief,created_by_user_id)
values('a1300000-0000-4000-8000-000000000001','a1100000-0000-4000-8000-000000000001','Quota test draft','google_ads','website_traffic','{}'::jsonb,'a1000000-0000-4000-8000-000000000001');
select extensions.is((select count(*)::integer from public.workspace_usage_events where workspace_id='a1100000-0000-4000-8000-000000000001' and metric_key='campaigns_created'),1,'campaign creation and its metering event commit together');
select extensions.throws_ok(
  $$insert into public.campaigns(id,workspace_id,name,platform,objective,brief,created_by_user_id) values('a1300000-0000-4000-8000-000000000002','a1100000-0000-4000-8000-000000000001','Over quota','google_ads','website_traffic','{}'::jsonb,'a1000000-0000-4000-8000-000000000001')$$,
  '54000',null,'database guard rejects a write that exceeds the current plan quota'
);
select extensions.is((select count(*)::integer from public.campaigns where workspace_id='a1100000-0000-4000-8000-000000000001'),1,'a rejected quota write leaves saved campaign data intact');

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
select extensions.ok((public.billing_workspace_summary('a1100000-0000-4000-8000-000000000001')->>'mode')='simulation','workspace member can read their own simulation billing summary');
select extensions.throws_ok($$select public.billing_workspace_summary('a1100000-0000-4000-8000-000000000002')$$,'P0002',null,'cross-workspace subscription summary is hidden');
select extensions.is(public.billing_consume_usage('a1100000-0000-4000-8000-000000000001','campaign_generation_ops','a3000000-0000-4000-8000-000000000001'::uuid)->>'status','recorded','offline generation quota is atomically recorded');
select extensions.is(public.billing_consume_usage('a1100000-0000-4000-8000-000000000001','campaign_generation_ops','a3000000-0000-4000-8000-000000000001'::uuid)->>'status','already_recorded','a retry reuses the usage event instead of consuming quota twice');
select extensions.is((public.billing_workspace_usage('a1100000-0000-4000-8000-000000000001')->'usage'->>'campaign_generation_ops_month')::integer,1,'idempotent generation retry has one usage event');
select public.record_report_export('a1100000-0000-4000-8000-000000000001',null,null,'csv',1,32,repeat('a',64));
select extensions.is((public.billing_workspace_usage('a1100000-0000-4000-8000-000000000001')->'usage'->>'csv_exports_month')::integer,1,'CSV export record and quota usage commit together');
select extensions.throws_ok($$select public.record_report_export('a1100000-0000-4000-8000-000000000001',null,null,'csv',1,32,repeat('b',64))$$,'54000',null,'second CSV export exceeds the configured monthly limit');
select extensions.throws_ok($$select public.billing_simulate_plan_activation('a1400000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001')$$,'42501',null,'a workspace owner may not directly activate an Enterprise entitlement');
reset role;

select * from extensions.finish();
rollback;
