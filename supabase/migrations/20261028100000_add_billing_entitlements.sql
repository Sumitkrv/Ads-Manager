begin;

-- Prompt 10 billing foundation. All prices are local sample catalog values.
-- There are no payment-provider calls or payment credentials in this schema.
do $$ begin
  if to_regclass('public.workspaces') is null or to_regclass('public.workspace_memberships') is null
    or to_regclass('public.campaigns') is null or to_regclass('public.creative_projects') is null then
    raise exception 'Billing requires the existing workspace, campaign and creative migrations.';
  end if;
end $$;

create table public.subscription_plans (
  id text primary key check (id ~ '^[a-z][a-z0-9_]{1,39}$'),
  display_name text not null check (pg_catalog.char_length(display_name) between 1 and 80),
  description text not null default '',
  is_public boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  current_version integer not null default 1,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique(id,current_version)
);

create table public.subscription_plan_versions (
  plan_id text not null references public.subscription_plans(id),
  version integer not null check (version > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  monthly_price_minor bigint check (monthly_price_minor is null or monthly_price_minor >= 0),
  annual_price_minor bigint check (annual_price_minor is null or annual_price_minor >= 0),
  trial_days integer not null default 0 check (trial_days between 0 and 90),
  features jsonb not null check (pg_catalog.jsonb_typeof(features) = 'object'),
  limits jsonb not null check (pg_catalog.jsonb_typeof(limits) = 'object'),
  effective_at timestamptz not null default pg_catalog.now(),
  authored_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  primary key(plan_id,version)
);

create table public.workspace_subscriptions (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  plan_id text not null,
  plan_version integer not null,
  status text not null check (status in ('trialing','active_demo','past_due_demo','cancel_scheduled','cancelled','expired','suspended','legacy_access')),
  billing_interval text not null check (billing_interval in ('monthly','annual')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  trial_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  source text not null check (source in ('demo_simulation','migration')),
  legacy_until timestamptz,
  updated_at timestamptz not null default pg_catalog.now(),
  created_at timestamptz not null default pg_catalog.now(),
  foreign key(plan_id,plan_version) references public.subscription_plan_versions(plan_id,version),
  constraint workspace_subscription_period_valid check (period_end > period_start)
);
create index workspace_subscriptions_plan_idx on public.workspace_subscriptions(plan_id,status);

create table public.subscription_change_requests (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  requested_plan_id text not null,
  requested_plan_version integer not null,
  requested_interval text not null check (requested_interval in ('monthly','annual')),
  request_type text not null check (request_type in ('plan_change','cancellation','reactivation')),
  status text not null default 'pending' check (status in ('pending','activated_demo','rejected','cancelled')),
  idempotency_key uuid not null,
  reason text not null default '' check (pg_catalog.char_length(reason) <= 500),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  unique(workspace_id,idempotency_key),
  foreign key(requested_plan_id,requested_plan_version) references public.subscription_plan_versions(plan_id,version)
);
create unique index one_pending_subscription_request_per_workspace on public.subscription_change_requests(workspace_id) where status = 'pending';
create index subscription_change_requests_recent_idx on public.subscription_change_requests(workspace_id,created_at desc);

create table public.subscription_events (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('trial_started','plan_change_requested','demo_plan_activated','downgrade_scheduled','cancellation_requested','subscription_cancelled','subscription_reactivated','trial_expired','plan_catalog_changed')),
  prior_state jsonb not null default '{}'::jsonb,
  next_state jsonb not null default '{}'::jsonb,
  reason text not null default '' check (pg_catalog.char_length(reason) <= 500),
  source text not null check (source in ('demo_simulation','migration','system')),
  idempotency_key text,
  created_at timestamptz not null default pg_catalog.now(),
  unique(workspace_id,idempotency_key)
);
create index subscription_events_workspace_recent_idx on public.subscription_events(workspace_id,created_at desc);

create table public.workspace_usage_events (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  metric_key text not null,
  operation text not null,
  quantity bigint not null check (quantity > 0),
  period_start date not null,
  source_resource_id uuid,
  plan_id text not null,
  plan_version integer not null,
  idempotency_key text not null,
  provenance text not null default 'LOCAL_APPLICATION',
  created_at timestamptz not null default pg_catalog.now(),
  unique(workspace_id,idempotency_key),
  foreign key(plan_id,plan_version) references public.subscription_plan_versions(plan_id,version)
);
create index workspace_usage_events_period_idx on public.workspace_usage_events(workspace_id,metric_key,period_start);

create table public.billing_demo_invoices (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  plan_id text not null,
  plan_version integer not null,
  billing_interval text not null check (billing_interval in ('monthly','annual')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  subtotal_minor bigint not null check (subtotal_minor >= 0),
  illustrative_tax_minor bigint not null default 0 check (illustrative_tax_minor >= 0),
  total_minor bigint not null check (total_minor = subtotal_minor + illustrative_tax_minor),
  billing_period_start date not null,
  billing_period_end date not null,
  document_status text not null default 'demo_document' check (document_status = 'demo_document'),
  payment_status text not null default 'not_processed' check (payment_status = 'not_processed'),
  generated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  foreign key(plan_id,plan_version) references public.subscription_plan_versions(plan_id,version)
);
create index billing_demo_invoices_workspace_idx on public.billing_demo_invoices(workspace_id,created_at desc);
create table public.billing_demo_invoice_items (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  invoice_id uuid not null references public.billing_demo_invoices(id) on delete cascade,
  description text not null check (pg_catalog.char_length(description) between 1 and 160),
  quantity integer not null default 1 check (quantity > 0),
  unit_amount_minor bigint not null check (unit_amount_minor >= 0),
  amount_minor bigint not null check (amount_minor = quantity * unit_amount_minor),
  created_at timestamptz not null default pg_catalog.now()
);
create index billing_invoice_items_invoice_idx on public.billing_demo_invoice_items(invoice_id);

create table public.platform_admin_audit_events (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  target_id text not null,
  summary jsonb not null default '{}'::jsonb,
  source text not null default 'local_demo_admin' check (source = 'local_demo_admin'),
  created_at timestamptz not null default pg_catalog.now()
);
create index platform_admin_audit_recent_idx on public.platform_admin_audit_events(created_at desc);

-- The five public tiers have configurable sample USD prices. These are not
-- payment offers; all provider-facing integrations remain disabled.
insert into public.subscription_plans(id,display_name,description,is_public,is_active,sort_order,current_version) values
 ('free_trial','Free Trial','Explore the core Tandem Ads workflow in simulation mode.',true,true,1,1),
 ('starter','Starter','For a single business beginning its campaign workflow.',true,true,2,1),
 ('growth','Growth','For teams coordinating active campaigns and reporting.',true,true,3,1),
 ('agency','Agency','For agency workspaces coordinating multiple authorized clients.',true,true,4,1),
 ('enterprise','Enterprise','Configurable limits for larger teams and organizations.',true,true,5,1),
 ('legacy_transition','Legacy transition','Temporary migration allowance for existing workspaces.',false,true,99,1);

insert into public.subscription_plan_versions(plan_id,version,currency,monthly_price_minor,annual_price_minor,trial_days,features,limits,effective_at) values
 ('free_trial',1,'USD',0,0,14,
  '{"campaigns.create":true,"campaigns.edit":true,"campaigns.demo_publish":true,"creatives.create":true,"creatives.export":true,"brand_kit.manage":true,"assets.upload":true,"optimization.view":true,"optimization.generate":true,"automation.create":false,"automation.enable":false,"analytics.advanced":false,"reports.create":true,"reports.export_pdf":false,"reports.export_csv":true,"agency.clients.manage":false,"agency.team.manage":false,"agency.client_portal":false,"billing.manage":true,"ai.live_generation":false,"ads.live_publish":false}'::jsonb,
  '{"seats":2,"campaigns_per_month":12,"active_campaigns":8,"creative_projects":20,"storage_bytes":262144000,"automation_rules":0,"automation_executions_per_month":0,"saved_reports":3,"pdf_exports_per_month":0,"agency_clients":0}'::jsonb,pg_catalog.now()),
 ('starter',1,'USD',1900,19000,0,
  '{"campaigns.create":true,"campaigns.edit":true,"campaigns.demo_publish":true,"creatives.create":true,"creatives.export":true,"brand_kit.manage":true,"assets.upload":true,"optimization.view":true,"optimization.generate":true,"automation.create":false,"automation.enable":false,"analytics.advanced":false,"reports.create":true,"reports.export_pdf":false,"reports.export_csv":true,"agency.clients.manage":false,"agency.team.manage":true,"agency.client_portal":false,"billing.manage":true,"ai.live_generation":false,"ads.live_publish":false}'::jsonb,
  '{"seats":3,"campaigns_per_month":50,"active_campaigns":25,"creative_projects":100,"storage_bytes":2147483648,"automation_rules":0,"automation_executions_per_month":0,"saved_reports":10,"pdf_exports_per_month":0,"agency_clients":0}'::jsonb,pg_catalog.now()),
 ('growth',1,'USD',7900,79000,0,
  '{"campaigns.create":true,"campaigns.edit":true,"campaigns.demo_publish":true,"creatives.create":true,"creatives.export":true,"brand_kit.manage":true,"assets.upload":true,"optimization.view":true,"optimization.generate":true,"automation.create":true,"automation.enable":true,"analytics.advanced":true,"reports.create":true,"reports.export_pdf":true,"reports.export_csv":true,"agency.clients.manage":false,"agency.team.manage":true,"agency.client_portal":false,"billing.manage":true,"ai.live_generation":false,"ads.live_publish":false}'::jsonb,
  '{"seats":10,"campaigns_per_month":250,"active_campaigns":100,"creative_projects":500,"storage_bytes":10737418240,"automation_rules":10,"automation_executions_per_month":500,"saved_reports":50,"pdf_exports_per_month":100,"agency_clients":0}'::jsonb,pg_catalog.now()),
 ('agency',1,'USD',24900,249000,0,
  '{"campaigns.create":true,"campaigns.edit":true,"campaigns.demo_publish":true,"creatives.create":true,"creatives.export":true,"brand_kit.manage":true,"assets.upload":true,"optimization.view":true,"optimization.generate":true,"automation.create":true,"automation.enable":true,"analytics.advanced":true,"reports.create":true,"reports.export_pdf":true,"reports.export_csv":true,"agency.clients.manage":true,"agency.team.manage":true,"agency.client_portal":true,"billing.manage":true,"ai.live_generation":false,"ads.live_publish":false}'::jsonb,
  '{"seats":20,"campaigns_per_month":500,"active_campaigns":250,"creative_projects":1000,"storage_bytes":26843545600,"automation_rules":25,"automation_executions_per_month":1000,"saved_reports":100,"pdf_exports_per_month":300,"agency_clients":25}'::jsonb,pg_catalog.now()),
 ('enterprise',1,'USD',99900,999000,0,
  '{"campaigns.create":true,"campaigns.edit":true,"campaigns.demo_publish":true,"creatives.create":true,"creatives.export":true,"brand_kit.manage":true,"assets.upload":true,"optimization.view":true,"optimization.generate":true,"automation.create":true,"automation.enable":true,"analytics.advanced":true,"reports.create":true,"reports.export_pdf":true,"reports.export_csv":true,"agency.clients.manage":true,"agency.team.manage":true,"agency.client_portal":true,"billing.manage":true,"ai.live_generation":false,"ads.live_publish":false}'::jsonb,
  '{"seats":100,"campaigns_per_month":5000,"active_campaigns":2500,"creative_projects":10000,"storage_bytes":268435456000,"automation_rules":250,"automation_executions_per_month":10000,"saved_reports":1000,"pdf_exports_per_month":1000,"agency_clients":250}'::jsonb,pg_catalog.now()),
 ('legacy_transition',1,'USD',0,0,0,
  '{"campaigns.create":true,"campaigns.edit":true,"campaigns.demo_publish":true,"creatives.create":true,"creatives.export":true,"brand_kit.manage":true,"assets.upload":true,"optimization.view":true,"optimization.generate":true,"automation.create":true,"automation.enable":true,"analytics.advanced":true,"reports.create":true,"reports.export_pdf":true,"reports.export_csv":true,"agency.clients.manage":true,"agency.team.manage":true,"agency.client_portal":true,"billing.manage":true,"ai.live_generation":false,"ads.live_publish":false}'::jsonb,
  '{"seats":-1,"campaigns_per_month":-1,"active_campaigns":-1,"creative_projects":-1,"storage_bytes":-1,"automation_rules":-1,"automation_executions_per_month":-1,"saved_reports":-1,"pdf_exports_per_month":-1,"agency_clients":-1}'::jsonb,pg_catalog.now());

create or replace function tandem_internal.billing_context(p_workspace_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select pg_catalog.jsonb_build_object('subscription',pg_catalog.to_jsonb(s),'plan',pg_catalog.to_jsonb(p),'version',pg_catalog.to_jsonb(v))
  from public.workspace_subscriptions s
  join public.subscription_plans p on p.id=s.plan_id
  join public.subscription_plan_versions v on v.plan_id=s.plan_id and v.version=s.plan_version
  where s.workspace_id=p_workspace_id;
$$;
revoke all on function tandem_internal.billing_context(uuid) from public,anon,authenticated,service_role;

create or replace function tandem_internal.billing_guard_resource(
 p_workspace_id uuid,p_feature text,p_metric text,p_current_usage bigint,p_quantity bigint default 1
) returns void language plpgsql security definer set search_path = '' as $$
declare ctx jsonb; sub jsonb; features jsonb; limits jsonb; entitlement bigint; legacy_until timestamptz;
begin
  if p_workspace_id is null then raise exception using errcode='22023',message='Workspace is required.'; end if;
  -- A row lock serializes reservations for the same workspace, including concurrent API/RPC callers.
  perform 1 from public.workspaces w where w.id=p_workspace_id for update;
  if not found then raise exception using errcode='P0002',message='Workspace not found.'; end if;
  ctx:=tandem_internal.billing_context(p_workspace_id);
  if ctx is null then raise exception using errcode='55000',message='Workspace billing setup is unavailable.'; end if;
  sub:=ctx->'subscription'; features:=ctx->'version'->'features'; limits:=ctx->'version'->'limits';
  if sub->>'status'='legacy_access' then
    legacy_until:=(sub->>'legacy_until')::timestamptz;
    if legacy_until is not null and legacy_until>pg_catalog.now() then return; end if;
  end if;
  if sub->>'status'='trialing' and (sub->>'trial_ends_at')::timestamptz<=pg_catalog.now() then
    raise exception using errcode='54000',message='The workspace trial has expired. Existing records remain available; select a plan to resume creating resources.';
  end if;
  if sub->>'status' in ('expired','cancelled','suspended') and (sub->>'period_end')::timestamptz<=pg_catalog.now() then
    raise exception using errcode='54000',message='This subscription is read-only. Select a plan to create new resources.';
  end if;
  if coalesce((features->>p_feature)::boolean,false)=false then
    raise exception using errcode='42501',message='This workspace plan does not include the requested feature.';
  end if;
  entitlement:=coalesce((limits->>p_metric)::bigint,0);
  if entitlement>=0 and p_current_usage+p_quantity>entitlement then
    raise exception using errcode='54000',message='The workspace plan quota has been reached.';
  end if;
end $$;
revoke all on function tandem_internal.billing_guard_resource(uuid,text,text,bigint,bigint) from public,anon,authenticated,service_role;

create or replace function tandem_internal.billing_guard_before_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare used bigint:=0; feature text; metric text; ws uuid; qty bigint:=1; archive_state text;
begin
  ws:=new.workspace_id;
  case tg_table_name
    when 'campaigns' then
      feature:='campaigns.create';
      if tg_op='INSERT' then
        metric:='campaigns_per_month';
        select count(*) into used from public.campaigns c where c.workspace_id=ws and c.created_at>=pg_catalog.date_trunc('month',pg_catalog.now());
        perform tandem_internal.billing_guard_resource(ws,feature,metric,used,1);
        select count(*) into used from public.campaigns c where c.workspace_id=ws and c.archived_at is null;
        perform tandem_internal.billing_guard_resource(ws,feature,'active_campaigns',used,1);
      end if;
    when 'creative_projects' then
      feature:='creatives.create'; metric:='creative_projects';
      select count(*) into used from public.creative_projects c where c.workspace_id=ws and c.lifecycle_status<>'archived';
      perform tandem_internal.billing_guard_resource(ws,feature,metric,used,case when tg_op='INSERT' then 1 else 0 end);
    when 'creative_asset_upload_reservations' then
      feature:='assets.upload'; metric:='storage_bytes'; qty:=new.size_bytes;
      select coalesce(sum(a.size_bytes),0) into used from public.creative_assets a where a.workspace_id=ws and a.asset_status='active';
      used:=used+coalesce((select sum(r.size_bytes) from tandem_internal.creative_asset_upload_reservations r where r.workspace_id=ws and r.expires_at>pg_catalog.now()),0);
      perform tandem_internal.billing_guard_resource(ws,feature,metric,used,qty);
    when 'automation_rules' then
      if tg_op='INSERT' then
        feature:='automation.create'; metric:='automation_rules';
        select count(*) into used from public.automation_rules r where r.workspace_id=ws and r.archived_at is null;
        perform tandem_internal.billing_guard_resource(ws,feature,metric,used,1);
      end if;
      if new.enabled and (tg_op='INSERT' or not old.enabled) then
        feature:='automation.enable'; metric:='automation_rules';
        select count(*) into used from public.automation_rules r where r.workspace_id=ws and r.archived_at is null and r.enabled and (tg_op='INSERT' or r.id<>new.id);
        perform tandem_internal.billing_guard_resource(ws,feature,metric,used,1);
      end if;
    when 'automation_executions' then
      feature:='automation.enable'; metric:='automation_executions_per_month';
      select count(*) into used from public.automation_executions e where e.workspace_id=ws and e.created_at>=pg_catalog.date_trunc('month',pg_catalog.now());
      perform tandem_internal.billing_guard_resource(ws,feature,metric,used,1);
    when 'report_definitions' then
      feature:='reports.create'; metric:='saved_reports';
      select count(*) into used from public.report_definitions r where r.workspace_id=ws and r.status='active';
      perform tandem_internal.billing_guard_resource(ws,feature,metric,used,1);
    when 'report_exports' then
      feature:=case when new.export_format='pdf' then 'reports.export_pdf' else 'reports.export_csv' end;
      metric:='pdf_exports_per_month';
      if new.export_format='pdf' then
        select count(*) into used from public.report_exports e where e.workspace_id=ws and e.export_format='pdf' and e.created_at>=pg_catalog.date_trunc('month',pg_catalog.now());
        perform tandem_internal.billing_guard_resource(ws,feature,metric,used,1);
      else
        perform tandem_internal.billing_guard_resource(ws,feature,'saved_reports',0,0);
      end if;
    when 'workspace_memberships' then
      -- Workspace creator membership is part of account provisioning; seat
      -- allowance is enforced here without granting a team-management feature.
      feature:='billing.manage'; metric:='seats';
      select count(*) into used from public.workspace_memberships m where m.workspace_id=ws;
      -- Every plan includes its listed member seats, including workspaces where only team membership applies.
      perform tandem_internal.billing_guard_resource(ws,feature,metric,used,1);
    else return new;
  end case;
  return new;
end $$;
revoke all on function tandem_internal.billing_guard_before_write() from public,anon,authenticated,service_role;

create or replace function tandem_internal.billing_record_resource_usage()
returns trigger language plpgsql security definer set search_path = '' as $$
declare ws uuid:=new.workspace_id; metric text; op text; qty bigint:=1; ctx jsonb; sub jsonb;
begin
  case tg_table_name
    when 'campaigns' then metric:='campaigns_created'; op:='campaign.created';
    when 'creative_projects' then metric:='creative_projects'; op:='creative.created';
    when 'creative_asset_upload_reservations' then return new;
    when 'automation_rules' then if tg_op='INSERT' then metric:='automation_rules'; op:='automation.created'; end if;
    when 'automation_executions' then metric:='automation_executions'; op:='automation.executed';
    when 'report_definitions' then metric:='saved_reports'; op:='report.created';
    when 'report_exports' then if new.export_format='pdf' then metric:='pdf_exports'; op:='report.exported.pdf'; else return new; end if;
    when 'workspace_memberships' then metric:='seats'; op:='seat.added';
    else return new;
  end case;
  if metric is null then return new; end if;
  ctx:=tandem_internal.billing_context(ws); sub:=ctx->'subscription';
  if tg_table_name='creative_asset_upload_reservations' then qty:=new.size_bytes; end if;
  insert into public.workspace_usage_events(workspace_id,metric_key,operation,quantity,period_start,source_resource_id,plan_id,plan_version,idempotency_key)
  values(ws,metric,op,qty,pg_catalog.date_trunc('month',pg_catalog.now())::date,new.id,(sub->>'plan_id'),(sub->>'plan_version')::integer,tg_table_name||':'||new.id::text)
  on conflict(workspace_id,idempotency_key) do nothing;
  return new;
end $$;
revoke all on function tandem_internal.billing_record_resource_usage() from public,anon,authenticated,service_role;

create trigger billing_campaign_quota before insert on public.campaigns for each row execute function tandem_internal.billing_guard_before_write();
create trigger billing_creative_quota before insert on public.creative_projects for each row execute function tandem_internal.billing_guard_before_write();
create trigger billing_asset_reservation_quota before insert on tandem_internal.creative_asset_upload_reservations for each row execute function tandem_internal.billing_guard_before_write();
create trigger billing_automation_quota before insert or update of enabled on public.automation_rules for each row execute function tandem_internal.billing_guard_before_write();
create trigger billing_automation_execution_quota before insert on public.automation_executions for each row execute function tandem_internal.billing_guard_before_write();
create trigger billing_report_quota before insert on public.report_definitions for each row execute function tandem_internal.billing_guard_before_write();
create trigger billing_export_quota before insert on public.report_exports for each row execute function tandem_internal.billing_guard_before_write();
create trigger billing_seat_quota before insert on public.workspace_memberships for each row execute function tandem_internal.billing_guard_before_write();

create trigger billing_campaign_usage after insert on public.campaigns for each row execute function tandem_internal.billing_record_resource_usage();
create trigger billing_creative_usage after insert on public.creative_projects for each row execute function tandem_internal.billing_record_resource_usage();
create trigger billing_automation_usage after insert on public.automation_rules for each row execute function tandem_internal.billing_record_resource_usage();
create trigger billing_automation_execution_usage after insert on public.automation_executions for each row execute function tandem_internal.billing_record_resource_usage();
create trigger billing_report_usage after insert on public.report_definitions for each row execute function tandem_internal.billing_record_resource_usage();
create trigger billing_export_usage after insert on public.report_exports for each row execute function tandem_internal.billing_record_resource_usage();
create trigger billing_seat_usage after insert on public.workspace_memberships for each row execute function tandem_internal.billing_record_resource_usage();

-- Existing workspaces receive a finite, hidden transition plan for 90 days so
-- migration does not remove access or silently delete existing resources.
insert into public.workspace_subscriptions(workspace_id,plan_id,plan_version,status,billing_interval,period_start,period_end,source,legacy_until)
select w.id,'legacy_transition',1,'legacy_access','monthly',pg_catalog.now(),pg_catalog.now()+interval '1 year','migration',pg_catalog.now()+interval '90 days'
from public.workspaces w on conflict(workspace_id) do nothing;

create or replace function tandem_internal.assign_workspace_trial()
returns trigger language plpgsql security definer set search_path = '' as $$
declare trial_days integer;
begin
  select v.trial_days into trial_days from public.subscription_plan_versions v where v.plan_id='free_trial' and v.version=1;
  insert into public.workspace_subscriptions(workspace_id,plan_id,plan_version,status,billing_interval,period_start,period_end,trial_ends_at,source)
  values(new.id,'free_trial',1,'trialing','monthly',pg_catalog.now(),pg_catalog.now()+pg_catalog.make_interval(days=>trial_days),pg_catalog.now()+pg_catalog.make_interval(days=>trial_days),'demo_simulation')
  on conflict(workspace_id) do nothing;
  insert into public.subscription_events(workspace_id,event_type,next_state,source,idempotency_key)
  values(new.id,'trial_started',pg_catalog.jsonb_build_object('plan_id','free_trial','trial_days',trial_days),'system','workspace-trial:'||new.id::text)
  on conflict(workspace_id,idempotency_key) do nothing;
  return new;
end $$;
revoke all on function tandem_internal.assign_workspace_trial() from public,anon,authenticated,service_role;
create trigger workspace_default_trial after insert on public.workspaces for each row execute function tandem_internal.assign_workspace_trial();

create function public.billing_public_plans()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id',p.id,'name',p.display_name,'description',p.description,'currency',v.currency,
    'monthlyPriceMinor',v.monthly_price_minor,'annualPriceMinor',v.annual_price_minor,'trialDays',v.trial_days,
    'features',v.features,'limits',v.limits,'public',p.is_public,'active',p.is_active,'sortOrder',p.sort_order,
    'version',v.version,'effectiveAt',v.effective_at
  ) order by p.sort_order),'[]'::jsonb)
  from public.subscription_plans p join public.subscription_plan_versions v on v.plan_id=p.id and v.version=p.current_version
  where p.is_public and p.is_active;
$$;

create function public.billing_workspace_summary(p_workspace_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare ctx jsonb; s jsonb; p jsonb; v jsonb; usage jsonb; pending jsonb; notice_array jsonb:='[]'::jsonb;
begin
  if auth.uid() is null then raise exception using errcode='28000',message='Authentication is required.'; end if;
  if not tandem_internal.has_workspace_role(p_workspace_id,array['owner','admin','editor','viewer']::text[]) then raise exception using errcode='P0002',message='Workspace not found.'; end if;
  update public.workspace_subscriptions set status='expired',updated_at=pg_catalog.now()
    where workspace_id=p_workspace_id and status='trialing' and trial_ends_at<=pg_catalog.now();
  if found then
    insert into public.subscription_events(workspace_id,event_type,prior_state,next_state,source,idempotency_key)
    values(p_workspace_id,'trial_expired','{"status":"trialing"}'::jsonb,'{"status":"expired"}'::jsonb,'system','trial-expired:'||p_workspace_id::text)
    on conflict(workspace_id,idempotency_key) do nothing;
  end if;
  ctx:=tandem_internal.billing_context(p_workspace_id);
  if ctx is null then raise exception using errcode='55000',message='Workspace billing setup is unavailable.'; end if;
  s:=ctx->'subscription'; p:=ctx->'plan'; v:=ctx->'version';
  select pg_catalog.jsonb_build_object(
    'campaigns_created_month',(select count(*) from public.workspace_usage_events e where e.workspace_id=p_workspace_id and e.metric_key='campaigns_created' and e.period_start=pg_catalog.date_trunc('month',pg_catalog.now())::date),
    'active_campaigns',(select count(*) from public.campaigns c where c.workspace_id=p_workspace_id and c.archived_at is null),
    'creative_projects',(select count(*) from public.creative_projects c where c.workspace_id=p_workspace_id and c.lifecycle_status<>'archived'),
    'storage_bytes',(select coalesce(sum(a.size_bytes),0) from public.creative_assets a where a.workspace_id=p_workspace_id and a.asset_status='active'),
    'automation_rules',(select count(*) from public.automation_rules r where r.workspace_id=p_workspace_id and r.archived_at is null and r.enabled),
    'automation_executions_month',(select count(*) from public.workspace_usage_events e where e.workspace_id=p_workspace_id and e.metric_key='automation_executions' and e.period_start=pg_catalog.date_trunc('month',pg_catalog.now())::date),
    'saved_reports',(select count(*) from public.report_definitions r where r.workspace_id=p_workspace_id and r.status='active'),
    'pdf_exports_month',(select count(*) from public.workspace_usage_events e where e.workspace_id=p_workspace_id and e.metric_key='pdf_exports' and e.period_start=pg_catalog.date_trunc('month',pg_catalog.now())::date),
    'seats',(select count(*) from public.workspace_memberships m where m.workspace_id=p_workspace_id)
  ) into usage;
  select pg_catalog.to_jsonb(r) into pending from public.subscription_change_requests r where r.workspace_id=p_workspace_id and r.status='pending' order by r.created_at desc limit 1;
  if s->>'status'='trialing' then notice_array:=notice_array||pg_catalog.jsonb_build_array('Free trial. No payment method is stored and no automatic renewal occurs.'); end if;
  if s->>'status'='legacy_access' then notice_array:=notice_array||pg_catalog.jsonb_build_array('Legacy transition access is temporary; review the plan catalog before the transition window ends.'); end if;
  if s->>'status'='expired' then notice_array:=notice_array||pg_catalog.jsonb_build_array('Trial expired. Existing data is preserved; new resource creation requires an active plan.'); end if;
  if s->>'cancel_at_period_end'='true' then notice_array:=notice_array||pg_catalog.jsonb_build_array('Cancellation is scheduled at the end of this simulated period.'); end if;
  return pg_catalog.jsonb_build_object('mode','simulation','subscription',pg_catalog.jsonb_build_object(
    'workspaceId',s->>'workspace_id','planId',s->>'plan_id','planVersion',(s->>'plan_version')::integer,'status',s->>'status','interval',s->>'billing_interval',
    'periodStart',s->>'period_start','periodEnd',s->>'period_end','trialEndsAt',s->>'trial_ends_at','cancelAtPeriodEnd',(s->>'cancel_at_period_end')::boolean,
    'source',s->>'source','legacyUntil',s->>'legacy_until'),
    'plan',pg_catalog.jsonb_build_object('id',p->>'id','name',p->>'display_name','description',p->>'description','currency',v->>'currency',
      'monthlyPriceMinor',(v->>'monthly_price_minor')::bigint,'annualPriceMinor',(v->>'annual_price_minor')::bigint,'trialDays',(v->>'trial_days')::integer,
      'features',v->'features','limits',v->'limits','public',p->>'is_public'='true','active',p->>'is_active'='true','sortOrder',(p->>'sort_order')::integer,'version',(v->>'version')::integer,'effectiveAt',v->>'effective_at'),
    'features',v->'features','limits',v->'limits','usage',usage,'remaining',pg_catalog.jsonb_build_object(
      'campaigns_per_month',case when (v->'limits'->>'campaigns_per_month')::bigint<0 then null else greatest(0,(v->'limits'->>'campaigns_per_month')::bigint-(usage->>'campaigns_created_month')::bigint) end,
      'active_campaigns',case when (v->'limits'->>'active_campaigns')::bigint<0 then null else greatest(0,(v->'limits'->>'active_campaigns')::bigint-(usage->>'active_campaigns')::bigint) end,
      'creative_projects',case when (v->'limits'->>'creative_projects')::bigint<0 then null else greatest(0,(v->'limits'->>'creative_projects')::bigint-(usage->>'creative_projects')::bigint) end,
      'storage_bytes',case when (v->'limits'->>'storage_bytes')::bigint<0 then null else greatest(0,(v->'limits'->>'storage_bytes')::bigint-(usage->>'storage_bytes')::bigint) end,
      'seats',case when (v->'limits'->>'seats')::bigint<0 then null else greatest(0,(v->'limits'->>'seats')::bigint-(usage->>'seats')::bigint) end),
    'pendingChange',pending,'notices',notice_array);
end $$;

create function public.billing_request_plan_change(p_workspace_id uuid,p_plan_id text,p_interval text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid:=auth.uid(); plan public.subscription_plans; ver public.subscription_plan_versions; result public.subscription_change_requests;
begin
  if actor is null then raise exception using errcode='28000',message='Authentication is required.'; end if;
  if p_interval not in ('monthly','annual') or p_idempotency_key is null then raise exception using errcode='22023',message='Plan request is invalid.'; end if;
  if not tandem_internal.has_workspace_role(p_workspace_id,array['owner','admin']::text[]) then raise exception using errcode='42501',message='Workspace owner or admin permission is required.'; end if;
  select * into plan from public.subscription_plans where id=p_plan_id and is_public and is_active;
  if not found then raise exception using errcode='22023',message='The selected plan is unavailable.'; end if;
  select * into ver from public.subscription_plan_versions where plan_id=plan.id and version=plan.current_version;
  if p_interval='annual' and ver.annual_price_minor is null then raise exception using errcode='22023',message='Annual billing is unavailable for this plan.'; end if;
  insert into public.subscription_change_requests(workspace_id,requested_by,requested_plan_id,requested_plan_version,requested_interval,request_type,idempotency_key)
  values(p_workspace_id,actor,plan.id,ver.version,p_interval,'plan_change',p_idempotency_key)
  on conflict(workspace_id,idempotency_key) do update set idempotency_key=excluded.idempotency_key returning * into result;
  insert into public.subscription_events(workspace_id,actor_user_id,event_type,next_state,source,idempotency_key)
  values(p_workspace_id,actor,'plan_change_requested',pg_catalog.jsonb_build_object('plan_id',plan.id,'version',ver.version,'interval',p_interval),'demo_simulation','plan-request:'||p_idempotency_key::text)
  on conflict(workspace_id,idempotency_key) do nothing;
  return pg_catalog.to_jsonb(result);
end $$;

create function public.billing_request_cancellation(p_workspace_id uuid,p_idempotency_key uuid,p_reason text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid:=auth.uid(); s public.workspace_subscriptions; result public.subscription_change_requests;
begin
  if actor is null then raise exception using errcode='28000',message='Authentication is required.'; end if;
  if not tandem_internal.has_workspace_role(p_workspace_id,array['owner','admin']::text[]) then raise exception using errcode='42501',message='Workspace owner or admin permission is required.'; end if;
  select * into s from public.workspace_subscriptions where workspace_id=p_workspace_id for update;
  if not found then raise exception using errcode='P0002',message='Subscription not found.'; end if;
  if s.status not in ('trialing','active_demo','past_due_demo','cancel_scheduled','legacy_access') then raise exception using errcode='22023',message='This subscription cannot be cancelled.'; end if;
  insert into public.subscription_change_requests(workspace_id,requested_by,requested_plan_id,requested_plan_version,requested_interval,request_type,idempotency_key,reason,status)
    values(p_workspace_id,actor,s.plan_id,s.plan_version,s.billing_interval,'cancellation',p_idempotency_key,coalesce(p_reason,''),'pending')
    on conflict(workspace_id,idempotency_key) do update set idempotency_key=excluded.idempotency_key returning * into result;
  update public.workspace_subscriptions set cancel_at_period_end=true,status='cancel_scheduled',updated_at=pg_catalog.now() where workspace_id=p_workspace_id;
  insert into public.subscription_events(workspace_id,actor_user_id,event_type,prior_state,next_state,reason,source,idempotency_key)
    values(p_workspace_id,actor,'cancellation_requested',pg_catalog.to_jsonb(s),'{"status":"cancel_scheduled"}'::jsonb,coalesce(p_reason,''),'demo_simulation','cancel:'||p_idempotency_key::text)
    on conflict(workspace_id,idempotency_key) do nothing;
  return pg_catalog.to_jsonb(result);
end $$;

create function public.billing_request_reactivation(p_workspace_id uuid,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid:=auth.uid(); s public.workspace_subscriptions; result public.subscription_change_requests;
begin
  if actor is null then raise exception using errcode='28000',message='Authentication is required.'; end if;
  if not tandem_internal.has_workspace_role(p_workspace_id,array['owner','admin']::text[]) then raise exception using errcode='42501',message='Workspace owner or admin permission is required.'; end if;
  select * into s from public.workspace_subscriptions where workspace_id=p_workspace_id for update;
  if not found or not s.cancel_at_period_end then raise exception using errcode='22023',message='No scheduled cancellation can be reversed.'; end if;
  insert into public.subscription_change_requests(workspace_id,requested_by,requested_plan_id,requested_plan_version,requested_interval,request_type,idempotency_key)
    values(p_workspace_id,actor,s.plan_id,s.plan_version,s.billing_interval,'reactivation',p_idempotency_key)
    on conflict(workspace_id,idempotency_key) do update set idempotency_key=excluded.idempotency_key returning * into result;
  update public.workspace_subscriptions set status=case when trial_ends_at>pg_catalog.now() then 'trialing' else 'active_demo' end,cancel_at_period_end=false,updated_at=pg_catalog.now() where workspace_id=p_workspace_id;
  insert into public.subscription_events(workspace_id,actor_user_id,event_type,prior_state,next_state,source,idempotency_key)
    values(p_workspace_id,actor,'subscription_reactivated',pg_catalog.to_jsonb(s),'{"cancel_at_period_end":false}'::jsonb,'demo_simulation','reactivate:'||p_idempotency_key::text)
    on conflict(workspace_id,idempotency_key) do nothing;
  return pg_catalog.to_jsonb(result);
end $$;

create function public.billing_workspace_history(p_workspace_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception using errcode='28000',message='Authentication is required.'; end if;
  if not tandem_internal.has_workspace_role(p_workspace_id,array['owner','admin','editor','viewer']::text[]) then raise exception using errcode='P0002',message='Workspace not found.'; end if;
  return pg_catalog.jsonb_build_object(
    'events',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',e.id,'eventType',e.event_type,'priorState',e.prior_state,'nextState',e.next_state,'reason',e.reason,'source',e.source,'createdAt',e.created_at) order by e.created_at desc) from (select * from public.subscription_events where workspace_id=p_workspace_id order by created_at desc limit 100) e),'[]'::jsonb),
    'invoices',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',i.id,'planId',i.plan_id,'planVersion',i.plan_version,'interval',i.billing_interval,'currency',i.currency,'subtotalMinor',i.subtotal_minor,'illustrativeTaxMinor',i.illustrative_tax_minor,'totalMinor',i.total_minor,'billingPeriodStart',i.billing_period_start,'billingPeriodEnd',i.billing_period_end,'documentStatus',i.document_status,'paymentStatus',i.payment_status,'createdAt',i.created_at) order by i.created_at desc) from (select * from public.billing_demo_invoices where workspace_id=p_workspace_id order by created_at desc limit 100) i),'[]'::jsonb));
end $$;

create function public.billing_invoice_document(p_workspace_id uuid,p_invoice_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare invoice_row public.billing_demo_invoices;
begin
  if auth.uid() is null then raise exception using errcode='28000',message='Authentication is required.'; end if;
  if not tandem_internal.has_workspace_role(p_workspace_id,array['owner','admin','editor']::text[]) then raise exception using errcode='P0002',message='Invoice not found.'; end if;
  select * into invoice_row from public.billing_demo_invoices where workspace_id=p_workspace_id and id=p_invoice_id;
  if not found then raise exception using errcode='P0002',message='Invoice not found.'; end if;
  return pg_catalog.jsonb_build_object('invoice',pg_catalog.to_jsonb(invoice_row),'items',coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(i) order by i.created_at) from public.billing_demo_invoice_items i where i.invoice_id=invoice_row.id),'[]'::jsonb),
    'workspace',pg_catalog.jsonb_build_object('name',(select w.name from public.workspaces w where w.id=p_workspace_id)));
end $$;

-- This function is executable only by the server service role. The API adds
-- a second gate: local APP_ENV, loopback Supabase URL, and an explicit user ID allowlist.
create function public.billing_simulate_plan_activation(p_request_id uuid,p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare req public.subscription_change_requests; current_sub public.workspace_subscriptions; v public.subscription_plan_versions; inv public.billing_demo_invoices; total bigint; next_status text;
begin
  if auth.role()<>'service_role' or p_actor_id is null then raise exception using errcode='42501',message='Trusted local billing operator authorization is required.'; end if;
  select * into req from public.subscription_change_requests where id=p_request_id for update;
  if not found or req.status<>'pending' then raise exception using errcode='40001',message='The request is no longer pending.'; end if;
  select * into current_sub from public.workspace_subscriptions where workspace_id=req.workspace_id for update;
  if not found then raise exception using errcode='P0002',message='Workspace subscription not found.'; end if;
  if req.request_type='plan_change' then
    select * into v from public.subscription_plan_versions where plan_id=req.requested_plan_id and version=req.requested_plan_version;
    if not found then raise exception using errcode='22023',message='Requested plan version is unavailable.'; end if;
    next_status:=case when req.requested_plan_id='free_trial' then 'trialing' else 'active_demo' end;
    update public.workspace_subscriptions set plan_id=req.requested_plan_id,plan_version=req.requested_plan_version,status=next_status,billing_interval=req.requested_interval,
      period_start=pg_catalog.now(),period_end=pg_catalog.now()+case when req.requested_interval='annual' then interval '1 year' else interval '1 month' end,
      trial_ends_at=case when req.requested_plan_id='free_trial' then pg_catalog.now()+pg_catalog.make_interval(days=>v.trial_days) else null end,
      cancel_at_period_end=false,source='demo_simulation',legacy_until=null,updated_at=pg_catalog.now()
      where workspace_id=req.workspace_id;
    total:=case when req.requested_interval='annual' then coalesce(v.annual_price_minor,0) else coalesce(v.monthly_price_minor,0) end;
    insert into public.billing_demo_invoices(workspace_id,plan_id,plan_version,billing_interval,currency,subtotal_minor,total_minor,billing_period_start,billing_period_end,generated_by)
      values(req.workspace_id,v.plan_id,v.version,req.requested_interval,v.currency,total,total,pg_catalog.current_date,(pg_catalog.current_date+case when req.requested_interval='annual' then interval '1 year' else interval '1 month' end)::date,p_actor_id) returning * into inv;
    insert into public.billing_demo_invoice_items(invoice_id,description,quantity,unit_amount_minor,amount_minor)
      values(inv.id,v.plan_id||' sample plan · '||req.requested_interval,1,total,total);
    insert into public.subscription_events(workspace_id,actor_user_id,event_type,prior_state,next_state,source,idempotency_key)
      values(req.workspace_id,p_actor_id,'demo_plan_activated',pg_catalog.to_jsonb(current_sub),pg_catalog.jsonb_build_object('plan_id',v.plan_id,'version',v.version,'status',next_status,'interval',req.requested_interval,'invoice_id',inv.id),'demo_simulation','activate-request:'||req.id::text);
  elsif req.request_type='cancellation' then
    update public.workspace_subscriptions set status='cancelled',cancel_at_period_end=false,period_end=pg_catalog.now(),updated_at=pg_catalog.now() where workspace_id=req.workspace_id;
    insert into public.subscription_events(workspace_id,actor_user_id,event_type,prior_state,next_state,reason,source,idempotency_key)
      values(req.workspace_id,p_actor_id,'subscription_cancelled',pg_catalog.to_jsonb(current_sub),'{"status":"cancelled"}'::jsonb,req.reason,'demo_simulation','admin-cancel:'||req.id::text);
  elsif req.request_type='reactivation' then
    update public.workspace_subscriptions set cancel_at_period_end=false,status=case when trial_ends_at>pg_catalog.now() then 'trialing' else 'active_demo' end,updated_at=pg_catalog.now() where workspace_id=req.workspace_id;
    insert into public.subscription_events(workspace_id,actor_user_id,event_type,prior_state,next_state,source,idempotency_key)
      values(req.workspace_id,p_actor_id,'subscription_reactivated',pg_catalog.to_jsonb(current_sub),'{"cancel_at_period_end":false}'::jsonb,'demo_simulation','admin-reactivate:'||req.id::text);
  end if;
  update public.subscription_change_requests set status='activated_demo',decided_by=p_actor_id,decided_at=pg_catalog.now() where id=req.id returning * into req;
  insert into public.platform_admin_audit_events(actor_user_id,action,target_id,summary)
    values(p_actor_id,'demo_subscription_transition',req.workspace_id::text,pg_catalog.jsonb_build_object('request_id',req.id,'request_type',req.request_type,'plan_id',req.requested_plan_id,'plan_version',req.requested_plan_version));
  return pg_catalog.jsonb_build_object('requestId',req.id,'workspaceId',req.workspace_id,'status',req.status,'invoiceId',case when inv.id is null then null else inv.id end,'mode','simulation','paymentProcessed',false);
end $$;

create function public.billing_admin_plan_catalog()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',p.id,'name',p.display_name,'description',p.description,'public',p.is_public,'active',p.is_active,'sortOrder',p.sort_order,'version',v.version,'currency',v.currency,'monthlyPriceMinor',v.monthly_price_minor,'annualPriceMinor',v.annual_price_minor,'trialDays',v.trial_days,'features',v.features,'limits',v.limits,'effectiveAt',v.effective_at) order by p.sort_order),'[]'::jsonb)
  from public.subscription_plans p join public.subscription_plan_versions v on v.plan_id=p.id and v.version=p.current_version;
$$;
create function public.billing_admin_save_plan(p_plan jsonb,p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare plan_id text; current_plan public.subscription_plans; new_version integer; saved public.subscription_plan_versions;
begin
  if auth.role()<>'service_role' or p_actor_id is null then raise exception using errcode='42501',message='Trusted local billing operator authorization is required.'; end if;
  plan_id:=p_plan->>'id';
  if plan_id is null or plan_id !~ '^[a-z][a-z0-9_]{1,39}$' or pg_catalog.jsonb_typeof(p_plan->'features')<>'object' or pg_catalog.jsonb_typeof(p_plan->'limits')<>'object' then
    raise exception using errcode='22023',message='Plan catalog input is invalid.';
  end if;
  select * into current_plan from public.subscription_plans where id=plan_id for update;
  if not found then
    insert into public.subscription_plans(id,display_name,description,is_public,is_active,sort_order,current_version)
    values(plan_id,p_plan->>'name',coalesce(p_plan->>'description',''),coalesce((p_plan->>'public')::boolean,true),coalesce((p_plan->>'active')::boolean,true),coalesce((p_plan->>'sortOrder')::integer,100),1);
    new_version:=1;
  else new_version:=current_plan.current_version+1;
  end if;
  insert into public.subscription_plan_versions(plan_id,version,currency,monthly_price_minor,annual_price_minor,trial_days,features,limits,effective_at,authored_by)
  values(plan_id,new_version,coalesce(p_plan->>'currency','USD'),nullif(p_plan->>'monthlyPriceMinor','')::bigint,nullif(p_plan->>'annualPriceMinor','')::bigint,coalesce((p_plan->>'trialDays')::integer,0),p_plan->'features',p_plan->'limits',pg_catalog.now(),p_actor_id) returning * into saved;
  update public.subscription_plans set display_name=p_plan->>'name',description=coalesce(p_plan->>'description',''),is_public=coalesce((p_plan->>'public')::boolean,true),is_active=coalesce((p_plan->>'active')::boolean,true),sort_order=coalesce((p_plan->>'sortOrder')::integer,100),current_version=new_version,updated_at=pg_catalog.now() where id=plan_id;
  insert into public.platform_admin_audit_events(actor_user_id,action,target_id,summary)
    values(p_actor_id,'plan_version_created',plan_id,pg_catalog.jsonb_build_object('version',new_version,'currency',saved.currency,'monthlyPriceMinor',saved.monthly_price_minor,'annualPriceMinor',saved.annual_price_minor));
  return pg_catalog.jsonb_build_object('id',plan_id,'version',new_version);
end $$;

-- Extend the existing validated upload reservation boundary with plan limits.
create or replace function public.reserve_creative_asset_upload(
  p_workspace_id uuid,p_user_id uuid,p_reservation_id uuid,p_asset_id uuid,p_asset_type text,p_original_filename text,
  p_mime_type text,p_size_bytes integer,p_width integer,p_height integer
) returns table(reservation_id uuid,storage_path text,expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare workspace_lock uuid; object_path text; active_count bigint; active_bytes bigint; pending_count bigint; pending_bytes bigint; max_assets bigint; max_bytes bigint; ctx jsonb; sub jsonb; ver jsonb;
begin
  if p_workspace_id is null or p_user_id is null or p_reservation_id is null or p_asset_id is null
    or p_asset_type not in ('logo','image') or p_mime_type not in ('image/png','image/jpeg','image/webp') or p_size_bytes not between 1 and 5242880
    or p_width not between 1 and 8192 or p_height not between 1 and 8192 or p_width::bigint*p_height::bigint>16000000
    or pg_catalog.char_length(p_original_filename) not between 1 and 255 or pg_catalog.strpos(p_original_filename,'/')>0 or pg_catalog.strpos(p_original_filename,pg_catalog.chr(92))>0 then
    raise exception using errcode='22023',message='Creative upload metadata is invalid.';
  end if;
  select w.id into workspace_lock from public.workspaces w where w.id=p_workspace_id for update;
  if workspace_lock is null or not exists(select 1 from public.workspace_memberships m where m.workspace_id=p_workspace_id and m.user_id=p_user_id and m.role in ('owner','admin','editor')) then
    raise exception using errcode='42501',message='Workspace upload permission is required.';
  end if;
  ctx:=tandem_internal.billing_context(p_workspace_id); sub:=ctx->'subscription'; ver:=ctx->'version';
  perform tandem_internal.billing_guard_resource(p_workspace_id,'assets.upload','storage_bytes',0,0);
  max_bytes:=coalesce((ver->'limits'->>'storage_bytes')::bigint,0);
  object_path:=p_workspace_id::text||'/'||p_asset_id::text||case p_mime_type when 'image/png' then '.png' when 'image/jpeg' then '.jpg' else '.webp' end;
  select count(*),coalesce(sum(a.size_bytes),0) into active_count,active_bytes from public.creative_assets a where a.workspace_id=p_workspace_id and a.asset_status='active';
  select count(*),coalesce(sum(r.size_bytes),0) into pending_count,pending_bytes from tandem_internal.creative_asset_upload_reservations r where r.workspace_id=p_workspace_id and r.expires_at>pg_catalog.now();
  max_assets:=coalesce((ver->'limits'->>'creative_projects')::bigint,250); -- bounded guard against excessive individual object counts
  if active_count+pending_count>=greatest(250,max_assets) or (max_bytes>=0 and active_bytes+pending_bytes+p_size_bytes>max_bytes) or active_bytes+pending_bytes+p_size_bytes>1073741824 then
    raise exception using errcode='54000',message='Workspace creative asset storage allowance has been reached.';
  end if;
  insert into tandem_internal.creative_asset_upload_reservations(id,workspace_id,user_id,asset_id,asset_type,original_filename,storage_path,mime_type,size_bytes,width,height)
  values(p_reservation_id,p_workspace_id,p_user_id,p_asset_id,p_asset_type,p_original_filename,object_path,p_mime_type,p_size_bytes,p_width,p_height);
  return query select p_reservation_id,object_path,(select r.expires_at from tandem_internal.creative_asset_upload_reservations r where r.id=p_reservation_id);
end $$;

alter table public.subscription_plans enable row level security;
alter table public.subscription_plan_versions enable row level security;
alter table public.workspace_subscriptions enable row level security;
alter table public.subscription_change_requests enable row level security;
alter table public.subscription_events enable row level security;
alter table public.workspace_usage_events enable row level security;
alter table public.billing_demo_invoices enable row level security;
alter table public.billing_demo_invoice_items enable row level security;
alter table public.platform_admin_audit_events enable row level security;
revoke all on public.subscription_plans,public.subscription_plan_versions,public.workspace_subscriptions,public.subscription_change_requests,public.subscription_events,public.workspace_usage_events,public.billing_demo_invoices,public.billing_demo_invoice_items,public.platform_admin_audit_events from public,anon,authenticated,service_role;
revoke all on function public.billing_public_plans(),public.billing_workspace_summary(uuid),public.billing_request_plan_change(uuid,text,text,uuid),public.billing_request_cancellation(uuid,uuid,text),public.billing_request_reactivation(uuid,uuid),public.billing_workspace_history(uuid),public.billing_invoice_document(uuid,uuid),public.billing_simulate_plan_activation(uuid,uuid),public.billing_admin_plan_catalog(),public.billing_admin_save_plan(jsonb,uuid) from public,anon,authenticated,service_role;
grant execute on function public.billing_public_plans() to anon,authenticated;
grant execute on function public.billing_workspace_summary(uuid),public.billing_request_plan_change(uuid,text,text,uuid),public.billing_request_cancellation(uuid,uuid,text),public.billing_request_reactivation(uuid,uuid),public.billing_workspace_history(uuid),public.billing_invoice_document(uuid,uuid) to authenticated;
grant execute on function public.billing_simulate_plan_activation(uuid,uuid),public.billing_admin_plan_catalog(),public.billing_admin_save_plan(jsonb,uuid) to service_role;
grant select,insert,delete on public.workspace_usage_events to service_role;
grant select,insert,update on public.subscription_plans,public.subscription_plan_versions,public.workspace_subscriptions,public.subscription_change_requests,public.subscription_events,public.billing_demo_invoices,public.billing_demo_invoice_items,public.platform_admin_audit_events to service_role;

commit;
