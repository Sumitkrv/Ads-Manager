begin;

-- Measurement planning is included in the existing workspace plans. The
-- subscription lifecycle and read-only/legacy grace checks still apply.
create or replace function tandem_internal.billing_context(p_workspace_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select pg_catalog.jsonb_build_object('subscription',pg_catalog.to_jsonb(s),'plan',pg_catalog.to_jsonb(p),
    'version',pg_catalog.to_jsonb(v)||pg_catalog.jsonb_build_object('features',v.features||'{"ai.live_generation":false,"ads.live_publish":false,"tracking.planning":true}'::jsonb))
  from public.workspace_subscriptions s
  join public.subscription_plans p on p.id=s.plan_id
  join public.subscription_plan_versions v on v.plan_id=s.plan_id and v.version=s.plan_version
  where s.workspace_id=p_workspace_id;
$$;
revoke all on function tandem_internal.billing_context(uuid) from public,anon,authenticated,service_role;

create function tandem_internal.guard_tracking_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare ws uuid;
begin
  if tg_op='DELETE' then ws:=old.workspace_id; else ws:=new.workspace_id; end if;
  if tg_op='UPDATE' and new.workspace_id is distinct from old.workspace_id then
    raise exception using errcode='42501',message='Tracking records cannot move between workspaces.';
  end if;
  if tg_op='UPDATE' then new.updated_by_user_id:=auth.uid(); end if;
  perform tandem_internal.billing_guard_resource(ws,'tracking.planning','tracking_objects',0,0);
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function tandem_internal.guard_tracking_write() from public,anon,authenticated,service_role;

create function tandem_internal.audit_tracking_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare ws uuid; row_id uuid; action_name text;
begin
  if tg_op='DELETE' then ws:=old.workspace_id; row_id:=old.id; action_name:='record_archived';
  else ws:=new.workspace_id; row_id:=new.id; action_name:=case when tg_op='INSERT' then 'record_created' else 'record_updated' end; end if;
  insert into public.integration_configuration_audit(workspace_id,actor_user_id,entity_type,entity_id,action)
  values(ws,(select auth.uid()),tg_table_name,row_id,action_name);
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function tandem_internal.audit_tracking_write() from public,anon,authenticated,service_role;

create table public.workspace_integration_configs (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null check(provider in ('google_ads','meta_ads','ga4','google_tag_manager','meta_pixel','google_ads_conversion')),
  account_identifier text not null default '' check(pg_catalog.char_length(account_identifier)<=120),
  business_label text not null default '' check(pg_catalog.char_length(business_label)<=160),
  website_url text not null default '' check(pg_catalog.char_length(website_url)<=2048 and (website_url='' or website_url ~ '^https://')),
  notes text not null default '' check(pg_catalog.char_length(notes)<=1000),
  configuration_status text not null default 'not_configured' check(configuration_status in ('not_configured','draft_configuration','readiness_incomplete','locally_validated')),
  updated_by_user_id uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique(workspace_id,provider), unique(workspace_id,id),
  check(account_identifier !~* '(token|secret|password|cookie|session|credential)'),
  check(notes !~* '(token|secret|password|cookie|session|credential)')
);

create table public.integration_readiness_responses (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null check(provider in ('google_ads','meta_ads')),
  requirement_id text not null check(requirement_id in ('business_details','account_owner','account_identifier','access_roles','website_destination','measurement_plan','billing_responsibility','policy_review')),
  completed boolean not null default false,
  note text not null default '' check(pg_catalog.char_length(note)<=500),
  updated_by_user_id uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique(workspace_id,provider,requirement_id), unique(workspace_id,id),
  check(note !~* '(verified|confirmed by google|confirmed by meta|payment verified|pixel active)')
);

create table public.conversion_goals (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check(pg_catalog.char_length(name) between 2 and 120),
  category text not null check(category in ('lead','sale','engagement','registration','booking','custom')),
  description text not null default '' check(pg_catalog.char_length(description)<=1000),
  event_name text not null check(event_name ~ '^[A-Za-z][A-Za-z0-9_]{1,63}$'),
  objective text not null default '' check(pg_catalog.char_length(objective)<=240),
  illustrative_value numeric(14,2) check(illustrative_value is null or illustrative_value>=0),
  currency text check(currency is null or currency ~ '^[A-Z]{3}$'),
  counting_policy text not null default 'once_per_event' check(counting_policy in ('once_per_event','once_per_session','once_per_user')),
  attribution_notes text not null default '' check(pg_catalog.char_length(attribution_notes)<=1000),
  status text not null default 'draft' check(status in ('draft','active','archived')),
  industry text check(industry is null or industry in ('real_estate','ecommerce_retail','healthcare_clinics','education_coaching','gyms_fitness','restaurants_cafes','hotels_hospitality','travel_tourism','automobile_dealerships','salons_beauty','professional_services','marketing_agencies','home_services','finance_insurance','events_entertainment','other')),
  created_by_user_id uuid not null default auth.uid() references auth.users(id),
  updated_by_user_id uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default pg_catalog.now(), updated_at timestamptz not null default pg_catalog.now(),
  unique(workspace_id,id), check((illustrative_value is null)=(currency is null))
);
create index conversion_goals_workspace_updated_idx on public.conversion_goals(workspace_id,updated_at desc);

create table public.conversion_event_definitions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_key text not null check(event_key ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  display_name text not null check(pg_catalog.char_length(display_name) between 2 and 120),
  description text not null default '' check(pg_catalog.char_length(description)<=1000),
  trigger_definition text not null default '' check(pg_catalog.char_length(trigger_definition)<=1000),
  source_type text not null check(source_type in ('website','mobile_app','offline','crm','custom')),
  expected_parameters jsonb not null default '{}'::jsonb check(pg_catalog.jsonb_typeof(expected_parameters)='object' and pg_catalog.jsonb_object_length(expected_parameters)<=30),
  deduplication_reference text not null default '' check(pg_catalog.char_length(deduplication_reference)<=120),
  consent_required boolean not null default true,
  status text not null default 'draft' check(status in ('draft','active','archived')),
  version integer not null default 1 check(version>0),
  created_by_user_id uuid not null default auth.uid() references auth.users(id), updated_by_user_id uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default pg_catalog.now(), updated_at timestamptz not null default pg_catalog.now(),
  unique(workspace_id,event_key), unique(workspace_id,id)
);
create index conversion_event_definitions_workspace_updated_idx on public.conversion_event_definitions(workspace_id,updated_at desc);

create table public.conversion_event_mappings (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_definition_id uuid not null,
  provider text not null check(provider in ('google_ads','meta_ads','ga4','google_tag_manager','meta_pixel','google_ads_conversion')),
  provider_event_name text not null check(provider_event_name ~ '^[A-Za-z][A-Za-z0-9_]{1,99}$'),
  parameter_map jsonb not null default '{}'::jsonb check(pg_catalog.jsonb_typeof(parameter_map)='object' and pg_catalog.jsonb_object_length(parameter_map)<=30),
  status text not null default 'draft' check(status in ('draft','active','archived')),
  notes text not null default '' check(pg_catalog.char_length(notes)<=600),
  version integer not null default 1 check(version>0),
  created_by_user_id uuid not null default auth.uid() references auth.users(id), updated_by_user_id uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default pg_catalog.now(), updated_at timestamptz not null default pg_catalog.now(),
  unique(workspace_id,event_definition_id,provider), unique(workspace_id,id),
  foreign key(workspace_id,event_definition_id) references public.conversion_event_definitions(workspace_id,id) on delete cascade
);

-- Schema versions are derived in the database, so callers cannot rewind or
-- pin a mapping/event version through a crafted update request.
create function tandem_internal.bump_tracking_schema_version()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.version := old.version + 1;
  return new;
end $$;
revoke all on function tandem_internal.bump_tracking_schema_version() from public,anon,authenticated,service_role;
create trigger conversion_event_definition_version before update on public.conversion_event_definitions for each row execute function tandem_internal.bump_tracking_schema_version();
create trigger conversion_event_mapping_version before update on public.conversion_event_mappings for each row execute function tandem_internal.bump_tracking_schema_version();

create table public.utm_templates (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check(pg_catalog.char_length(name) between 2 and 120),
  destination_url text not null check(pg_catalog.char_length(destination_url) between 8 and 2048 and destination_url ~ '^https://'),
  source text not null check(pg_catalog.char_length(source) between 1 and 100),
  medium text not null check(pg_catalog.char_length(medium) between 1 and 100),
  campaign text not null check(pg_catalog.char_length(campaign) between 1 and 160),
  content text not null default '' check(pg_catalog.char_length(content)<=160),
  term text not null default '' check(pg_catalog.char_length(term)<=160),
  custom_parameters jsonb not null default '[]'::jsonb check(pg_catalog.jsonb_typeof(custom_parameters)='array' and pg_catalog.jsonb_array_length(custom_parameters)<=10),
  replace_existing boolean not null default false,
  campaign_id uuid references public.campaigns(id) on delete set null,
  goal_id uuid,
  status text not null default 'active' check(status in ('draft','active','archived')),
  created_by_user_id uuid not null default auth.uid() references auth.users(id), updated_by_user_id uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default pg_catalog.now(), updated_at timestamptz not null default pg_catalog.now(),
  unique(workspace_id,id),
  foreign key(workspace_id,goal_id) references public.conversion_goals(workspace_id,id)
);
create index utm_templates_workspace_updated_idx on public.utm_templates(workspace_id,updated_at desc);

create table public.campaign_tracking_configs (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  goal_id uuid,
  utm_template_id uuid,
  notes text not null default '' check(pg_catalog.char_length(notes)<=600),
  created_by_user_id uuid not null default auth.uid() references auth.users(id), updated_by_user_id uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default pg_catalog.now(), updated_at timestamptz not null default pg_catalog.now(),
  unique(workspace_id,campaign_id),
  foreign key(workspace_id,goal_id) references public.conversion_goals(workspace_id,id),
  foreign key(workspace_id,utm_template_id) references public.utm_templates(workspace_id,id)
);
create index campaign_tracking_configs_workspace_idx on public.campaign_tracking_configs(workspace_id,campaign_id);

create table public.tracking_test_runs (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  goal_id uuid,
  event_definition_id uuid not null,
  result text not null check(result in ('pass','warning','fail')),
  issues jsonb not null default '[]'::jsonb check(pg_catalog.jsonb_typeof(issues)='array' and pg_catalog.jsonb_array_length(issues)<=40),
  synthetic_preview jsonb not null check(pg_catalog.jsonb_typeof(synthetic_preview)='object' and pg_catalog.octet_length(synthetic_preview::text)<=10000),
  delivery_status text not null default 'not_sent' check(delivery_status='not_sent'),
  created_by_user_id uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default pg_catalog.now(),
  foreign key(workspace_id,goal_id) references public.conversion_goals(workspace_id,id),
  foreign key(workspace_id,event_definition_id) references public.conversion_event_definitions(workspace_id,id) on delete cascade
);
create index tracking_test_runs_workspace_recent_idx on public.tracking_test_runs(workspace_id,created_at desc);

create table public.workspace_tracking_plans (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check(pg_catalog.char_length(name) between 2 and 120),
  destination_website text not null check(pg_catalog.char_length(destination_website)<=2048 and destination_website ~ '^https://'),
  provider text not null check(provider in ('google_ads','meta_ads','ga4','google_tag_manager','meta_pixel','google_ads_conversion')),
  installation_method text not null check(installation_method in ('google_tag_ga4','google_tag_manager','meta_pixel','google_ads_conversion_tag','future_server_side')),
  measurement_identifier text not null default '' check(pg_catalog.char_length(measurement_identifier)<=120),
  consent_prerequisites text not null default '' check(pg_catalog.char_length(consent_prerequisites)<=1000),
  test_plan text not null default '' check(pg_catalog.char_length(test_plan)<=2000),
  implementation_owner_label text not null default '' check(pg_catalog.char_length(implementation_owner_label)<=120),
  review_status text not null default 'draft' check(review_status in ('draft','internal_review','client_review','approved_for_future_implementation')),
  privacy_checklist jsonb not null default '{"privacyNoticeReviewed":false,"consentPlanningReviewed":false,"jurisdictionReviewNeeded":false,"dataMinimizationReviewed":false,"sensitiveFieldsExcluded":false,"retentionReviewed":false,"thirdPartySharingReviewed":false}'::jsonb,
  created_by_user_id uuid not null default auth.uid() references auth.users(id), updated_by_user_id uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default pg_catalog.now(), updated_at timestamptz not null default pg_catalog.now(),
  unique(workspace_id,id),
  check(pg_catalog.jsonb_typeof(privacy_checklist)='object' and pg_catalog.jsonb_object_length(privacy_checklist)=7 and privacy_checklist ?& array['privacyNoticeReviewed','consentPlanningReviewed','jurisdictionReviewNeeded','dataMinimizationReviewed','sensitiveFieldsExcluded','retentionReviewed','thirdPartySharingReviewed']),
  check(measurement_identifier !~* '(token|secret|password|cookie|session|credential)')
);
create index workspace_tracking_plans_workspace_updated_idx on public.workspace_tracking_plans(workspace_id,updated_at desc);

create table public.workspace_tracking_preferences (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  casing text not null default 'lower' check(casing in ('lower','upper','preserve')),
  separator text not null default '_' check(separator in ('_','-','.')),
  campaign_format text not null default '{campaign}_{channel}_{date}' check(pg_catalog.char_length(campaign_format) between 1 and 120 and pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(campaign_format,'{campaign}',''),'{channel}',''),'{date}','') !~ '[{}]'),
  source_presets text[] not null default array['google','meta','linkedin'] check(pg_catalog.cardinality(source_presets)<=12 and array_position(source_presets,null) is null),
  content_labels text[] not null default array['image','video','headline'] check(pg_catalog.cardinality(content_labels)<=20 and array_position(content_labels,null) is null),
  date_token_format text not null default 'yyyyMMdd' check(date_token_format in ('yyyyMMdd','yyyy-MM-dd','MMM-yyyy')),
  updated_by_user_id uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default pg_catalog.now(), updated_at timestamptz not null default pg_catalog.now(),
  unique(workspace_id,id)
);
create index workspace_tracking_preferences_workspace_idx on public.workspace_tracking_preferences(workspace_id);

create table public.integration_configuration_audit (
  id uuid primary key default pg_catalog.gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null, entity_type text not null,
  entity_id uuid not null, action text not null check(action in ('record_created','record_updated','record_archived')),
  created_at timestamptz not null default pg_catalog.now()
);
create index integration_configuration_audit_recent_idx on public.integration_configuration_audit(workspace_id,created_at desc);

do $$
declare table_name text;
begin
  foreach table_name in array array['workspace_integration_configs','integration_readiness_responses','conversion_goals','conversion_event_definitions','conversion_event_mappings','utm_templates','campaign_tracking_configs','tracking_test_runs','workspace_tracking_plans','workspace_tracking_preferences','integration_configuration_audit'] loop
    execute format('alter table public.%I enable row level security',table_name);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role',table_name);
    execute format('grant select on public.%I to authenticated',table_name);
  end loop;
end $$;

-- Read membership and write administration are deliberately separate. All
-- writes stay in the authenticated caller context and must pass these policies.
grant insert (workspace_id,provider,account_identifier,business_label,website_url,notes,configuration_status) on public.workspace_integration_configs to authenticated;
grant update (workspace_id,provider,account_identifier,business_label,website_url,notes,configuration_status) on public.workspace_integration_configs to authenticated;
grant insert (workspace_id,provider,requirement_id,completed,note) on public.integration_readiness_responses to authenticated;
grant update (workspace_id,provider,requirement_id,completed,note) on public.integration_readiness_responses to authenticated;
grant insert (workspace_id,name,category,description,event_name,objective,illustrative_value,currency,counting_policy,attribution_notes,status,industry) on public.conversion_goals to authenticated;
grant update (name,category,description,event_name,objective,illustrative_value,currency,counting_policy,attribution_notes,status,industry) on public.conversion_goals to authenticated;
grant insert (workspace_id,event_key,display_name,description,trigger_definition,source_type,expected_parameters,deduplication_reference,consent_required,status) on public.conversion_event_definitions to authenticated;
grant update (workspace_id,event_key,display_name,description,trigger_definition,source_type,expected_parameters,deduplication_reference,consent_required,status,version) on public.conversion_event_definitions to authenticated;
grant insert (workspace_id,event_definition_id,provider,provider_event_name,parameter_map,status,notes) on public.conversion_event_mappings to authenticated;
grant update (workspace_id,event_definition_id,provider,provider_event_name,parameter_map,status,notes,version) on public.conversion_event_mappings to authenticated;
grant insert (workspace_id,name,destination_url,source,medium,campaign,content,term,custom_parameters,replace_existing,campaign_id,goal_id,status) on public.utm_templates to authenticated;
grant update (name,destination_url,source,medium,campaign,content,term,custom_parameters,replace_existing,campaign_id,goal_id,status) on public.utm_templates to authenticated;
grant insert (workspace_id,campaign_id,goal_id,utm_template_id,notes) on public.campaign_tracking_configs to authenticated;
grant update (workspace_id,campaign_id,goal_id,utm_template_id,notes) on public.campaign_tracking_configs to authenticated;
grant insert (workspace_id,name,destination_website,provider,installation_method,measurement_identifier,consent_prerequisites,test_plan,implementation_owner_label,review_status,privacy_checklist) on public.workspace_tracking_plans to authenticated;
grant update (name,destination_website,provider,installation_method,measurement_identifier,consent_prerequisites,test_plan,implementation_owner_label,review_status,privacy_checklist) on public.workspace_tracking_plans to authenticated;
grant insert (workspace_id,casing,separator,campaign_format,source_presets,content_labels,date_token_format) on public.workspace_tracking_preferences to authenticated;
grant update (workspace_id,casing,separator,campaign_format,source_presets,content_labels,date_token_format) on public.workspace_tracking_preferences to authenticated;
grant insert (workspace_id,goal_id,event_definition_id,result,issues,synthetic_preview,delivery_status) on public.tracking_test_runs to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['workspace_integration_configs','integration_readiness_responses','conversion_goals','conversion_event_definitions','conversion_event_mappings','utm_templates','campaign_tracking_configs','tracking_test_runs','workspace_tracking_plans','workspace_tracking_preferences'] loop
    execute format('create policy %I on public.%I for select to authenticated using (tandem_internal.has_workspace_role(workspace_id,array[''owner'',''admin'',''editor'',''viewer'']::text[]))',table_name||'_member_read',table_name);
  end loop;
  foreach table_name in array array['workspace_integration_configs','integration_readiness_responses','conversion_goals','conversion_event_definitions','conversion_event_mappings','utm_templates','campaign_tracking_configs','workspace_tracking_plans','workspace_tracking_preferences'] loop
    execute format('create policy %I on public.%I for insert to authenticated with check (tandem_internal.has_workspace_role(workspace_id,array[''owner'',''admin'']::text[]))',table_name||'_admin_insert',table_name);
    execute format('create policy %I on public.%I for update to authenticated using (tandem_internal.has_workspace_role(workspace_id,array[''owner'',''admin'']::text[])) with check (tandem_internal.has_workspace_role(workspace_id,array[''owner'',''admin'']::text[]))',table_name||'_admin_update',table_name);
    execute format('create trigger %I before insert or update or delete on public.%I for each row execute function tandem_internal.guard_tracking_write()',table_name||'_billing_guard',table_name);
    execute format('create trigger %I before update on public.%I for each row execute function tandem_internal.touch_settings_updated_at()',table_name||'_touch',table_name);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function tandem_internal.audit_tracking_write()',table_name||'_audit',table_name);
  end loop;
  create policy tracking_test_runs_admin_insert on public.tracking_test_runs for insert to authenticated with check (tandem_internal.has_workspace_role(workspace_id,array['owner','admin']::text[]));
  create trigger tracking_test_runs_billing_guard before insert on public.tracking_test_runs for each row execute function tandem_internal.guard_tracking_write();
  create policy integration_configuration_audit_admin_read on public.integration_configuration_audit for select to authenticated using (tandem_internal.has_workspace_role(workspace_id,array['owner','admin']::text[]));
end $$;

-- Bind campaign references to the same workspace, even if a caller knows a
-- foreign campaign UUID. RLS remains the first line of isolation.
create function tandem_internal.guard_tracking_campaign_workspace()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.campaigns c where c.id=new.campaign_id and c.workspace_id=new.workspace_id) then
    raise exception using errcode='23503',message='Campaign does not belong to this workspace.';
  end if;
  return new;
end $$;
revoke all on function tandem_internal.guard_tracking_campaign_workspace() from public,anon,authenticated,service_role;
create trigger utm_campaign_workspace_guard before insert or update of workspace_id,campaign_id on public.utm_templates for each row when (new.campaign_id is not null) execute function tandem_internal.guard_tracking_campaign_workspace();
create trigger campaign_tracking_workspace_guard before insert or update of workspace_id,campaign_id on public.campaign_tracking_configs for each row execute function tandem_internal.guard_tracking_campaign_workspace();

commit;
