begin;

do $$ begin
  if to_regclass('public.campaigns') is null or to_regclass('public.demo_campaign_analytics') is null
     or to_regprocedure('tandem_internal.has_workspace_role(uuid,text[])') is null then
    raise exception 'Prompt 08 requires the Prompt 03 workspace and Prompt 05 campaign migrations.';
  end if;
end $$;

create or replace function tandem_internal.has_reporting_permission(p_workspace_id uuid, p_permission text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case p_permission
    when 'read' then tandem_internal.has_workspace_role(p_workspace_id, array['owner','admin','editor','viewer']::text[])
    when 'manage' then tandem_internal.has_workspace_role(p_workspace_id, array['owner','admin','editor']::text[])
    when 'archive' then tandem_internal.has_workspace_role(p_workspace_id, array['owner','admin']::text[])
    when 'export' then tandem_internal.has_workspace_role(p_workspace_id, array['owner','admin','editor']::text[])
    else false
  end;
$$;
revoke all on function tandem_internal.has_reporting_permission(uuid,text) from public, anon, authenticated, service_role;
grant execute on function tandem_internal.has_reporting_permission(uuid,text) to authenticated;

create table public.analytics_saved_views (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  filters jsonb not null,
  visible_columns text[] not null,
  sort_key text not null default 'spend',
  version integer not null default 1,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  updated_by_user_id uuid not null references auth.users(id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique(id,workspace_id),
  constraint analytics_saved_views_name check (pg_catalog.char_length(pg_catalog.btrim(name)) between 1 and 100),
  constraint analytics_saved_views_filters check (pg_catalog.jsonb_typeof(filters)='object' and pg_catalog.octet_length(filters::text)<=16384),
  constraint analytics_saved_views_columns check (pg_catalog.cardinality(visible_columns) between 1 and 20),
  constraint analytics_saved_views_sort check (sort_key in ('spend','impressions','clicks','ctr','campaign','updated')),
  constraint analytics_saved_views_version check (version>0)
);
create unique index analytics_saved_views_workspace_name_idx on public.analytics_saved_views(workspace_id,pg_catalog.lower(name)) where archived_at is null;
create index analytics_saved_views_recent_idx on public.analytics_saved_views(workspace_id,updated_at desc) where archived_at is null;

create table public.report_definitions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text not null default '',
  report_type text not null,
  definition jsonb not null,
  version integer not null default 1,
  status text not null default 'active',
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  updated_by_user_id uuid not null references auth.users(id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique(id,workspace_id),
  constraint report_definitions_name check (pg_catalog.char_length(pg_catalog.btrim(name)) between 1 and 120),
  constraint report_definitions_description check (pg_catalog.char_length(description)<=1000),
  constraint report_definitions_type check (report_type in ('executive_overview','campaign_performance','platform_comparison','creative_analysis','budget_efficiency','performance_trends','custom','google_search','meta_campaign')),
  constraint report_definitions_payload check (pg_catalog.jsonb_typeof(definition)='object' and pg_catalog.octet_length(definition::text)<=131072),
  constraint report_definitions_version check (version>0),
  constraint report_definitions_status check (status in ('active','archived')),
  constraint report_definitions_archive_state check ((status='archived')=(archived_at is not null))
);
create unique index report_definitions_workspace_name_idx on public.report_definitions(workspace_id,pg_catalog.lower(name)) where archived_at is null;
create index report_definitions_recent_idx on public.report_definitions(workspace_id,updated_at desc,id) where archived_at is null;
create index report_definitions_creator_idx on public.report_definitions(workspace_id,created_by_user_id,created_at desc);

create table public.report_revisions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  report_id uuid not null,
  version integer not null,
  name text not null,
  definition jsonb not null,
  authored_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  foreign key(report_id,workspace_id) references public.report_definitions(id,workspace_id) on delete cascade,
  unique(report_id,version),
  constraint report_revisions_definition_object check (pg_catalog.jsonb_typeof(definition)='object' and pg_catalog.octet_length(definition::text)<=131072)
);
create index report_revisions_recent_idx on public.report_revisions(workspace_id,report_id,version desc);

create table public.report_exports (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  report_id uuid,
  report_version integer,
  export_format text not null,
  row_count integer not null,
  file_bytes integer not null,
  sha256 text not null,
  data_source text not null default 'DEMO_SIMULATION',
  generated_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  foreign key(report_id,workspace_id) references public.report_definitions(id,workspace_id),
  constraint report_exports_format check (export_format in ('csv','pdf')),
  constraint report_exports_counts check (row_count between 0 and 100000 and file_bytes between 1 and 25000000),
  constraint report_exports_sha256 check (sha256 ~ '^[0-9a-f]{64}$'),
  constraint report_exports_source check (data_source='DEMO_SIMULATION'),
  constraint report_exports_version check ((report_id is null and report_version is null) or (report_id is not null and report_version>0))
);
create index report_exports_recent_idx on public.report_exports(workspace_id,created_at desc);
create index report_exports_report_idx on public.report_exports(workspace_id,report_id,created_at desc);

alter table public.analytics_saved_views enable row level security;
alter table public.report_definitions enable row level security;
alter table public.report_revisions enable row level security;
alter table public.report_exports enable row level security;
revoke all on public.analytics_saved_views,public.report_definitions,public.report_revisions,public.report_exports from public,anon,authenticated,service_role;
grant select on public.analytics_saved_views,public.report_definitions,public.report_revisions,public.report_exports to authenticated;
create policy analytics_saved_views_member_read on public.analytics_saved_views for select to authenticated using (tandem_internal.has_reporting_permission(workspace_id,'read'));
create policy report_definitions_member_read on public.report_definitions for select to authenticated using (tandem_internal.has_reporting_permission(workspace_id,'read'));
create policy report_revisions_member_read on public.report_revisions for select to authenticated using (tandem_internal.has_reporting_permission(workspace_id,'read'));
create policy report_exports_member_read on public.report_exports for select to authenticated using (tandem_internal.has_reporting_permission(workspace_id,'read'));

create function public.save_analytics_view(p_workspace_id uuid,p_view_id uuid,p_expected_version integer,p_name text,p_filters jsonb,p_visible_columns text[],p_sort_key text)
returns public.analytics_saved_views language plpgsql security definer set search_path = '' as $$
declare actor uuid:=(select auth.uid()); existing public.analytics_saved_views; result public.analytics_saved_views;
begin
  if actor is null then raise exception using errcode='28000',message='Authentication is required.'; end if;
  if not tandem_internal.has_reporting_permission(p_workspace_id,'manage') then raise exception using errcode='42501',message='Analytics view management permission is required.'; end if;
  if p_name is null or pg_catalog.char_length(pg_catalog.btrim(p_name)) not between 1 and 100 or pg_catalog.jsonb_typeof(p_filters)<>'object' or pg_catalog.octet_length(p_filters::text)>16384 or pg_catalog.cardinality(p_visible_columns) not between 1 and 20 or p_sort_key not in ('spend','impressions','clicks','ctr','campaign','updated') then
    raise exception using errcode='22023',message='Analytics view is invalid.';
  end if;
  if p_view_id is null then
    insert into public.analytics_saved_views(workspace_id,name,filters,visible_columns,sort_key,created_by_user_id,updated_by_user_id)
      values(p_workspace_id,pg_catalog.btrim(p_name),p_filters,p_visible_columns,p_sort_key,actor,actor) returning * into result;
  else
    select * into existing from public.analytics_saved_views where id=p_view_id and workspace_id=p_workspace_id and archived_at is null for update;
    if not found then raise exception using errcode='P0002',message='Analytics view not found.'; end if;
    if existing.version<>p_expected_version then raise exception using errcode='40001',message='Analytics view changed.'; end if;
    update public.analytics_saved_views set name=pg_catalog.btrim(p_name),filters=p_filters,visible_columns=p_visible_columns,sort_key=p_sort_key,version=version+1,updated_by_user_id=actor,updated_at=pg_catalog.now()
      where id=p_view_id and workspace_id=p_workspace_id returning * into result;
  end if;
  return result;
end;
$$;

create function public.create_report_definition(p_workspace_id uuid,p_definition jsonb)
returns public.report_definitions language plpgsql security definer set search_path = '' as $$
declare actor uuid:=(select auth.uid()); result public.report_definitions;
begin
  if actor is null then raise exception using errcode='28000',message='Authentication is required.'; end if;
  if not tandem_internal.has_reporting_permission(p_workspace_id,'manage') then raise exception using errcode='42501',message='Report management permission is required.'; end if;
  if pg_catalog.jsonb_typeof(p_definition)<>'object' or pg_catalog.octet_length(p_definition::text)>131072
     or pg_catalog.char_length(pg_catalog.btrim(p_definition->>'name')) not between 1 and 120
     or pg_catalog.jsonb_typeof(p_definition->'metrics') is distinct from 'array' or pg_catalog.jsonb_array_length(p_definition->'metrics') not between 1 and 10
     or pg_catalog.jsonb_typeof(p_definition->'sections') is distinct from 'array' or pg_catalog.jsonb_array_length(p_definition->'sections') not between 1 and 20 then
    raise exception using errcode='22023',message='Report definition is invalid.';
  end if;
  insert into public.report_definitions(workspace_id,name,description,report_type,definition,created_by_user_id,updated_by_user_id)
    values(p_workspace_id,pg_catalog.btrim(p_definition->>'name'),coalesce(p_definition->>'description',''),p_definition->>'reportType',p_definition,actor,actor)
    returning * into result;
  insert into public.report_revisions(workspace_id,report_id,version,name,definition,authored_by_user_id)
    values(p_workspace_id,result.id,result.version,result.name,result.definition,actor);
  return result;
end;
$$;

create function public.save_report_definition(p_report_id uuid,p_workspace_id uuid,p_expected_version integer,p_definition jsonb)
returns public.report_definitions language plpgsql security definer set search_path = '' as $$
declare actor uuid:=(select auth.uid()); existing public.report_definitions; result public.report_definitions;
begin
  if actor is null then raise exception using errcode='28000',message='Authentication is required.'; end if;
  if not tandem_internal.has_reporting_permission(p_workspace_id,'manage') then raise exception using errcode='42501',message='Report management permission is required.'; end if;
  if pg_catalog.jsonb_typeof(p_definition)<>'object' or pg_catalog.octet_length(p_definition::text)>131072
     or pg_catalog.char_length(pg_catalog.btrim(p_definition->>'name')) not between 1 and 120
     or pg_catalog.jsonb_typeof(p_definition->'metrics') is distinct from 'array' or pg_catalog.jsonb_array_length(p_definition->'metrics') not between 1 and 10
     or pg_catalog.jsonb_typeof(p_definition->'sections') is distinct from 'array' or pg_catalog.jsonb_array_length(p_definition->'sections') not between 1 and 20 then
    raise exception using errcode='22023',message='Report definition is invalid.';
  end if;
  select * into existing from public.report_definitions where id=p_report_id and workspace_id=p_workspace_id and status='active' for update;
  if not found then raise exception using errcode='P0002',message='Report not found.'; end if;
  if existing.version<>p_expected_version then raise exception using errcode='40001',message='Report changed.'; end if;
  update public.report_definitions set name=pg_catalog.btrim(p_definition->>'name'),description=coalesce(p_definition->>'description',''),report_type=p_definition->>'reportType',definition=p_definition,version=version+1,updated_by_user_id=actor,updated_at=pg_catalog.now()
    where id=p_report_id and workspace_id=p_workspace_id returning * into result;
  insert into public.report_revisions(workspace_id,report_id,version,name,definition,authored_by_user_id)
    values(p_workspace_id,result.id,result.version,result.name,result.definition,actor);
  return result;
end;
$$;

create function public.duplicate_report_definition(p_report_id uuid,p_workspace_id uuid,p_name text)
returns public.report_definitions language plpgsql security definer set search_path = '' as $$
declare actor uuid:=(select auth.uid()); original public.report_definitions; result public.report_definitions; definition_value jsonb;
begin
  if actor is null then raise exception using errcode='28000',message='Authentication is required.'; end if;
  if not tandem_internal.has_reporting_permission(p_workspace_id,'manage') then raise exception using errcode='42501',message='Report management permission is required.'; end if;
  select * into original from public.report_definitions where id=p_report_id and workspace_id=p_workspace_id and status='active';
  if not found then raise exception using errcode='P0002',message='Report not found.'; end if;
  definition_value:=pg_catalog.jsonb_set(original.definition,'{name}',pg_catalog.to_jsonb(coalesce(nullif(pg_catalog.btrim(p_name),''),original.name||' copy')),true);
  insert into public.report_definitions(workspace_id,name,description,report_type,definition,created_by_user_id,updated_by_user_id)
    values(p_workspace_id,definition_value->>'name',original.description,original.report_type,definition_value,actor,actor) returning * into result;
  insert into public.report_revisions(workspace_id,report_id,version,name,definition,authored_by_user_id)
    values(p_workspace_id,result.id,result.version,result.name,result.definition,actor);
  return result;
end;
$$;

create function public.archive_report_definition(p_report_id uuid,p_workspace_id uuid,p_expected_version integer)
returns public.report_definitions language plpgsql security definer set search_path = '' as $$
declare actor uuid:=(select auth.uid()); result public.report_definitions;
begin
  if actor is null then raise exception using errcode='28000',message='Authentication is required.'; end if;
  if not tandem_internal.has_reporting_permission(p_workspace_id,'archive') then raise exception using errcode='42501',message='Report archive permission is required.'; end if;
  update public.report_definitions set status='archived',archived_at=pg_catalog.now(),version=version+1,updated_by_user_id=actor,updated_at=pg_catalog.now()
   where id=p_report_id and workspace_id=p_workspace_id and status='active' and version=p_expected_version returning * into result;
  if not found then
    if exists(select 1 from public.report_definitions where id=p_report_id and workspace_id=p_workspace_id) then raise exception using errcode='40001',message='Report changed.'; end if;
    raise exception using errcode='P0002',message='Report not found.';
  end if;
  insert into public.report_revisions(workspace_id,report_id,version,name,definition,authored_by_user_id)
    values(p_workspace_id,result.id,result.version,result.name,result.definition,actor);
  return result;
end;
$$;

create function public.record_report_export(p_workspace_id uuid,p_report_id uuid,p_report_version integer,p_format text,p_row_count integer,p_file_bytes integer,p_sha256 text)
returns public.report_exports language plpgsql security definer set search_path = '' as $$
declare actor uuid:=(select auth.uid()); report_row public.report_definitions; result public.report_exports;
begin
  if actor is null then raise exception using errcode='28000',message='Authentication is required.'; end if;
  if not tandem_internal.has_reporting_permission(p_workspace_id,'export') then raise exception using errcode='42501',message='Report export permission is required.'; end if;
  if p_report_id is not null then
    select * into report_row from public.report_definitions where id=p_report_id and workspace_id=p_workspace_id and status='active';
    if not found or report_row.version<>p_report_version then raise exception using errcode='40001',message='Report changed before export.'; end if;
  end if;
  insert into public.report_exports(workspace_id,report_id,report_version,export_format,row_count,file_bytes,sha256,generated_by_user_id)
    values(p_workspace_id,p_report_id,p_report_version,p_format,p_row_count,p_file_bytes,p_sha256,actor) returning * into result;
  return result;
end;
$$;

revoke all on function public.save_analytics_view(uuid,uuid,integer,text,jsonb,text[],text) from public,anon,authenticated,service_role;
revoke all on function public.create_report_definition(uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.save_report_definition(uuid,uuid,integer,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.duplicate_report_definition(uuid,uuid,text) from public,anon,authenticated,service_role;
revoke all on function public.archive_report_definition(uuid,uuid,integer) from public,anon,authenticated,service_role;
revoke all on function public.record_report_export(uuid,uuid,integer,text,integer,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.save_analytics_view(uuid,uuid,integer,text,jsonb,text[],text) to authenticated;
grant execute on function public.create_report_definition(uuid,jsonb) to authenticated;
grant execute on function public.save_report_definition(uuid,uuid,integer,jsonb) to authenticated;
grant execute on function public.duplicate_report_definition(uuid,uuid,text) to authenticated;
grant execute on function public.archive_report_definition(uuid,uuid,integer) to authenticated;
grant execute on function public.record_report_export(uuid,uuid,integer,text,integer,integer,text) to authenticated;

commit;
