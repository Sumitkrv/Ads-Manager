begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
 (null,'93000000-0000-4000-8000-000000000001','authenticated','authenticated','agency-owner@example.invalid','',pg_catalog.now(),'{}','{}',pg_catalog.now(),pg_catalog.now()),
 (null,'93000000-0000-4000-8000-000000000002','authenticated','authenticated','agency-staff@example.invalid','',pg_catalog.now(),'{}','{}',pg_catalog.now(),pg_catalog.now()),
 (null,'93000000-0000-4000-8000-000000000003','authenticated','authenticated','client-owner@example.invalid','',pg_catalog.now(),'{}','{}',pg_catalog.now(),pg_catalog.now()),
 (null,'93000000-0000-4000-8000-000000000004','authenticated','authenticated','independent-staff@example.invalid','',pg_catalog.now(),'{}','{}',pg_catalog.now(),pg_catalog.now()),
 (null,'93000000-0000-4000-8000-000000000005','authenticated','authenticated','client-viewer@example.invalid','',pg_catalog.now(),'{}','{}',pg_catalog.now(),pg_catalog.now());

insert into public.workspaces (id,name,slug,industry_key,created_by,creation_request_id) values
 ('94000000-0000-4000-8000-000000000001','Agency Test','agency-collab-test-agency','marketing_agencies','93000000-0000-4000-8000-000000000001','94100000-0000-4000-8000-000000000001'),
 ('94000000-0000-4000-8000-000000000002','Client Test','agency-collab-test-client','gyms_fitness','93000000-0000-4000-8000-000000000003','94100000-0000-4000-8000-000000000002'),
 ('94000000-0000-4000-8000-000000000003','Other Client','agency-collab-test-other','ecommerce_retail','93000000-0000-4000-8000-000000000003','94100000-0000-4000-8000-000000000003');
insert into public.workspace_memberships(workspace_id,user_id,role) values
 ('94000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','owner'),
 ('94000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000002','editor'),
 ('94000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000004','editor'),
 ('94000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000003','owner'),
 ('94000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000004','viewer'),
 ('94000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000005','viewer');
update public.workspace_subscriptions set plan_id='agency',plan_version=2,status='active_demo',trial_ends_at=null
where workspace_id='94000000-0000-4000-8000-000000000001';

select extensions.ok(not has_table_privilege('authenticated','public.agency_client_relationships','INSERT'), 'authenticated users cannot forge agency relationships directly');
select extensions.ok(not has_table_privilege('authenticated','public.workspace_invitations','INSERT'), 'authenticated users cannot forge workspace invitations directly');
select extensions.ok(not has_table_privilege('authenticated','public.client_tasks','INSERT'), 'authenticated users cannot bypass validated task RPCs');
select extensions.ok(not has_table_privilege('authenticated','public.client_collaboration_comments','INSERT'), 'authenticated users cannot bypass validated comment RPCs');
select extensions.ok(has_function_privilege('authenticated','public.accept_workspace_invitation(text,text)','EXECUTE'), 'authenticated users can accept invitations through the identity-bound RPC');

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000001',true);
select public.save_agency_profile('94000000-0000-4000-8000-000000000001','Independent client services',null,'["fitness"]'::jsonb);
select pg_catalog.set_config('test.agency_relationship',public.request_agency_client_relationship('94000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000002')->>'id',true);
select extensions.is((select status from public.agency_client_relationships where id=pg_catalog.current_setting('test.agency_relationship')::uuid),'pending','agency creates a pending request rather than granting access');
select extensions.is((select count(*)::integer from public.workspaces where id='94000000-0000-4000-8000-000000000002'),0,'agency relationship alone cannot expose the client workspace');
select extensions.throws_ok($$select public.transition_agency_client_relationship(pg_catalog.current_setting('test.agency_relationship')::uuid,'accept')$$,'42501',null,'agency cannot accept its own request on the client side');
reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000003',true);
select public.transition_agency_client_relationship(pg_catalog.current_setting('test.agency_relationship')::uuid,'accept');
select extensions.is((select status from public.agency_client_relationships where id=pg_catalog.current_setting('test.agency_relationship')::uuid),'active','client owner explicitly accepts the relationship');
select extensions.is((select count(*)::integer from public.workspaces where id='94000000-0000-4000-8000-000000000001'),0,'client membership does not expose the agency workspace');
select extensions.throws_ok($$select public.create_workspace_invitation('94000000-0000-4000-8000-000000000003',pg_catalog.current_setting('test.agency_relationship')::uuid,'agency-staff@example.invalid','viewer',pg_catalog.repeat('a',64),pg_catalog.now()+interval '7 days')$$,'42501',null,'a client invitation cannot bind to a relationship from another client workspace');
select pg_catalog.set_config('test.client_staff_invite',public.create_workspace_invitation('94000000-0000-4000-8000-000000000002',pg_catalog.current_setting('test.agency_relationship')::uuid,'agency-staff@example.invalid','editor',pg_catalog.repeat('b',64),pg_catalog.now()+interval '7 days')->>'id',true);
select pg_catalog.set_config('test.independent_invite',public.create_workspace_invitation('94000000-0000-4000-8000-000000000002',pg_catalog.current_setting('test.agency_relationship')::uuid,'independent-staff@example.invalid','viewer',pg_catalog.repeat('c',64),pg_catalog.now()+interval '7 days')->>'id',true);
reset role;
select extensions.ok((select count(*)::integer from public.workspace_notifications where workspace_id='94000000-0000-4000-8000-000000000001' and recipient_user_id='93000000-0000-4000-8000-000000000001' and notification_type='agency_collaboration' and title='Collaboration invitation created') >= 1,'client invitation notifies the agency owner in-app without email delivery');

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000002',true);
select public.accept_workspace_invitation(pg_catalog.repeat('b',64),'accept');
select extensions.is((select role from public.workspace_memberships where workspace_id='94000000-0000-4000-8000-000000000002' and user_id='93000000-0000-4000-8000-000000000002'),'editor','a verified agency member receives only the invited client role');
reset role;
select extensions.is((select count(*)::integer from public.agency_membership_grants where relationship_id=pg_catalog.current_setting('test.agency_relationship')::uuid and user_id='93000000-0000-4000-8000-000000000002' and status='active'),1,'agency-created client membership is tracked for safe revocation');

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000001',true);
select pg_catalog.set_config('test.assignment',public.create_agency_team_assignment(pg_catalog.current_setting('test.agency_relationship')::uuid,'93000000-0000-4000-8000-000000000002','Campaign editor')->>'id',true);
reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000002',true);
select public.create_client_comment('94000000-0000-4000-8000-000000000002',pg_catalog.current_setting('test.agency_relationship')::uuid,'workspace','94000000-0000-4000-8000-000000000002',null,'agency_internal','Internal collaboration note');
select extensions.is((select count(*)::integer from public.client_collaboration_comments where visibility='agency_internal'),1,'authorized agency and client member can create an internal note');
reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000004',true);
select public.accept_workspace_invitation(pg_catalog.repeat('c',64),'accept');
reset role;
select extensions.is((select count(*)::integer from public.agency_membership_grants where relationship_id=pg_catalog.current_setting('test.agency_relationship')::uuid and user_id='93000000-0000-4000-8000-000000000004'),0,'pre-existing client membership is not recorded as an agency grant');

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000005',true);
select extensions.is((select count(*)::integer from public.client_collaboration_comments where visibility='agency_internal'),0,'client viewer cannot read internal agency notes');
select extensions.throws_ok($$select public.transition_agency_client_relationship(pg_catalog.current_setting('test.agency_relationship')::uuid,'revoke')$$,'42501',null,'agency staff cannot revoke the client relationship');
reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000002',true);
select extensions.is((select count(*)::integer from public.client_collaboration_comments where visibility='agency_internal'),1,'agency staff with explicit client membership can read internal notes');
reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000003',true);
select public.transition_agency_client_relationship(pg_catalog.current_setting('test.agency_relationship')::uuid,'revoke');
select extensions.is((select count(*)::integer from public.workspace_memberships where workspace_id='94000000-0000-4000-8000-000000000002' and user_id='93000000-0000-4000-8000-000000000002'),0,'revoking relationship removes the membership created by the agency invitation');
select extensions.is((select count(*)::integer from public.workspace_memberships where workspace_id='94000000-0000-4000-8000-000000000002' and user_id='93000000-0000-4000-8000-000000000004'),1,'revoking relationship preserves independently held client membership');
select extensions.is((select status from public.agency_team_assignments where id=pg_catalog.current_setting('test.assignment')::uuid),'revoked','relationship revocation deactivates team assignments');
reset role;

select * from extensions.finish();
rollback;
