begin;

-- Immutable v2 sample catalog: adds accountable offline generation meters and
-- slightly widens trial seats so an existing workspace/team remains usable.
insert into public.subscription_plan_versions(plan_id,version,currency,monthly_price_minor,annual_price_minor,trial_days,features,limits,effective_at)
select v.plan_id,2,v.currency,v.monthly_price_minor,v.annual_price_minor,v.trial_days,
  v.features||'{"campaigns.generate":true}'::jsonb,
  v.limits||pg_catalog.jsonb_build_object(
    'seats',case when v.plan_id='free_trial' then 10 else (v.limits->>'seats')::integer end,
    'campaign_generation_ops_per_month',case v.plan_id when 'free_trial' then 20 when 'starter' then 100 when 'growth' then 500 when 'agency' then 1000 when 'enterprise' then 10000 else -1 end,
    'creative_variations_per_month',case v.plan_id when 'free_trial' then 20 when 'starter' then 100 when 'growth' then 500 when 'agency' then 1000 when 'enterprise' then 10000 else -1 end,
    'csv_exports_per_month',case v.plan_id when 'free_trial' then 25 when 'starter' then 100 when 'growth' then 500 when 'agency' then 1500 when 'enterprise' then 5000 else -1 end
  ),pg_catalog.now()
from public.subscription_plan_versions v where v.version=1
on conflict(plan_id,version) do nothing;
update public.subscription_plans set current_version=2,updated_at=pg_catalog.now();
-- Existing active trials move to the expanded catalog version without changing
-- their trial dates; all other subscriptions keep their historical version.
update public.workspace_subscriptions set plan_version=2,updated_at=pg_catalog.now()
where plan_id='free_trial' and status='trialing';

create or replace function tandem_internal.assign_workspace_trial()
returns trigger language plpgsql security definer set search_path = '' as $$
declare plan_version integer; trial_days integer;
begin
  select p.current_version,v.trial_days into plan_version,trial_days
    from public.subscription_plans p join public.subscription_plan_versions v on v.plan_id=p.id and v.version=p.current_version
    where p.id='free_trial' and p.is_active;
  if plan_version is null then raise exception using errcode='55000',message='Default trial plan is unavailable.'; end if;
  insert into public.workspace_subscriptions(workspace_id,plan_id,plan_version,status,billing_interval,period_start,period_end,trial_ends_at,source)
  values(new.id,'free_trial',plan_version,'trialing','monthly',pg_catalog.now(),pg_catalog.now()+pg_catalog.make_interval(days=>trial_days),pg_catalog.now()+pg_catalog.make_interval(days=>trial_days),'demo_simulation')
  on conflict(workspace_id) do nothing;
  insert into public.subscription_events(workspace_id,event_type,next_state,source,idempotency_key)
  values(new.id,'trial_started',pg_catalog.jsonb_build_object('plan_id','free_trial','plan_version',plan_version,'trial_days',trial_days),'system','workspace-trial:'||new.id::text)
  on conflict(workspace_id,idempotency_key) do nothing;
  return new;
end $$;

-- All quota checks must serialize before calculating the current usage.
create function tandem_internal.lock_billing_workspace_before_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare ws uuid;
begin
  if tg_table_name='agency_client_relationships' then ws:=new.agency_workspace_id; else ws:=new.workspace_id; end if;
  perform 1 from public.workspaces w where w.id=ws for update;
  if not found then raise exception using errcode='P0002',message='Workspace not found.'; end if;
  return new;
end $$;
revoke all on function tandem_internal.lock_billing_workspace_before_write() from public,anon,authenticated,service_role;

create trigger a_billing_campaign_lock before insert on public.campaigns for each row execute function tandem_internal.lock_billing_workspace_before_write();
create trigger a_billing_creative_lock before insert on public.creative_projects for each row execute function tandem_internal.lock_billing_workspace_before_write();
create trigger a_billing_automation_lock before insert or update of enabled on public.automation_rules for each row execute function tandem_internal.lock_billing_workspace_before_write();
create trigger a_billing_execution_lock before insert on public.automation_executions for each row execute function tandem_internal.lock_billing_workspace_before_write();
create trigger a_billing_report_lock before insert on public.report_definitions for each row execute function tandem_internal.lock_billing_workspace_before_write();
create trigger a_billing_export_lock before insert on public.report_exports for each row execute function tandem_internal.lock_billing_workspace_before_write();
create trigger a_billing_membership_lock before insert on public.workspace_memberships for each row execute function tandem_internal.lock_billing_workspace_before_write();
create trigger a_billing_asset_reservation_lock before insert on tandem_internal.creative_asset_upload_reservations for each row execute function tandem_internal.lock_billing_workspace_before_write();

create function public.billing_consume_usage(p_workspace_id uuid,p_metric_key text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid:=auth.uid(); metric text; feature text; limit_key text; used bigint; ctx jsonb; sub jsonb;
begin
  if actor is null then raise exception using errcode='28000',message='Authentication is required.'; end if;
  if p_idempotency_key is null then raise exception using errcode='22023',message='Usage idempotency key is required.'; end if;
  if p_metric_key='creative_variations' then metric:='creative_variations'; feature:='creatives.create'; limit_key:='creative_variations_per_month';
  elsif p_metric_key='campaign_generation_ops' then metric:='campaign_generation_ops'; feature:='campaigns.generate'; limit_key:='campaign_generation_ops_per_month';
  else raise exception using errcode='22023',message='This usage operation is not available.';
  end if;
  if not tandem_internal.has_workspace_role(p_workspace_id,array['owner','admin','editor']::text[]) then raise exception using errcode='42501',message='Workspace operation permission is required.'; end if;
  perform 1 from public.workspaces w where w.id=p_workspace_id for update;
  if not found then raise exception using errcode='P0002',message='Workspace not found.'; end if;
  if exists(select 1 from public.workspace_usage_events e where e.workspace_id=p_workspace_id and e.idempotency_key='operation:'||p_idempotency_key::text) then
    return pg_catalog.jsonb_build_object('status','already_recorded','metric',metric,'source','LOCAL_APPLICATION');
  end if;
  select count(*) into used from public.workspace_usage_events e where e.workspace_id=p_workspace_id and e.metric_key=metric and e.period_start=pg_catalog.date_trunc('month',pg_catalog.now())::date;
  perform tandem_internal.billing_guard_resource(p_workspace_id,feature,limit_key,used,1);
  ctx:=tandem_internal.billing_context(p_workspace_id); sub:=ctx->'subscription';
  insert into public.workspace_usage_events(workspace_id,metric_key,operation,quantity,period_start,plan_id,plan_version,idempotency_key)
  values(p_workspace_id,metric,case metric when 'creative_variations' then 'creative.variation.generated' when 'csv_exports' then 'report.exported.csv' else 'campaign.generated' end,1,pg_catalog.date_trunc('month',pg_catalog.now())::date,sub->>'plan_id',(sub->>'plan_version')::integer,'operation:'||p_idempotency_key::text)
  on conflict(workspace_id,idempotency_key) do nothing;
  return pg_catalog.jsonb_build_object('status','recorded','metric',metric,'source','LOCAL_APPLICATION');
end $$;

-- CSV/PDF exports are metered at the trusted export-record boundary. The CSV
-- operation cannot be charged by a client-posted usage event.
create function tandem_internal.guard_billing_csv_export()
returns trigger language plpgsql security definer set search_path = '' as $$
declare used bigint; ctx jsonb; sub jsonb;
begin
  if new.export_format<>'csv' then return new; end if;
  select count(*) into used from public.workspace_usage_events e
    where e.workspace_id=new.workspace_id and e.metric_key='csv_exports'
      and e.period_start=pg_catalog.date_trunc('month',pg_catalog.now())::date;
  perform tandem_internal.billing_guard_resource(new.workspace_id,'reports.export_csv','csv_exports_per_month',used,1);
  return new;
end $$;
revoke all on function tandem_internal.guard_billing_csv_export() from public,anon,authenticated,service_role;
create trigger billing_csv_export_quota before insert on public.report_exports
  for each row execute function tandem_internal.guard_billing_csv_export();

create function tandem_internal.record_billing_csv_export_usage()
returns trigger language plpgsql security definer set search_path = '' as $$
declare ctx jsonb; sub jsonb;
begin
  if new.export_format<>'csv' then return new; end if;
  ctx:=tandem_internal.billing_context(new.workspace_id); sub:=ctx->'subscription';
  insert into public.workspace_usage_events(workspace_id,metric_key,operation,quantity,period_start,source_resource_id,plan_id,plan_version,idempotency_key)
    values(new.workspace_id,'csv_exports','report.exported.csv',1,pg_catalog.date_trunc('month',pg_catalog.now())::date,new.id,
      sub->>'plan_id',(sub->>'plan_version')::integer,'csv-export:'||new.id::text)
    on conflict(workspace_id,idempotency_key) do nothing;
  return new;
end $$;
revoke all on function tandem_internal.record_billing_csv_export_usage() from public,anon,authenticated,service_role;
create trigger billing_csv_export_usage after insert on public.report_exports
  for each row execute function tandem_internal.record_billing_csv_export_usage();

create function public.billing_workspace_usage(p_workspace_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare base jsonb;
begin
  base:=public.billing_workspace_summary(p_workspace_id);
  return pg_catalog.jsonb_build_object(
    'usage',(base->'usage')||pg_catalog.jsonb_build_object(
      'campaign_generation_ops_month',(select coalesce(sum(e.quantity),0) from public.workspace_usage_events e where e.workspace_id=p_workspace_id and e.metric_key='campaign_generation_ops' and e.period_start=pg_catalog.date_trunc('month',pg_catalog.now())::date),
      'creative_variations_month',(select coalesce(sum(e.quantity),0) from public.workspace_usage_events e where e.workspace_id=p_workspace_id and e.metric_key='creative_variations' and e.period_start=pg_catalog.date_trunc('month',pg_catalog.now())::date),
  'csv_exports_month',(select coalesce(sum(e.quantity),0) from public.workspace_usage_events e where e.workspace_id=p_workspace_id and e.metric_key='csv_exports' and e.period_start=pg_catalog.date_trunc('month',pg_catalog.now())::date)),
    'limits',base->'limits','remaining',base->'remaining');
end $$;

create or replace function tandem_internal.billing_context(p_workspace_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select pg_catalog.jsonb_build_object('subscription',pg_catalog.to_jsonb(s),'plan',pg_catalog.to_jsonb(p),
    'version',pg_catalog.to_jsonb(v)||pg_catalog.jsonb_build_object('features',v.features||'{"ai.live_generation":false,"ads.live_publish":false}'::jsonb))
  from public.workspace_subscriptions s
  join public.subscription_plans p on p.id=s.plan_id
  join public.subscription_plan_versions v on v.plan_id=s.plan_id and v.version=s.plan_version
  where s.workspace_id=p_workspace_id;
$$;

create function tandem_internal.force_live_entitlements_off()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.features:=new.features||'{"ai.live_generation":false,"ads.live_publish":false}'::jsonb;
  return new;
end $$;
revoke all on function tandem_internal.force_live_entitlements_off() from public,anon,authenticated,service_role;
create trigger billing_force_live_features_off before insert or update of features on public.subscription_plan_versions for each row execute function tandem_internal.force_live_entitlements_off();

create function tandem_internal.guard_agency_client_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare used bigint;
begin
  if new.status in ('pending','active','paused') then
    select count(distinct r.client_workspace_id) into used from public.agency_client_relationships r where r.agency_workspace_id=new.agency_workspace_id and r.status in ('pending','active','paused');
    perform tandem_internal.billing_guard_resource(new.agency_workspace_id,'agency.clients.manage','agency_clients',used,case when tg_op='INSERT' then 1 else 0 end);
  end if;
  return new;
end $$;
revoke all on function tandem_internal.guard_agency_client_limit() from public,anon,authenticated,service_role;
create trigger agency_billing_client_lock before insert or update of status on public.agency_client_relationships for each row execute function tandem_internal.lock_billing_workspace_before_write();
create trigger billing_agency_client_quota before insert or update of status on public.agency_client_relationships for each row execute function tandem_internal.guard_agency_client_limit();

create function public.billing_admin_subscriptions()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.role()<>'service_role' then raise exception using errcode='42501',message='Trusted local billing operator authorization is required.'; end if;
  return coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'workspaceId',s.workspace_id,'workspaceName',w.name,'planId',s.plan_id,'planVersion',s.plan_version,
    'status',s.status,'interval',s.billing_interval,'periodEnd',s.period_end,'trialEndsAt',s.trial_ends_at,
    'cancelAtPeriodEnd',s.cancel_at_period_end,'source',s.source,'updatedAt',s.updated_at)
    order by s.updated_at desc) from (select * from public.workspace_subscriptions order by updated_at desc limit 250) s
    join public.workspaces w on w.id=s.workspace_id),'[]'::jsonb);
end $$;

revoke all on function public.billing_consume_usage(uuid,text,uuid),public.billing_admin_subscriptions() from public,anon,authenticated,service_role;
revoke all on function public.billing_workspace_usage(uuid) from public,anon,authenticated,service_role;
grant execute on function public.billing_consume_usage(uuid,text,uuid) to authenticated;
grant execute on function public.billing_workspace_usage(uuid) to authenticated;
grant execute on function public.billing_admin_subscriptions() to service_role;

commit;
