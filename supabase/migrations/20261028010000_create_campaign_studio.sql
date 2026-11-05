begin;

-- Depends on 20261027010000_create_multi_tenant_workspaces.sql.
-- Demo-only campaign workflow. It has no provider credentials, external calls, or live publish path.

create or replace function tandem_internal.has_campaign_permission(
  p_workspace_id uuid,
  p_permission text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_permission
    when 'read' then tandem_internal.has_workspace_role(p_workspace_id, array['owner', 'admin', 'editor', 'viewer']::text[])
    when 'manage' then tandem_internal.has_workspace_role(p_workspace_id, array['owner', 'admin', 'editor']::text[])
    when 'review' then tandem_internal.has_workspace_role(p_workspace_id, array['owner', 'admin', 'editor']::text[])
    when 'approve' then tandem_internal.has_workspace_role(p_workspace_id, array['owner', 'admin']::text[])
    when 'publish_demo' then tandem_internal.has_workspace_role(p_workspace_id, array['owner', 'admin']::text[])
    else false
  end;
$$;

revoke all on function tandem_internal.has_campaign_permission(uuid, text) from public, anon, authenticated, service_role;
grant execute on function tandem_internal.has_campaign_permission(uuid, text) to authenticated;

create table public.campaigns (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  platform text not null,
  objective text not null,
  lifecycle_status text not null default 'draft',
  revision integer not null default 1,
  approved_revision integer,
  brief jsonb not null,
  plan jsonb,
  generation_mode text not null default 'none',
  execution_mode text not null default 'demo',
  published_externally boolean not null default false,
  generated_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint campaigns_workspace_id_pair_unique unique (id, workspace_id),
  constraint campaigns_name_length check (pg_catalog.char_length(pg_catalog.btrim(name)) between 1 and 160),
  constraint campaigns_platform_valid check (platform in ('google_ads', 'meta_ads')),
  constraint campaigns_objective_valid check (objective in ('website_traffic', 'traffic', 'lead_generation', 'sales', 'awareness', 'engagement', 'app_promotion')),
  constraint campaigns_status_valid check (lifecycle_status in ('draft', 'generated_simulation', 'needs_review', 'changes_requested', 'approved_for_demo', 'demo_published', 'archived')),
  constraint campaigns_revision_valid check (revision > 0 and (approved_revision is null or approved_revision > 0)),
  constraint campaigns_json_objects check (pg_catalog.jsonb_typeof(brief) = 'object' and (plan is null or pg_catalog.jsonb_typeof(plan) = 'object')),
  constraint campaigns_generation_mode_valid check (generation_mode in ('none', 'simulation')),
  constraint campaigns_execution_mode_demo check (execution_mode = 'demo'),
  constraint campaigns_never_external check (published_externally = false),
  constraint campaigns_approval_matches_revision check (approved_revision is null or approved_revision = revision),
  constraint campaigns_archived_status check ((lifecycle_status = 'archived') = (archived_at is not null))
);

create index campaigns_workspace_recent_idx on public.campaigns(workspace_id, updated_at desc, id);
create index campaigns_workspace_status_idx on public.campaigns(workspace_id, lifecycle_status, updated_at desc);
create index campaigns_workspace_platform_idx on public.campaigns(workspace_id, platform, updated_at desc);

create table public.campaign_revisions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null,
  revision integer not null,
  name text not null,
  objective text not null,
  brief jsonb not null,
  plan jsonb,
  changed_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  constraint campaign_revisions_campaign_workspace_fk foreign key(campaign_id, workspace_id) references public.campaigns(id, workspace_id) on delete cascade,
  constraint campaign_revisions_number_unique unique(campaign_id, revision),
  constraint campaign_revisions_json_objects check (pg_catalog.jsonb_typeof(brief) = 'object' and (plan is null or pg_catalog.jsonb_typeof(plan) = 'object'))
);
create index campaign_revisions_workspace_campaign_idx on public.campaign_revisions(workspace_id, campaign_id, revision desc);

create table public.campaign_activity (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null,
  event_type text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default pg_catalog.now(),
  constraint campaign_activity_campaign_workspace_fk foreign key(campaign_id, workspace_id) references public.campaigns(id, workspace_id) on delete cascade,
  constraint campaign_activity_json_object check (pg_catalog.jsonb_typeof(details) = 'object')
);
create index campaign_activity_workspace_recent_idx on public.campaign_activity(workspace_id, campaign_id, created_at desc);

create table public.campaign_reviews (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null,
  draft_revision integer not null,
  decision text not null,
  reviewer_user_id uuid not null references auth.users(id) on delete restrict,
  comments text not null default '',
  created_at timestamptz not null default pg_catalog.now(),
  constraint campaign_reviews_campaign_workspace_fk foreign key(campaign_id, workspace_id) references public.campaigns(id, workspace_id) on delete cascade,
  constraint campaign_reviews_decision_valid check (decision in ('submitted', 'changes_requested', 'approved_for_demo', 'reopened')),
  constraint campaign_reviews_comments_length check (pg_catalog.char_length(comments) <= 4000)
);
create index campaign_reviews_workspace_campaign_idx on public.campaign_reviews(workspace_id, campaign_id, created_at desc);

create table public.demo_publish_attempts (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null,
  draft_revision integer not null,
  status text not null,
  scenario text not null,
  failure_code text,
  local_demo_reference text not null,
  attempted_by_user_id uuid references auth.users(id) on delete set null,
  published_externally boolean not null default false,
  created_at timestamptz not null default pg_catalog.now(),
  completed_at timestamptz,
  constraint demo_publish_attempts_campaign_workspace_fk foreign key(campaign_id, workspace_id) references public.campaigns(id, workspace_id) on delete cascade,
  constraint demo_publish_attempts_status_valid check (status in ('processing', 'succeeded', 'failed')),
  constraint demo_publish_attempts_scenario_valid check (scenario in ('success', 'provider_unavailable')),
  constraint demo_publish_attempts_reference_demo check (pg_catalog.left(local_demo_reference, 5) = 'demo_'),
  constraint demo_publish_attempts_never_external check (published_externally = false)
);
create index demo_publish_attempts_workspace_recent_idx on public.demo_publish_attempts(workspace_id, campaign_id, created_at desc);
alter table public.demo_publish_attempts add constraint demo_publish_attempts_pair_unique unique (id, campaign_id, workspace_id);

create table public.demo_campaign_analytics (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null,
  publish_attempt_id uuid not null,
  scenario text not null,
  seed bigint not null,
  metrics jsonb not null,
  data_source text not null default 'demo_simulation',
  simulated_at timestamptz not null default pg_catalog.now(),
  constraint demo_campaign_analytics_campaign_workspace_fk foreign key(campaign_id, workspace_id) references public.campaigns(id, workspace_id) on delete cascade,
  constraint demo_campaign_analytics_attempt_fk foreign key(publish_attempt_id, campaign_id, workspace_id) references public.demo_publish_attempts(id, campaign_id, workspace_id) on delete cascade,
  constraint demo_campaign_analytics_scenario_valid check (scenario in ('low', 'average', 'high', 'gradual_improvement', 'decline')),
  constraint demo_campaign_analytics_json_object check (pg_catalog.jsonb_typeof(metrics) = 'object' and metrics ->> 'label' = 'Simulated Data — Not Actual Ad Performance'),
  constraint demo_campaign_analytics_source_valid check (data_source = 'demo_simulation'),
  constraint demo_campaign_analytics_per_attempt unique (publish_attempt_id)
);
create index demo_campaign_analytics_workspace_idx on public.demo_campaign_analytics(workspace_id, campaign_id, simulated_at desc);

create or replace function tandem_internal.touch_campaign_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.updated_at := pg_catalog.now(); return new; end;
$$;
revoke all on function tandem_internal.touch_campaign_updated_at() from public, anon, authenticated, service_role;
create trigger campaigns_touch_updated_at before update on public.campaigns for each row execute function tandem_internal.touch_campaign_updated_at();

alter table public.campaigns enable row level security;
alter table public.campaign_revisions enable row level security;
alter table public.campaign_activity enable row level security;
alter table public.campaign_reviews enable row level security;
alter table public.demo_publish_attempts enable row level security;
alter table public.demo_campaign_analytics enable row level security;
revoke all on public.campaigns, public.campaign_revisions, public.campaign_activity, public.campaign_reviews, public.demo_publish_attempts, public.demo_campaign_analytics from public, anon, authenticated, service_role;
grant select on public.campaigns, public.campaign_revisions, public.campaign_activity, public.campaign_reviews, public.demo_publish_attempts, public.demo_campaign_analytics to authenticated;

create policy campaigns_member_read on public.campaigns for select to authenticated using (tandem_internal.has_campaign_permission(workspace_id, 'read'));
create policy campaign_revisions_member_read on public.campaign_revisions for select to authenticated using (tandem_internal.has_campaign_permission(workspace_id, 'read'));
create policy campaign_activity_member_read on public.campaign_activity for select to authenticated using (tandem_internal.has_campaign_permission(workspace_id, 'read'));
create policy campaign_reviews_member_read on public.campaign_reviews for select to authenticated using (tandem_internal.has_campaign_permission(workspace_id, 'read'));
create policy demo_publish_attempts_member_read on public.demo_publish_attempts for select to authenticated using (tandem_internal.has_campaign_permission(workspace_id, 'read'));
create policy demo_campaign_analytics_member_read on public.demo_campaign_analytics for select to authenticated using (tandem_internal.has_campaign_permission(workspace_id, 'read'));

create function public.create_campaign(p_campaign jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); result public.campaigns;
begin
  if actor_id is null then raise exception using errcode = '28000', message = 'Authentication is required.'; end if;
  if pg_catalog.jsonb_typeof(p_campaign) <> 'object' then raise exception using errcode = '22023', message = 'Campaign input is invalid.'; end if;
  if not tandem_internal.has_campaign_permission((p_campaign ->> 'workspace_id')::uuid, 'manage') then raise exception using errcode = '42501', message = 'Campaign management permission is required.'; end if;
  insert into public.campaigns(workspace_id, name, platform, objective, brief, plan, lifecycle_status, revision, generation_mode, generated_at, created_by_user_id, updated_by_user_id)
  values ((p_campaign ->> 'workspace_id')::uuid, pg_catalog.btrim(p_campaign ->> 'name'), p_campaign ->> 'platform', p_campaign ->> 'objective', p_campaign -> 'brief', p_campaign -> 'plan',
    case when p_campaign -> 'plan' is null or p_campaign -> 'plan' = 'null'::jsonb then 'draft' else 'generated_simulation' end,
    1, case when p_campaign -> 'plan' is null or p_campaign -> 'plan' = 'null'::jsonb then 'none' else 'simulation' end,
    case when p_campaign -> 'plan' is null or p_campaign -> 'plan' = 'null'::jsonb then null else pg_catalog.now() end, actor_id, actor_id)
  returning * into result;
  insert into public.campaign_revisions(workspace_id, campaign_id, revision, name, objective, brief, plan, changed_by_user_id)
    values(result.workspace_id, result.id, result.revision, result.name, result.objective, result.brief, result.plan, actor_id);
  insert into public.campaign_activity(workspace_id, campaign_id, event_type, actor_user_id, details)
    values(result.workspace_id, result.id, 'campaign_created', actor_id, jsonb_build_object('revision', result.revision));
  return pg_catalog.to_jsonb(result);
exception when invalid_text_representation or invalid_parameter_value then
  raise exception using errcode = '22023', message = 'Campaign input is invalid.';
end;
$$;

create function public.save_campaign(p_campaign_id uuid, p_workspace_id uuid, p_expected_revision integer, p_campaign jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); existing public.campaigns; result public.campaigns; next_status text; changed boolean;
begin
  if actor_id is null then raise exception using errcode = '28000', message = 'Authentication is required.'; end if;
  if not tandem_internal.has_campaign_permission(p_workspace_id, 'manage') then raise exception using errcode = '42501', message = 'Campaign management permission is required.'; end if;
  select * into existing from public.campaigns where id = p_campaign_id and workspace_id = p_workspace_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Campaign not found.'; end if;
  if existing.revision <> p_expected_revision then raise exception using errcode = '40001', message = 'Campaign changed since it was loaded.'; end if;
  if existing.lifecycle_status = 'archived' then raise exception using errcode = '22023', message = 'Archived campaign cannot be edited.'; end if;
  changed := existing.name is distinct from pg_catalog.btrim(p_campaign ->> 'name') or existing.objective is distinct from p_campaign ->> 'objective' or existing.platform is distinct from p_campaign ->> 'platform' or existing.brief is distinct from p_campaign -> 'brief' or existing.plan is distinct from p_campaign -> 'plan';
  next_status := case
    when changed and existing.lifecycle_status in ('needs_review', 'changes_requested', 'approved_for_demo', 'demo_published')
      then case when p_campaign -> 'plan' is null or p_campaign -> 'plan' = 'null'::jsonb then 'draft' else 'generated_simulation' end
    else existing.lifecycle_status
  end;
  update public.campaigns set name = pg_catalog.btrim(p_campaign ->> 'name'), platform = p_campaign ->> 'platform', objective = p_campaign ->> 'objective', brief = p_campaign -> 'brief', plan = p_campaign -> 'plan', revision = revision + case when changed then 1 else 0 end,
    approved_revision = case when changed then null else approved_revision end, lifecycle_status = next_status,
    generation_mode = case when p_campaign -> 'plan' is null or p_campaign -> 'plan' = 'null'::jsonb then 'none' else 'simulation' end,
    generated_at = case when p_campaign -> 'plan' is null or p_campaign -> 'plan' = 'null'::jsonb then null else coalesce(generated_at, pg_catalog.now()) end,
    updated_by_user_id = actor_id
  where id = p_campaign_id and workspace_id = p_workspace_id returning * into result;
  if changed then
    insert into public.campaign_revisions(workspace_id, campaign_id, revision, name, objective, brief, plan, changed_by_user_id) values(result.workspace_id, result.id, result.revision, result.name, result.objective, result.brief, result.plan, actor_id);
    insert into public.campaign_activity(workspace_id, campaign_id, event_type, actor_user_id, details) values(result.workspace_id, result.id, 'campaign_saved', actor_id, jsonb_build_object('revision', result.revision, 'approval_invalidated', existing.approved_revision is not null));
  end if;
  return pg_catalog.to_jsonb(result);
end;
$$;

create function public.duplicate_campaign(p_campaign_id uuid, p_workspace_id uuid, p_new_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); source public.campaigns; result public.campaigns;
begin
  if actor_id is null then raise exception using errcode = '28000', message = 'Authentication is required.'; end if;
  if not tandem_internal.has_campaign_permission(p_workspace_id, 'manage') then raise exception using errcode = '42501', message = 'Campaign management permission is required.'; end if;
  select * into source from public.campaigns where id = p_campaign_id and workspace_id = p_workspace_id for share;
  if not found then raise exception using errcode = 'P0002', message = 'Campaign not found.'; end if;
  insert into public.campaigns(workspace_id, name, platform, objective, brief, plan, lifecycle_status, revision, generation_mode, execution_mode, published_externally, generated_at, created_by_user_id, updated_by_user_id)
  values(p_workspace_id, pg_catalog.left(pg_catalog.btrim(p_new_name), 160), source.platform, source.objective, source.brief, source.plan,
    case when source.plan is null then 'draft' else 'generated_simulation' end, 1, case when source.plan is null then 'none' else 'simulation' end, 'demo', false, source.generated_at, actor_id, actor_id)
  returning * into result;
  insert into public.campaign_revisions(workspace_id, campaign_id, revision, name, objective, brief, plan, changed_by_user_id) values(p_workspace_id, result.id, 1, result.name, result.objective, result.brief, result.plan, actor_id);
  insert into public.campaign_activity(workspace_id, campaign_id, event_type, actor_user_id, details) values(p_workspace_id, result.id, 'campaign_duplicated', actor_id, jsonb_build_object('source_campaign_id', source.id, 'revision', 1));
  return pg_catalog.to_jsonb(result);
end;
$$;

create function public.archive_campaign(p_campaign_id uuid, p_workspace_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); result public.campaigns;
begin
  if actor_id is null then raise exception using errcode = '28000', message = 'Authentication is required.'; end if;
  if not tandem_internal.has_campaign_permission(p_workspace_id, 'manage') then raise exception using errcode = '42501', message = 'Campaign management permission is required.'; end if;
  update public.campaigns set lifecycle_status = 'archived', archived_at = coalesce(archived_at, pg_catalog.now()), approved_revision = null, updated_by_user_id = actor_id where id = p_campaign_id and workspace_id = p_workspace_id returning * into result;
  if not found then raise exception using errcode = 'P0002', message = 'Campaign not found.'; end if;
  insert into public.campaign_activity(workspace_id, campaign_id, event_type, actor_user_id, details) values(p_workspace_id, p_campaign_id, 'campaign_archived', actor_id, jsonb_build_object('revision', result.revision));
  return pg_catalog.to_jsonb(result);
end;
$$;

create function public.submit_campaign_review(p_campaign_id uuid, p_workspace_id uuid, p_expected_revision integer, p_comments text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); item public.campaigns;
begin
  if actor_id is null then raise exception using errcode = '28000', message = 'Authentication is required.'; end if;
  if not tandem_internal.has_campaign_permission(p_workspace_id, 'review') then raise exception using errcode = '42501', message = 'Review submission permission is required.'; end if;
  select * into item from public.campaigns where id = p_campaign_id and workspace_id = p_workspace_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Campaign not found.'; end if;
  if item.revision <> p_expected_revision then raise exception using errcode = '40001', message = 'Campaign changed since it was loaded.'; end if;
  if item.lifecycle_status = 'archived' or item.plan is null then raise exception using errcode = '22023', message = 'A generated, active draft is required for review.'; end if;
  update public.campaigns set lifecycle_status = 'needs_review', approved_revision = null, updated_by_user_id = actor_id where id = p_campaign_id and workspace_id = p_workspace_id returning * into item;
  insert into public.campaign_reviews(workspace_id, campaign_id, draft_revision, decision, reviewer_user_id, comments) values(p_workspace_id, p_campaign_id, item.revision, 'submitted', actor_id, pg_catalog.left(coalesce(p_comments, ''), 4000));
  insert into public.campaign_activity(workspace_id, campaign_id, event_type, actor_user_id, details) values(p_workspace_id, p_campaign_id, 'review_submitted', actor_id, jsonb_build_object('revision', item.revision));
  return pg_catalog.to_jsonb(item);
end;
$$;

create function public.decide_campaign_review(p_campaign_id uuid, p_workspace_id uuid, p_decision text, p_comments text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); item public.campaigns; event_type text;
begin
  if actor_id is null then raise exception using errcode = '28000', message = 'Authentication is required.'; end if;
  if p_decision not in ('approved_for_demo', 'changes_requested', 'reopened') then raise exception using errcode = '22023', message = 'Review decision is invalid.'; end if;
  if not tandem_internal.has_campaign_permission(p_workspace_id, 'approve') then raise exception using errcode = '42501', message = 'Workspace approval permission is required.'; end if;
  select * into item from public.campaigns where id = p_campaign_id and workspace_id = p_workspace_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Campaign not found.'; end if;
  if item.lifecycle_status = 'archived' then raise exception using errcode = '22023', message = 'Archived campaign cannot be reviewed.'; end if;
  if p_decision = 'approved_for_demo' and (item.lifecycle_status <> 'needs_review' or item.plan is null) then raise exception using errcode = '22023', message = 'Only a submitted campaign can be approved.'; end if;
  if p_decision = 'changes_requested' and item.lifecycle_status <> 'needs_review' then raise exception using errcode = '22023', message = 'Only a submitted campaign can receive requested changes.'; end if;
  if p_decision = 'reopened' and item.lifecycle_status not in ('approved_for_demo', 'demo_published', 'changes_requested') then raise exception using errcode = '22023', message = 'This campaign cannot be reopened.'; end if;
  event_type := p_decision;
  update public.campaigns set lifecycle_status = case
      when p_decision = 'reopened' then case when plan is null then 'draft' else 'generated_simulation' end
      else p_decision
    end,
    approved_revision = case when p_decision = 'approved_for_demo' then revision else null end,
    updated_by_user_id = actor_id
    where id = p_campaign_id and workspace_id = p_workspace_id returning * into item;
  insert into public.campaign_reviews(workspace_id, campaign_id, draft_revision, decision, reviewer_user_id, comments) values(p_workspace_id, p_campaign_id, item.revision, event_type, actor_id, pg_catalog.left(coalesce(p_comments, ''), 4000));
  insert into public.campaign_activity(workspace_id, campaign_id, event_type, actor_user_id, details) values(p_workspace_id, p_campaign_id, event_type, actor_id, jsonb_build_object('revision', item.revision, 'comments', pg_catalog.left(coalesce(p_comments, ''), 4000)));
  return pg_catalog.to_jsonb(item);
end;
$$;

create function public.simulate_campaign_publish(p_campaign_id uuid, p_workspace_id uuid, p_expected_revision integer, p_scenario text, p_seed bigint, p_metrics jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); item public.campaigns; attempt_id uuid := pg_catalog.gen_random_uuid(); result jsonb;
begin
  if actor_id is null then raise exception using errcode = '28000', message = 'Authentication is required.'; end if;
  if not tandem_internal.has_campaign_permission(p_workspace_id, 'publish_demo') then raise exception using errcode = '42501', message = 'Demo publishing permission is required.'; end if;
  select * into item from public.campaigns where id = p_campaign_id and workspace_id = p_workspace_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Campaign not found.'; end if;
  if item.revision <> p_expected_revision or item.approved_revision <> item.revision or item.lifecycle_status <> 'approved_for_demo' then raise exception using errcode = '22023', message = 'A current approval is required before demo publishing.'; end if;
  if p_scenario not in ('success', 'provider_unavailable') then raise exception using errcode = '22023', message = 'Demo scenario is invalid.'; end if;
  if p_scenario = 'success' and (p_metrics is null or p_metrics ->> 'label' <> 'Simulated Data — Not Actual Ad Performance') then raise exception using errcode = '22023', message = 'Clearly labeled demo metrics are required.'; end if;
  insert into public.demo_publish_attempts(workspace_id, campaign_id, draft_revision, status, scenario, failure_code, local_demo_reference, attempted_by_user_id, completed_at)
    values(p_workspace_id, p_campaign_id, item.revision, case when p_scenario = 'success' then 'succeeded' else 'failed' end, p_scenario, case when p_scenario = 'success' then null else 'demo_provider_unavailable' end, 'demo_' || attempt_id::text, actor_id, pg_catalog.now());
  if p_scenario = 'success' then
    insert into public.demo_campaign_analytics(workspace_id, campaign_id, publish_attempt_id, scenario, seed, metrics) values(p_workspace_id, p_campaign_id, attempt_id, coalesce(p_metrics ->> 'scenario', 'average'), p_seed, p_metrics);
    update public.campaigns set lifecycle_status = 'demo_published', updated_by_user_id = actor_id where id = p_campaign_id and workspace_id = p_workspace_id returning * into item;
    result := jsonb_build_object('status', 'succeeded', 'attempt_id', attempt_id, 'local_demo_reference', 'demo_' || attempt_id::text, 'published_externally', false, 'campaign', pg_catalog.to_jsonb(item));
  else
    result := jsonb_build_object('status', 'failed', 'attempt_id', attempt_id, 'local_demo_reference', 'demo_' || attempt_id::text, 'failure_code', 'demo_provider_unavailable', 'message', 'The demo simulator recorded an intentional provider-unavailable scenario. No external request was made.', 'published_externally', false);
  end if;
  insert into public.campaign_activity(workspace_id, campaign_id, event_type, actor_user_id, details) values(p_workspace_id, p_campaign_id, case when p_scenario = 'success' then 'demo_published' else 'demo_publish_failed' end, actor_id, jsonb_build_object('attempt_id', attempt_id, 'scenario', p_scenario, 'published_externally', false));
  return result;
end;
$$;

create function public.campaign_activity_for(p_campaign_id uuid, p_workspace_id uuid)
returns setof public.campaign_activity language sql stable security invoker set search_path = '' as $$
  select * from public.campaign_activity where campaign_id = p_campaign_id and workspace_id = p_workspace_id order by created_at desc limit 100;
$$;
create function public.campaign_reviews_for(p_campaign_id uuid, p_workspace_id uuid)
returns setof public.campaign_reviews language sql stable security invoker set search_path = '' as $$
  select * from public.campaign_reviews where campaign_id = p_campaign_id and workspace_id = p_workspace_id order by created_at desc limit 100;
$$;
create function public.demo_analytics_for(p_campaign_id uuid, p_workspace_id uuid)
returns setof public.demo_campaign_analytics language sql stable security invoker set search_path = '' as $$
  select * from public.demo_campaign_analytics where campaign_id = p_campaign_id and workspace_id = p_workspace_id order by simulated_at desc;
$$;

revoke all on function public.create_campaign(jsonb), public.save_campaign(uuid, uuid, integer, jsonb), public.duplicate_campaign(uuid, uuid, text), public.archive_campaign(uuid, uuid), public.submit_campaign_review(uuid, uuid, integer, text), public.decide_campaign_review(uuid, uuid, text, text), public.simulate_campaign_publish(uuid, uuid, integer, text, bigint, jsonb), public.campaign_activity_for(uuid, uuid), public.campaign_reviews_for(uuid, uuid), public.demo_analytics_for(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.create_campaign(jsonb), public.save_campaign(uuid, uuid, integer, jsonb), public.duplicate_campaign(uuid, uuid, text), public.archive_campaign(uuid, uuid), public.submit_campaign_review(uuid, uuid, integer, text), public.decide_campaign_review(uuid, uuid, text, text), public.simulate_campaign_publish(uuid, uuid, integer, text, bigint, jsonb), public.campaign_activity_for(uuid, uuid), public.campaign_reviews_for(uuid, uuid), public.demo_analytics_for(uuid, uuid) to authenticated;

commit;
