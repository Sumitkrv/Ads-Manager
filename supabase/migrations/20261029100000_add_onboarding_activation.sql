begin;

create table public.user_onboarding_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  setup_path text not null default 'business',
  draft jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default pg_catalog.now(),
  constraint user_onboarding_path_valid check (setup_path in ('business', 'agency', 'join')),
  constraint user_onboarding_draft_object check (
    pg_catalog.jsonb_typeof(draft) = 'object'
    and pg_catalog.octet_length(draft::text) <= 16000
    and draft - array['businessName','industryKey','industryCustomLabel','websiteUrl','countryCode','timezone','businessDescription','primaryRegion','mainOffering','marketingObjective','campaignGoal','platformFormat','budgetRange','audience','brandTone','ctaPreference','currentStep','requestId','createdWorkspaceId']::text[] = '{}'::jsonb
  )
);

create table public.workspace_onboarding_progress (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  setup_data jsonb not null default '{}'::jsonb,
  current_step smallint not null default 0,
  last_completed_step smallint not null default -1,
  started_at timestamptz not null default pg_catalog.now(),
  last_active_at timestamptz not null default pg_catalog.now(),
  completed_at timestamptz,
  updated_at timestamptz not null default pg_catalog.now(),
  version integer not null default 1,
  constraint workspace_onboarding_step_valid check (current_step between 0 and 6 and last_completed_step between -1 and 6 and last_completed_step <= current_step),
  constraint workspace_onboarding_version_valid check (version > 0),
  constraint workspace_onboarding_data_object check (
    pg_catalog.jsonb_typeof(setup_data) = 'object'
    and pg_catalog.octet_length(setup_data::text) <= 16000
    and setup_data - array['businessDescription','primaryRegion','mainOffering','marketingObjective','campaignGoal','platformFormat','budgetRange','audience','brandTone','ctaPreference']::text[] = '{}'::jsonb
  )
);

create table public.user_product_tour_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  tour_id text not null,
  step_index smallint not null default 0,
  status text not null default 'running',
  started_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  completed_at timestamptz,
  primary key (user_id, workspace_id, tour_id),
  constraint user_product_tour_id_valid check (tour_id ~ '^[a-z][a-z0-9_-]{1,63}$'),
  constraint user_product_tour_step_valid check (step_index between 0 and 40),
  constraint user_product_tour_status_valid check (status in ('running', 'skipped', 'completed')),
  constraint user_product_tour_completion_valid check ((status = 'completed') = (completed_at is not null))
);

create table public.workspace_activation_events (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_key text not null,
  idempotency_key text not null,
  resource_id uuid,
  occurred_at timestamptz not null default pg_catalog.now(),
  constraint workspace_activation_event_key_valid check (event_key in ('onboarding_started','onboarding_completed','first_campaign_created','first_creative_saved','first_demo_published','first_report_viewed','demo_mode_reviewed','tour_started','tour_completed','tour_skipped')),
  constraint workspace_activation_event_idempotency_unique unique (workspace_id, idempotency_key)
);
create index workspace_activation_events_recent_idx on public.workspace_activation_events(workspace_id, occurred_at desc);

alter table public.user_onboarding_preferences enable row level security;
alter table public.workspace_onboarding_progress enable row level security;
alter table public.user_product_tour_progress enable row level security;
alter table public.workspace_activation_events enable row level security;

revoke all on public.user_onboarding_preferences, public.workspace_onboarding_progress, public.user_product_tour_progress, public.workspace_activation_events from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.user_onboarding_preferences to authenticated;
grant select on public.workspace_onboarding_progress to authenticated;
grant insert (workspace_id, setup_data, current_step, last_completed_step) on public.workspace_onboarding_progress to authenticated;
grant update (setup_data, current_step, last_completed_step) on public.workspace_onboarding_progress to authenticated;
grant select, insert, update, delete on public.user_product_tour_progress to authenticated;
grant select on public.workspace_activation_events to authenticated;

create policy user_onboarding_preferences_self on public.user_onboarding_preferences
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy workspace_onboarding_progress_member_read on public.workspace_onboarding_progress
  for select to authenticated using (tandem_internal.has_workspace_role(workspace_id, null::text[]));
create policy workspace_onboarding_progress_manager_write on public.workspace_onboarding_progress
  for all to authenticated using (tandem_internal.has_workspace_role(workspace_id, array['owner','admin']::text[]))
  with check (tandem_internal.has_workspace_role(workspace_id, array['owner','admin']::text[]));

create policy user_product_tour_progress_owner on public.user_product_tour_progress
  for all to authenticated
  using (user_id = (select auth.uid()) and tandem_internal.has_workspace_role(workspace_id, null::text[]))
  with check (user_id = (select auth.uid()) and tandem_internal.has_workspace_role(workspace_id, null::text[]));

create policy workspace_activation_events_member_read on public.workspace_activation_events
  for select to authenticated using (tandem_internal.has_workspace_role(workspace_id, null::text[]));

create function tandem_internal.touch_onboarding_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at := pg_catalog.now();
  new.last_active_at := pg_catalog.now();
  new.version := old.version + 1;
  return new;
end;
$$;
revoke all on function tandem_internal.touch_onboarding_updated_at() from public, anon, authenticated, service_role;
create trigger workspace_onboarding_progress_touch before update on public.workspace_onboarding_progress
  for each row execute function tandem_internal.touch_onboarding_updated_at();

create function tandem_internal.record_activation_milestone(
  p_workspace_id uuid, p_event_key text, p_idempotency_key text, p_actor_user_id uuid default null, p_resource_id uuid default null
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_event_key not in ('onboarding_started','onboarding_completed','first_campaign_created','first_creative_saved','first_demo_published','first_report_viewed','demo_mode_reviewed','tour_started','tour_completed','tour_skipped') then
    raise exception using errcode = '22023', message = 'Unsupported activation milestone.';
  end if;
  insert into public.workspace_activation_events(workspace_id, actor_user_id, event_key, idempotency_key, resource_id)
  values (p_workspace_id, p_actor_user_id, p_event_key, p_idempotency_key, p_resource_id)
  on conflict (workspace_id, idempotency_key) do nothing;
end;
$$;
revoke all on function tandem_internal.record_activation_milestone(uuid,text,text,uuid,uuid) from public, anon, authenticated, service_role;

create function tandem_internal.recalculate_workspace_onboarding_completion(p_workspace_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.workspace_onboarding_progress p
    where p.workspace_id = p_workspace_id and p.completed_at is null
      and pg_catalog.btrim(coalesce(p.setup_data ->> 'businessDescription', '')) <> ''
      and pg_catalog.btrim(coalesce(p.setup_data ->> 'mainOffering', '')) <> ''
      and exists (select 1 from public.workspace_brand_kits b where b.workspace_id = p_workspace_id)
      and exists (select 1 from public.workspace_activation_events e where e.workspace_id = p_workspace_id and e.event_key = 'demo_mode_reviewed')
      and exists (select 1 from public.campaigns c where c.workspace_id = p_workspace_id and c.plan is not null and c.lifecycle_status <> 'archived')
      and exists (select 1 from public.creative_projects c where c.workspace_id = p_workspace_id and c.lifecycle_status <> 'archived')
      and exists (select 1 from public.campaign_reviews r where r.workspace_id = p_workspace_id and r.decision in ('submitted','approved_for_demo'))
      and exists (select 1 from public.demo_publish_attempts d where d.workspace_id = p_workspace_id and d.status = 'succeeded' and d.published_externally = false)
      and exists (select 1 from public.demo_campaign_analytics a where a.workspace_id = p_workspace_id)
      and exists (select 1 from public.workspace_activation_events e where e.workspace_id = p_workspace_id and e.event_key = 'first_report_viewed')
  ) then
    update public.workspace_onboarding_progress
    set completed_at = pg_catalog.now(), current_step = 6, last_completed_step = 6
    where workspace_id = p_workspace_id and completed_at is null;
  end if;
end;
$$;
revoke all on function tandem_internal.recalculate_workspace_onboarding_completion(uuid) from public, anon, authenticated, service_role;

create function tandem_internal.track_onboarding_progress_activation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform tandem_internal.record_activation_milestone(new.workspace_id, 'onboarding_started', 'onboarding_started', auth.uid());
  elsif old.completed_at is null and new.completed_at is not null then
    perform tandem_internal.record_activation_milestone(new.workspace_id, 'onboarding_completed', 'onboarding_completed', auth.uid());
  end if;
  perform tandem_internal.recalculate_workspace_onboarding_completion(new.workspace_id);
  return new;
end;
$$;
revoke all on function tandem_internal.track_onboarding_progress_activation() from public, anon, authenticated, service_role;
create trigger workspace_onboarding_progress_activation after insert or update on public.workspace_onboarding_progress
  for each row execute function tandem_internal.track_onboarding_progress_activation();

create function tandem_internal.track_campaign_activation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform tandem_internal.record_activation_milestone(new.workspace_id, 'first_campaign_created', 'first_campaign_created', new.created_by_user_id, new.id);
  perform tandem_internal.recalculate_workspace_onboarding_completion(new.workspace_id);
  return new;
end;
$$;
revoke all on function tandem_internal.track_campaign_activation() from public, anon, authenticated, service_role;
create trigger campaigns_first_activation after insert on public.campaigns
  for each row execute function tandem_internal.track_campaign_activation();

create function tandem_internal.track_creative_activation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform tandem_internal.record_activation_milestone(new.workspace_id, 'first_creative_saved', 'first_creative_saved', new.created_by_user_id, new.id);
  perform tandem_internal.recalculate_workspace_onboarding_completion(new.workspace_id);
  return new;
end;
$$;
revoke all on function tandem_internal.track_creative_activation() from public, anon, authenticated, service_role;
create trigger creative_projects_first_activation after insert on public.creative_projects
  for each row execute function tandem_internal.track_creative_activation();

create function tandem_internal.track_demo_publish_activation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'succeeded' and new.published_externally = false then
    perform tandem_internal.record_activation_milestone(new.workspace_id, 'first_demo_published', 'first_demo_published', new.attempted_by_user_id, new.id);
  end if;
  perform tandem_internal.recalculate_workspace_onboarding_completion(new.workspace_id);
  return new;
end;
$$;
revoke all on function tandem_internal.track_demo_publish_activation() from public, anon, authenticated, service_role;
create trigger demo_publish_attempts_first_activation after insert on public.demo_publish_attempts
  for each row execute function tandem_internal.track_demo_publish_activation();

create function tandem_internal.track_tour_activation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  milestone text;
begin
  if tg_op = 'INSERT' then
    milestone := 'tour_started';
  elsif old.status is distinct from new.status and new.status in ('completed','skipped') then
    milestone := 'tour_' || new.status;
  else
    return new;
  end if;
  perform tandem_internal.record_activation_milestone(new.workspace_id, milestone,
    'tour:' || new.user_id::text || ':' || new.tour_id || ':' || milestone, new.user_id);
  return new;
end;
$$;
revoke all on function tandem_internal.track_tour_activation() from public, anon, authenticated, service_role;
create trigger user_product_tour_progress_activation after insert or update on public.user_product_tour_progress
  for each row execute function tandem_internal.track_tour_activation();

create function tandem_internal.track_brand_kit_activation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform tandem_internal.recalculate_workspace_onboarding_completion(new.workspace_id);
  return new;
end;
$$;
revoke all on function tandem_internal.track_brand_kit_activation() from public, anon, authenticated, service_role;
create trigger workspace_brand_kit_onboarding after insert or update on public.workspace_brand_kits
  for each row execute function tandem_internal.track_brand_kit_activation();

create function tandem_internal.record_onboarding_event(p_workspace_id uuid, p_event_key text)
returns void language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := auth.uid();
begin
  if actor_id is null or not tandem_internal.has_workspace_role(p_workspace_id, null::text[]) then
    raise exception using errcode = '42501', message = 'Workspace membership is required.';
  end if;
  if p_event_key = 'report_viewed' then
    if not exists (select 1 from public.demo_campaign_analytics where workspace_id = p_workspace_id) then
      raise exception using errcode = '22023', message = 'A saved demo analytics report is required.';
    end if;
    perform tandem_internal.record_activation_milestone(p_workspace_id, 'first_report_viewed', 'first_report_viewed', actor_id);
  elsif p_event_key = 'demo_mode_reviewed' then
    perform tandem_internal.record_activation_milestone(p_workspace_id, 'demo_mode_reviewed', 'demo_mode_reviewed', actor_id);
  else
    raise exception using errcode = '22023', message = 'Unsupported onboarding event.';
  end if;
  perform tandem_internal.recalculate_workspace_onboarding_completion(p_workspace_id);
end;
$$;
revoke all on function tandem_internal.record_onboarding_event(uuid,text) from public, anon, authenticated, service_role;

create function public.record_onboarding_event(p_workspace_id uuid, p_event_key text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform tandem_internal.record_onboarding_event(p_workspace_id, p_event_key);
end;
$$;
revoke all on function public.record_onboarding_event(uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.record_onboarding_event(uuid,text) to authenticated;

commit;
