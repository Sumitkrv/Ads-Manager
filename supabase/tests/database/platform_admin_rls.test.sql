begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 (null,'b1000000-0000-4000-8000-000000000001','authenticated','authenticated','root-test@example.invalid','',now(),'{}','{}',now(),now()),
 (null,'b1000000-0000-4000-8000-000000000002','authenticated','authenticated','ops-test@example.invalid','',now(),'{}','{}',now(),now()),
 (null,'b1000000-0000-4000-8000-000000000003','authenticated','authenticated','support-test@example.invalid','',now(),'{}','{}',now(),now()),
 (null,'b1000000-0000-4000-8000-000000000004','authenticated','authenticated','billing-test@example.invalid','',now(),'{}','{}',now(),now()),
 (null,'b1000000-0000-4000-8000-000000000005','authenticated','authenticated','auditor-test@example.invalid','',now(),'{}','{}',now(),now()),
 (null,'b1000000-0000-4000-8000-000000000006','authenticated','authenticated','owner-test@example.invalid','',now(),'{}','{}',now(),now()),
 (null,'b1000000-0000-4000-8000-000000000007','authenticated','authenticated','viewer-test@example.invalid','',now(),'{}','{}',now(),now());
insert into public.workspaces(id,name,slug,industry_key,created_by,creation_request_id) values
 ('b1100000-0000-4000-8000-000000000001','Platform test tenant','platform-test-tenant','professional_services','b1000000-0000-4000-8000-000000000006','b1200000-0000-4000-8000-000000000001'),
 ('b1100000-0000-4000-8000-000000000002','Other test tenant','platform-other-tenant','ecommerce_retail','b1000000-0000-4000-8000-000000000007','b1200000-0000-4000-8000-000000000002');
insert into public.workspace_memberships(workspace_id,user_id,role) values
 ('b1100000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000006','owner'),
 ('b1100000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000007','viewer'),
 ('b1100000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000007','owner');
insert into tandem_internal.platform_admin_role_assignments(user_id,role_key,granted_by,reason) values
 ('b1000000-0000-4000-8000-000000000001','super_admin',null,'Isolated pgTAP super administrator fixture'),
 ('b1000000-0000-4000-8000-000000000002','operations_admin','b1000000-0000-4000-8000-000000000001','Isolated pgTAP operations fixture'),
 ('b1000000-0000-4000-8000-000000000003','support_agent','b1000000-0000-4000-8000-000000000001','Isolated pgTAP support fixture'),
 ('b1000000-0000-4000-8000-000000000004','billing_admin','b1000000-0000-4000-8000-000000000001','Isolated pgTAP billing fixture'),
 ('b1000000-0000-4000-8000-000000000005','auditor','b1000000-0000-4000-8000-000000000001','Isolated pgTAP audit fixture');

select extensions.ok(has_schema_privilege('authenticated','tandem_internal','USAGE'),'existing workspace wrappers retain helper-schema usage outside the Data API');
select extensions.ok(not has_table_privilege('authenticated','tandem_internal.platform_admin_role_assignments','SELECT'),'workspace users cannot read platform role assignments directly');
select extensions.ok(not has_function_privilege('authenticated','tandem_internal.platform_admin_has_capability(uuid,text)','EXECUTE'),'workspace users cannot directly probe platform capability helpers');
select extensions.ok(not has_table_privilege('authenticated','public.platform_support_cases','SELECT'),'workspace users cannot enumerate support cases directly');
select extensions.ok(not has_table_privilege('authenticated','public.platform_admin_events','SELECT'),'workspace users cannot read platform audit rows directly');
select extensions.ok(not has_function_privilege('authenticated','public.platform_admin_overview(uuid)','EXECUTE'),'workspace users cannot execute platform dashboard RPCs');
select extensions.ok(not has_function_privilege('authenticated','public.platform_admin_set_tenant_status(uuid,uuid,text,text)','EXECUTE'),'workspace users cannot call lifecycle mutations');
select extensions.ok(not has_function_privilege('authenticated','public.platform_admin_record_denied_attempt(uuid,text)','EXECUTE'),'workspace users cannot write platform denial audit events');
select extensions.ok(has_function_privilege('service_role','public.platform_admin_record_denied_attempt(uuid,text)','EXECUTE'),'only the server can record a verified denied capability attempt');
select extensions.ok(has_function_privilege('service_role','public.platform_admin_overview(uuid)','EXECUTE'),'only the server-side role can call the admin overview RPC');

select extensions.ok(tandem_internal.platform_admin_has_capability('b1000000-0000-4000-8000-000000000001','platform.admin.provision'),'super admin has explicitly granted provisioning capability');
select extensions.ok(tandem_internal.platform_admin_has_capability('b1000000-0000-4000-8000-000000000002','platform.tenants.manage'),'operations role can manage tenant operations');
select extensions.ok(not tandem_internal.platform_admin_has_capability('b1000000-0000-4000-8000-000000000003','platform.billing.manage'),'support role cannot manage billing');
select extensions.ok(not tandem_internal.platform_admin_has_capability('b1000000-0000-4000-8000-000000000004','platform.tenants.manage'),'billing role cannot suspend tenants');
select extensions.ok(not tandem_internal.platform_admin_has_capability('b1000000-0000-4000-8000-000000000005','platform.settings.manage'),'auditor is read only');
select extensions.ok(not tandem_internal.platform_admin_has_capability('b1000000-0000-4000-8000-000000000006','platform.dashboard.read'),'workspace owner is not a platform admin');
select extensions.ok(not tandem_internal.platform_admin_has_capability('b1000000-0000-4000-8000-000000000007','platform.dashboard.read'),'workspace viewer is not a platform admin');
set local role service_role;
select extensions.ok(public.platform_admin_record_denied_attempt('b1000000-0000-4000-8000-000000000006','platform.tenants.read'),'verified workspace-owner denial is recorded server-side');
select extensions.ok(not public.platform_admin_record_denied_attempt('b1000000-0000-4000-8000-000000000006','platform.tenants.read'),'repeated capability denial is throttled');
reset role;
select extensions.is((select count(*)::integer from public.platform_admin_events where actor_user_id='b1000000-0000-4000-8000-000000000006' and action='platform.authorization.denied' and target_id='platform.tenants.read'),1,'denial history contains only the bounded capability metadata');
select extensions.ok(not has_function_privilege('anon','public.platform_support_decide_access(uuid,text)','EXECUTE'),'anonymous callers cannot decide customer support consent');
select extensions.ok(has_function_privilege('authenticated','public.platform_support_decide_access(uuid,text)','EXECUTE'),'authenticated customer owners can decide consent through a membership-checked RPC');

update public.platform_feature_flags set enabled=false where flag_key='campaign_studio_enabled';
select extensions.throws_ok($$insert into public.campaigns(id,workspace_id,name,platform,objective,brief,created_by_user_id) values('b5000000-0000-4000-8000-000000000001','b1100000-0000-4000-8000-000000000001','Flagged campaign','google_ads','website_traffic','{}'::jsonb,'b1000000-0000-4000-8000-000000000006')$$,'55000',null,'platform rollout flags add a database write gate but grant no role or plan access');
update public.platform_feature_flags set enabled=true where flag_key='campaign_studio_enabled';

set local role service_role;
select extensions.throws_ok($$select public.platform_admin_overview('b1000000-0000-4000-8000-000000000006')$$,'42501',null,'workspace owner cannot call admin overview through the trusted RPC');
select extensions.throws_ok($$select public.platform_admin_list_tenants('b1000000-0000-4000-8000-000000000003',1,25,null,null,null,null)$$,'42501',null,'support agent cannot enumerate the tenant directory');
select extensions.ok((public.platform_admin_overview('b1000000-0000-4000-8000-000000000001')->>'workspaces_total')::integer>=2,'overview aggregates actual workspace records');
select extensions.is((public.platform_admin_list_tenants('b1000000-0000-4000-8000-000000000002',1,25,'Platform test',null,null,null)->>'total')::integer,1,'tenant search/filter happens in the bounded server query');
select extensions.ok((public.platform_admin_tenant_detail('b1000000-0000-4000-8000-000000000002','b1100000-0000-4000-8000-000000000001')->'workspace'->>'id')='b1100000-0000-4000-8000-000000000001','tenant detail returns only safe administrative workspace metadata');
select extensions.ok(jsonb_array_length(public.platform_admin_list_users('b1000000-0000-4000-8000-000000000001',1,10,null)->'items')>=7,'user directory is bounded and uses actual Auth/profile rows');
select extensions.is((public.platform_admin_health_probe('b1000000-0000-4000-8000-000000000001')->>'database'),'HEALTHY','database health reflects a successful authenticated probe');
select extensions.throws_ok($$select public.platform_admin_set_tenant_status('b1000000-0000-4000-8000-000000000001','b1100000-0000-4000-8000-000000000001','SUSPENDED','skip required request')$$,'23514',null,'tenant suspension cannot skip the pending review transition');
select public.platform_admin_set_tenant_status('b1000000-0000-4000-8000-000000000002','b1100000-0000-4000-8000-000000000001','SUSPENSION_PENDING','Validated local operations test');
select public.platform_admin_set_tenant_status('b1000000-0000-4000-8000-000000000002','b1100000-0000-4000-8000-000000000001','SUSPENDED','Confirmed isolated local suspension');
reset role;
select extensions.is((select status from public.platform_tenant_lifecycle where workspace_id='b1100000-0000-4000-8000-000000000001'),'SUSPENDED','tenant lifecycle status persists');
select extensions.throws_ok($$insert into public.workspace_memberships(workspace_id,user_id,role) values('b1100000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000005','viewer')$$,'55000',null,'suspension blocks new workspace mutations without deleting data');
select extensions.is((select count(*)::integer from public.workspace_memberships where workspace_id='b1100000-0000-4000-8000-000000000001'),2,'suspension preserves existing customer records');

set local role service_role;
select public.platform_admin_set_tenant_status('b1000000-0000-4000-8000-000000000002','b1100000-0000-4000-8000-000000000001','RESTORATION_PENDING','Local recovery request');
select public.platform_admin_set_tenant_status('b1000000-0000-4000-8000-000000000002','b1100000-0000-4000-8000-000000000001','ACTIVE','Local test tenant restored');
select public.platform_admin_create_support_case('b1000000-0000-4000-8000-000000000003','b1100000-0000-4000-8000-000000000001','permissions','normal','Access review','A test request to verify operator access boundaries.');
select public.platform_admin_update_support_case('b1000000-0000-4000-8000-000000000003',((public.platform_admin_list_support_cases('b1000000-0000-4000-8000-000000000003',1,25,null,'Access review')->'items'->0->>'id')::uuid),'OPEN',null,null,'PRIVATE TEST NOTE — NEVER VISIBLE TO WORKSPACE USERS');
select public.platform_admin_support_access_request('b1000000-0000-4000-8000-000000000003',((public.platform_admin_list_support_cases('b1000000-0000-4000-8000-000000000003',1,25,null,'Access review')->'items'->0->>'id')::uuid),array['workspace_metadata','campaign_status'],'Need limited operational metadata to diagnose case');
select extensions.throws_ok($$select public.platform_admin_create_support_case('b1000000-0000-4000-8000-000000000004','b1100000-0000-4000-8000-000000000001','other','normal','Wrong role','Billing admin must not create support cases.')$$,'42501',null,'billing admin cannot manage support cases');
select extensions.throws_ok($$select public.platform_admin_grant_role('b1000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000006','super_admin','Privilege escalation')$$,'42501',null,'operations admin cannot grant platform roles');
select public.platform_admin_grant_role('b1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000006','auditor','Reviewed isolated test grant');
select extensions.ok(public.platform_admin_has_capability('b1000000-0000-4000-8000-000000000006','platform.audit.read'),'super admin role grant creates only the selected least-privilege role');
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000006',true);
select extensions.ok(jsonb_array_length(public.workspace_list_support_cases('b1100000-0000-4000-8000-000000000001'))>0,'workspace owner can read customer-facing case summary');
select extensions.ok(position('PRIVATE TEST NOTE' in public.workspace_list_support_cases('b1100000-0000-4000-8000-000000000001')::text)=0,'workspace support response never contains operator-only notes');
select extensions.is((public.workspace_list_support_access_requests('b1100000-0000-4000-8000-000000000001')->0->>'status'),'PENDING','consent request begins pending');
select public.workspace_decide_support_access((public.workspace_list_support_access_requests('b1100000-0000-4000-8000-000000000001')->0->>'id')::uuid,'REJECTED');
select extensions.ok((public.workspace_list_support_access_requests('b1100000-0000-4000-8000-000000000001')->0->>'access_granted') is null,'consent endpoint exposes no cross-tenant content access');
select extensions.throws_ok($$select public.workspace_list_support_cases('b1100000-0000-4000-8000-000000000002')$$,'42501',null,'member cannot enumerate another workspace support cases');
reset role;
select * from extensions.finish();

rollback;
