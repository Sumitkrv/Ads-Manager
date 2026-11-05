begin;

-- Agency links are workflow metadata. They never grant a user access to a
-- client workspace; the user's own workspace_memberships row remains required.

create table public.agency_profiles (
  agency_workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  description text,
  website_url text,
  specializations jsonb not null default '[]'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint agency_profile_description_length check (description is null or pg_catalog.char_length(description) <= 1200),
  constraint agency_profile_url_valid check (website_url is null or (pg_catalog.char_length(website_url) <= 2048 and website_url ~* '^https?://[^/@[:space:]]+([/?#][^[:space:]]*)?$')),
  constraint agency_profile_specializations_array check (pg_catalog.jsonb_typeof(specializations) = 'array' and pg_catalog.jsonb_array_length(specializations) <= 16)
);

create table public.agency_client_relationships (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  agency_workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_workspace_id uuid not null references public.workspaces(id) on delete cascade,
  request_direction text not null default 'agency_to_client' check (request_direction in ('agency_to_client','client_to_agency')),
  status text not null default 'pending',
  decision text,
  requested_by uuid not null references auth.users(id) on delete restrict,
  responded_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default pg_catalog.now(),
  responded_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint agency_relationship_distinct_workspaces check (agency_workspace_id <> client_workspace_id),
  constraint agency_relationship_status_valid check (status in ('pending','active','paused','revoked','ended')),
  constraint agency_relationship_decision_valid check (decision is null or decision in ('accepted','rejected','paused','resumed','revoked','ended')),
  unique (id, agency_workspace_id, client_workspace_id)
);
create unique index agency_relationship_open_pair_idx on public.agency_client_relationships(agency_workspace_id, client_workspace_id) where status in ('pending','active','paused');
create index agency_relationship_agency_recent_idx on public.agency_client_relationships(agency_workspace_id, status, updated_at desc);
create index agency_relationship_client_recent_idx on public.agency_client_relationships(client_workspace_id, status, updated_at desc);

create table public.agency_team_assignments (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  relationship_id uuid not null,
  agency_workspace_id uuid not null,
  client_workspace_id uuid not null,
  assignee_user_id uuid not null references auth.users(id) on delete cascade,
  responsibility text not null,
  status text not null default 'active',
  created_by uuid not null references auth.users(id) on delete restrict,
  revoked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  revoked_at timestamptz,
  foreign key (relationship_id, agency_workspace_id, client_workspace_id)
    references public.agency_client_relationships(id, agency_workspace_id, client_workspace_id) on delete cascade,
  constraint agency_assignment_responsibility_length check (pg_catalog.char_length(pg_catalog.btrim(responsibility)) between 2 and 120),
  constraint agency_assignment_status_valid check (status in ('active','revoked')),
  unique (relationship_id, assignee_user_id)
);
create index agency_assignments_client_active_idx on public.agency_team_assignments(client_workspace_id, assignee_user_id) where status = 'active';

-- A client membership created from an accepted agency invitation is tracked
-- separately so agency revocation can remove only that grant. Pre-existing
-- client memberships are never recorded or deleted by this mechanism.
create table public.agency_membership_grants (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  relationship_id uuid not null references public.agency_client_relationships(id) on delete cascade,
  agency_workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  membership_id uuid,
  granted_role text not null check (granted_role in ('editor','viewer')),
  status text not null default 'active' check (status in ('active','revoked','released')),
  created_at timestamptz not null default pg_catalog.now(),
  revoked_at timestamptz,
  foreign key (relationship_id, agency_workspace_id, client_workspace_id)
    references public.agency_client_relationships(id, agency_workspace_id, client_workspace_id) on delete cascade,
  foreign key (membership_id) references public.workspace_memberships(id) on delete set null,
  unique (relationship_id, user_id)
);
create index agency_membership_grants_user_idx on public.agency_membership_grants(agency_workspace_id, user_id, status);

create table public.workspace_invitations (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  relationship_id uuid references public.agency_client_relationships(id) on delete cascade,
  invited_email text not null,
  invited_role text not null check (invited_role in ('admin','editor','viewer')),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending' check (status in ('pending','accepted','declined','revoked','expired')),
  created_by uuid not null references auth.users(id) on delete restrict,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint workspace_invitation_email_normalized check (invited_email = pg_catalog.lower(pg_catalog.btrim(invited_email)) and pg_catalog.char_length(invited_email) between 3 and 320),
  constraint workspace_invitation_expiration_valid check (expires_at > created_at and expires_at <= created_at + interval '14 days')
);
create unique index workspace_invitation_pending_email_idx on public.workspace_invitations(workspace_id, invited_email) where status = 'pending';
create index workspace_invitation_recent_idx on public.workspace_invitations(workspace_id, created_at desc);

create table public.client_tasks (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  relationship_id uuid references public.agency_client_relationships(id) on delete set null,
  title text not null,
  description text,
  assigned_user_id uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  due_date date,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'todo' check (status in ('todo','in_progress','blocked','in_review','done','cancelled')),
  visibility text not null default 'client_visible' check (visibility in ('agency_internal','client_visible')),
  related_resource_type text check (related_resource_type is null or related_resource_type in ('campaign','creative','report')),
  related_resource_id uuid,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint client_task_title_length check (pg_catalog.char_length(pg_catalog.btrim(title)) between 2 and 180),
  constraint client_task_description_length check (description is null or pg_catalog.char_length(description) <= 4000),
  constraint client_task_resource_pair check ((related_resource_type is null) = (related_resource_id is null))
);
create index client_tasks_workspace_status_idx on public.client_tasks(workspace_id, status, updated_at desc);
create index client_tasks_assignee_idx on public.client_tasks(workspace_id, assigned_user_id, status);

create table public.client_collaboration_comments (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  relationship_id uuid references public.agency_client_relationships(id) on delete set null,
  related_resource_type text not null check (related_resource_type in ('campaign','creative','report','task','workspace')),
  related_resource_id uuid,
  parent_comment_id uuid,
  author_user_id uuid not null references auth.users(id) on delete restrict,
  visibility text not null default 'client_visible' check (visibility in ('agency_internal','client_visible')),
  body text not null,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  foreign key (parent_comment_id, workspace_id) references public.client_collaboration_comments(id, workspace_id) on delete cascade,
  unique (id, workspace_id),
  constraint client_comment_body_length check (pg_catalog.char_length(pg_catalog.btrim(body)) between 1 and 5000)
);
create index client_comments_resource_idx on public.client_collaboration_comments(workspace_id, related_resource_type, related_resource_id, created_at);

create table public.agency_activity_events (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  agency_workspace_id uuid references public.workspaces(id) on delete cascade,
  client_workspace_id uuid references public.workspaces(id) on delete cascade,
  relationship_id uuid references public.agency_client_relationships(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action_type text not null,
  target_type text not null,
  target_id uuid,
  visibility text not null check (visibility in ('agency_only','client_visible')),
  summary jsonb not null default '{}'::jsonb,
  request_id uuid,
  created_at timestamptz not null default pg_catalog.now(),
  constraint agency_activity_scope_present check (agency_workspace_id is not null or client_workspace_id is not null),
  constraint agency_activity_summary_object check (pg_catalog.jsonb_typeof(summary) = 'object'),
  constraint agency_activity_action_safe check (action_type ~ '^[a-z][a-z0-9_]{1,63}$'),
  constraint agency_activity_target_safe check (target_type ~ '^[a-z][a-z0-9_]{1,63}$')
);
create index agency_activity_agency_recent_idx on public.agency_activity_events(agency_workspace_id, created_at desc);
create index agency_activity_client_recent_idx on public.agency_activity_events(client_workspace_id, created_at desc) where visibility = 'client_visible';

alter table public.workspace_notifications drop constraint if exists workspace_notification_type;
alter table public.workspace_notifications add constraint workspace_notification_type check (notification_type in (
  'optimization_opportunity','rule_execution','rule_failed','approval_required','recommendation_decision','campaign_review','demo_threshold',
  'agency_collaboration','agency_invitation','agency_assignment','client_task','client_comment'
));

alter table public.agency_profiles enable row level security;
alter table public.agency_client_relationships enable row level security;
alter table public.agency_team_assignments enable row level security;
alter table public.agency_membership_grants enable row level security;
alter table public.workspace_invitations enable row level security;
alter table public.client_tasks enable row level security;
alter table public.client_collaboration_comments enable row level security;
alter table public.agency_activity_events enable row level security;

revoke all on public.agency_profiles, public.agency_client_relationships, public.agency_team_assignments,
  public.agency_membership_grants, public.workspace_invitations, public.client_tasks,
  public.client_collaboration_comments, public.agency_activity_events from public, anon, authenticated, service_role;
grant select on public.agency_profiles, public.agency_client_relationships, public.agency_team_assignments,
  public.workspace_invitations, public.client_tasks, public.client_collaboration_comments,
  public.agency_activity_events to authenticated;

create or replace function tandem_internal.can_view_agency_internal(p_relationship_id uuid, p_client_workspace_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.agency_client_relationships rel
    where rel.id = p_relationship_id and rel.client_workspace_id = p_client_workspace_id and rel.status = 'active'
      and exists (select 1 from public.workspace_memberships m where m.workspace_id = rel.agency_workspace_id and m.user_id = (select auth.uid()))
      and exists (select 1 from public.workspace_memberships m where m.workspace_id = rel.client_workspace_id and m.user_id = (select auth.uid()))
  );
$$;
revoke all on function tandem_internal.can_view_agency_internal(uuid,uuid) from public, anon, authenticated, service_role;

create policy agency_profiles_member_read on public.agency_profiles for select to authenticated
  using (tandem_internal.has_workspace_role(agency_workspace_id, null::text[]));
create policy agency_relationship_participant_read on public.agency_client_relationships for select to authenticated
  using (tandem_internal.has_workspace_role(agency_workspace_id, null::text[]) or tandem_internal.has_workspace_role(client_workspace_id, null::text[]));
create policy agency_assignments_participant_read on public.agency_team_assignments for select to authenticated
  using (tandem_internal.has_workspace_role(agency_workspace_id, null::text[]) or tandem_internal.has_workspace_role(client_workspace_id, array['owner','admin']::text[]));
create policy agency_membership_grants_admin_read on public.agency_membership_grants for select to authenticated
  using (tandem_internal.has_workspace_role(agency_workspace_id, array['owner','admin']::text[]) or tandem_internal.has_workspace_role(client_workspace_id, array['owner','admin']::text[]));
create policy workspace_invitations_admin_read on public.workspace_invitations for select to authenticated
  using (tandem_internal.has_workspace_role(workspace_id, array['owner','admin']::text[]));
create policy client_tasks_visible_read on public.client_tasks for select to authenticated
  using (tandem_internal.has_workspace_role(workspace_id, null::text[]) and (
    visibility = 'client_visible' or tandem_internal.can_view_agency_internal(relationship_id, workspace_id)
  ));
create policy client_comments_visible_read on public.client_collaboration_comments for select to authenticated
  using (tandem_internal.has_workspace_role(workspace_id, null::text[]) and (
    visibility = 'client_visible' or tandem_internal.can_view_agency_internal(relationship_id, workspace_id)
  ));
create policy agency_activity_scope_read on public.agency_activity_events for select to authenticated
  using (
    (agency_workspace_id is not null and tandem_internal.has_workspace_role(agency_workspace_id, null::text[]))
    or (visibility = 'client_visible' and client_workspace_id is not null and tandem_internal.has_workspace_role(client_workspace_id, null::text[]))
  );

-- The invitation/hash is single-use and identity-bound. Membership created by
-- accepting an agency invitation is tracked so relationship/team revocation
-- cannot delete an independently created client membership.
create or replace function public.save_agency_profile(p_workspace_id uuid, p_description text, p_website_url text, p_specializations jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); result public.agency_profiles;
begin
 if actor is null or not tandem_internal.has_workspace_role(p_workspace_id,array['owner','admin']::text[]) then raise exception using errcode='42501',message='Agency settings permission is required.'; end if;
 if pg_catalog.char_length(coalesce(p_description,'')) > 1200 or (p_website_url is not null and (pg_catalog.char_length(p_website_url)>2048 or p_website_url !~* '^https?://[^/@[:space:]]+([/?#][^[:space:]]*)?$'))
   or pg_catalog.jsonb_typeof(p_specializations)<>'array' or pg_catalog.jsonb_array_length(p_specializations)>16
   or exists(select 1 from pg_catalog.jsonb_array_elements(p_specializations) x where pg_catalog.jsonb_typeof(x)<>'string' or pg_catalog.char_length(pg_catalog.btrim(x#>>'{}')) not between 1 and 80) then
   raise exception using errcode='22023',message='Agency profile details are invalid.';
 end if;
 insert into public.agency_profiles(agency_workspace_id,description,website_url,specializations,created_by)
 values(p_workspace_id,nullif(pg_catalog.btrim(coalesce(p_description,'')),''),p_website_url,p_specializations,actor)
 on conflict(agency_workspace_id) do update set description=excluded.description,website_url=excluded.website_url,specializations=excluded.specializations,updated_at=pg_catalog.now()
 returning * into result;
 return pg_catalog.to_jsonb(result);
end; $$;

create or replace function public.request_agency_client_relationship(p_agency_workspace_id uuid,p_client_workspace_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); existing public.agency_client_relationships; result public.agency_client_relationships;
begin
 if actor is null or p_agency_workspace_id=p_client_workspace_id or not tandem_internal.has_workspace_role(p_agency_workspace_id,array['owner','admin']::text[])
   or not exists(select 1 from public.agency_profiles p where p.agency_workspace_id=p_agency_workspace_id) then
   raise exception using errcode='42501',message='Agency relationship request permission is required.';
 end if;
 select * into existing from public.agency_client_relationships r where r.agency_workspace_id=p_agency_workspace_id and r.client_workspace_id=p_client_workspace_id and r.status in ('pending','active','paused') for update;
 if found then return pg_catalog.to_jsonb(existing); end if;
 if not exists(select 1 from public.workspaces w where w.id=p_client_workspace_id) then raise exception using errcode='P0002',message='Client workspace was not found.'; end if;
 insert into public.agency_client_relationships(agency_workspace_id,client_workspace_id,requested_by)
 values(p_agency_workspace_id,p_client_workspace_id,actor) returning * into result;
 return pg_catalog.to_jsonb(result);
end; $$;

create or replace function public.request_client_agency_relationship(p_client_workspace_id uuid,p_agency_workspace_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); existing public.agency_client_relationships; result public.agency_client_relationships;
begin
 if actor is null or p_agency_workspace_id=p_client_workspace_id or not tandem_internal.has_workspace_role(p_client_workspace_id,array['owner','admin']::text[])
   or not exists(select 1 from public.agency_profiles p where p.agency_workspace_id=p_agency_workspace_id) then
   raise exception using errcode='42501',message='Client collaboration request permission is required.';
 end if;
 select * into existing from public.agency_client_relationships r where r.agency_workspace_id=p_agency_workspace_id and r.client_workspace_id=p_client_workspace_id and r.status in ('pending','active','paused') for update;
 if found then return pg_catalog.to_jsonb(existing); end if;
 insert into public.agency_client_relationships(agency_workspace_id,client_workspace_id,request_direction,requested_by)
 values(p_agency_workspace_id,p_client_workspace_id,'client_to_agency',actor) returning * into result;
 return pg_catalog.to_jsonb(result);
end; $$;

create or replace function public.transition_agency_client_relationship(p_relationship_id uuid,p_action text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); rel public.agency_client_relationships; actor_agency_role text; actor_client_role text; next_status text; decision_value text;
begin
 if actor is null then raise exception using errcode='28000',message='Authentication is required.'; end if;
 select * into rel from public.agency_client_relationships where id=p_relationship_id for update;
 if not found then raise exception using errcode='P0002',message='Relationship was not found.'; end if;
 select role into actor_agency_role from public.workspace_memberships where workspace_id=rel.agency_workspace_id and user_id=actor;
 select role into actor_client_role from public.workspace_memberships where workspace_id=rel.client_workspace_id and user_id=actor;
 if p_action in ('accept','reject') then
   if (rel.request_direction='agency_to_client' and coalesce(actor_client_role,'') not in ('owner','admin'))
      or (rel.request_direction='client_to_agency' and coalesce(actor_agency_role,'') not in ('owner','admin')) then raise exception using errcode='42501',message='The requested workspace owner or admin must decide.'; end if;
 elsif p_action='revoke' then
   if coalesce(actor_client_role,'') not in ('owner','admin') then raise exception using errcode='42501',message='Client workspace owner or admin action is required to revoke agency access.'; end if;
 elsif p_action in ('pause','resume','end') then
   if coalesce(actor_client_role,'') not in ('owner','admin') and coalesce(actor_agency_role,'') not in ('owner','admin') then raise exception using errcode='42501',message='Agency or client workspace management permission is required.'; end if;
 else raise exception using errcode='22023',message='Relationship action is invalid.'; end if;
 if p_action='accept' and rel.status='pending' then next_status:='active'; decision_value:='accepted';
 elsif p_action='reject' and rel.status='pending' then next_status:='ended'; decision_value:='rejected';
 elsif p_action='pause' and rel.status='active' then next_status:='paused'; decision_value:='paused';
 elsif p_action='resume' and rel.status='paused' then next_status:='active'; decision_value:='resumed';
 elsif p_action='revoke' and rel.status in ('pending','active','paused') then next_status:='revoked'; decision_value:='revoked';
 elsif p_action='end' and rel.status in ('active','paused') then next_status:='ended'; decision_value:='ended';
 else raise exception using errcode='22023',message='Relationship transition is not allowed.'; end if;
 update public.agency_client_relationships set status=next_status,decision=decision_value,responded_by=actor,responded_at=pg_catalog.now(),updated_at=pg_catalog.now() where id=rel.id returning * into rel;
 if next_status in ('revoked','ended') then
   update public.workspace_invitations set status='revoked',updated_at=pg_catalog.now() where relationship_id=rel.id and status='pending';
   update public.agency_membership_grants set status='revoked',revoked_at=pg_catalog.now() where relationship_id=rel.id and status='active';
   delete from public.workspace_memberships m using public.agency_membership_grants g where g.relationship_id=rel.id and g.user_id=m.user_id and g.client_workspace_id=m.workspace_id and g.membership_id=m.id and g.status='revoked' and m.role=g.granted_role;
   update public.agency_team_assignments set status='revoked',revoked_by=actor,revoked_at=pg_catalog.now(),updated_at=pg_catalog.now() where relationship_id=rel.id and status='active';
 end if;
 return pg_catalog.to_jsonb(rel);
end; $$;

create or replace function public.create_agency_team_assignment(p_relationship_id uuid,p_user_id uuid,p_responsibility text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); rel public.agency_client_relationships; assignment public.agency_team_assignments;
begin
 if actor is null then raise exception using errcode='28000',message='Authentication is required.'; end if;
 select * into rel from public.agency_client_relationships where id=p_relationship_id and status='active' for share;
 if not found or not tandem_internal.has_workspace_role(rel.agency_workspace_id,array['owner','admin']::text[])
   or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_responsibility,''))) not between 2 and 120
   or not exists(select 1 from public.workspace_memberships m where m.workspace_id=rel.agency_workspace_id and m.user_id=p_user_id)
   or not exists(select 1 from public.workspace_memberships m where m.workspace_id=rel.client_workspace_id and m.user_id=p_user_id) then
   raise exception using errcode='42501',message='Assignment requires an active relationship and current membership in both workspaces.';
 end if;
 insert into public.agency_team_assignments(relationship_id,agency_workspace_id,client_workspace_id,assignee_user_id,responsibility,created_by,status,revoked_by,revoked_at)
 values(rel.id,rel.agency_workspace_id,rel.client_workspace_id,p_user_id,pg_catalog.btrim(p_responsibility),actor,'active',null,null)
 on conflict(relationship_id,assignee_user_id) do update set responsibility=excluded.responsibility,status='active',revoked_by=null,revoked_at=null,updated_at=pg_catalog.now()
 returning * into assignment;
 return pg_catalog.to_jsonb(assignment);
end; $$;

create or replace function public.revoke_agency_team_assignment(p_assignment_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); assignment public.agency_team_assignments;
begin
 select * into assignment from public.agency_team_assignments where id=p_assignment_id for update;
 if not found then raise exception using errcode='P0002',message='Assignment was not found.'; end if;
 if actor is null or not tandem_internal.has_workspace_role(assignment.agency_workspace_id,array['owner','admin']::text[]) then raise exception using errcode='42501',message='Agency team management permission is required.'; end if;
 update public.agency_team_assignments set status='revoked',revoked_by=actor,revoked_at=pg_catalog.now(),updated_at=pg_catalog.now() where id=assignment.id returning * into assignment;
 return pg_catalog.to_jsonb(assignment);
end; $$;

create or replace function public.create_workspace_invitation(p_workspace_id uuid,p_relationship_id uuid,p_email text,p_role text,p_token_hash text,p_expires_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); actor_role text; rel public.agency_client_relationships; invited_user uuid; result public.workspace_invitations;
begin
 select role into actor_role from public.workspace_memberships where workspace_id=p_workspace_id and user_id=actor;
 if actor is null or coalesce(actor_role,'') not in ('owner','admin') then raise exception using errcode='42501',message='Workspace invitation management permission is required.'; end if;
 if p_role not in ('admin','editor','viewer') or (actor_role='admin' and p_role='admin') or p_token_hash !~ '^[a-f0-9]{64}$'
   or p_expires_at <= pg_catalog.now() or p_expires_at > pg_catalog.now()+interval '14 days' then raise exception using errcode='22023',message='Invitation details are invalid.'; end if;
 if p_relationship_id is not null then
   select * into rel from public.agency_client_relationships where id=p_relationship_id and client_workspace_id=p_workspace_id and status='active' for share;
   if not found then raise exception using errcode='42501',message='An active relationship for this client workspace is required.'; end if;
   select id into invited_user from auth.users where pg_catalog.lower(email)=pg_catalog.lower(pg_catalog.btrim(p_email)) and email_confirmed_at is not null;
   if actor_role<>'owner' or not found or invited_user is null
     or not exists(select 1 from public.workspace_memberships m where m.workspace_id=rel.agency_workspace_id and m.user_id=invited_user) then
     raise exception using errcode='42501',message='Client owner may invite only a verified member of the linked agency.';
   end if;
   if p_role not in ('editor','viewer') then raise exception using errcode='22023',message='Client workspace invitations are limited to editor or viewer.'; end if;
 else
   if not exists(select 1 from public.agency_profiles where agency_workspace_id=p_workspace_id) then
     raise exception using errcode='42501',message='Agency team invitations require an authorized agency workspace.';
   end if;
 end if;
 insert into public.workspace_invitations(workspace_id,relationship_id,invited_email,invited_role,token_hash,created_by,expires_at)
 values(p_workspace_id,p_relationship_id,pg_catalog.lower(pg_catalog.btrim(p_email)),p_role,p_token_hash,actor,p_expires_at)
 returning * into result;
 return pg_catalog.jsonb_build_object('id',result.id,'workspace_id',result.workspace_id,'relationship_id',result.relationship_id,'invited_email',result.invited_email,'invited_role',result.invited_role,'status',result.status,'expires_at',result.expires_at,'created_at',result.created_at);
end; $$;

create or replace function public.revoke_workspace_invitation(p_invitation_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); invitation public.workspace_invitations;
begin
 select * into invitation from public.workspace_invitations where id=p_invitation_id for update;
 if not found then raise exception using errcode='P0002',message='Invitation was not found.'; end if;
 if actor is null or not tandem_internal.has_workspace_role(invitation.workspace_id,array['owner','admin']::text[]) then raise exception using errcode='42501',message='Invitation revocation permission is required.'; end if;
 if invitation.status<>'pending' then raise exception using errcode='22023',message='Only pending invitations can be revoked.'; end if;
 update public.workspace_invitations set status='revoked',updated_at=pg_catalog.now() where id=invitation.id returning * into invitation;
 return pg_catalog.jsonb_build_object('id',invitation.id,'workspace_id',invitation.workspace_id,'status',invitation.status);
end; $$;

create or replace function public.accept_workspace_invitation(p_token_hash text,p_action text default 'accept')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); invitation public.workspace_invitations; user_email text; confirmed_at timestamptz; existing public.workspace_memberships; membership public.workspace_memberships; rel public.agency_client_relationships;
begin
 if actor is null then raise exception using errcode='28000',message='Sign in before accepting this invitation.'; end if;
 select pg_catalog.lower(email),email_confirmed_at into user_email,confirmed_at from auth.users where id=actor;
 if confirmed_at is null or user_email is null then raise exception using errcode='42501',message='Verify the invited email address before accepting.'; end if;
 select * into invitation from public.workspace_invitations where token_hash=p_token_hash for update;
 if not found or invitation.expires_at<=pg_catalog.now() then raise exception using errcode='P0002',message='Invitation is invalid or expired.'; end if;
 if invitation.status<>'pending' or user_email<>invitation.invited_email then raise exception using errcode='42501',message='Invitation is not available to this signed-in identity.'; end if;
 if p_action='decline' then
   update public.workspace_invitations set status='declined',accepted_by=actor,accepted_at=pg_catalog.now(),updated_at=pg_catalog.now() where id=invitation.id;
   return pg_catalog.jsonb_build_object('status','declined','workspace_id',invitation.workspace_id,'invitation_id',invitation.id);
 elsif p_action<>'accept' then raise exception using errcode='22023',message='Invitation action is invalid.'; end if;
 if invitation.relationship_id is not null then
   select * into rel from public.agency_client_relationships where id=invitation.relationship_id and client_workspace_id=invitation.workspace_id and status='active' for share;
   if not found or not exists(select 1 from public.workspace_memberships m where m.workspace_id=rel.agency_workspace_id and m.user_id=actor) then
     raise exception using errcode='42501',message='Agency relationship or agency membership is no longer active.';
   end if;
 end if;
 select * into existing from public.workspace_memberships where workspace_id=invitation.workspace_id and user_id=actor for update;
 if found then
   update public.workspace_invitations set status='accepted',accepted_by=actor,accepted_at=pg_catalog.now(),updated_at=pg_catalog.now() where id=invitation.id;
   return pg_catalog.jsonb_build_object('status','accepted','workspace_id',invitation.workspace_id,'role',existing.role,'invitation_id',invitation.id,'membership_existed',true);
 end if;
 insert into public.workspace_memberships(workspace_id,user_id,role) values(invitation.workspace_id,actor,invitation.invited_role) returning * into membership;
 if invitation.relationship_id is not null then
   insert into public.agency_membership_grants(relationship_id,agency_workspace_id,client_workspace_id,user_id,membership_id,granted_role)
   values(rel.id,rel.agency_workspace_id,rel.client_workspace_id,actor,membership.id,invitation.invited_role);
 end if;
 update public.workspace_invitations set status='accepted',accepted_by=actor,accepted_at=pg_catalog.now(),updated_at=pg_catalog.now() where id=invitation.id;
 return pg_catalog.jsonb_build_object('status','accepted','workspace_id',invitation.workspace_id,'role',membership.role,'invitation_id',invitation.id);
end; $$;

create or replace function public.remove_agency_team_member(p_agency_workspace_id uuid,p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); actor_role text; target public.workspace_memberships; grant_row record;
begin
 select role into actor_role from public.workspace_memberships where workspace_id=p_agency_workspace_id and user_id=actor;
 select * into target from public.workspace_memberships where workspace_id=p_agency_workspace_id and user_id=p_user_id for update;
 if coalesce(actor_role,'') not in ('owner','admin') or target.user_id is null or target.role='owner' or (target.role='admin' and actor_role<>'owner') then
   raise exception using errcode='42501',message='Agency team revocation permission is required.';
 end if;
 for grant_row in select g.* from public.agency_membership_grants g join public.agency_client_relationships r on r.id=g.relationship_id
   where r.agency_workspace_id=p_agency_workspace_id and g.user_id=p_user_id and g.status='active' for update of g loop
   update public.agency_membership_grants set status='revoked',revoked_at=pg_catalog.now() where id=grant_row.id;
   delete from public.workspace_memberships m where m.id=grant_row.membership_id and m.workspace_id=grant_row.client_workspace_id and m.user_id=grant_row.user_id and m.role=grant_row.granted_role;
 end loop;
 update public.agency_team_assignments set status='revoked',revoked_by=actor,revoked_at=pg_catalog.now(),updated_at=pg_catalog.now()
   where agency_workspace_id=p_agency_workspace_id and assignee_user_id=p_user_id and status='active';
 delete from public.workspace_memberships where id=target.id;
 return pg_catalog.jsonb_build_object('workspace_id',p_agency_workspace_id,'user_id',p_user_id,'status','revoked');
end; $$;

create or replace function public.create_client_task(p_workspace_id uuid,p_relationship_id uuid,p_title text,p_description text,p_assigned_user_id uuid,p_due_date date,p_priority text,p_visibility text,p_resource_type text,p_resource_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); task public.client_tasks; rel public.agency_client_relationships;
begin
 if actor is null or not tandem_internal.has_workspace_role(p_workspace_id,array['owner','admin','editor']::text[]) then raise exception using errcode='42501',message='Client task management permission is required.'; end if;
 if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_title,''))) not between 2 and 180 or pg_catalog.char_length(coalesce(p_description,''))>4000
   or p_priority not in ('low','normal','high','urgent') or p_visibility not in ('agency_internal','client_visible') then raise exception using errcode='22023',message='Task details are invalid.'; end if;
 if p_assigned_user_id is not null and not exists(select 1 from public.workspace_memberships where workspace_id=p_workspace_id and user_id=p_assigned_user_id) then raise exception using errcode='42501',message='Task assignee must be a current workspace member.'; end if;
 if p_relationship_id is not null then select * into rel from public.agency_client_relationships where id=p_relationship_id and client_workspace_id=p_workspace_id and status='active'; if not found then raise exception using errcode='42501',message='An active relationship is required for this task.'; end if; end if;
 if p_visibility='agency_internal' and not tandem_internal.can_view_agency_internal(p_relationship_id,p_workspace_id) then raise exception using errcode='42501',message='Internal agency tasks require active agency membership and client membership.'; end if;
 insert into public.client_tasks(workspace_id,relationship_id,title,description,assigned_user_id,created_by,due_date,priority,visibility,related_resource_type,related_resource_id)
 values(p_workspace_id,p_relationship_id,pg_catalog.btrim(p_title),nullif(p_description,''),p_assigned_user_id,actor,p_due_date,p_priority,p_visibility,p_resource_type,p_resource_id) returning * into task;
 return pg_catalog.to_jsonb(task);
end; $$;

create or replace function public.update_client_task(p_workspace_id uuid,p_task_id uuid,p_expected_version integer,p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); task public.client_tasks;
begin
 if actor is null or not tandem_internal.has_workspace_role(p_workspace_id,array['owner','admin','editor']::text[]) then raise exception using errcode='42501',message='Client task management permission is required.'; end if;
 select * into task from public.client_tasks where id=p_task_id and workspace_id=p_workspace_id for update;
 if not found then raise exception using errcode='P0002',message='Task was not found.'; end if;
 if task.visibility='agency_internal' and not tandem_internal.can_view_agency_internal(task.relationship_id,p_workspace_id) then raise exception using errcode='P0002',message='Task was not found.'; end if;
 if task.version<>p_expected_version then raise exception using errcode='40001',message='Task changed since it was opened.'; end if;
 if p_patch ? 'assignedUserId' and p_patch->>'assignedUserId' is not null and not exists(select 1 from public.workspace_memberships where workspace_id=p_workspace_id and user_id=(p_patch->>'assignedUserId')::uuid) then raise exception using errcode='42501',message='Task assignee must remain a workspace member.'; end if;
 if coalesce(p_patch->>'visibility',task.visibility)='agency_internal' and not tandem_internal.can_view_agency_internal(task.relationship_id,p_workspace_id) then raise exception using errcode='42501',message='Internal agency task permission is required.'; end if;
 update public.client_tasks set title=coalesce(p_patch->>'title',title),description=case when p_patch ? 'description' then nullif(p_patch->>'description','') else description end,
   assigned_user_id=case when p_patch ? 'assignedUserId' then nullif(p_patch->>'assignedUserId','')::uuid else assigned_user_id end,
   due_date=case when p_patch ? 'dueDate' then nullif(p_patch->>'dueDate','')::date else due_date end,
   priority=coalesce(p_patch->>'priority',priority),status=coalesce(p_patch->>'status',status),visibility=coalesce(p_patch->>'visibility',visibility),
   version=version+1,updated_at=pg_catalog.now() where id=task.id returning * into task;
 return pg_catalog.to_jsonb(task);
end; $$;

create or replace function public.create_client_comment(p_workspace_id uuid,p_relationship_id uuid,p_resource_type text,p_resource_id uuid,p_parent_id uuid,p_visibility text,p_body text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); comment_row public.client_collaboration_comments;
begin
 if actor is null or not tandem_internal.has_workspace_role(p_workspace_id,array['owner','admin','editor']::text[]) then raise exception using errcode='42501',message='Client collaboration permission is required.'; end if;
 if p_resource_type not in ('campaign','creative','report','task','workspace') or p_visibility not in ('agency_internal','client_visible') or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_body,''))) not between 1 and 5000 then raise exception using errcode='22023',message='Comment details are invalid.'; end if;
 if p_relationship_id is not null and not exists(select 1 from public.agency_client_relationships r where r.id=p_relationship_id and r.client_workspace_id=p_workspace_id and r.status='active') then raise exception using errcode='42501',message='An active client relationship is required.'; end if;
 if p_visibility='agency_internal' and not tandem_internal.can_view_agency_internal(p_relationship_id,p_workspace_id) then raise exception using errcode='42501',message='Internal notes require active agency membership and client membership.'; end if;
 if p_parent_id is not null and not exists(select 1 from public.client_collaboration_comments c where c.id=p_parent_id and c.workspace_id=p_workspace_id and (c.visibility='client_visible' or tandem_internal.can_view_agency_internal(c.relationship_id,p_workspace_id))) then raise exception using errcode='42501',message='Reply target is not accessible.'; end if;
 insert into public.client_collaboration_comments(workspace_id,relationship_id,related_resource_type,related_resource_id,parent_comment_id,author_user_id,visibility,body)
 values(p_workspace_id,p_relationship_id,p_resource_type,p_resource_id,p_parent_id,actor,p_visibility,pg_catalog.btrim(p_body)) returning * into comment_row;
 return pg_catalog.to_jsonb(comment_row);
end; $$;

create or replace function public.resolve_client_comment(p_workspace_id uuid,p_comment_id uuid,p_resolve boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); comment_row public.client_collaboration_comments;
begin
 if actor is null or not tandem_internal.has_workspace_role(p_workspace_id,array['owner','admin','editor']::text[]) then raise exception using errcode='42501',message='Comment management permission is required.'; end if;
 select * into comment_row from public.client_collaboration_comments where id=p_comment_id and workspace_id=p_workspace_id
   and (visibility='client_visible' or tandem_internal.can_view_agency_internal(relationship_id,p_workspace_id)) for update;
 if not found then raise exception using errcode='P0002',message='Comment was not found.'; end if;
 update public.client_collaboration_comments set resolved_at=case when p_resolve then pg_catalog.now() else null end,resolved_by=case when p_resolve then actor else null end,updated_at=pg_catalog.now()
 where id=p_comment_id and workspace_id=p_workspace_id returning * into comment_row;
 return pg_catalog.to_jsonb(comment_row);
end; $$;

-- Polymorphic resource references are verified under a narrow definer trigger
-- so a client record cannot point at another workspace's campaign/creative/report.
create or replace function tandem_internal.validate_client_resource_reference()
returns trigger language plpgsql security definer set search_path = '' as $$
declare exists_in_workspace boolean := true;
begin
 if new.relationship_id is not null and not exists(select 1 from public.agency_client_relationships rel where rel.id=new.relationship_id and rel.client_workspace_id=new.workspace_id) then
   raise exception using errcode='23503',message='Relationship must belong to the client workspace.';
 end if;
 if new.related_resource_id is null then return new; end if;
 if tg_table_name='client_tasks' then
   if new.related_resource_type='campaign' then select exists(select 1 from public.campaigns where id=new.related_resource_id and workspace_id=new.workspace_id) into exists_in_workspace;
   elsif new.related_resource_type='creative' then select exists(select 1 from public.creative_projects where id=new.related_resource_id and workspace_id=new.workspace_id) into exists_in_workspace;
   elsif new.related_resource_type='report' then select exists(select 1 from public.report_definitions where id=new.related_resource_id and workspace_id=new.workspace_id) into exists_in_workspace; end if;
 else
   if new.related_resource_type='campaign' then select exists(select 1 from public.campaigns where id=new.related_resource_id and workspace_id=new.workspace_id) into exists_in_workspace;
   elsif new.related_resource_type='creative' then select exists(select 1 from public.creative_projects where id=new.related_resource_id and workspace_id=new.workspace_id) into exists_in_workspace;
   elsif new.related_resource_type='report' then select exists(select 1 from public.report_definitions where id=new.related_resource_id and workspace_id=new.workspace_id) into exists_in_workspace;
   elsif new.related_resource_type='task' then select exists(select 1 from public.client_tasks where id=new.related_resource_id and workspace_id=new.workspace_id) into exists_in_workspace;
   elsif new.related_resource_type='workspace' then exists_in_workspace := new.related_resource_id=new.workspace_id; end if;
 end if;
 if not exists_in_workspace then raise exception using errcode='23503',message='Related resource must belong to this workspace.'; end if;
 return new;
end; $$;
create trigger client_tasks_resource_scope before insert or update of related_resource_type,related_resource_id,workspace_id on public.client_tasks for each row execute function tandem_internal.validate_client_resource_reference();
create trigger client_comments_resource_scope before insert or update of related_resource_type,related_resource_id,workspace_id on public.client_collaboration_comments for each row execute function tandem_internal.validate_client_resource_reference();

create or replace function tandem_internal.record_agency_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); agency_id uuid; client_id uuid; rel_id uuid; event_action text; target_kind text; target_uuid uuid; visible text; safe_summary jsonb;
begin
 if tg_table_name='agency_client_relationships' then
   agency_id:=coalesce(new.agency_workspace_id,old.agency_workspace_id); client_id:=coalesce(new.client_workspace_id,old.client_workspace_id); rel_id:=coalesce(new.id,old.id); target_kind:='relationship'; target_uuid:=rel_id;
   if tg_op='INSERT' then event_action:='collaboration_requested'; visible:='client_visible'; safe_summary:=pg_catalog.jsonb_build_object('status','pending');
   else event_action:='collaboration_'||coalesce(new.decision,'updated'); visible:='client_visible'; safe_summary:=pg_catalog.jsonb_build_object('status',new.status,'decision',new.decision); end if;
 elsif tg_table_name='agency_team_assignments' then
   agency_id:=coalesce(new.agency_workspace_id,old.agency_workspace_id); client_id:=coalesce(new.client_workspace_id,old.client_workspace_id); rel_id:=coalesce(new.relationship_id,old.relationship_id); target_kind:='assignment'; target_uuid:=coalesce(new.id,old.id); event_action:=case when tg_op='INSERT' then 'team_assigned' else 'team_assignment_updated' end; visible:='client_visible'; safe_summary:=pg_catalog.jsonb_build_object('status',coalesce(new.status,old.status),'responsibility',coalesce(new.responsibility,old.responsibility));
 elsif tg_table_name='workspace_invitations' then
   target_kind:='invitation'; target_uuid:=coalesce(new.id,old.id); event_action:='invitation_'||coalesce(new.status,old.status); safe_summary:=pg_catalog.jsonb_build_object('status',coalesce(new.status,old.status),'role',coalesce(new.invited_role,old.invited_role));
   select rel.agency_workspace_id,rel.client_workspace_id,rel.id into agency_id,client_id,rel_id from public.agency_client_relationships rel where rel.id=coalesce(new.relationship_id,old.relationship_id);
   if agency_id is null then
      if exists(select 1 from public.agency_profiles p where p.agency_workspace_id=coalesce(new.workspace_id,old.workspace_id)) then agency_id:=coalesce(new.workspace_id,old.workspace_id); else client_id:=coalesce(new.workspace_id,old.workspace_id); end if;
   end if;
   visible:=case when agency_id is not null then 'agency_only' else 'client_visible' end;
 elsif tg_table_name='client_tasks' then
   client_id:=coalesce(new.workspace_id,old.workspace_id); rel_id:=coalesce(new.relationship_id,old.relationship_id); target_kind:='task'; target_uuid:=coalesce(new.id,old.id); event_action:=case when tg_op='INSERT' then 'task_created' else 'task_updated' end; visible:=coalesce(new.visibility,old.visibility); safe_summary:=pg_catalog.jsonb_build_object('status',coalesce(new.status,old.status),'priority',coalesce(new.priority,old.priority));
   if rel_id is not null then select agency_workspace_id into agency_id from public.agency_client_relationships where id=rel_id; end if;
 elsif tg_table_name='client_collaboration_comments' then
   client_id:=coalesce(new.workspace_id,old.workspace_id); rel_id:=coalesce(new.relationship_id,old.relationship_id); target_kind:='comment'; target_uuid:=coalesce(new.id,old.id); event_action:='comment_created'; visible:=coalesce(new.visibility,old.visibility); safe_summary:=pg_catalog.jsonb_build_object('resource_type',coalesce(new.related_resource_type,old.related_resource_type));
   if rel_id is not null then select agency_workspace_id into agency_id from public.agency_client_relationships where id=rel_id; end if;
 else return coalesce(new,old); end if;
 if agency_id is not null or client_id is not null then
   insert into public.agency_activity_events(agency_workspace_id,client_workspace_id,relationship_id,actor_user_id,action_type,target_type,target_id,visibility,summary)
   values(agency_id,client_id,rel_id,actor,event_action,target_kind,target_uuid,case when visible='agency_internal' then 'agency_only' else visible end,coalesce(safe_summary,'{}'::jsonb));
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
create trigger agency_relationship_activity after insert or update on public.agency_client_relationships for each row execute function tandem_internal.record_agency_activity();
create trigger agency_assignment_activity after insert or update on public.agency_team_assignments for each row execute function tandem_internal.record_agency_activity();
create trigger agency_invitation_activity after insert or update on public.workspace_invitations for each row execute function tandem_internal.record_agency_activity();
create trigger client_task_activity after insert or update on public.client_tasks for each row execute function tandem_internal.record_agency_activity();
create trigger client_comment_activity after insert on public.client_collaboration_comments for each row execute function tandem_internal.record_agency_activity();

create or replace function tandem_internal.notify_agency_client_changes()
returns trigger language plpgsql security definer set search_path = '' as $$
declare rel public.agency_client_relationships; assigned uuid;
begin
 if tg_table_name='agency_client_relationships' then
   rel:=new;
   if tg_op='INSERT' then perform tandem_internal.notify_workspace_members(rel.client_workspace_id,null,'agency_collaboration','Agency collaboration request','An agency requested a workspace relationship. Review it in the client portal.','/app/client/overview','agency-request:'||rel.id::text,array['owner','admin']::text[]);
   elsif new.status is distinct from old.status then perform tandem_internal.notify_workspace_members(rel.agency_workspace_id,null,'agency_collaboration','Client relationship updated','A client workspace updated the collaboration relationship.','/app/agency/clients','agency-state:'||rel.id::text||':'||rel.status,array['owner','admin']::text[]); end if;
 elsif tg_table_name='client_tasks' and tg_op='INSERT' and new.assigned_user_id is not null then
   insert into public.workspace_notifications(workspace_id,recipient_user_id,notification_type,title,body,href,dedupe_key)
   values(new.workspace_id,new.assigned_user_id,'client_task','Task assigned','A workspace task was assigned to you.','/app/client/tasks','client-task:'||new.id::text)
   on conflict(workspace_id,recipient_user_id,dedupe_key) do nothing;
 elsif tg_table_name='client_collaboration_comments' and tg_op='INSERT' and new.visibility='client_visible' and new.relationship_id is not null then
   select * into rel from public.agency_client_relationships where id=new.relationship_id and status='active';
   if found then
     if exists(select 1 from public.workspace_memberships where workspace_id=rel.agency_workspace_id and user_id=new.author_user_id) then
       perform tandem_internal.notify_workspace_members(rel.client_workspace_id,null,'client_comment','New client comment','A client-visible discussion has a new comment.','/app/client/overview','comment:'||new.id::text,array['owner','admin','editor']::text[]);
     else perform tandem_internal.notify_workspace_members(rel.agency_workspace_id,null,'client_comment','New client comment','A client workspace added feedback.','/app/agency/clients','comment:'||new.id::text,array['owner','admin','editor']::text[]); end if;
   end if;
 end if;
 return coalesce(new,old);
end; $$;
create trigger agency_relationship_notifications after insert or update of status on public.agency_client_relationships for each row execute function tandem_internal.notify_agency_client_changes();
create trigger client_task_notifications after insert on public.client_tasks for each row execute function tandem_internal.notify_agency_client_changes();
create trigger client_comment_notifications after insert on public.client_collaboration_comments for each row execute function tandem_internal.notify_agency_client_changes();

create or replace function public.agency_overview_counts(p_agency_workspace_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); authorized_client_ids uuid[]; result jsonb;
begin
 if actor is null or not tandem_internal.has_workspace_role(p_agency_workspace_id,null::text[]) or not exists(select 1 from public.agency_profiles where agency_workspace_id=p_agency_workspace_id) then raise exception using errcode='42501',message='Agency workspace access is required.'; end if;
 select coalesce(pg_catalog.array_agg(rel.client_workspace_id),array[]::uuid[]) into authorized_client_ids
 from public.agency_client_relationships rel join public.workspace_memberships member on member.workspace_id=rel.client_workspace_id and member.user_id=actor
 where rel.agency_workspace_id=p_agency_workspace_id and rel.status='active';
 select pg_catalog.jsonb_build_object(
   'authorized_client_count',pg_catalog.cardinality(authorized_client_ids),
   'campaign_count',coalesce((select pg_catalog.count(*) from public.campaigns c where c.workspace_id=any(authorized_client_ids) and c.archived_at is null),0),
   'pending_campaign_reviews',coalesce((select pg_catalog.count(*) from public.campaigns c where c.workspace_id=any(authorized_client_ids) and c.lifecycle_status='needs_review'),0),
   'open_tasks',coalesce((select pg_catalog.count(*) from public.client_tasks t where t.workspace_id=any(authorized_client_ids) and t.status not in ('done','cancelled') and (t.visibility='client_visible' or tandem_internal.can_view_agency_internal(t.relationship_id,t.workspace_id))),0)
 ) into result;
 return result;
end; $$;

create or replace function public.client_portal_overview(p_client_workspace_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); result jsonb; rel record;
begin
 if actor is null or not tandem_internal.has_workspace_role(p_client_workspace_id,null::text[]) then raise exception using errcode='42501',message='Client workspace membership is required.'; end if;
 select pg_catalog.jsonb_build_object(
   'campaign_count',coalesce((select pg_catalog.count(*) from public.campaigns c where c.workspace_id=p_client_workspace_id and c.archived_at is null),0),
   'pending_campaign_reviews',coalesce((select pg_catalog.count(*) from public.campaigns c where c.workspace_id=p_client_workspace_id and c.lifecycle_status='needs_review'),0),
   'creative_review_count',coalesce((select pg_catalog.count(*) from public.creative_projects c where c.workspace_id=p_client_workspace_id and c.lifecycle_status='needs_review'),0),
   'open_task_count',coalesce((select pg_catalog.count(*) from public.client_tasks t where t.workspace_id=p_client_workspace_id and t.visibility='client_visible' and t.status not in ('done','cancelled')),0)
 ) into result;
 select r.id,r.agency_workspace_id,r.status,r.created_at into rel from public.agency_client_relationships r where r.client_workspace_id=p_client_workspace_id and r.status in ('pending','active','paused') and (r.status<>'pending' or r.request_direction='agency_to_client') order by r.created_at desc limit 1;
 if found and (rel.status<>'pending' or tandem_internal.has_workspace_role(p_client_workspace_id,array['owner','admin']::text[])) then
   result:=result||pg_catalog.jsonb_build_object('agencyRelationship',pg_catalog.jsonb_build_object('id',rel.id,'agencyWorkspaceId',rel.agency_workspace_id,'status',rel.status,'createdAt',rel.created_at));
 end if;
 return result;
end; $$;

-- Grant only the RPC surface. Every write function resolves the caller from
-- auth.uid(); caller-supplied workspace IDs are checked against memberships.
revoke all on function public.save_agency_profile(uuid,text,text,jsonb), public.request_agency_client_relationship(uuid,uuid),public.request_client_agency_relationship(uuid,uuid),
  public.transition_agency_client_relationship(uuid,text), public.create_agency_team_assignment(uuid,uuid,text),
  public.revoke_agency_team_assignment(uuid), public.create_workspace_invitation(uuid,uuid,text,text,text,timestamptz),
  public.revoke_workspace_invitation(uuid), public.accept_workspace_invitation(text,text), public.remove_agency_team_member(uuid,uuid),
  public.create_client_task(uuid,uuid,text,text,uuid,date,text,text,text,uuid), public.update_client_task(uuid,uuid,integer,jsonb),
  public.create_client_comment(uuid,uuid,text,uuid,uuid,text,text), public.resolve_client_comment(uuid,uuid,boolean),
  public.agency_overview_counts(uuid), public.client_portal_overview(uuid)
from public,anon,authenticated,service_role;
grant execute on function public.save_agency_profile(uuid,text,text,jsonb), public.request_agency_client_relationship(uuid,uuid),public.request_client_agency_relationship(uuid,uuid),
  public.transition_agency_client_relationship(uuid,text), public.create_agency_team_assignment(uuid,uuid,text),
  public.revoke_agency_team_assignment(uuid), public.create_workspace_invitation(uuid,uuid,text,text,text,timestamptz),
  public.revoke_workspace_invitation(uuid), public.accept_workspace_invitation(text,text), public.remove_agency_team_member(uuid,uuid),
  public.create_client_task(uuid,uuid,text,text,uuid,date,text,text,text,uuid), public.update_client_task(uuid,uuid,integer,jsonb),
  public.create_client_comment(uuid,uuid,text,uuid,uuid,text,text), public.resolve_client_comment(uuid,uuid,boolean),
  public.agency_overview_counts(uuid), public.client_portal_overview(uuid)
to authenticated;

revoke all on function tandem_internal.can_view_agency_internal(uuid,uuid), tandem_internal.validate_client_resource_reference(),
  tandem_internal.record_agency_activity(), tandem_internal.notify_agency_client_changes() from public,anon,authenticated,service_role;
grant execute on function tandem_internal.can_view_agency_internal(uuid,uuid) to authenticated;

commit;
