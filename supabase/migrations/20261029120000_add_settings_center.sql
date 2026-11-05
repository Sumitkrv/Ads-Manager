begin;

create or replace function tandem_internal.notification_preferences_are_valid(p_value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case when pg_catalog.jsonb_typeof(p_value) <> 'object' then false else
    p_value ?& array[
      'campaign_reviews','creative_reviews','automation_activity','usage_limit_alerts',
      'subscription_events','agency_collaboration','client_approvals','team_invitations','support_cases'
    ] and not exists (
      select 1
      from pg_catalog.jsonb_each(p_value) as preference(key, value)
      where preference.key not in (
        'campaign_reviews', 'creative_reviews', 'automation_activity',
        'usage_limit_alerts', 'subscription_events', 'agency_collaboration',
        'client_approvals', 'team_invitations', 'support_cases'
      )
      or pg_catalog.jsonb_typeof(preference.value) <> 'boolean'
    ) end;
$$;
revoke all on function tandem_internal.notification_preferences_are_valid(jsonb) from public, anon, authenticated, service_role;

create or replace function tandem_internal.touch_settings_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at:=pg_catalog.now();
  return new;
end; $$;
revoke all on function tandem_internal.touch_settings_updated_at() from public, anon, authenticated, service_role;

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme_preference text not null default 'system' check (theme_preference in ('light','dark','system')),
  preferred_language text not null default 'en' check (preferred_language = 'en'),
  timezone text not null default 'UTC' check (pg_catalog.char_length(pg_catalog.btrim(timezone)) between 1 and 100),
  date_format text not null default 'local' check (date_format in ('local','iso','mdy','dmy')),
  time_format text not null default '24h' check (time_format in ('12h','24h')),
  display_currency text not null default 'USD' check (display_currency ~ '^[A-Z]{3}$'),
  notification_preferences jsonb not null default '{"campaign_reviews":true,"creative_reviews":true,"automation_activity":true,"usage_limit_alerts":true,"subscription_events":true,"agency_collaboration":true,"client_approvals":true,"team_invitations":true,"support_cases":true}'::jsonb,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint user_preferences_notifications_valid check (tandem_internal.notification_preferences_are_valid(notification_preferences))
);
alter table public.user_preferences enable row level security;
revoke all on public.user_preferences from public, anon, authenticated, service_role;
grant select on public.user_preferences to authenticated;
grant insert (user_id,theme_preference,preferred_language,timezone,date_format,time_format,display_currency,notification_preferences)
  on public.user_preferences to authenticated;
grant update (theme_preference,preferred_language,timezone,date_format,time_format,display_currency,notification_preferences)
  on public.user_preferences to authenticated;
create policy user_preferences_select_own on public.user_preferences for select to authenticated using (user_id=(select auth.uid()));
create policy user_preferences_insert_own on public.user_preferences for insert to authenticated with check (user_id=(select auth.uid()));
create policy user_preferences_update_own on public.user_preferences for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create trigger user_preferences_touch_updated_at before update on public.user_preferences for each row execute function tandem_internal.touch_settings_updated_at();

create table public.workspace_preferences (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  business_description text not null default '' check (pg_catalog.char_length(business_description)<=1200),
  business_category text not null default '' check (pg_catalog.char_length(business_category)<=120),
  operating_region text not null default '' check (pg_catalog.char_length(operating_region)<=120),
  default_currency text not null default 'USD' check (default_currency ~ '^[A-Z]{3}$'),
  default_landing_page text not null default 'overview' check (default_landing_page in ('overview','campaigns','analytics','reports')),
  default_campaign_format text not null default 'google_search' check (default_campaign_format in ('google_search','meta_social','mixed')),
  default_report_date_range text not null default '30d' check (default_report_date_range in ('7d','30d','90d')),
  default_marketing_objective text not null default 'leads' check (default_marketing_objective in ('leads','sales','traffic','awareness','engagement')),
  display_density text not null default 'comfortable' check (display_density in ('comfortable','compact')),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);
alter table public.workspace_preferences enable row level security;
revoke all on public.workspace_preferences from public, anon, authenticated, service_role;
grant select on public.workspace_preferences to authenticated;
grant insert (workspace_id,business_description,business_category,operating_region,default_currency,default_landing_page,default_campaign_format,default_report_date_range,default_marketing_objective,display_density)
  on public.workspace_preferences to authenticated;
grant update (business_description,business_category,operating_region,default_currency,default_landing_page,default_campaign_format,default_report_date_range,default_marketing_objective,display_density)
  on public.workspace_preferences to authenticated;
create policy workspace_preferences_member_read on public.workspace_preferences for select to authenticated
  using (tandem_internal.has_workspace_role(workspace_id,null::text[]));
create policy workspace_preferences_admin_insert on public.workspace_preferences for insert to authenticated
  with check (tandem_internal.has_workspace_role(workspace_id,array['owner','admin']::text[]));
create policy workspace_preferences_admin_update on public.workspace_preferences for update to authenticated
  using (tandem_internal.has_workspace_role(workspace_id,array['owner','admin']::text[]))
  with check (tandem_internal.has_workspace_role(workspace_id,array['owner','admin']::text[]));
create trigger workspace_preferences_touch_updated_at before update on public.workspace_preferences for each row execute function tandem_internal.touch_settings_updated_at();

create table public.workspace_settings_audit (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('workspace_settings_updated','workspace_preferences_updated','member_role_changed','member_removed','invitation_created','invitation_status_changed','closure_requested')),
  changed_fields text[] not null default '{}',
  created_at timestamptz not null default pg_catalog.now(),
  constraint workspace_settings_audit_fields_safe check (pg_catalog.cardinality(changed_fields) <= 32)
);
create index workspace_settings_audit_recent_idx on public.workspace_settings_audit(workspace_id,created_at desc);
alter table public.workspace_settings_audit enable row level security;
revoke all on public.workspace_settings_audit from public, anon, authenticated, service_role;
grant select on public.workspace_settings_audit to authenticated;
create policy workspace_settings_audit_admin_read on public.workspace_settings_audit for select to authenticated
  using (tandem_internal.has_workspace_role(workspace_id,array['owner','admin']::text[]));

create or replace function tandem_internal.audit_workspace_preferences_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare changed text[] := array[]::text[];
begin
  if tg_op='INSERT' then
    changed:=array['business_description','business_category','operating_region','default_currency','default_landing_page','default_campaign_format','default_report_date_range','default_marketing_objective','display_density'];
  else
    if new.business_description is distinct from old.business_description then changed:=pg_catalog.array_append(changed,'business_description'); end if;
    if new.business_category is distinct from old.business_category then changed:=pg_catalog.array_append(changed,'business_category'); end if;
    if new.operating_region is distinct from old.operating_region then changed:=pg_catalog.array_append(changed,'operating_region'); end if;
    if new.default_currency is distinct from old.default_currency then changed:=pg_catalog.array_append(changed,'default_currency'); end if;
    if new.default_landing_page is distinct from old.default_landing_page then changed:=pg_catalog.array_append(changed,'default_landing_page'); end if;
    if new.default_campaign_format is distinct from old.default_campaign_format then changed:=pg_catalog.array_append(changed,'default_campaign_format'); end if;
    if new.default_report_date_range is distinct from old.default_report_date_range then changed:=pg_catalog.array_append(changed,'default_report_date_range'); end if;
    if new.default_marketing_objective is distinct from old.default_marketing_objective then changed:=pg_catalog.array_append(changed,'default_marketing_objective'); end if;
    if new.display_density is distinct from old.display_density then changed:=pg_catalog.array_append(changed,'display_density'); end if;
  end if;
  if pg_catalog.cardinality(changed)>0 then
    insert into public.workspace_settings_audit(workspace_id,actor_user_id,action,changed_fields)
    values(new.workspace_id,(select auth.uid()),'workspace_preferences_updated',changed);
  end if;
  return new;
end;
$$;
revoke all on function tandem_internal.audit_workspace_preferences_update() from public,anon,authenticated,service_role;
create trigger workspace_preferences_audit after insert or update on public.workspace_preferences
  for each row execute function tandem_internal.audit_workspace_preferences_update();

create table public.account_closure_requests (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  scope text not null check (scope in ('account','workspace')),
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  status text not null default 'pending_review' check (status in ('pending_review','reviewed','cancelled')),
  created_at timestamptz not null default pg_catalog.now(),
  reviewed_at timestamptz,
  constraint account_closure_scope_consistent check ((scope='account' and workspace_id is null) or (scope='workspace' and workspace_id is not null))
);
create unique index account_closure_one_pending_account on public.account_closure_requests(requester_user_id)
  where scope='account' and status='pending_review';
create unique index account_closure_one_pending_workspace on public.account_closure_requests(workspace_id)
  where scope='workspace' and status='pending_review';
alter table public.account_closure_requests enable row level security;
revoke all on public.account_closure_requests from public, anon, authenticated, service_role;
grant select on public.account_closure_requests to authenticated;
create policy account_closure_requester_read on public.account_closure_requests for select to authenticated
  using ((scope='account' and requester_user_id=(select auth.uid()))
    or (scope='workspace' and tandem_internal.has_workspace_role(workspace_id,array['owner','admin']::text[])));

create or replace function tandem_internal.can_view_workspace_profile(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id=(select auth.uid()) or exists (
    select 1 from public.workspace_memberships actor_membership
    join public.workspace_memberships target_membership on target_membership.workspace_id=actor_membership.workspace_id
    where actor_membership.user_id=(select auth.uid()) and target_membership.user_id=p_user_id
  );
$$;
revoke all on function tandem_internal.can_view_workspace_profile(uuid) from public, anon, authenticated, service_role;
grant execute on function tandem_internal.can_view_workspace_profile(uuid) to authenticated;
create policy profiles_select_workspace_colleagues on public.profiles for select to authenticated
  using (tandem_internal.can_view_workspace_profile(user_id));

create or replace function public.workspace_team_member_identities(p_workspace_id uuid)
returns table(user_id uuid,verified_email text,email_verified boolean)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not tandem_internal.has_workspace_role(p_workspace_id,array['owner','admin']::text[]) then
    raise exception using errcode='42501',message='Workspace member identity access is restricted to owners and admins.';
  end if;
  return query
    select membership.user_id,
      case when auth_user.email_confirmed_at is not null then auth_user.email else null end,
      auth_user.email_confirmed_at is not null
    from public.workspace_memberships membership
    left join auth.users auth_user on auth_user.id=membership.user_id
    where membership.workspace_id=p_workspace_id
    order by membership.created_at asc
    limit 500;
end;
$$;
revoke all on function public.workspace_team_member_identities(uuid) from public,anon,authenticated,service_role;
grant execute on function public.workspace_team_member_identities(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('tandem-user-avatars','tandem-user-avatars',false,2097152,array['image/png','image/jpeg','image/webp'])
on conflict(id) do nothing;
create policy tandem_user_avatar_select on storage.objects for select to authenticated using (
  bucket_id='tandem-user-avatars'
  and case when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then (storage.foldername(name))[1]=(select auth.uid())::text or tandem_internal.can_view_workspace_profile(((storage.foldername(name))[1])::uuid)
    else false end
);
create policy tandem_user_avatar_insert_own on storage.objects for insert to authenticated with check (
  bucket_id='tandem-user-avatars'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and storage.filename(name) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](png|jpg|webp)$'
);
create policy tandem_user_avatar_delete_own on storage.objects for delete to authenticated using (
  bucket_id='tandem-user-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text
);

create or replace function tandem_internal.audit_workspace_settings_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare changed text[] := array[]::text[];
begin
  if new.name is distinct from old.name then changed:=pg_catalog.array_append(changed,'name'); end if;
  if new.industry_key is distinct from old.industry_key or new.industry_custom_label is distinct from old.industry_custom_label then changed:=pg_catalog.array_append(changed,'industry'); end if;
  if new.website_url is distinct from old.website_url then changed:=pg_catalog.array_append(changed,'website_url'); end if;
  if new.country_code is distinct from old.country_code then changed:=pg_catalog.array_append(changed,'country_code'); end if;
  if new.timezone is distinct from old.timezone then changed:=pg_catalog.array_append(changed,'timezone'); end if;
  if new.logo_url is distinct from old.logo_url then changed:=pg_catalog.array_append(changed,'logo_url'); end if;
  if pg_catalog.cardinality(changed)>0 then
    insert into public.workspace_settings_audit(workspace_id,actor_user_id,action,changed_fields)
    values(new.id,(select auth.uid()),'workspace_settings_updated',changed);
  end if;
  return new;
end;
$$;
revoke all on function tandem_internal.audit_workspace_settings_update() from public, anon, authenticated, service_role;
create trigger workspaces_settings_audit after update of name,industry_key,industry_custom_label,website_url,country_code,timezone,logo_url
  on public.workspaces for each row execute function tandem_internal.audit_workspace_settings_update();

create or replace function tandem_internal.audit_workspace_invitation_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op='INSERT' then
    insert into public.workspace_settings_audit(workspace_id,actor_user_id,action,changed_fields)
    values(new.workspace_id,(select auth.uid()),'invitation_created',array['invitation']);
  elsif new.status is distinct from old.status then
    insert into public.workspace_settings_audit(workspace_id,actor_user_id,action,changed_fields)
    values(new.workspace_id,(select auth.uid()),'invitation_status_changed',array['invitation_status']);
  end if;
  return new;
end;
$$;
revoke all on function tandem_internal.audit_workspace_invitation_change() from public, anon, authenticated, service_role;
create trigger workspace_invitations_settings_audit after insert or update of status on public.workspace_invitations
  for each row execute function tandem_internal.audit_workspace_invitation_change();

create or replace function public.create_workspace_invitation(p_workspace_id uuid,p_relationship_id uuid,p_email text,p_role text,p_token_hash text,p_expires_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); actor_role text; rel public.agency_client_relationships; invited_user uuid; result public.workspace_invitations; clean_email text;
  billing jsonb; seat_limit bigint; used_seats bigint; pending_seats bigint;
begin
  perform 1 from public.workspaces where id=p_workspace_id for update;
  if not found then raise exception using errcode='P0002',message='Workspace was not found.'; end if;
  select role into actor_role from public.workspace_memberships where workspace_id=p_workspace_id and user_id=actor;
  if actor is null or coalesce(actor_role,'') not in ('owner','admin') then
    raise exception using errcode='42501',message='Workspace invitation management permission is required.';
  end if;
  clean_email:=pg_catalog.lower(pg_catalog.btrim(p_email));
  if clean_email is null or pg_catalog.char_length(clean_email)>320 or clean_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_role is null or p_role not in ('admin','editor','viewer') or (actor_role='admin' and p_role='admin')
    or p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' or p_expires_at is null or p_expires_at<=pg_catalog.now() or p_expires_at>pg_catalog.now()+interval '14 days' then
    raise exception using errcode='22023',message='Invitation details are invalid.';
  end if;
  if p_relationship_id is not null then
    select * into rel from public.agency_client_relationships where id=p_relationship_id and client_workspace_id=p_workspace_id and status='active' for share;
    if not found then raise exception using errcode='42501',message='An active relationship for this client workspace is required.'; end if;
    select id into invited_user from auth.users where pg_catalog.lower(email)=clean_email and email_confirmed_at is not null;
    if actor_role<>'owner' or not found or invited_user is null
      or not exists(select 1 from public.workspace_memberships m where m.workspace_id=rel.agency_workspace_id and m.user_id=invited_user) then
      raise exception using errcode='42501',message='Client owner may invite only a verified member of the linked agency.';
    end if;
    if p_role not in ('editor','viewer') then raise exception using errcode='22023',message='Client workspace invitations are limited to editor or viewer.'; end if;
  else
    update public.workspace_invitations set status='revoked',updated_at=pg_catalog.now()
    where workspace_id=p_workspace_id and relationship_id is null and invited_email=clean_email and status='pending';
  end if;
  billing:=public.billing_workspace_summary(p_workspace_id);
  seat_limit:=nullif(billing->'limits'->>'seats','')::bigint;
  used_seats:=coalesce((billing->'usage'->>'seats')::bigint,0);
  select count(*) into pending_seats from public.workspace_invitations
    where workspace_id=p_workspace_id and status='pending' and expires_at>pg_catalog.now();
  if seat_limit is not null and seat_limit>=0 and used_seats+pending_seats>=seat_limit then
    raise exception using errcode='23514',message='The current plan has no available seats for another invitation.';
  end if;
  insert into public.workspace_invitations(workspace_id,relationship_id,invited_email,invited_role,token_hash,created_by,expires_at)
  values(p_workspace_id,p_relationship_id,clean_email,p_role,p_token_hash,actor,p_expires_at) returning * into result;
  return pg_catalog.jsonb_build_object('id',result.id,'workspace_id',result.workspace_id,'relationship_id',result.relationship_id,'invited_email',result.invited_email,'invited_role',result.invited_role,'status',result.status,'expires_at',result.expires_at,'created_at',result.created_at);
end; $$;

create or replace function public.accept_workspace_invitation(p_token_hash text,p_action text default 'accept')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid:=(select auth.uid()); invitation public.workspace_invitations; user_email text; confirmed_at timestamptz; existing public.workspace_memberships; membership public.workspace_memberships; rel public.agency_client_relationships;
begin
  if actor is null then raise exception using errcode='28000',message='Sign in before accepting this invitation.'; end if;
  select pg_catalog.lower(email),email_confirmed_at into user_email,confirmed_at from auth.users where id=actor;
  if confirmed_at is null or user_email is null then raise exception using errcode='42501',message='Verify the invited email address before accepting.'; end if;
  select * into invitation from public.workspace_invitations where token_hash=p_token_hash for update;
  if not found then raise exception using errcode='P0002',message='Invitation is invalid or expired.'; end if;
  if user_email<>invitation.invited_email then raise exception using errcode='42501',message='Invitation is not available to this signed-in identity.'; end if;
  if p_action is null or p_action not in ('accept','decline') then raise exception using errcode='22023',message='Invitation action is invalid.'; end if;
  if p_action='accept' and invitation.status='accepted' and invitation.accepted_by=actor then
    return pg_catalog.jsonb_build_object('status','accepted','workspace_id',invitation.workspace_id,'role',invitation.invited_role,'invitation_id',invitation.id,'idempotent_replay',true);
  end if;
  if invitation.expires_at<=pg_catalog.now() then raise exception using errcode='P0002',message='Invitation is invalid or expired.'; end if;
  if invitation.status<>'pending' then raise exception using errcode='42501',message='Invitation is not available to this signed-in identity.'; end if;
  if p_action='decline' then
    update public.workspace_invitations set status='declined',accepted_by=actor,accepted_at=pg_catalog.now(),updated_at=pg_catalog.now() where id=invitation.id;
    return pg_catalog.jsonb_build_object('status','declined','workspace_id',invitation.workspace_id,'invitation_id',invitation.id);
  end if;
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

create or replace function public.update_workspace_member_role(p_workspace_id uuid,p_user_id uuid,p_role text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid:=(select auth.uid()); actor_role text; target public.workspace_memberships;
begin
  perform 1 from public.workspaces where id=p_workspace_id for update;
  if not found then raise exception using errcode='P0002',message='Workspace was not found.'; end if;
  select role into actor_role from public.workspace_memberships where workspace_id=p_workspace_id and user_id=actor;
  if actor is null or coalesce(actor_role,'') not in ('owner','admin') then raise exception using errcode='42501',message='Workspace member administration is required.'; end if;
  select * into target from public.workspace_memberships where workspace_id=p_workspace_id and user_id=p_user_id for update;
  if target.id is null then raise exception using errcode='P0002',message='Workspace member was not found.'; end if;
  if p_user_id=actor or target.role='owner' then raise exception using errcode='42501',message='Self changes and owner role changes are unavailable.'; end if;
  if p_role is null or p_role not in ('admin','editor','viewer') or (actor_role='admin' and (p_role='admin' or target.role='admin')) then
    raise exception using errcode='42501',message='The requested role is above your authority.';
  end if;
  if target.role=p_role then return pg_catalog.jsonb_build_object('workspace_id',p_workspace_id,'user_id',p_user_id,'role',target.role,'unchanged',true); end if;
  update public.workspace_memberships set role=p_role,updated_at=pg_catalog.now() where id=target.id;
  insert into public.workspace_settings_audit(workspace_id,actor_user_id,target_user_id,action,changed_fields)
    values(p_workspace_id,actor,p_user_id,'member_role_changed',array['role']);
  return pg_catalog.jsonb_build_object('workspace_id',p_workspace_id,'user_id',p_user_id,'role',p_role);
end; $$;

create or replace function public.remove_workspace_member(p_workspace_id uuid,p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid:=(select auth.uid()); actor_role text; target public.workspace_memberships; agency_result jsonb;
begin
  perform 1 from public.workspaces where id=p_workspace_id for update;
  if not found then raise exception using errcode='P0002',message='Workspace was not found.'; end if;
  select role into actor_role from public.workspace_memberships where workspace_id=p_workspace_id and user_id=actor;
  if actor is null or coalesce(actor_role,'') not in ('owner','admin') then raise exception using errcode='42501',message='Workspace member administration is required.'; end if;
  select * into target from public.workspace_memberships where workspace_id=p_workspace_id and user_id=p_user_id for update;
  if target.id is null then raise exception using errcode='P0002',message='Workspace member was not found.'; end if;
  if p_user_id=actor or target.role='owner' then raise exception using errcode='42501',message='Self removal and owner removal are unavailable.'; end if;
  if actor_role='admin' and target.role='admin' then raise exception using errcode='42501',message='Admins cannot remove another administrator.'; end if;
  insert into public.workspace_settings_audit(workspace_id,actor_user_id,target_user_id,action,changed_fields)
    values(p_workspace_id,actor,p_user_id,'member_removed',array['membership']);
  if exists(select 1 from public.agency_profiles where agency_workspace_id=p_workspace_id) then
    select public.remove_agency_team_member(p_workspace_id,p_user_id) into agency_result;
    return agency_result;
  end if;
  delete from public.workspace_memberships where id=target.id;
  return pg_catalog.jsonb_build_object('workspace_id',p_workspace_id,'user_id',p_user_id,'status','removed');
end; $$;

create or replace function public.request_account_closure(p_scope text,p_workspace_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid:=(select auth.uid()); request_row public.account_closure_requests;
begin
  if actor is null then raise exception using errcode='28000',message='Sign in to request account closure.'; end if;
  if p_scope='account' then
    if p_workspace_id is not null then raise exception using errcode='22023',message='Account closure scope is invalid.'; end if;
    select * into request_row from public.account_closure_requests where requester_user_id=actor and scope='account' and status='pending_review' limit 1;
    if request_row.id is null then
      insert into public.account_closure_requests(scope,requester_user_id) values('account',actor) returning * into request_row;
    end if;
  elsif p_scope='workspace' then
    if p_workspace_id is null or not tandem_internal.has_workspace_role(p_workspace_id,array['owner']::text[]) then
      raise exception using errcode='42501',message='Only the workspace owner may request workspace closure.';
    end if;
    select * into request_row from public.account_closure_requests where workspace_id=p_workspace_id and scope='workspace' and status='pending_review' limit 1;
    if request_row.id is null then
      insert into public.account_closure_requests(scope,requester_user_id,workspace_id) values('workspace',actor,p_workspace_id) returning * into request_row;
      insert into public.workspace_settings_audit(workspace_id,actor_user_id,action,changed_fields)
        values(p_workspace_id,actor,'closure_requested',array['workspace_closure']);
    end if;
  else raise exception using errcode='22023',message='Closure request scope is invalid.';
  end if;
  return pg_catalog.jsonb_build_object('id',request_row.id,'scope',request_row.scope,'status',request_row.status,'created_at',request_row.created_at);
end; $$;

revoke all on function public.accept_workspace_invitation(text,text),public.update_workspace_member_role(uuid,uuid,text),public.remove_workspace_member(uuid,uuid),public.request_account_closure(text,uuid)
  from public,anon,service_role;
grant execute on function public.accept_workspace_invitation(text,text),public.update_workspace_member_role(uuid,uuid,text),public.remove_workspace_member(uuid,uuid),public.request_account_closure(text,uuid)
  to authenticated;

commit;
