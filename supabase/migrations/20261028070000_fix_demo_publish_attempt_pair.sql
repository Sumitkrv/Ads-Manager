-- Keep the attempt identifier identical in the attempt row and its analytics FK.
-- Additive replacement of the local demo-only publishing RPC.
create or replace function public.simulate_campaign_publish(
  p_campaign_id uuid,
  p_workspace_id uuid,
  p_expected_revision integer,
  p_scenario text,
  p_seed bigint,
  p_metrics jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  item public.campaigns;
  attempt_id uuid := pg_catalog.gen_random_uuid();
  result jsonb;
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required.';
  end if;
  if not tandem_internal.has_campaign_permission(p_workspace_id, 'publish_demo') then
    raise exception using errcode = '42501', message = 'Demo publishing permission is required.';
  end if;
  select * into item
  from public.campaigns
  where id = p_campaign_id and workspace_id = p_workspace_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Campaign not found.';
  end if;
  if item.revision <> p_expected_revision
    or item.approved_revision <> item.revision
    or item.lifecycle_status <> 'approved_for_demo' then
    raise exception using errcode = '22023', message = 'A current approval is required before demo publishing.';
  end if;
  if p_scenario not in ('success', 'provider_unavailable') then
    raise exception using errcode = '22023', message = 'Demo scenario is invalid.';
  end if;
  if p_scenario = 'success'
    and (p_metrics is null or p_metrics ->> 'label' <> 'Simulated Data — Not Actual Ad Performance') then
    raise exception using errcode = '22023', message = 'Clearly labeled demo metrics are required.';
  end if;

  insert into public.demo_publish_attempts(
    id, workspace_id, campaign_id, draft_revision, status, scenario,
    failure_code, local_demo_reference, attempted_by_user_id,
    published_externally, completed_at
  ) values (
    attempt_id,
    p_workspace_id,
    p_campaign_id,
    item.revision,
    case when p_scenario = 'success' then 'succeeded' else 'failed' end,
    p_scenario,
    case when p_scenario = 'success' then null else 'demo_provider_unavailable' end,
    'demo_' || attempt_id::text,
    actor_id,
    false,
    pg_catalog.now()
  );

  if p_scenario = 'success' then
    insert into public.demo_campaign_analytics(
      workspace_id, campaign_id, publish_attempt_id, scenario, seed, metrics
    ) values (
      p_workspace_id,
      p_campaign_id,
      attempt_id,
      coalesce(p_metrics ->> 'scenario', 'average'),
      p_seed,
      p_metrics
    );
    update public.campaigns
    set lifecycle_status = 'demo_published', updated_by_user_id = actor_id
    where id = p_campaign_id and workspace_id = p_workspace_id
    returning * into item;
    result := pg_catalog.jsonb_build_object(
      'status', 'succeeded',
      'attempt_id', attempt_id,
      'local_demo_reference', 'demo_' || attempt_id::text,
      'published_externally', false,
      'campaign', pg_catalog.to_jsonb(item)
    );
  else
    result := pg_catalog.jsonb_build_object(
      'status', 'failed',
      'attempt_id', attempt_id,
      'local_demo_reference', 'demo_' || attempt_id::text,
      'failure_code', 'demo_provider_unavailable',
      'message', 'The demo simulator recorded an intentional provider-unavailable scenario. No external request was made.',
      'published_externally', false
    );
  end if;

  insert into public.campaign_activity(
    workspace_id, campaign_id, event_type, actor_user_id, details
  ) values (
    p_workspace_id,
    p_campaign_id,
    case when p_scenario = 'success' then 'demo_published' else 'demo_publish_failed' end,
    actor_id,
    pg_catalog.jsonb_build_object(
      'attempt_id', attempt_id,
      'scenario', p_scenario,
      'published_externally', false
    )
  );
  return result;
end;
$$;

revoke all on function public.simulate_campaign_publish(uuid, uuid, integer, text, bigint, jsonb)
from public, anon, authenticated, service_role;
grant execute on function public.simulate_campaign_publish(uuid, uuid, integer, text, bigint, jsonb)
to authenticated;
