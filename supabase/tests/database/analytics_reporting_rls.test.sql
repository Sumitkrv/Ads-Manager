begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
 (null,'91000000-0000-4000-8000-000000000001','authenticated','authenticated','report-owner-a@example.invalid','',pg_catalog.now(),'{}','{}',pg_catalog.now(),pg_catalog.now()),
 (null,'91000000-0000-4000-8000-000000000002','authenticated','authenticated','report-owner-b@example.invalid','',pg_catalog.now(),'{}','{}',pg_catalog.now(),pg_catalog.now()),
 (null,'91000000-0000-4000-8000-000000000003','authenticated','authenticated','report-viewer@example.invalid','',pg_catalog.now(),'{}','{}',pg_catalog.now(),pg_catalog.now());
insert into public.workspaces(id,name,slug,industry_key,created_by,creation_request_id)
values
 ('92000000-0000-4000-8000-000000000001','Report Tenant A','report-tenant-a','professional_services','91000000-0000-4000-8000-000000000001','92100000-0000-4000-8000-000000000001'),
 ('92000000-0000-4000-8000-000000000002','Report Tenant B','report-tenant-b','ecommerce_retail','91000000-0000-4000-8000-000000000002','92100000-0000-4000-8000-000000000002');
insert into public.workspace_memberships(workspace_id,user_id,role) values
 ('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','owner'),
 ('92000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000002','owner'),
 ('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000003','viewer');
update public.workspace_subscriptions set plan_id='growth',plan_version=2,status='active_demo',trial_ends_at=null
where workspace_id in ('92000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000002');
insert into public.report_definitions(id,workspace_id,name,description,report_type,definition,created_by_user_id,updated_by_user_id)
values
 ('93000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','Tenant A report','','custom','{"name":"Tenant A report","metrics":["clicks"],"sections":[{"id":"94000000-0000-4000-8000-000000000001","type":"table"}]}'::jsonb,'91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001'),
 ('93000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000002','Tenant B report','','custom','{"name":"Tenant B report","metrics":["spend"],"sections":[{"id":"94000000-0000-4000-8000-000000000002","type":"table"}]}'::jsonb,'91000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000002');
insert into public.report_revisions(workspace_id,report_id,version,name,definition,authored_by_user_id)
values
 ('92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001',1,'Tenant A report','{"name":"Tenant A report","metrics":["clicks"],"sections":[{"id":"94000000-0000-4000-8000-000000000001","type":"table"}]}'::jsonb,'91000000-0000-4000-8000-000000000001'),
 ('92000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000002',1,'Tenant B report','{"name":"Tenant B report","metrics":["spend"],"sections":[{"id":"94000000-0000-4000-8000-000000000002","type":"table"}]}'::jsonb,'91000000-0000-4000-8000-000000000002');
insert into public.analytics_saved_views(id,workspace_id,name,filters,visible_columns,sort_key,created_by_user_id,updated_by_user_id)
values
 ('95000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','Tenant A view','{"preset":"last_30_days","platform":"all","comparePrevious":false}'::jsonb,array['campaign','spend'],'spend','91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001'),
 ('95000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000002','Tenant B view','{"preset":"last_30_days","platform":"all","comparePrevious":false}'::jsonb,array['campaign','spend'],'spend','91000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000002');
insert into public.report_exports(workspace_id,export_format,row_count,file_bytes,sha256,generated_by_user_id)
values
 ('92000000-0000-4000-8000-000000000001','csv',1,64,pg_catalog.repeat('a',64),'91000000-0000-4000-8000-000000000001'),
 ('92000000-0000-4000-8000-000000000002','pdf',1,128,pg_catalog.repeat('b',64),'91000000-0000-4000-8000-000000000002');

select extensions.ok(not has_table_privilege('anon','public.report_definitions','SELECT'),'anonymous users cannot read saved reports');
select extensions.ok(not has_table_privilege('authenticated','public.report_definitions','INSERT'),'clients cannot insert report definitions outside guarded RPCs');
select extensions.ok(not has_table_privilege('authenticated','public.report_definitions','UPDATE'),'clients cannot directly modify saved report definitions');
select extensions.ok(not has_table_privilege('authenticated','public.report_exports','INSERT'),'clients cannot forge export history');
select extensions.ok(not has_table_privilege('authenticated','public.analytics_saved_views','INSERT'),'clients cannot bypass the saved-view RPC');
select extensions.ok(not has_table_privilege('authenticated','public.report_revisions','INSERT'),'clients cannot forge immutable report revisions');
select extensions.ok(has_function_privilege('authenticated','public.create_report_definition(uuid,jsonb)','EXECUTE'),'authenticated users can call guarded report creation');
select extensions.ok(not has_function_privilege('anon','public.create_report_definition(uuid,jsonb)','EXECUTE'),'anonymous users cannot create reports');

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000001',true);
select extensions.is((select pg_catalog.count(*)::integer from public.report_definitions),1,'workspace A sees its own report');
select extensions.is((select pg_catalog.count(*)::integer from public.report_definitions where id='93000000-0000-4000-8000-000000000002'),0,'workspace A cannot read a guessed workspace B report');
select extensions.is((select pg_catalog.count(*)::integer from public.analytics_saved_views),1,'workspace A sees its own saved view');
select extensions.is((select pg_catalog.count(*)::integer from public.analytics_saved_views where id='95000000-0000-4000-8000-000000000002'),0,'workspace A cannot read a guessed workspace B view');
select extensions.is((select pg_catalog.count(*)::integer from public.report_revisions),1,'workspace A sees only its report revision');
select extensions.is((select pg_catalog.count(*)::integer from public.report_exports),1,'workspace A sees only its export history');
select extensions.is((select (public.save_analytics_view('92000000-0000-4000-8000-000000000001',null,null,'Owner view','{"preset":"last_7_days","platform":"all","comparePrevious":false}'::jsonb,array['campaign','clicks'],'clicks')).name),'Owner view','owner can save a view through the guarded RPC');
select extensions.is((select (public.create_report_definition('92000000-0000-4000-8000-000000000001','{"name":"New report","description":"","reportType":"custom","metrics":["clicks"],"sections":[{"id":"94000000-0000-4000-8000-000000000003","type":"table"}]}'::jsonb)).name),'New report','owner can create a report through its guarded RPC');
reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000003',true);
select extensions.is((select pg_catalog.count(*)::integer from public.report_definitions),2,'viewer can read safe report metadata in the workspace');
select extensions.is((select pg_catalog.count(*)::integer from public.analytics_saved_views),2,'viewer can read workspace saved-view metadata');
select extensions.is((select pg_catalog.count(*)::integer from public.report_exports),1,'viewer can read safe export metadata for the workspace');
select extensions.throws_ok($$select public.create_report_definition('92000000-0000-4000-8000-000000000001','{"name":"Viewer report","metrics":["clicks"],"sections":[{"id":"94000000-0000-4000-8000-000000000004","type":"table"}]}'::jsonb)$$,'42501',null,'viewer cannot create reports');
select extensions.throws_ok($$select public.save_analytics_view('92000000-0000-4000-8000-000000000001',null,null,'Viewer view','{"preset":"last_7_days","platform":"all","comparePrevious":false}'::jsonb,array['campaign'],'campaign')$$,'42501',null,'viewer cannot save analytics views');
select extensions.throws_ok($$select public.record_report_export('92000000-0000-4000-8000-000000000001',null,null,'csv',0,3,'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')$$,'42501',null,'viewer cannot export report data');
reset role;

select * from extensions.finish();
rollback;
