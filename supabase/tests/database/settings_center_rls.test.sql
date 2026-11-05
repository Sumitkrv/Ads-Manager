begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
 (null,'92000000-0000-4000-8000-000000000001','authenticated','authenticated','settings-owner@example.invalid','',pg_catalog.now(),'{}','{}',pg_catalog.now(),pg_catalog.now()),
 (null,'92000000-0000-4000-8000-000000000002','authenticated','authenticated','settings-admin@example.invalid','',pg_catalog.now(),'{}','{}',pg_catalog.now(),pg_catalog.now()),
 (null,'92000000-0000-4000-8000-000000000003','authenticated','authenticated','settings-editor@example.invalid','',pg_catalog.now(),'{}','{}',pg_catalog.now(),pg_catalog.now()),
 (null,'92000000-0000-4000-8000-000000000004','authenticated','authenticated','settings-viewer@example.invalid','',pg_catalog.now(),'{}','{}',pg_catalog.now(),pg_catalog.now()),
 (null,'92000000-0000-4000-8000-000000000005','authenticated','authenticated','settings-invitee@example.invalid','',pg_catalog.now(),'{}','{}',pg_catalog.now(),pg_catalog.now()),
 (null,'92000000-0000-4000-8000-000000000006','authenticated','authenticated','settings-revoked@example.invalid','',pg_catalog.now(),'{}','{}',pg_catalog.now(),pg_catalog.now()),
 (null,'92000000-0000-4000-8000-000000000007','authenticated','authenticated','settings-second-owner@example.invalid','',pg_catalog.now(),'{}','{}',pg_catalog.now(),pg_catalog.now());

insert into public.workspaces(id,name,slug,industry_key,created_by,creation_request_id) values
 ('92100000-0000-4000-8000-000000000001','Settings tenant A','settings-tenant-a','professional_services','92000000-0000-4000-8000-000000000001','92200000-0000-4000-8000-000000000001'),
 ('92100000-0000-4000-8000-000000000002','Settings tenant B','settings-tenant-b','ecommerce_retail','92000000-0000-4000-8000-000000000007','92200000-0000-4000-8000-000000000002');
insert into public.workspace_memberships(workspace_id,user_id,role) values
 ('92100000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','owner'),
 ('92100000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000002','admin'),
 ('92100000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000003','editor'),
 ('92100000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000004','viewer'),
 ('92100000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000007','owner');
insert into public.workspace_preferences(workspace_id) values
 ('92100000-0000-4000-8000-000000000001'),('92100000-0000-4000-8000-000000000002');
insert into public.user_preferences(user_id,theme_preference) values
 ('92000000-0000-4000-8000-000000000007','light');

select extensions.ok(not has_table_privilege('anon','public.user_preferences','SELECT'),'anonymous users cannot read account preferences');
select extensions.ok(not has_table_privilege('anon','public.workspace_preferences','SELECT'),'anonymous users cannot read workspace preferences');
select extensions.ok(not has_table_privilege('anon','public.workspace_preferences','UPDATE'),'anonymous users cannot change workspace defaults');
select extensions.ok(not has_table_privilege('authenticated','public.workspace_memberships','UPDATE'),'authenticated users cannot write membership roles directly');
select extensions.ok(not has_table_privilege('authenticated','public.workspace_settings_audit','INSERT'),'authenticated users cannot forge audit entries directly');
select extensions.ok(not has_table_privilege('authenticated','public.account_closure_requests','INSERT'),'authenticated users must use the guarded closure request function');
select extensions.ok(not has_function_privilege('anon','public.workspace_team_member_identities(uuid)','EXECUTE'),'anonymous users cannot retrieve workspace member identities');
select extensions.ok(not has_function_privilege('anon','public.update_workspace_member_role(uuid,uuid,text)','EXECUTE'),'anonymous users cannot execute the member role function');
select extensions.ok(not has_function_privilege('authenticated','public.billing_simulate_plan_activation(uuid,uuid)','EXECUTE'),'workspace owners cannot grant themselves plan entitlements');
select extensions.ok(not (select public from storage.buckets where id='tandem-user-avatars'),'account avatars stay in private storage');
select extensions.ok(exists(select 1 from pg_catalog.pg_policies where schemaname='storage' and tablename='objects' and policyname='tandem_user_avatar_insert_own'),'avatar uploads have a dedicated owner-path policy');
select extensions.ok(exists(select 1 from pg_catalog.pg_policies where schemaname='storage' and tablename='objects' and policyname='tandem_user_avatar_select'),'avatar reads are limited to owners and workspace colleagues');

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000001',true);
insert into public.user_preferences(user_id,theme_preference,timezone,notification_preferences)
values(auth.uid(),'dark','Asia/Kolkata','{"campaign_reviews":true,"creative_reviews":false,"automation_activity":true,"usage_limit_alerts":true,"subscription_events":true,"agency_collaboration":true,"client_approvals":true,"team_invitations":true,"support_cases":true}'::jsonb);
select extensions.is((select theme_preference from public.user_preferences where user_id=auth.uid()),'dark','authenticated account appearance preference persists');
select extensions.is((select timezone from public.user_preferences where user_id=auth.uid()),'Asia/Kolkata','regional time zone persists with the account');
select extensions.is((select notification_preferences->>'creative_reviews' from public.user_preferences where user_id=auth.uid()),'false','notification category preferences persist with the account');
select extensions.is((select count(*)::integer from public.user_preferences),1,'owner can read only their own personal preferences');
update public.user_preferences set theme_preference='dark' where user_id='92000000-0000-4000-8000-000000000007';
select extensions.is((select count(*)::integer from public.user_preferences where user_id='92000000-0000-4000-8000-000000000007'),0,'user A cannot read another user preference row');
select extensions.is((select count(*)::integer from public.workspace_preferences where workspace_id='92100000-0000-4000-8000-000000000002'),0,'workspace A cannot read workspace B defaults');
update public.workspace_preferences set display_density='compact' where workspace_id='92100000-0000-4000-8000-000000000001';
select extensions.is((select display_density from public.workspace_preferences where workspace_id='92100000-0000-4000-8000-000000000001'),'compact','owner can save permitted workspace defaults');
update public.workspace_preferences set business_description='Local legal services',business_category='Employment law',operating_region='South India',default_currency='INR' where workspace_id='92100000-0000-4000-8000-000000000001';
select extensions.is((select business_description from public.workspace_preferences where workspace_id='92100000-0000-4000-8000-000000000001'),'Local legal services','workspace business description persists');
select extensions.is((select business_category from public.workspace_preferences where workspace_id='92100000-0000-4000-8000-000000000001'),'Employment law','workspace business category persists');
select extensions.is((select operating_region from public.workspace_preferences where workspace_id='92100000-0000-4000-8000-000000000001'),'South India','workspace operating region persists');
select extensions.is((select default_currency from public.workspace_preferences where workspace_id='92100000-0000-4000-8000-000000000001'),'INR','workspace display currency persists without conversion');
select extensions.ok(exists(select 1 from public.workspace_settings_audit where workspace_id='92100000-0000-4000-8000-000000000001' and action='workspace_preferences_updated' and actor_user_id=auth.uid() and changed_fields @> array['business_description','business_category','operating_region','default_currency']),'workspace preferences log changed field names for the verified actor');
update public.workspaces set name='Settings tenant A updated' where id='92100000-0000-4000-8000-000000000001';
select extensions.is((select count(*)::integer from public.workspace_settings_audit where workspace_id='92100000-0000-4000-8000-000000000001' and action='workspace_settings_updated'),1,'workspace settings changes produce an audit record');
select extensions.is((select count(*)::integer from public.workspace_team_member_identities('92100000-0000-4000-8000-000000000001')),4,'owner can view only current workspace membership identities');
select extensions.ok((select email_verified from public.workspace_team_member_identities('92100000-0000-4000-8000-000000000001') where user_id='92000000-0000-4000-8000-000000000002'),'team identity endpoint marks a verified email explicitly');
select extensions.is(public.update_workspace_member_role('92100000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000003','viewer')->>'role','viewer','owner can change an eligible member role');
select extensions.is((select count(*)::integer from public.workspace_settings_audit where action='member_role_changed' and target_user_id='92000000-0000-4000-8000-000000000003'),1,'membership role changes are audited');
select extensions.throws_ok($$select public.update_workspace_member_role('92100000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','viewer')$$,'42501',null,'owner cannot change their own membership');
select extensions.throws_ok($$select public.update_workspace_member_role('92100000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000004','admin')$$,'42501',null,'workspace role function denies cross-tenant member assignment');
select extensions.throws_ok($$select public.remove_workspace_member('92100000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001')$$,'42501',null,'workspace owner cannot remove an owner through the member removal function');
select extensions.throws_ok($$select public.update_workspace_member_role('92100000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000002','owner')$$,'42501',null,'owner transfer is unavailable through a normal role edit');
select extensions.throws_ok($$select public.create_workspace_invitation('92100000-0000-4000-8000-000000000001',null,'role-forge@example.invalid','owner',repeat('a',64),pg_catalog.now()+interval '7 days')$$,'22023',null,'database rejects forged Owner invitation roles');
select extensions.is(public.create_workspace_invitation('92100000-0000-4000-8000-000000000001',null,'settings-invitee@example.invalid','viewer',repeat('b',64),pg_catalog.now()+interval '7 days')->>'status','pending','owner creates a secure pending invitation');
select extensions.is((select pg_catalog.char_length(token_hash)::integer from public.workspace_invitations where token_hash=repeat('b',64)),64,'invitation rows contain a token hash rather than a raw link token');
select public.create_workspace_invitation('92100000-0000-4000-8000-000000000001',null,'settings-owner@example.invalid','viewer',repeat('c',64),pg_catalog.now()+interval '7 days');
select extensions.is(public.revoke_workspace_invitation((select id from public.workspace_invitations where token_hash=repeat('c',64)))->>'status','revoked','owner can revoke a pending invitation');
select extensions.throws_ok($$select public.accept_workspace_invitation(repeat('c',64))$$,'42501',null,'revoked invitation token cannot be accepted');
insert into public.workspace_invitations(workspace_id,invited_email,invited_role,token_hash,created_by,expires_at)
values('92100000-0000-4000-8000-000000000001','settings-invitee@example.invalid','viewer',repeat('d',64),'92000000-0000-4000-8000-000000000001',pg_catalog.now()-interval '1 minute');
select pg_catalog.set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000005',true);
select extensions.throws_ok($$select public.accept_workspace_invitation(repeat('d',64))$$,'P0002',null,'expired invitation token is rejected');
select pg_catalog.set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000001',true);
select public.create_workspace_invitation('92100000-0000-4000-8000-000000000001',null,'settings-invitee@example.invalid','viewer',repeat('e',64),pg_catalog.now()+interval '7 days');
select pg_catalog.set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000005',true);
select extensions.is(public.accept_workspace_invitation(repeat('e',64))->>'status','accepted','verified matching invitee can accept a pending token');
select extensions.ok((public.accept_workspace_invitation(repeat('e',64))->>'idempotent_replay')::boolean,'acceptance retry is idempotent for the verified accepting identity');
select extensions.throws_ok($$select public.accept_workspace_invitation(repeat('e',64),'forged-action')$$,'22023',null,'invitation action values are validated');
select extensions.is((select count(*)::integer from public.workspace_memberships where workspace_id='92100000-0000-4000-8000-000000000001' and user_id='92000000-0000-4000-8000-000000000005'),1,'invitation retry does not create a duplicate membership');
select public.request_account_closure('account',null);
select extensions.is((select count(*)::integer from public.account_closure_requests where requester_user_id=auth.uid() and scope='account' and status='pending_review'),1,'account closure creates a pending request');
select extensions.is((select count(*)::integer from auth.users where id=auth.uid()),1,'account closure request does not delete the account');
select extensions.is((select count(*)::integer from public.workspaces where id='92100000-0000-4000-8000-000000000001'),1,'settings changes and closure requests preserve workspace records');
reset role;
select extensions.is((select theme_preference from public.user_preferences where user_id='92000000-0000-4000-8000-000000000007'),'light','user A cannot update user B personal preferences');

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000004',true);
select extensions.is((select count(*)::integer from public.user_preferences),0,'viewer cannot read another account preferences');
update public.workspace_preferences set display_density='comfortable' where workspace_id='92100000-0000-4000-8000-000000000001';
select extensions.is((select display_density from public.workspace_preferences where workspace_id='92100000-0000-4000-8000-000000000001'),'compact','viewer cannot change workspace defaults through direct SQL');
select extensions.is((select count(*)::integer from public.workspace_settings_audit),0,'viewer cannot read administrative workspace audit history');
select extensions.throws_ok($$select public.workspace_team_member_identities('92100000-0000-4000-8000-000000000001')$$,'42501',null,'viewer cannot retrieve verified member email identities');
select extensions.throws_ok($$select public.create_workspace_invitation('92100000-0000-4000-8000-000000000001',null,'viewer-invite@example.invalid','viewer',repeat('f',64),pg_catalog.now()+interval '7 days')$$,'42501',null,'viewer cannot create an invitation through the database RPC');
select extensions.throws_ok($$select public.request_account_closure('workspace','92100000-0000-4000-8000-000000000001')$$,'42501',null,'viewer cannot request workspace closure');
reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000002',true);
select extensions.throws_ok($$select public.update_workspace_member_role('92100000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000002','viewer')$$,'42501',null,'admin cannot elevate or alter their own membership');
select extensions.throws_ok($$select public.update_workspace_member_role('92100000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000003','admin')$$,'42501',null,'admin cannot grant a role at their authority ceiling');
select extensions.throws_ok($$select public.create_workspace_invitation('92100000-0000-4000-8000-000000000001',null,'admin-invite@example.invalid','admin',repeat('9',64),pg_catalog.now()+interval '7 days')$$,'22023',null,'admin cannot invite another admin');
select extensions.throws_ok($$select public.create_workspace_invitation('92100000-0000-4000-8000-000000000002',null,'cross-tenant-invite@example.invalid','viewer',repeat('8',64),pg_catalog.now()+interval '7 days')$$,'42501',null,'admin cannot create invitation in another tenant');
select extensions.throws_ok($$select public.remove_workspace_member('92100000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001')$$,'42501',null,'admin cannot remove workspace owner');
reset role;

insert into public.subscription_plans(id,display_name,description,is_public,is_active,sort_order,current_version)
values('settings_seat_test','Settings seat test','Bounded seats for settings RLS tests',false,true,999,1);
insert into public.subscription_plan_versions(plan_id,version,currency,monthly_price_minor,annual_price_minor,trial_days,features,limits)
values('settings_seat_test',1,'USD',0,0,0,'{"billing.manage":true}'::jsonb,'{"seats":2,"campaigns_per_month":-1,"active_campaigns":-1,"creative_projects":-1,"storage_bytes":-1,"automation_rules":-1,"automation_executions_per_month":-1,"saved_reports":-1,"pdf_exports_per_month":-1,"agency_clients":-1}'::jsonb);
update public.workspace_subscriptions set plan_id='settings_seat_test',plan_version=1,status='active_demo',trial_ends_at=null where workspace_id='92100000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000007',true);
select extensions.is(public.create_workspace_invitation('92100000-0000-4000-8000-000000000002',null,'settings-invitee@example.invalid','viewer',repeat('1',64),pg_catalog.now()+interval '7 days')->>'status','pending','available plan seat can be reserved by a pending invitation');
select extensions.throws_ok($$select public.create_workspace_invitation('92100000-0000-4000-8000-000000000002',null,'settings-revoked@example.invalid','viewer',repeat('2',64),pg_catalog.now()+interval '7 days')$$,'23514',null,'pending invitations reserve seats against the workspace plan limit');
select extensions.throws_ok($$select public.create_workspace_invitation('92100000-0000-4000-8000-000000000002',null,'settings-other@example.invalid','viewer',repeat('3',64),pg_catalog.now()+interval '7 days')$$,'23514',null,'seat reservation remains enforced when the plan is full');
reset role;

select * from extensions.finish();
rollback;
