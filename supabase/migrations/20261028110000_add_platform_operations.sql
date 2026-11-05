begin;

-- Platform administration uses a separate identity/capability model from
-- workspace membership. No operator assignments are seeded by this migration.
create table tandem_internal.platform_admin_roles (
  role_key text primary key check (role_key in ('super_admin','operations_admin','support_agent','billing_admin','auditor')),
  display_name text not null,
  created_at timestamptz not null default now()
);
create table tandem_internal.platform_admin_role_capabilities (
  role_key text not null references tandem_internal.platform_admin_roles(role_key),
  capability_key text not null check (capability_key in (
    'platform.dashboard.read','platform.tenants.read','platform.tenants.manage',
    'platform.users.read','platform.support.manage','platform.billing.read',
    'platform.billing.manage','platform.usage.read','platform.audit.read',
    'platform.health.read','platform.settings.manage','platform.admin.provision'
  )),
  primary key(role_key, capability_key)
);
create table tandem_internal.platform_admin_role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  role_key text not null references tandem_internal.platform_admin_roles(role_key),
  granted_by uuid references auth.users(id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_by uuid references auth.users(id) on delete restrict,
  revoked_at timestamptz,
  reason text not null check (char_length(btrim(reason)) between 8 and 500),
  constraint platform_admin_revocation_pair check ((revoked_at is null) = (revoked_by is null))
);
create unique index platform_admin_one_active_role on tandem_internal.platform_admin_role_assignments(user_id,role_key) where revoked_at is null;
create index platform_admin_assignment_user_idx on tandem_internal.platform_admin_role_assignments(user_id,granted_at desc);

insert into tandem_internal.platform_admin_roles(role_key,display_name) values
 ('super_admin','Super Admin'),('operations_admin','Operations Admin'),
 ('support_agent','Support Agent'),('billing_admin','Billing Admin'),('auditor','Auditor');
insert into tandem_internal.platform_admin_role_capabilities(role_key,capability_key)
select role_key, capability_key from (values
 ('super_admin','platform.dashboard.read'),('super_admin','platform.tenants.read'),('super_admin','platform.tenants.manage'),('super_admin','platform.users.read'),('super_admin','platform.support.manage'),('super_admin','platform.billing.read'),('super_admin','platform.billing.manage'),('super_admin','platform.usage.read'),('super_admin','platform.audit.read'),('super_admin','platform.health.read'),('super_admin','platform.settings.manage'),('super_admin','platform.admin.provision'),
 ('operations_admin','platform.dashboard.read'),('operations_admin','platform.tenants.read'),('operations_admin','platform.tenants.manage'),('operations_admin','platform.usage.read'),('operations_admin','platform.health.read'),('operations_admin','platform.audit.read'),
 ('support_agent','platform.dashboard.read'),('support_agent','platform.tenants.read'),('support_agent','platform.support.manage'),
 ('billing_admin','platform.dashboard.read'),('billing_admin','platform.tenants.read'),('billing_admin','platform.billing.read'),('billing_admin','platform.billing.manage'),('billing_admin','platform.usage.read'),('billing_admin','platform.audit.read'),
 ('auditor','platform.dashboard.read'),('auditor','platform.tenants.read'),('auditor','platform.users.read'),('auditor','platform.billing.read'),('auditor','platform.usage.read'),('auditor','platform.audit.read'),('auditor','platform.health.read')
) as permissions(role_key,capability_key);

create table public.platform_tenant_lifecycle (
  workspace_id uuid primary key references public.workspaces(id) on delete restrict,
  status text not null default 'ACTIVE' check(status in ('ACTIVE','UNDER_REVIEW','SUSPENSION_PENDING','SUSPENDED','RESTORATION_PENDING','ARCHIVED')),
  reason text,
  updated_by uuid references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  constraint tenant_lifecycle_reason_length check(reason is null or char_length(reason) between 8 and 500)
);
create table public.platform_admin_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role text not null,
  action text not null check(char_length(action) between 3 and 100),
  target_type text not null check(char_length(target_type) between 2 and 80),
  target_id text,
  reason text,
  outcome text not null default 'succeeded' check(outcome in ('succeeded','denied','failed')),
  correlation_id text,
  safe_metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(safe_metadata)='object'),
  created_at timestamptz not null default now()
);
create index platform_admin_events_recent_idx on public.platform_admin_events(created_at desc,id);
create index platform_admin_events_target_idx on public.platform_admin_events(target_type,target_id,created_at desc);
create table public.platform_tenant_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  previous_status text,
  next_status text not null,
  reason text not null,
  created_at timestamptz not null default now()
);
create index platform_tenant_events_workspace_idx on public.platform_tenant_lifecycle_events(workspace_id,created_at desc);

create table public.platform_support_cases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete restrict,
  requester_user_id uuid references auth.users(id) on delete set null,
  category text not null check(category in ('authentication','onboarding','permissions','billing','storage','campaigns','reports','agency','other')),
  priority text not null default 'normal' check(priority in ('low','normal','high','urgent')),
  status text not null default 'OPEN' check(status in ('OPEN','IN_PROGRESS','WAITING_ON_CUSTOMER','RESOLVED','CLOSED')),
  subject text not null check(char_length(btrim(subject)) between 4 and 160),
  description text not null check(char_length(btrim(description)) between 10 and 5000),
  assigned_to uuid references auth.users(id) on delete set null,
  resolution_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index platform_support_cases_status_idx on public.platform_support_cases(status,priority,updated_at desc);
create index platform_support_cases_workspace_idx on public.platform_support_cases(workspace_id,created_at desc);
create table public.platform_support_internal_notes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.platform_support_cases(id) on delete restrict,
  author_user_id uuid references auth.users(id) on delete set null,
  body text not null check(char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index platform_support_notes_case_idx on public.platform_support_internal_notes(case_id,created_at);
create table public.platform_support_access_requests (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.platform_support_cases(id) on delete restrict,
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,
  scope_keys text[] not null check(cardinality(scope_keys) between 1 and 5 and scope_keys <@ array['workspace_metadata','campaign_status','creative_metadata','report_metadata','storage_diagnostics']::text[]),
  reason text not null check(char_length(btrim(reason)) between 8 and 500),
  status text not null default 'PENDING' check(status in ('PENDING','APPROVED','REJECTED','REVOKED','EXPIRED')),
  decided_by uuid references auth.users(id) on delete restrict,
  decided_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint support_access_decision_fields check((status='PENDING' and decided_at is null) or status<>'PENDING')
);
create index platform_support_access_case_idx on public.platform_support_access_requests(case_id,created_at desc);
create table public.platform_feature_flags (
  flag_key text primary key check(flag_key in ('campaign_studio_enabled','creative_studio_enabled','optimization_studio_enabled','automation_studio_enabled','advanced_analytics_enabled','agency_portal_enabled','demo_publishing_enabled','billing_simulation_enabled')),
  enabled boolean not null,
  description text not null,
  updated_by uuid references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now()
);
insert into public.platform_feature_flags(flag_key,enabled,description) values
 ('campaign_studio_enabled',true,'Campaign draft workflows'),('creative_studio_enabled',true,'Local creative editor'),
 ('optimization_studio_enabled',true,'Offline optimization tools'),('automation_studio_enabled',true,'Internal rule automation'),
 ('advanced_analytics_enabled',true,'Analytics and reports'),('agency_portal_enabled',true,'Agency and client collaboration'),
 ('demo_publishing_enabled',true,'Internal demo publishing only'),('billing_simulation_enabled',true,'Offline billing simulation only');
create table public.platform_settings (
  setting_key text primary key check(setting_key in ('public_registration_mode','default_trial_days','public_onboarding_notice')),
  setting_value jsonb not null,
  updated_by uuid references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now()
);
insert into public.platform_settings(setting_key,setting_value) values
 ('public_registration_mode','"enabled"'::jsonb),('default_trial_days','14'::jsonb),('public_onboarding_notice','""'::jsonb);

alter table public.platform_tenant_lifecycle enable row level security;
alter table public.platform_admin_events enable row level security;
alter table public.platform_tenant_lifecycle_events enable row level security;
alter table public.platform_support_cases enable row level security;
alter table public.platform_support_internal_notes enable row level security;
alter table public.platform_support_access_requests enable row level security;
alter table public.platform_feature_flags enable row level security;
alter table public.platform_settings enable row level security;
revoke all on public.platform_tenant_lifecycle,public.platform_admin_events,public.platform_tenant_lifecycle_events,
 public.platform_support_cases,public.platform_support_internal_notes,public.platform_support_access_requests,
 public.platform_feature_flags,public.platform_settings from public,anon,authenticated,service_role;
revoke all on tandem_internal.platform_admin_roles,tandem_internal.platform_admin_role_capabilities,
 tandem_internal.platform_admin_role_assignments from public,anon,authenticated,service_role;

create function tandem_internal.platform_admin_has_capability(p_user_id uuid,p_capability text)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(
 select 1 from tandem_internal.platform_admin_role_assignments a
 join tandem_internal.platform_admin_role_capabilities c using(role_key)
 where a.user_id=p_user_id and a.revoked_at is null and c.capability_key=p_capability
); $$;
create function tandem_internal.platform_admin_role(p_user_id uuid)
returns text language sql stable security definer set search_path=''
as $$ select a.role_key from tandem_internal.platform_admin_role_assignments a
 where a.user_id=p_user_id and a.revoked_at is null
 order by case a.role_key when 'super_admin' then 1 when 'operations_admin' then 2 when 'billing_admin' then 3 when 'support_agent' then 4 else 5 end limit 1; $$;
create function tandem_internal.platform_admin_require(p_actor uuid,p_capability text)
returns text language plpgsql stable security definer set search_path=''
as $$ declare role_name text; begin
 if p_actor is null or not tandem_internal.platform_admin_has_capability(p_actor,p_capability) then raise exception using errcode='42501',message='Platform capability required.'; end if;
 role_name:=tandem_internal.platform_admin_role(p_actor); return role_name;
end; $$;
revoke all on function tandem_internal.platform_admin_has_capability(uuid,text),tandem_internal.platform_admin_role(uuid),tandem_internal.platform_admin_require(uuid,text) from public,anon,authenticated,service_role;

create function tandem_internal.platform_admin_audit(p_actor uuid,p_action text,p_target_type text,p_target_id text,p_reason text,p_metadata jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path=''
as $$ begin
 insert into public.platform_admin_events(actor_user_id,actor_role,action,target_type,target_id,reason,safe_metadata)
 values(p_actor,coalesce(tandem_internal.platform_admin_role(p_actor),'unassigned'),p_action,p_target_type,p_target_id,p_reason,coalesce(p_metadata,'{}'::jsonb));
end; $$;
revoke all on function tandem_internal.platform_admin_audit(uuid,text,text,text,text,jsonb) from public,anon,authenticated,service_role;

create function public.platform_admin_has_capability(p_user_id uuid,p_capability text)
returns boolean language sql stable security definer set search_path=''
as $$ select tandem_internal.platform_admin_has_capability(p_user_id,p_capability); $$;

create function public.platform_admin_overview(p_actor uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$ declare result jsonb; begin
 perform tandem_internal.platform_admin_require(p_actor,'platform.dashboard.read');
 select jsonb_build_object(
   'workspaces_total',(select count(*) from public.workspaces),
   'workspaces_active',(select count(*) from public.workspaces w left join public.platform_tenant_lifecycle s on s.workspace_id=w.id where coalesce(s.status,'ACTIVE')='ACTIVE'),
   'workspaces_under_review',(select count(*) from public.platform_tenant_lifecycle where status in ('UNDER_REVIEW','SUSPENSION_PENDING')),
   'workspaces_suspended',(select count(*) from public.platform_tenant_lifecycle where status in ('SUSPENDED','ARCHIVED')),
   'users_total',(select count(*) from auth.users),
   'subscriptions_by_status',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select status,count(*)::bigint count from public.workspace_subscriptions group by status order by status) x),
   'subscriptions_by_plan',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select plan_id,count(*)::bigint count from public.workspace_subscriptions group by plan_id order by plan_id) x),
   'industries',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select industry_key,count(*)::bigint count from public.workspaces group by industry_key order by industry_key) x),
   'workspaces_created_last_30_days',(select count(*) from public.workspaces where created_at>=now()-interval '30 days'),
   'campaigns_total',(select count(*) from public.campaigns),
   'creatives_total',(select count(*) from public.creative_projects),
   'storage_bytes',(select coalesce(sum(size_bytes),0) from public.creative_assets),
   'support_open',(select count(*) from public.platform_support_cases where status in ('OPEN','IN_PROGRESS','WAITING_ON_CUSTOMER')),
   'recent_admin_events',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select id,actor_role,action,target_type,target_id,outcome,created_at from public.platform_admin_events order by created_at desc limit 8) x),
   'source','live_database_records','as_of',now()) into result;
 return result;
end; $$;

create function public.platform_admin_list_tenants(p_actor uuid,p_page int default 1,p_page_size int default 25,p_search text default null,p_industry text default null,p_status text default null,p_plan text default null)
returns jsonb language plpgsql stable security definer set search_path=''
as $$ declare result jsonb; begin
 perform tandem_internal.platform_admin_require(p_actor,'platform.tenants.read');
 if p_page<1 or p_page_size not between 1 and 100 then raise exception using errcode='22023',message='Invalid page.'; end if;
 with rows as (
  select w.id,w.name,w.industry_key,w.industry_custom_label,w.created_at,coalesce(s.status,'ACTIVE') workspace_status,
   sub.plan_id,sub.status subscription_status,
   coalesce(m.members,0) membership_count,coalesce(c.campaigns,0) campaign_count,
   coalesce(cr.creatives,0) creative_count,coalesce(a.storage_bytes,0) storage_bytes,
   coalesce(ap.operating_mode,'business') operating_mode,
   (select max(e.created_at) from public.platform_admin_events e where e.target_type='workspace' and e.target_id=w.id::text) last_admin_activity
  from public.workspaces w
  left join public.platform_tenant_lifecycle s on s.workspace_id=w.id
  left join public.workspace_subscriptions sub on sub.workspace_id=w.id
  left join lateral (select count(*)::bigint members from public.workspace_memberships m0 where m0.workspace_id=w.id) m on true
  left join lateral (select count(*)::bigint campaigns from public.campaigns c0 where c0.workspace_id=w.id) c on true
  left join lateral (select count(*)::bigint creatives from public.creative_projects cr0 where cr0.workspace_id=w.id) cr on true
  left join lateral (select coalesce(sum(size_bytes),0)::bigint storage_bytes from public.creative_assets a0 where a0.workspace_id=w.id) a on true
  left join public.agency_profiles ap on ap.agency_workspace_id=w.id
  where (p_search is null or w.name ilike '%'||left(p_search,120)||'%' or w.id::text ilike '%'||left(p_search,120)||'%')
   and (p_industry is null or w.industry_key=p_industry)
   and (p_status is null or coalesce(s.status,'ACTIVE')=p_status)
   and (p_plan is null or sub.plan_id=p_plan)
 ), page_rows as (select * from rows order by created_at desc,id limit p_page_size offset (p_page-1)*p_page_size)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(x)) from page_rows x),'[]'::jsonb),'total',(select count(*) from rows),'page',p_page,'page_size',p_page_size) into result;
 return result;
end; $$;

create function public.platform_admin_tenant_detail(p_actor uuid,p_workspace_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$ declare result jsonb; begin
 perform tandem_internal.platform_admin_require(p_actor,'platform.tenants.read');
 select jsonb_build_object('workspace',jsonb_build_object('id',w.id,'name',w.name,'industry_key',w.industry_key,'industry_custom_label',w.industry_custom_label,'website_url',w.website_url,'created_at',w.created_at,'status',coalesce(s.status,'ACTIVE'),'status_reason',s.reason,'agency_mode',exists(select 1 from public.agency_profiles ap where ap.agency_workspace_id=w.id)),
 'subscription',(select to_jsonb(x) from (select plan_id,status,billing_interval,period_start,period_end,trial_ends_at,cancel_at_period_end,source from public.workspace_subscriptions where workspace_id=w.id) x),
 'counts',jsonb_build_object('members',(select count(*) from public.workspace_memberships where workspace_id=w.id),'campaigns',(select count(*) from public.campaigns where workspace_id=w.id),'creatives',(select count(*) from public.creative_projects where workspace_id=w.id),'storage_bytes',(select coalesce(sum(size_bytes),0) from public.creative_assets where workspace_id=w.id)),
 'lifecycle_history',(select coalesce(jsonb_agg(to_jsonb(h)),'[]'::jsonb) from (select id,actor_user_id,previous_status,next_status,reason,created_at from public.platform_tenant_lifecycle_events where workspace_id=w.id order by created_at desc limit 20) h),
 'billing_events',(select coalesce(jsonb_agg(to_jsonb(b)),'[]'::jsonb) from (select event_type,prior_state,next_state,reason,source,created_at from public.subscription_events where workspace_id=w.id order by created_at desc limit 20) b),
 'support_cases',(select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) from (select id,category,priority,status,subject,created_at,updated_at from public.platform_support_cases where workspace_id=w.id order by updated_at desc limit 10) c))
 into result from public.workspaces w left join public.platform_tenant_lifecycle s on s.workspace_id=w.id where w.id=p_workspace_id;
 if result is null then raise exception using errcode='P0002',message='Tenant not found.'; end if;
 return result;
end; $$;

create function public.platform_admin_list_users(p_actor uuid,p_page int default 1,p_page_size int default 25,p_search text default null)
returns jsonb language plpgsql stable security definer set search_path=''
as $$ declare result jsonb; begin
 perform tandem_internal.platform_admin_require(p_actor,'platform.users.read');
 if p_page<1 or p_page_size not between 1 and 100 then raise exception using errcode='22023',message='Invalid page.'; end if;
 with rows as (select u.id,u.email,u.email_confirmed_at,u.created_at,p.full_name,
  (select count(*) from public.workspace_memberships m where m.user_id=u.id)::bigint membership_count,
  exists(select 1 from tandem_internal.platform_admin_role_assignments a where a.user_id=u.id and a.revoked_at is null) platform_operator
  from auth.users u left join public.profiles p on p.user_id=u.id
  where p_search is null or u.email ilike '%'||left(p_search,200)||'%' or p.full_name ilike '%'||left(p_search,200)||'%' or u.id::text ilike '%'||left(p_search,200)||'%'),
 page_rows as (select * from rows order by created_at desc,id limit p_page_size offset (p_page-1)*p_page_size)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(x)) from page_rows x),'[]'::jsonb),'total',(select count(*) from rows),'page',p_page,'page_size',p_page_size) into result;
 return result;
end; $$;
create function public.platform_admin_user_detail(p_actor uuid,p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$ declare result jsonb; begin
 perform tandem_internal.platform_admin_require(p_actor,'platform.users.read');
 select jsonb_build_object('user',jsonb_build_object('id',u.id,'email',u.email,'email_confirmed_at',u.email_confirmed_at,'created_at',u.created_at,'full_name',p.full_name),
 'memberships',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select w.id workspace_id,w.name workspace_name,m.role,m.created_at,coalesce(s.status,'ACTIVE') workspace_status from public.workspace_memberships m join public.workspaces w on w.id=m.workspace_id left join public.platform_tenant_lifecycle s on s.workspace_id=w.id where m.user_id=u.id order by w.name limit 100) x),
 'platform_roles',(select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from (select role_key,granted_at,revoked_at,reason from tandem_internal.platform_admin_role_assignments where user_id=u.id order by granted_at desc limit 10) r)) into result
 from auth.users u left join public.profiles p on p.user_id=u.id where u.id=p_user_id;
 if result is null then raise exception using errcode='P0002',message='User not found.'; end if; return result;
end; $$;

create function public.platform_admin_usage(p_actor uuid,p_page int default 1,p_page_size int default 25,p_sort text default 'storage_bytes')
returns jsonb language plpgsql stable security definer set search_path=''
as $$ declare result jsonb; begin
 perform tandem_internal.platform_admin_require(p_actor,'platform.usage.read');
 if p_page<1 or p_page_size not between 1 and 100 or p_sort not in ('storage_bytes','campaigns','creatives','members','name') then raise exception using errcode='22023',message='Invalid usage query.'; end if;
 with rows as (select w.id,w.name,w.industry_key,coalesce(s.status,'ACTIVE') workspace_status,sub.plan_id,sub.status subscription_status,
  (select count(*) from public.workspace_memberships m where m.workspace_id=w.id)::bigint seats,
  (select count(*) from public.campaigns c where c.workspace_id=w.id)::bigint campaigns,
  (select count(*) from public.creative_projects c where c.workspace_id=w.id)::bigint creatives,
  (select coalesce(sum(a.size_bytes),0) from public.creative_assets a where a.workspace_id=w.id)::bigint storage_bytes,
  (select count(*) from public.automation_executions e where e.workspace_id=w.id and e.created_at>=date_trunc('month',now()))::bigint automation_runs,
  (select count(*) from public.report_definitions r where r.workspace_id=w.id)::bigint reports
  from public.workspaces w left join public.platform_tenant_lifecycle s on s.workspace_id=w.id left join public.workspace_subscriptions sub on sub.workspace_id=w.id),
 ordered as (select * from rows order by case when p_sort='storage_bytes' then storage_bytes end desc,case when p_sort='campaigns' then campaigns end desc,case when p_sort='creatives' then creatives end desc,case when p_sort='members' then seats end desc,name asc),
 page_rows as (select * from ordered limit p_page_size offset (p_page-1)*p_page_size)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(x)) from page_rows x),'[]'::jsonb),'total',(select count(*) from rows),'page',p_page,'page_size',p_page_size,'source','current_saved_records') into result;
 return result;
end; $$;

create function public.platform_admin_audit(p_actor uuid,p_page int default 1,p_page_size int default 50,p_search text default null)
returns jsonb language plpgsql stable security definer set search_path=''
as $$ declare result jsonb; begin
 perform tandem_internal.platform_admin_require(p_actor,'platform.audit.read');
 if p_page<1 or p_page_size not between 1 and 100 then raise exception using errcode='22023',message='Invalid page.'; end if;
 select jsonb_build_object('items',coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),'page',p_page,'page_size',p_page_size,'total',(select count(*) from public.platform_admin_events where p_search is null or action ilike '%'||left(p_search,100)||'%' or target_id ilike '%'||left(p_search,100)||'%')) into result
 from (select id,actor_user_id,actor_role,action,target_type,target_id,reason,outcome,correlation_id,safe_metadata,created_at from public.platform_admin_events where p_search is null or action ilike '%'||left(p_search,100)||'%' or target_id ilike '%'||left(p_search,100)||'%' order by created_at desc limit p_page_size offset (p_page-1)*p_page_size) x;
 return result;
end; $$;

create function public.platform_admin_health_probe(p_actor uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$ begin
 perform tandem_internal.platform_admin_require(p_actor,'platform.health.read');
 return jsonb_build_object('database','HEALTHY','checked_at',now(),'source','authenticated administrative database probe');
end; $$;

create function public.platform_admin_set_tenant_status(p_actor uuid,p_workspace_id uuid,p_next_status text,p_reason text)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare old_status text; role_name text; begin
 role_name:=tandem_internal.platform_admin_require(p_actor,'platform.tenants.manage');
 if p_next_status not in ('UNDER_REVIEW','SUSPENSION_PENDING','SUSPENDED','RESTORATION_PENDING','ACTIVE') or char_length(btrim(coalesce(p_reason,''))) not between 8 and 500 then raise exception using errcode='22023',message='Invalid lifecycle operation.'; end if;
 perform 1 from public.workspaces where id=p_workspace_id for update; if not found then raise exception using errcode='P0002',message='Tenant not found.'; end if;
 select status into old_status from public.platform_tenant_lifecycle where workspace_id=p_workspace_id for update;
 old_status:=coalesce(old_status,'ACTIVE');
 if old_status=p_next_status then return jsonb_build_object('workspace_id',p_workspace_id,'status',old_status,'changed',false); end if;
 if not ((old_status='ACTIVE' and p_next_status in ('UNDER_REVIEW','SUSPENSION_PENDING')) or (old_status='UNDER_REVIEW' and p_next_status in ('ACTIVE','SUSPENSION_PENDING')) or (old_status='SUSPENSION_PENDING' and p_next_status in ('SUSPENDED','ACTIVE')) or (old_status='SUSPENDED' and p_next_status='RESTORATION_PENDING') or (old_status='RESTORATION_PENDING' and p_next_status in ('ACTIVE','SUSPENDED'))) then raise exception using errcode='23514',message='Invalid tenant lifecycle transition.'; end if;
 insert into public.platform_tenant_lifecycle(workspace_id,status,reason,updated_by,updated_at) values(p_workspace_id,p_next_status,btrim(p_reason),p_actor,now())
 on conflict(workspace_id) do update set status=excluded.status,reason=excluded.reason,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
 insert into public.platform_tenant_lifecycle_events(workspace_id,actor_user_id,previous_status,next_status,reason) values(p_workspace_id,p_actor,old_status,p_next_status,btrim(p_reason));
 perform tandem_internal.platform_admin_audit(p_actor,'tenant.lifecycle.'||lower(p_next_status),'workspace',p_workspace_id::text,p_reason,'{}'::jsonb);
 return jsonb_build_object('workspace_id',p_workspace_id,'previous_status',old_status,'status',p_next_status,'changed',true,'writes_blocked',p_next_status in ('SUSPENDED','ARCHIVED'));
end; $$;

create function tandem_internal.guard_suspended_workspace_write()
returns trigger language plpgsql security definer set search_path=''
as $$ declare ws uuid; state text; begin
 ws:=case when tg_op='DELETE' then old.workspace_id else new.workspace_id end;
 select status into state from public.platform_tenant_lifecycle where workspace_id=ws;
 if state in ('SUSPENDED','ARCHIVED') then raise exception using errcode='55000',message='Workspace writes are temporarily suspended; existing data is preserved.'; end if;
 if tg_op='DELETE' then return old; else return new; end if;
end; $$;
revoke all on function tandem_internal.guard_suspended_workspace_write() from public,anon,authenticated,service_role;
do $$ declare t text; begin
 foreach t in array array['campaigns','campaign_revisions','campaign_reviews','campaign_activity','demo_publish_attempts','creative_projects','creative_project_revisions','creative_project_assets','creative_project_reviews','creative_campaign_links','workspace_brand_kits','automation_rules','automation_rule_versions','report_definitions','report_revisions','report_exports','workspace_memberships','client_tasks','client_collaboration_comments'] loop
  execute format('create trigger a_platform_suspension_guard before insert or update or delete on public.%I for each row execute function tandem_internal.guard_suspended_workspace_write()',t);
 end loop;
end $$;

create function public.platform_admin_list_support_cases(p_actor uuid,p_page int default 1,p_page_size int default 25,p_status text default null,p_search text default null)
returns jsonb language plpgsql stable security definer set search_path=''
as $$ declare result jsonb; begin
 perform tandem_internal.platform_admin_require(p_actor,'platform.support.manage');
 if p_page<1 or p_page_size not between 1 and 100 then raise exception using errcode='22023',message='Invalid page.'; end if;
 with rows as (select c.id,c.workspace_id,w.name workspace_name,c.requester_user_id,u.email requester_email,c.category,c.priority,c.status,c.subject,c.description,c.assigned_to,c.resolution_summary,c.created_at,c.updated_at from public.platform_support_cases c left join public.workspaces w on w.id=c.workspace_id left join auth.users u on u.id=c.requester_user_id where (p_status is null or c.status=p_status) and (p_search is null or c.subject ilike '%'||left(p_search,120)||'%' or c.id::text ilike '%'||left(p_search,120)||'%')),
 page_rows as (select * from rows order by case priority when 'urgent' then 1 when 'high' then 2 when 'normal' then 3 else 4 end,updated_at desc limit p_page_size offset (p_page-1)*p_page_size)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(x)) from page_rows x),'[]'::jsonb),'total',(select count(*) from rows),'page',p_page,'page_size',p_page_size) into result;
 return result;
end; $$;
create function public.platform_admin_create_support_case(p_actor uuid,p_workspace_id uuid,p_category text,p_priority text,p_subject text,p_description text)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare role_name text; row public.platform_support_cases; begin
 role_name:=tandem_internal.platform_admin_require(p_actor,'platform.support.manage');
 insert into public.platform_support_cases(workspace_id,category,priority,subject,description)
 values(p_workspace_id,p_category,p_priority,btrim(p_subject),btrim(p_description)) returning * into row;
 perform tandem_internal.platform_admin_audit(p_actor,'support.case.created','support_case',row.id::text,'Operator-created case','{}'::jsonb);
 return jsonb_build_object('id',row.id,'workspace_id',row.workspace_id,'category',row.category,'priority',row.priority,'status',row.status,'subject',row.subject,'created_at',row.created_at);
end; $$;
create function public.platform_admin_update_support_case(p_actor uuid,p_case_id uuid,p_status text,p_assigned_to uuid,p_resolution text,p_note text)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare row public.platform_support_cases; begin
 perform tandem_internal.platform_admin_require(p_actor,'platform.support.manage');
 if p_assigned_to is not null and not tandem_internal.platform_admin_has_capability(p_assigned_to,'platform.support.manage') then raise exception using errcode='22023',message='Support assignment target is not an authorized operator.'; end if;
 if p_status not in ('OPEN','IN_PROGRESS','WAITING_ON_CUSTOMER','RESOLVED','CLOSED') or (p_resolution is not null and char_length(p_resolution)>2000) or (p_note is not null and char_length(btrim(p_note)) not between 1 and 4000) then raise exception using errcode='22023',message='Invalid support update.'; end if;
 update public.platform_support_cases set status=p_status,assigned_to=p_assigned_to,resolution_summary=nullif(btrim(coalesce(p_resolution,'')),''),updated_at=now() where id=p_case_id returning * into row;
 if not found then raise exception using errcode='P0002',message='Support case not found.'; end if;
 if p_note is not null then insert into public.platform_support_internal_notes(case_id,author_user_id,body) values(row.id,p_actor,btrim(p_note)); end if;
 perform tandem_internal.platform_admin_audit(p_actor,'support.case.updated','support_case',row.id::text,'Support case updated',jsonb_build_object('status',p_status));
 return jsonb_build_object('id',row.id,'status',row.status,'assigned_to',row.assigned_to,'updated_at',row.updated_at);
end; $$;
create function public.platform_admin_support_access_request(p_actor uuid,p_case_id uuid,p_scope_keys text[],p_reason text)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare row public.platform_support_cases; access_row public.platform_support_access_requests; begin
 perform tandem_internal.platform_admin_require(p_actor,'platform.support.manage');
 select * into row from public.platform_support_cases where id=p_case_id for update;
 if not found or row.workspace_id is null then raise exception using errcode='P0002',message='Workspace support case not found.'; end if;
 insert into public.platform_support_access_requests(case_id,workspace_id,requested_by,scope_keys,reason,expires_at)
 values(p_case_id,row.workspace_id,p_actor,p_scope_keys,btrim(p_reason),now()+interval '24 hours') returning * into access_row;
 perform tandem_internal.platform_admin_audit(p_actor,'support.access.requested','support_access_request',access_row.id::text,'Limited access requested; no content access granted',jsonb_build_object('scope_keys',to_jsonb(p_scope_keys)));
 return jsonb_build_object('id',access_row.id,'case_id',p_case_id,'workspace_id',row.workspace_id,'scope_keys',to_jsonb(p_scope_keys),'status',access_row.status,'expires_at',access_row.expires_at,'access_granted',false);
end; $$;
create function public.platform_support_decide_access(p_access_request_id uuid,p_decision text)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare access_row public.platform_support_access_requests; actor uuid:=auth.uid(); begin
 if actor is null or p_decision not in ('APPROVED','REJECTED') then raise exception using errcode='42501',message='Workspace owner authorization is required.'; end if;
 select * into access_row from public.platform_support_access_requests where id=p_access_request_id for update;
 if not found or not tandem_internal.has_workspace_role(access_row.workspace_id,array['owner','admin']::text[]) then raise exception using errcode='42501',message='Workspace owner authorization is required.'; end if;
 if access_row.status<>'PENDING' or access_row.expires_at<=now() then raise exception using errcode='40001',message='Support access request is no longer pending.'; end if;
 update public.platform_support_access_requests set status=p_decision,decided_by=actor,decided_at=now() where id=access_row.id;
 insert into public.platform_admin_events(actor_user_id,actor_role,action,target_type,target_id,reason,safe_metadata)
 values(actor,'workspace_owner','support.access.'||lower(p_decision),'support_access_request',access_row.id::text,'Workspace owner decision; no content API is enabled',jsonb_build_object('workspace_id',access_row.workspace_id,'scope_keys',to_jsonb(access_row.scope_keys)));
 return jsonb_build_object('id',access_row.id,'status',p_decision,'access_granted',false,'scope_keys',to_jsonb(access_row.scope_keys));
end; $$;
create function public.platform_admin_revoke_support_access(p_actor uuid,p_access_request_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare row public.platform_support_access_requests; begin
 perform tandem_internal.platform_admin_require(p_actor,'platform.support.manage');
 update public.platform_support_access_requests set status='REVOKED',decided_by=p_actor,decided_at=now() where id=p_access_request_id and status='APPROVED' returning * into row;
 if not found then raise exception using errcode='P0002',message='Approved support access request not found.'; end if;
 perform tandem_internal.platform_admin_audit(p_actor,'support.access.revoked','support_access_request',row.id::text,p_reason,'{}'::jsonb);
 return jsonb_build_object('id',row.id,'status',row.status,'access_granted',false);
end; $$;

create function public.platform_admin_settings(p_actor uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$ declare result jsonb; begin
 perform tandem_internal.platform_admin_require(p_actor,'platform.settings.manage');
 select jsonb_build_object('settings',(select coalesce(jsonb_object_agg(setting_key,setting_value),'{}'::jsonb) from public.platform_settings),'feature_flags',(select coalesce(jsonb_agg(to_jsonb(f)),'[]'::jsonb) from (select flag_key,enabled,description,updated_at from public.platform_feature_flags order by flag_key) f)) into result; return result;
end; $$;
create function public.platform_admin_update_setting(p_actor uuid,p_key text,p_value jsonb,p_reason text)
returns jsonb language plpgsql security definer set search_path=''
as $$ begin
 perform tandem_internal.platform_admin_require(p_actor,'platform.settings.manage');
 if p_key not in ('public_registration_mode','default_trial_days','public_onboarding_notice') or char_length(coalesce(p_reason,'')) not between 8 and 500 then raise exception using errcode='22023',message='Setting change is invalid.'; end if;
 if p_key='public_registration_mode' and p_value not in ('"enabled"'::jsonb,'"invite_only"'::jsonb,'"disabled"'::jsonb) then raise exception using errcode='22023',message='Registration mode is invalid.'; end if;
 if p_key='default_trial_days' and (jsonb_typeof(p_value)<>'number' or (p_value#>>'{}')::int not between 0 and 90) then raise exception using errcode='22023',message='Trial duration is invalid.'; end if;
 if p_key='public_onboarding_notice' and (jsonb_typeof(p_value)<>'string' or char_length(p_value#>>'{}')>500) then raise exception using errcode='22023',message='Notice is invalid.'; end if;
 insert into public.platform_settings(setting_key,setting_value,updated_by,updated_at) values(p_key,p_value,p_actor,now()) on conflict(setting_key) do update set setting_value=excluded.setting_value,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
 perform tandem_internal.platform_admin_audit(p_actor,'platform.setting.updated','platform_setting',p_key,p_reason,'{}'::jsonb);
 return jsonb_build_object('key',p_key,'value',p_value,'updated_at',now());
end; $$;
create function public.platform_admin_update_feature_flag(p_actor uuid,p_flag_key text,p_enabled boolean,p_reason text)
returns jsonb language plpgsql security definer set search_path=''
as $$ begin
 perform tandem_internal.platform_admin_require(p_actor,'platform.settings.manage');
 if p_flag_key not in ('campaign_studio_enabled','creative_studio_enabled','optimization_studio_enabled','automation_studio_enabled','advanced_analytics_enabled','agency_portal_enabled','demo_publishing_enabled','billing_simulation_enabled') or char_length(coalesce(p_reason,'')) not between 8 and 500 then raise exception using errcode='22023',message='Feature flag change is invalid.'; end if;
 update public.platform_feature_flags set enabled=p_enabled,updated_by=p_actor,updated_at=now() where flag_key=p_flag_key;
 if not found then raise exception using errcode='P0002',message='Feature flag not found.'; end if;
 perform tandem_internal.platform_admin_audit(p_actor,'platform.feature_flag.updated','feature_flag',p_flag_key,p_reason,jsonb_build_object('enabled',p_enabled));
 return jsonb_build_object('flag_key',p_flag_key,'enabled',p_enabled,'updated_at',now());
end; $$;

create function public.platform_admin_grant_role(p_actor uuid,p_user_id uuid,p_role_key text,p_reason text)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare row tandem_internal.platform_admin_role_assignments; begin
 perform tandem_internal.platform_admin_require(p_actor,'platform.admin.provision');
 if p_role_key not in ('super_admin','operations_admin','support_agent','billing_admin','auditor') or char_length(coalesce(p_reason,'')) not between 8 and 500 or p_actor=p_user_id then raise exception using errcode='22023',message='Platform role grant is invalid.'; end if;
 if not exists(select 1 from auth.users where id=p_user_id and email_confirmed_at is not null) then raise exception using errcode='P0002',message='A confirmed account is required.'; end if;
 insert into tandem_internal.platform_admin_role_assignments(user_id,role_key,granted_by,reason) values(p_user_id,p_role_key,p_actor,btrim(p_reason)) returning * into row;
 perform tandem_internal.platform_admin_audit(p_actor,'platform.role.granted','user',p_user_id::text,p_reason,jsonb_build_object('role_key',p_role_key));
 return jsonb_build_object('assignment_id',row.id,'user_id',row.user_id,'role_key',row.role_key,'granted_at',row.granted_at);
end; $$;
create function public.platform_admin_revoke_role(p_actor uuid,p_assignment_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare row tandem_internal.platform_admin_role_assignments; begin
 perform tandem_internal.platform_admin_require(p_actor,'platform.admin.provision');
 if char_length(coalesce(p_reason,'')) not between 8 and 500 then raise exception using errcode='22023',message='A revocation reason is required.'; end if;
 if exists(select 1 from tandem_internal.platform_admin_role_assignments a where a.id=p_assignment_id and a.user_id=p_actor and a.revoked_at is null) then raise exception using errcode='42501',message='Operators cannot revoke their own active platform role.'; end if;
 if exists(select 1 from tandem_internal.platform_admin_role_assignments a where a.id=p_assignment_id and a.role_key='super_admin' and a.revoked_at is null)
  and (select count(*) from tandem_internal.platform_admin_role_assignments a where a.role_key='super_admin' and a.revoked_at is null)<=1 then raise exception using errcode='23514',message='The final super administrator cannot be removed.'; end if;
 update tandem_internal.platform_admin_role_assignments set revoked_by=p_actor,revoked_at=now(),reason=left(reason||' | Revoked: '||btrim(p_reason),500) where id=p_assignment_id and revoked_at is null returning * into row;
 if not found then raise exception using errcode='P0002',message='Active platform role assignment not found.'; end if;
 perform tandem_internal.platform_admin_audit(p_actor,'platform.role.revoked','user',row.user_id::text,p_reason,jsonb_build_object('role_key',row.role_key));
 return jsonb_build_object('assignment_id',row.id,'user_id',row.user_id,'role_key',row.role_key,'revoked_at',row.revoked_at);
end; $$;

-- Customer-facing support RPCs are workspace-scoped and expose no operator notes.
create function public.workspace_create_support_case(p_workspace_id uuid,p_category text,p_subject text,p_description text)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare actor uuid:=auth.uid(); row public.platform_support_cases; begin
 if actor is null or not tandem_internal.has_workspace_role(p_workspace_id,null::text[]) then raise exception using errcode='42501',message='Workspace membership is required.'; end if;
 insert into public.platform_support_cases(workspace_id,requester_user_id,category,subject,description) values(p_workspace_id,actor,p_category,btrim(p_subject),btrim(p_description)) returning * into row;
 return jsonb_build_object('id',row.id,'workspace_id',row.workspace_id,'category',row.category,'status',row.status,'subject',row.subject,'created_at',row.created_at);
end; $$;
create function public.workspace_list_support_cases(p_workspace_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$ begin
 if auth.uid() is null or not tandem_internal.has_workspace_role(p_workspace_id,null::text[]) then raise exception using errcode='42501',message='Workspace membership is required.'; end if;
 return (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select id,category,priority,status,subject,description,resolution_summary,created_at,updated_at from public.platform_support_cases where workspace_id=p_workspace_id order by created_at desc limit 100) x);
end; $$;
create function public.workspace_list_support_access_requests(p_workspace_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$ begin
 if auth.uid() is null or not tandem_internal.has_workspace_role(p_workspace_id,array['owner','admin']::text[]) then raise exception using errcode='42501',message='Workspace owner authorization is required.'; end if;
 return (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select r.id,r.case_id,r.scope_keys,r.reason,r.status,r.expires_at,r.created_at from public.platform_support_access_requests r where r.workspace_id=p_workspace_id and r.status in ('PENDING','APPROVED') order by r.created_at desc limit 100) x);
end; $$;
create function public.workspace_decide_support_access(p_access_request_id uuid,p_decision text)
returns jsonb language plpgsql security definer set search_path=''
as $$ begin return public.platform_support_decide_access(p_access_request_id,p_decision); end; $$;

-- Server-only operator procedures: every function has a specific scope check.
revoke all on function public.platform_admin_has_capability(uuid,text),public.platform_admin_overview(uuid),public.platform_admin_list_tenants(uuid,int,int,text,text,text,text),public.platform_admin_tenant_detail(uuid,uuid),public.platform_admin_list_users(uuid,int,int,text),public.platform_admin_user_detail(uuid,uuid),public.platform_admin_usage(uuid,int,int,text),public.platform_admin_audit(uuid,int,int,text),public.platform_admin_health_probe(uuid),public.platform_admin_set_tenant_status(uuid,uuid,text,text),public.platform_admin_list_support_cases(uuid,int,int,text,text),public.platform_admin_create_support_case(uuid,uuid,text,text,text,text),public.platform_admin_update_support_case(uuid,uuid,text,uuid,text,text),public.platform_admin_support_access_request(uuid,uuid,text[],text),public.platform_admin_revoke_support_access(uuid,uuid,text),public.platform_admin_settings(uuid),public.platform_admin_update_setting(uuid,text,jsonb,text),public.platform_admin_update_feature_flag(uuid,text,boolean,text),public.platform_admin_grant_role(uuid,uuid,text,text),public.platform_admin_revoke_role(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.platform_admin_has_capability(uuid,text),public.platform_admin_overview(uuid),public.platform_admin_list_tenants(uuid,int,int,text,text,text,text),public.platform_admin_tenant_detail(uuid,uuid),public.platform_admin_list_users(uuid,int,int,text),public.platform_admin_user_detail(uuid,uuid),public.platform_admin_usage(uuid,int,int,text),public.platform_admin_audit(uuid,int,int,text),public.platform_admin_health_probe(uuid),public.platform_admin_set_tenant_status(uuid,uuid,text,text),public.platform_admin_list_support_cases(uuid,int,int,text,text),public.platform_admin_create_support_case(uuid,uuid,text,text,text,text),public.platform_admin_update_support_case(uuid,uuid,text,uuid,text,text),public.platform_admin_support_access_request(uuid,uuid,text[],text),public.platform_admin_revoke_support_access(uuid,uuid,text),public.platform_admin_settings(uuid),public.platform_admin_update_setting(uuid,text,jsonb,text),public.platform_admin_update_feature_flag(uuid,text,boolean,text),public.platform_admin_grant_role(uuid,uuid,text,text),public.platform_admin_revoke_role(uuid,uuid,text) to service_role;
revoke all on function public.workspace_create_support_case(uuid,text,text,text),public.workspace_list_support_cases(uuid),public.workspace_list_support_access_requests(uuid),public.workspace_decide_support_access(uuid,text) from public,anon,service_role;
grant execute on function public.workspace_create_support_case(uuid,text,text,text),public.workspace_list_support_cases(uuid),public.workspace_list_support_access_requests(uuid),public.workspace_decide_support_access(uuid,text) to authenticated;

comment on table tandem_internal.platform_admin_role_assignments is 'Trusted platform-operator grants. No public or authenticated DML; first operator requires an explicitly reviewed local/production DBA procedure.';
comment on table public.platform_support_access_requests is 'Consent records only. Approval does not enable cross-tenant content access in this milestone.';
comment on table public.platform_feature_flags is 'Audited rollout configuration; never an authorization or subscription bypass and cannot enable live provider integrations.';

commit;
