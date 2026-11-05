begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
 (null,'81000000-0000-4000-8000-000000000001','authenticated','authenticated','opt-owner-a@example.invalid','',pg_catalog.now(),'{}','{}',pg_catalog.now(),pg_catalog.now()),
 (null,'81000000-0000-4000-8000-000000000002','authenticated','authenticated','opt-owner-b@example.invalid','',pg_catalog.now(),'{}','{}',pg_catalog.now(),pg_catalog.now()),
 (null,'81000000-0000-4000-8000-000000000003','authenticated','authenticated','opt-viewer@example.invalid','',pg_catalog.now(),'{}','{}',pg_catalog.now(),pg_catalog.now());
insert into public.workspaces(id,name,slug,industry_key,created_by,creation_request_id)
values
 ('82000000-0000-4000-8000-000000000001','Optimization Tenant A','optimization-tenant-a','professional_services','81000000-0000-4000-8000-000000000001','82100000-0000-4000-8000-000000000001'),
 ('82000000-0000-4000-8000-000000000002','Optimization Tenant B','optimization-tenant-b','ecommerce_retail','81000000-0000-4000-8000-000000000002','82100000-0000-4000-8000-000000000002');
insert into public.workspace_memberships(workspace_id,user_id,role) values
 ('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','owner'),
 ('82000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000002','owner'),
 ('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000003','viewer');
update public.workspace_subscriptions set plan_id='growth',plan_version=2,status='active_demo',trial_ends_at=null
where workspace_id in ('82000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000002');

insert into public.automation_rules(id,workspace_id,name,definition,enabled,created_by_user_id)
values
 ('83000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','Tenant A rule', '{"version":1,"trigger":"manual","conditionLogic":"all","conditions":[{"metric":"ctr","operator":"lt","threshold":1}],"action":"create_recommendation","approvalRequired":true,"industry":"professional_services"}',false,'81000000-0000-4000-8000-000000000001'),
 ('83000000-0000-4000-8000-000000000002','82000000-0000-4000-8000-000000000002','Tenant B rule', '{"version":1,"trigger":"manual","conditionLogic":"all","conditions":[{"metric":"cpa","operator":"gt","threshold":50}],"action":"create_review_task","approvalRequired":true,"industry":"ecommerce_retail"}',false,'81000000-0000-4000-8000-000000000002');
insert into public.workspace_notifications(id,workspace_id,recipient_user_id,notification_type,title,body,dedupe_key)
values
 ('86000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','approval_required','Tenant A notice','A review is waiting.','notice-a'),
 ('86000000-0000-4000-8000-000000000002','82000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000002','approval_required','Tenant B notice','A review is waiting.','notice-b');

select extensions.ok(not has_table_privilege('anon','public.optimization_recommendations','SELECT'),'anonymous users cannot read recommendations');
select extensions.ok(not has_table_privilege('authenticated','public.optimization_recommendations','INSERT'),'clients cannot insert recommendations directly');
select extensions.ok(not has_table_privilege('authenticated','public.optimization_scenarios','UPDATE'),'clients can only transition scenarios through checked RPCs');
select extensions.ok(not has_table_privilege('authenticated','public.automation_rules','INSERT'),'clients cannot create automation rules outside the checked RPC');
select extensions.ok(not has_table_privilege('authenticated','public.automation_rules','UPDATE'),'clients cannot modify automation definitions directly');
select extensions.ok(not has_table_privilege('authenticated','public.automation_executions','INSERT'),'clients cannot forge execution history');
select extensions.ok(not has_table_privilege('authenticated','public.optimization_activity','INSERT'),'clients cannot forge optimization audit events');
select extensions.ok(not has_table_privilege('authenticated','public.workspace_notifications','INSERT'),'clients cannot create notifications directly');
select extensions.ok(has_function_privilege('authenticated','public.execute_automation_rule(uuid,uuid,uuid,uuid)','EXECUTE'),'authenticated clients call the guarded manual evaluation RPC');
select extensions.ok(not has_function_privilege('anon','public.execute_automation_rule(uuid,uuid,uuid,uuid)','EXECUTE'),'anonymous users cannot run automation');
select extensions.ok(not has_function_privilege('authenticated','tandem_internal.automation_rule_definition_is_valid(jsonb)','EXECUTE'),'internal DSL validation helper is not directly callable');
select extensions.ok((select p.prosecdef from pg_catalog.pg_proc p where p.oid='public.execute_automation_rule(uuid,uuid,uuid,uuid)'::regprocedure),'rule evaluation checks access in a guarded definer transaction');
select extensions.ok((select exists(select 1 from pg_catalog.unnest(p.proconfig) s(value) where s.value like 'search_path=%' and pg_catalog.replace(s.value,'"','')='search_path=') from pg_catalog.pg_proc p where p.oid='public.execute_automation_rule(uuid,uuid,uuid,uuid)'::regprocedure),'rule evaluation pins an empty search path');

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
select extensions.is((select pg_catalog.count(*)::integer from public.automation_rules),1,'workspace A sees only its own rules');
select extensions.is((select pg_catalog.count(*)::integer from public.automation_rules where id='83000000-0000-4000-8000-000000000002'),0,'workspace A cannot read a guessed workspace B rule');
select extensions.is((select pg_catalog.count(*)::integer from public.workspace_notifications),1,'recipient sees only their workspace notification');
select extensions.is((select pg_catalog.count(*)::integer from public.optimization_scenarios),0,'no scenarios leak across tenants');
reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000003',true);
select extensions.is((select pg_catalog.count(*)::integer from public.automation_rules),1,'viewer can read safe workspace rule metadata');
select extensions.throws_ok($$select public.save_automation_rule('82000000-0000-4000-8000-000000000001',null,null,'Viewer rule','{"version":1}'::jsonb,false)$$,'42501',null,'viewer cannot create an automation rule');
select extensions.throws_ok($$select public.execute_automation_rule('82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000001')$$,'42501',null,'viewer cannot execute automation even with guessed IDs');
select extensions.throws_ok($$select public.update_workspace_notification('86000000-0000-4000-8000-000000000002','read')$$,'P0002',null,'viewer cannot mark another tenant notification read');
reset role;

select * from extensions.finish();
rollback;
