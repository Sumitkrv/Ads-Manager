begin;

do $$
begin
  if to_regclass('public.workspaces') is null
    or to_regclass('public.workspace_memberships') is null
    or to_regclass('public.campaigns') is null
    or to_regprocedure('tandem_internal.has_workspace_role(uuid,text[])') is null then
    raise exception 'Prompt 06 requires the Prompt 03 workspace and Prompt 05 campaign migrations.';
  end if;
end;
$$;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('workspace-creative-assets', 'workspace-creative-assets', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create table public.creative_assets (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  asset_type text not null,
  original_filename text not null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes integer not null,
  width integer not null,
  height integer not null,
  uploader_user_id uuid references auth.users(id) on delete set null,
  tags text[] not null default '{}',
  asset_status text not null default 'active',
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  archived_at timestamptz,
  constraint creative_assets_id_workspace_unique unique (id, workspace_id),
  constraint creative_assets_type_valid check (asset_type in ('logo', 'image')),
  constraint creative_assets_filename_safe check (pg_catalog.char_length(original_filename) between 1 and 255 and pg_catalog.strpos(original_filename, '/') = 0 and pg_catalog.strpos(original_filename, pg_catalog.chr(92)) = 0),
  constraint creative_assets_path_scoped check (storage_path = workspace_id::text || '/' || id::text || case mime_type when 'image/png' then '.png' when 'image/jpeg' then '.jpg' when 'image/webp' then '.webp' else '.invalid' end),
  constraint creative_assets_mime_valid check (mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  constraint creative_assets_size_valid check (size_bytes between 1 and 5242880),
  constraint creative_assets_dimensions_valid check (width between 1 and 8192 and height between 1 and 8192 and width::bigint * height::bigint <= 16000000),
  constraint creative_assets_tags_valid check (pg_catalog.cardinality(tags) <= 20),
  constraint creative_assets_status_valid check ((asset_status = 'active' and archived_at is null) or (asset_status = 'archived' and archived_at is not null))
);
create index creative_assets_workspace_recent_idx on public.creative_assets(workspace_id, created_at desc) where asset_status = 'active';
create index creative_assets_workspace_type_idx on public.creative_assets(workspace_id, asset_type, created_at desc) where asset_status = 'active';

create table public.workspace_brand_kits (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  display_name text not null,
  tagline text not null default '',
  main_message text not null default '',
  description text not null default '',
  primary_color text not null,
  secondary_color text not null,
  accent_colors text[] not null default '{}',
  background_preferences text[] not null default '{}',
  saved_palettes jsonb not null default '[]'::jsonb,
  heading_font text not null default 'Inter',
  body_font text not null default 'Inter',
  tone text not null default 'clear',
  cta_style text not null default 'direct',
  website text,
  social_handles jsonb not null default '{}'::jsonb,
  industry_key text not null,
  industry_custom_label text,
  logo_asset_id uuid,
  alternate_logo_asset_id uuid,
  revision integer not null default 1,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint workspace_brand_display_name_length check (pg_catalog.char_length(display_name) between 1 and 120),
  constraint workspace_brand_industry_valid check (industry_key in ('real_estate', 'ecommerce_retail', 'healthcare_clinics', 'education_coaching', 'gyms_fitness', 'restaurants_cafes', 'hotels_hospitality', 'travel_tourism', 'automobile_dealerships', 'salons_beauty', 'professional_services', 'marketing_agencies', 'home_services', 'finance_insurance', 'events_entertainment', 'other')),
  constraint workspace_brand_colors_valid check (primary_color ~ '^#[0-9A-Fa-f]{6}$' and secondary_color ~ '^#[0-9A-Fa-f]{6}$' and pg_catalog.cardinality(accent_colors) <= 6 and pg_catalog.cardinality(background_preferences) <= 6),
  constraint workspace_brand_palettes_object check (pg_catalog.jsonb_typeof(saved_palettes) = 'array' and pg_catalog.jsonb_array_length(saved_palettes) <= 12),
  constraint workspace_brand_social_object check (pg_catalog.jsonb_typeof(social_handles) = 'object'),
  constraint workspace_brand_tone_valid check (tone in ('clear', 'warm', 'confident', 'playful', 'premium', 'expert')),
  constraint workspace_brand_cta_valid check (cta_style in ('direct', 'warm', 'minimal', 'confident', 'custom')),
  constraint workspace_brand_font_valid check (heading_font in ('Inter', 'Arial', 'Georgia', 'DM Sans', 'Space Grotesk', 'Playfair Display', 'Roboto', 'Lato') and body_font in ('Inter', 'Arial', 'Georgia', 'DM Sans', 'Space Grotesk', 'Playfair Display', 'Roboto', 'Lato')),
  constraint workspace_brand_logo_workspace_fk foreign key (logo_asset_id, workspace_id) references public.creative_assets(id, workspace_id) on delete restrict,
  constraint workspace_brand_alt_logo_workspace_fk foreign key (alternate_logo_asset_id, workspace_id) references public.creative_assets(id, workspace_id) on delete restrict
);

create table public.creative_projects (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  document jsonb not null,
  aspect_bucket text generated always as (
    case
      when document ->> 'width' is null or document ->> 'height' is null then 'custom'
      when (document ->> 'width')::numeric = (document ->> 'height')::numeric then 'square'
      when (document ->> 'width')::numeric * 5 = (document ->> 'height')::numeric * 4 then 'portrait'
      when (document ->> 'width')::numeric * 16 = (document ->> 'height')::numeric * 9 then 'vertical'
      when (document ->> 'width')::numeric between (document ->> 'height')::numeric * 1.8 and (document ->> 'height')::numeric * 2.0 then 'landscape'
      else 'custom'
    end
  ) stored,
  industry_key text not null,
  platform text,
  template_key text,
  lifecycle_status text not null default 'draft',
  revision integer not null default 1,
  approved_revision integer,
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint creative_projects_id_workspace_unique unique (id, workspace_id),
  constraint creative_projects_name_length check (pg_catalog.char_length(name) between 1 and 160),
  constraint creative_projects_document_object check (pg_catalog.jsonb_typeof(document) = 'object' and document ->> 'version' = '1'),
  constraint creative_projects_industry_valid check (industry_key in ('real_estate', 'ecommerce_retail', 'healthcare_clinics', 'education_coaching', 'gyms_fitness', 'restaurants_cafes', 'hotels_hospitality', 'travel_tourism', 'automobile_dealerships', 'salons_beauty', 'professional_services', 'marketing_agencies', 'home_services', 'finance_insurance', 'events_entertainment', 'other')),
  constraint creative_projects_platform_valid check (platform is null or platform in ('google_ads', 'meta_ads')),
  constraint creative_projects_status_valid check (lifecycle_status in ('draft', 'needs_review', 'changes_requested', 'approved', 'archived')),
  constraint creative_projects_approval_revision check (approved_revision is null or approved_revision <= revision)
);
create index creative_projects_workspace_recent_idx on public.creative_projects(workspace_id, updated_at desc);
create index creative_projects_workspace_industry_idx on public.creative_projects(workspace_id, industry_key, updated_at desc);
create index creative_projects_workspace_aspect_idx on public.creative_projects(workspace_id, aspect_bucket, updated_at desc);

create table public.creative_project_revisions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  creative_id uuid not null,
  revision integer not null,
  name text not null,
  document jsonb not null,
  lifecycle_status text not null,
  author_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  constraint creative_project_revisions_creative_fk foreign key (creative_id, workspace_id) references public.creative_projects(id, workspace_id) on delete cascade,
  constraint creative_project_revisions_unique unique (creative_id, revision)
);
create index creative_project_revisions_workspace_idx on public.creative_project_revisions(workspace_id, creative_id, revision desc);

create table public.creative_project_assets (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  creative_id uuid not null,
  asset_id uuid not null,
  created_at timestamptz not null default pg_catalog.now(),
  primary key (creative_id, asset_id),
  constraint creative_project_assets_project_fk foreign key (creative_id, workspace_id) references public.creative_projects(id, workspace_id) on delete cascade,
  constraint creative_project_assets_asset_fk foreign key (asset_id, workspace_id) references public.creative_assets(id, workspace_id) on delete restrict
);
create index creative_project_assets_asset_idx on public.creative_project_assets(workspace_id, asset_id);

create table public.creative_project_reviews (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  creative_id uuid not null,
  draft_revision integer not null,
  decision text not null,
  reviewer_user_id uuid not null references auth.users(id) on delete restrict,
  comments text not null default '',
  created_at timestamptz not null default pg_catalog.now(),
  constraint creative_project_reviews_project_fk foreign key (creative_id, workspace_id) references public.creative_projects(id, workspace_id) on delete cascade,
  constraint creative_project_reviews_decision_valid check (decision in ('submitted', 'approved', 'changes_requested', 'reopened')),
  constraint creative_project_reviews_comments_length check (pg_catalog.char_length(comments) <= 4000)
);
create index creative_project_reviews_workspace_idx on public.creative_project_reviews(workspace_id, creative_id, created_at desc);

create table public.creative_campaign_links (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null,
  creative_id uuid not null,
  linked_by_user_id uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  primary key (campaign_id, creative_id),
  constraint creative_campaign_links_campaign_fk foreign key (campaign_id, workspace_id) references public.campaigns(id, workspace_id) on delete cascade,
  constraint creative_campaign_links_creative_fk foreign key (creative_id, workspace_id) references public.creative_projects(id, workspace_id) on delete cascade
);
create index creative_campaign_links_workspace_idx on public.creative_campaign_links(workspace_id, campaign_id);

create or replace function tandem_internal.touch_creative_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.updated_at := pg_catalog.now(); return new; end;
$$;
revoke all on function tandem_internal.touch_creative_updated_at() from public, anon, authenticated, service_role;
create trigger brand_kits_touch_updated_at before update on public.workspace_brand_kits for each row execute function tandem_internal.touch_creative_updated_at();
create trigger creative_assets_touch_updated_at before update on public.creative_assets for each row execute function tandem_internal.touch_creative_updated_at();
create trigger creative_projects_touch_updated_at before update on public.creative_projects for each row execute function tandem_internal.touch_creative_updated_at();

create or replace function tandem_internal.set_brand_kit_revision()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then new.revision := old.revision + 1; else new.revision := 1; end if;
  return new;
end;
$$;
revoke all on function tandem_internal.set_brand_kit_revision() from public, anon, authenticated, service_role;
create trigger brand_kits_set_revision before insert or update on public.workspace_brand_kits for each row execute function tandem_internal.set_brand_kit_revision();

create or replace function tandem_internal.creative_document_is_valid(p_document jsonb)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
declare
  element jsonb;
  element_id uuid;
  seen_ids uuid[] := array[]::uuid[];
  width_value integer;
  height_value integer;
  x_value numeric;
  y_value numeric;
  element_width numeric;
  element_height numeric;
  font_size integer;
  border_width integer;
  radius_value integer;
  opacity_value numeric;
  rotation_value numeric;
  color_value text;
  element_type text;
  background_kind text;
begin
  if p_document is null or pg_catalog.jsonb_typeof(p_document) is distinct from 'object'
    or pg_catalog.jsonb_typeof(p_document -> 'version') is distinct from 'number' or p_document ->> 'version' <> '1' then return false; end if;
  if pg_catalog.jsonb_typeof(p_document -> 'width') is distinct from 'number' or pg_catalog.jsonb_typeof(p_document -> 'height') is distinct from 'number' then return false; end if;
  width_value := (p_document ->> 'width')::integer;
  height_value := (p_document ->> 'height')::integer;
  if width_value is null or height_value is null or width_value not between 120 and 4096 or height_value not between 120 and 4096 or width_value::bigint * height_value::bigint > 16000000 then return false; end if;
  if pg_catalog.jsonb_typeof(p_document -> 'background') is distinct from 'object' or pg_catalog.jsonb_typeof(p_document -> 'elements') is distinct from 'array' then return false; end if;
  if pg_catalog.jsonb_array_length(p_document -> 'elements') > 100 then return false; end if;
  background_kind := p_document -> 'background' ->> 'kind';
  if background_kind = 'solid' then
    if coalesce(p_document -> 'background' ->> 'color', '') !~ '^#[0-9A-Fa-f]{6}$' then return false; end if;
  elsif background_kind = 'gradient' then
    if coalesce(p_document -> 'background' ->> 'from', '') !~ '^#[0-9A-Fa-f]{6}$'
      or coalesce(p_document -> 'background' ->> 'to', '') !~ '^#[0-9A-Fa-f]{6}$'
      or pg_catalog.jsonb_typeof(p_document -> 'background' -> 'angle') is distinct from 'number'
      or coalesce((p_document -> 'background' ->> 'angle')::integer, -1) not between 0 and 360 then return false; end if;
  else return false;
  end if;

  for element in select value from pg_catalog.jsonb_array_elements(p_document -> 'elements') loop
    if pg_catalog.jsonb_typeof(element) is distinct from 'object' then return false; end if;
    element_id := (element ->> 'id')::uuid;
    if element_id = any(seen_ids) then return false; end if;
    seen_ids := pg_catalog.array_append(seen_ids, element_id);
    element_type := element ->> 'type';
    if pg_catalog.jsonb_typeof(element -> 'x') is distinct from 'number' or pg_catalog.jsonb_typeof(element -> 'y') is distinct from 'number'
      or pg_catalog.jsonb_typeof(element -> 'width') is distinct from 'number' or pg_catalog.jsonb_typeof(element -> 'height') is distinct from 'number'
      or pg_catalog.jsonb_typeof(element -> 'locked') is distinct from 'boolean' then return false; end if;
    x_value := (element ->> 'x')::numeric;
    y_value := (element ->> 'y')::numeric;
    element_width := (element ->> 'width')::numeric;
    element_height := (element ->> 'height')::numeric;
    rotation_value := coalesce((element ->> 'rotation')::numeric, 0);
    opacity_value := coalesce((element ->> 'opacity')::numeric, 1);
    if x_value is null or y_value is null or element_width is null or element_height is null
      or x_value not between -8192 and 16384 or y_value not between -8192 and 16384
      or element_width not between 8 and 16384 or element_height not between 8 and 16384
      or rotation_value not between -180 and 180 or opacity_value not between 0 and 1 then return false; end if;
    if coalesce(element ->> 'locked', 'false') not in ('true', 'false') then return false; end if;
    if element_type = 'text' then
      if pg_catalog.jsonb_typeof(element -> 'text') is distinct from 'string' or pg_catalog.char_length(element ->> 'text') > 1600
        or coalesce(element ->> 'color', '') !~ '^#[0-9A-Fa-f]{6}$'
        or element ->> 'fontFamily' is null or element ->> 'fontFamily' not in ('Inter', 'Arial', 'Georgia', 'DM Sans', 'Space Grotesk', 'Playfair Display', 'Roboto', 'Lato')
        or element ->> 'fontWeight' is null or element ->> 'fontWeight' not in ('400', '500', '600', '700', '800')
        or element ->> 'align' is null or element ->> 'align' not in ('left', 'center', 'right')
        or pg_catalog.jsonb_typeof(element -> 'fontSize') is distinct from 'number'
        or pg_catalog.jsonb_typeof(element -> 'letterSpacing') is distinct from 'number' then return false; end if;
      font_size := (element ->> 'fontSize')::integer;
      if font_size not between 8 and 320 then return false; end if;
      if coalesce((element ->> 'letterSpacing')::numeric, 0) not between -4 and 24 then return false; end if;
    elsif element_type = 'shape' then
      if element ->> 'shape' is null or element ->> 'shape' not in ('rectangle', 'circle') or coalesce(element ->> 'fill', '') !~ '^#[0-9A-Fa-f]{6}$'
        or pg_catalog.jsonb_typeof(element -> 'borderWidth') is distinct from 'number'
        or pg_catalog.jsonb_typeof(element -> 'radius') is distinct from 'number' then return false; end if;
      color_value := element ->> 'borderColor';
      if color_value is not null and color_value !~ '^#[0-9A-Fa-f]{6}$' then return false; end if;
      border_width := coalesce((element ->> 'borderWidth')::integer, 0);
      radius_value := coalesce((element ->> 'radius')::integer, 0);
      if border_width not between 0 and 40 or radius_value not between 0 and 400 then return false; end if;
    elsif element_type = 'image' then
      element_id := (element ->> 'assetId')::uuid;
      if element ->> 'fit' is null or element ->> 'fit' not in ('cover', 'contain') then return false; end if;
    else return false;
    end if;
  end loop;
  if p_document ? 'generation' and (pg_catalog.jsonb_typeof(p_document -> 'generation') is distinct from 'object'
    or p_document -> 'generation' ->> 'mode' is distinct from 'offline'
    or p_document -> 'generation' ->> 'label' is distinct from 'Offline Creative Variations'
    or pg_catalog.jsonb_typeof(p_document -> 'generation' -> 'seed') is distinct from 'number'
    or pg_catalog.char_length(coalesce(p_document -> 'generation' ->> 'style', '')) not between 1 and 80) then return false; end if;
  return true;
exception when others then return false;
end;
$$;
revoke all on function tandem_internal.creative_document_is_valid(jsonb) from public, anon, authenticated, service_role;

create or replace function public.create_creative_project(p_workspace_id uuid, p_name text, p_document jsonb, p_industry text, p_platform text, p_template_key text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); result public.creative_projects;
begin
  if actor_id is null then raise exception using errcode = '28000', message = 'Authentication is required.'; end if;
  if not tandem_internal.has_workspace_role(p_workspace_id, array['owner', 'admin', 'editor']::text[]) then raise exception using errcode = '42501', message = 'Creative management permission is required.'; end if;
  if not tandem_internal.creative_document_is_valid(p_document) then raise exception using errcode = '22023', message = 'Creative document is invalid.'; end if;
  insert into public.creative_projects(workspace_id, name, document, industry_key, platform, template_key, created_by_user_id, updated_by_user_id)
  values (p_workspace_id, pg_catalog.btrim(p_name), p_document, p_industry, p_platform, p_template_key, actor_id, actor_id)
  returning * into result;
  insert into public.creative_project_revisions(workspace_id, creative_id, revision, name, document, lifecycle_status, author_user_id)
  values(result.workspace_id, result.id, result.revision, result.name, result.document, result.lifecycle_status, actor_id);
  insert into public.creative_project_assets(workspace_id, creative_id, asset_id)
    select result.workspace_id, result.id, distinct_asset.asset_id
    from (select distinct (element ->> 'assetId')::uuid as asset_id from pg_catalog.jsonb_array_elements(p_document -> 'elements') element where element ->> 'type' = 'image') distinct_asset;
  return pg_catalog.to_jsonb(result);
end;
$$;

create or replace function public.save_creative_project(p_workspace_id uuid, p_creative_id uuid, p_expected_revision integer, p_name text, p_document jsonb, p_industry text, p_platform text, p_template_key text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); project_row public.creative_projects;
begin
  if actor_id is null then raise exception using errcode = '28000', message = 'Authentication is required.'; end if;
  if not tandem_internal.has_workspace_role(p_workspace_id, array['owner', 'admin', 'editor']::text[]) then raise exception using errcode = '42501', message = 'Creative management permission is required.'; end if;
  select * into project_row from public.creative_projects where id = p_creative_id and workspace_id = p_workspace_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Creative project not found.'; end if;
  if project_row.revision <> p_expected_revision then raise exception using errcode = '40001', message = 'Creative project changed since it was loaded.'; end if;
  if project_row.lifecycle_status = 'archived' then raise exception using errcode = '22023', message = 'Archived creative cannot be edited.'; end if;
  if not tandem_internal.creative_document_is_valid(p_document) then raise exception using errcode = '22023', message = 'Creative document is invalid.'; end if;
  update public.creative_projects set name = pg_catalog.btrim(p_name), document = p_document, industry_key = p_industry, platform = p_platform, template_key = p_template_key,
    revision = revision + 1, approved_revision = null,
    lifecycle_status = case when lifecycle_status in ('needs_review', 'changes_requested', 'approved') then 'draft' else lifecycle_status end,
    updated_by_user_id = actor_id where id = p_creative_id and workspace_id = p_workspace_id returning * into project_row;
  delete from public.creative_project_assets where creative_id = project_row.id and workspace_id = project_row.workspace_id;
  insert into public.creative_project_assets(workspace_id, creative_id, asset_id)
    select project_row.workspace_id, project_row.id, distinct_asset.asset_id
    from (select distinct (element ->> 'assetId')::uuid as asset_id from pg_catalog.jsonb_array_elements(p_document -> 'elements') element where element ->> 'type' = 'image') distinct_asset;
  insert into public.creative_project_revisions(workspace_id, creative_id, revision, name, document, lifecycle_status, author_user_id)
  values(project_row.workspace_id, project_row.id, project_row.revision, project_row.name, project_row.document, project_row.lifecycle_status, actor_id);
  return pg_catalog.to_jsonb(project_row);
end;
$$;

create or replace function public.review_creative_project(p_workspace_id uuid, p_creative_id uuid, p_expected_revision integer, p_decision text, p_comments text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); project_row public.creative_projects; next_status text;
begin
  if actor_id is null then raise exception using errcode = '28000', message = 'Authentication is required.'; end if;
  if p_decision not in ('submitted', 'approved', 'changes_requested', 'reopened') then raise exception using errcode = '22023', message = 'Creative review decision is invalid.'; end if;
  if p_decision = 'submitted' then
    if not tandem_internal.has_workspace_role(p_workspace_id, array['owner', 'admin', 'editor']::text[]) then raise exception using errcode = '42501', message = 'Creative submission permission is required.'; end if;
  elsif not tandem_internal.has_workspace_role(p_workspace_id, array['owner', 'admin']::text[]) then
    raise exception using errcode = '42501', message = 'Creative approval permission is required.';
  end if;
  select * into project_row from public.creative_projects where id = p_creative_id and workspace_id = p_workspace_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Creative project not found.'; end if;
  if project_row.revision <> p_expected_revision then raise exception using errcode = '40001', message = 'Creative project changed since review was opened.'; end if;
  next_status := case p_decision when 'submitted' then 'needs_review' when 'approved' then 'approved' when 'changes_requested' then 'changes_requested' when 'reopened' then 'draft' end;
  if (p_decision = 'submitted' and project_row.lifecycle_status not in ('draft', 'changes_requested'))
    or (p_decision in ('approved', 'changes_requested') and project_row.lifecycle_status <> 'needs_review')
    or (p_decision = 'reopened' and project_row.lifecycle_status not in ('approved', 'needs_review', 'changes_requested')) then
    raise exception using errcode = '22023', message = 'Creative project cannot transition to that review state.';
  end if;
  update public.creative_projects set lifecycle_status = next_status,
    approved_revision = case when p_decision = 'approved' then revision when p_decision = 'reopened' then null else approved_revision end,
    updated_by_user_id = actor_id where id = p_creative_id and workspace_id = p_workspace_id returning * into project_row;
  insert into public.creative_project_reviews(workspace_id, creative_id, draft_revision, decision, reviewer_user_id, comments)
  values(p_workspace_id, p_creative_id, project_row.revision, p_decision, actor_id, pg_catalog.left(p_comments, 4000));
  return pg_catalog.to_jsonb(project_row);
end;
$$;

create or replace function public.set_creative_project_archived(p_workspace_id uuid, p_creative_id uuid, p_expected_revision integer, p_archived boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); project_row public.creative_projects;
begin
  if actor_id is null then raise exception using errcode = '28000', message = 'Authentication is required.'; end if;
  if not tandem_internal.has_workspace_role(p_workspace_id, array['owner', 'admin']::text[]) then raise exception using errcode = '42501', message = 'Creative archive permission is required.'; end if;
  select * into project_row from public.creative_projects where id = p_creative_id and workspace_id = p_workspace_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Creative project not found.'; end if;
  if project_row.revision <> p_expected_revision then raise exception using errcode = '40001', message = 'Creative project changed since it was loaded.'; end if;
  update public.creative_projects set lifecycle_status = case when p_archived then 'archived' else 'draft' end, approved_revision = null,
    revision = revision + 1, updated_by_user_id = actor_id where id = p_creative_id and workspace_id = p_workspace_id returning * into project_row;
  insert into public.creative_project_revisions(workspace_id, creative_id, revision, name, document, lifecycle_status, author_user_id)
  values(project_row.workspace_id, project_row.id, project_row.revision, project_row.name, project_row.document, project_row.lifecycle_status, actor_id);
  return pg_catalog.to_jsonb(project_row);
end;
$$;

create or replace function tandem_internal.invalidate_campaign_for_creative(p_campaign_id uuid, p_workspace_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare campaign_row public.campaigns;
begin
  update public.campaigns set revision = revision + 1, approved_revision = null,
    lifecycle_status = case when lifecycle_status in ('needs_review', 'changes_requested', 'approved_for_demo', 'demo_published') then 'generated_simulation' else lifecycle_status end,
    updated_by_user_id = (select auth.uid())
    where id = p_campaign_id and workspace_id = p_workspace_id returning * into campaign_row;
  if found then
    insert into public.campaign_revisions(workspace_id, campaign_id, revision, name, objective, brief, plan, changed_by_user_id)
    values(campaign_row.workspace_id, campaign_row.id, campaign_row.revision, campaign_row.name, campaign_row.objective, campaign_row.brief, campaign_row.plan, (select auth.uid()));
    insert into public.campaign_activity(workspace_id, campaign_id, event_type, actor_user_id, details)
    values(p_workspace_id, p_campaign_id, p_reason, (select auth.uid()), pg_catalog.jsonb_build_object('creative_link_invalidated_approval', true, 'revision', campaign_row.revision));
  end if;
end;
$$;
revoke all on function tandem_internal.invalidate_campaign_for_creative(uuid, uuid, text) from public, anon, authenticated, service_role;

create or replace function tandem_internal.invalidate_campaigns_after_creative_edit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare linked record;
begin
  for linked in select campaign_id, workspace_id from public.creative_campaign_links where creative_id = new.id and workspace_id = new.workspace_id loop
    perform tandem_internal.invalidate_campaign_for_creative(linked.campaign_id, linked.workspace_id, 'campaign_creative_changed');
  end loop;
  return new;
end;
$$;
revoke all on function tandem_internal.invalidate_campaigns_after_creative_edit() from public, anon, authenticated, service_role;
create trigger creative_projects_invalidate_campaigns after update of document, name on public.creative_projects for each row when (old.document is distinct from new.document or old.name is distinct from new.name) execute function tandem_internal.invalidate_campaigns_after_creative_edit();

create or replace function tandem_internal.invalidate_campaigns_after_creative_link()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform tandem_internal.invalidate_campaign_for_creative(new.campaign_id, new.workspace_id, 'campaign_creative_attached');
    return new;
  end if;
  perform tandem_internal.invalidate_campaign_for_creative(old.campaign_id, old.workspace_id, 'campaign_creative_detached');
  return old;
end;
$$;
revoke all on function tandem_internal.invalidate_campaigns_after_creative_link() from public, anon, authenticated, service_role;
create trigger creative_campaign_links_invalidate_after_insert after insert on public.creative_campaign_links for each row execute function tandem_internal.invalidate_campaigns_after_creative_link();
create trigger creative_campaign_links_invalidate_after_delete after delete on public.creative_campaign_links for each row execute function tandem_internal.invalidate_campaigns_after_creative_link();

alter table public.creative_assets enable row level security;
alter table public.workspace_brand_kits enable row level security;
alter table public.creative_projects enable row level security;
alter table public.creative_project_revisions enable row level security;
alter table public.creative_project_assets enable row level security;
alter table public.creative_project_reviews enable row level security;
alter table public.creative_campaign_links enable row level security;

revoke all on public.creative_assets, public.workspace_brand_kits, public.creative_projects, public.creative_project_revisions, public.creative_project_assets, public.creative_project_reviews, public.creative_campaign_links from public, anon, authenticated, service_role;
grant select on public.creative_assets, public.workspace_brand_kits, public.creative_projects, public.creative_project_revisions, public.creative_project_assets, public.creative_project_reviews, public.creative_campaign_links to authenticated;
grant insert (id, workspace_id, asset_type, original_filename, storage_path, mime_type, size_bytes, width, height, uploader_user_id, tags) on public.creative_assets to authenticated;
grant update (tags, asset_status, archived_at) on public.creative_assets to authenticated;
grant insert, update on public.workspace_brand_kits to authenticated;
grant insert (workspace_id, campaign_id, creative_id) on public.creative_campaign_links to authenticated;
grant delete on public.creative_campaign_links to authenticated;

create policy creative_assets_member_read on public.creative_assets for select to authenticated using (tandem_internal.has_workspace_role(workspace_id, null::text[]));
create policy creative_assets_manager_insert on public.creative_assets for insert to authenticated with check (tandem_internal.has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::text[]) and asset_status = 'active' and uploader_user_id = (select auth.uid()));
create policy creative_assets_manager_update on public.creative_assets for update to authenticated using (tandem_internal.has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::text[])) with check (tandem_internal.has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::text[]));
create policy workspace_brand_member_read on public.workspace_brand_kits for select to authenticated using (tandem_internal.has_workspace_role(workspace_id, null::text[]));
create policy workspace_brand_manager_insert on public.workspace_brand_kits for insert to authenticated with check (tandem_internal.has_workspace_role(workspace_id, array['owner', 'admin']::text[]) and updated_by_user_id = (select auth.uid()));
create policy workspace_brand_manager_update on public.workspace_brand_kits for update to authenticated using (tandem_internal.has_workspace_role(workspace_id, array['owner', 'admin']::text[])) with check (tandem_internal.has_workspace_role(workspace_id, array['owner', 'admin']::text[]) and updated_by_user_id = (select auth.uid()));
create policy creative_projects_member_read on public.creative_projects for select to authenticated using (tandem_internal.has_workspace_role(workspace_id, null::text[]));
create policy creative_project_revisions_member_read on public.creative_project_revisions for select to authenticated using (tandem_internal.has_workspace_role(workspace_id, null::text[]));
create policy creative_project_assets_member_read on public.creative_project_assets for select to authenticated using (tandem_internal.has_workspace_role(workspace_id, null::text[]));
create policy creative_project_reviews_member_read on public.creative_project_reviews for select to authenticated using (tandem_internal.has_workspace_role(workspace_id, null::text[]));
create policy creative_campaign_links_member_read on public.creative_campaign_links for select to authenticated using (tandem_internal.has_workspace_role(workspace_id, null::text[]));
create policy creative_campaign_links_manager_insert on public.creative_campaign_links for insert to authenticated with check (tandem_internal.has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::text[]) and tandem_internal.has_workspace_role((select campaign.workspace_id from public.campaigns campaign where campaign.id = creative_campaign_links.campaign_id), array['owner', 'admin', 'editor']::text[]));
create policy creative_campaign_links_manager_delete on public.creative_campaign_links for delete to authenticated using (tandem_internal.has_workspace_role(workspace_id, array['owner', 'admin', 'editor']::text[]));

create policy creative_storage_member_read on storage.objects for select to authenticated using (
  bucket_id = 'workspace-creative-assets'
  and case when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then tandem_internal.has_workspace_role(((storage.foldername(name))[1])::uuid, null::text[])
      and exists (select 1 from public.creative_assets asset where asset.workspace_id = ((storage.foldername(name))[1])::uuid and asset.storage_path = storage.objects.name and asset.asset_status = 'active')
    else false end
);
create policy creative_storage_member_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'workspace-creative-assets'
  and case when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then tandem_internal.has_workspace_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin', 'editor']::text[]) else false end
  and storage.filename(name) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](png|jpg|webp)$'
);
create policy creative_storage_member_delete on storage.objects for delete to authenticated using (
  bucket_id = 'workspace-creative-assets'
  and case when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then tandem_internal.has_workspace_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin', 'editor']::text[]) else false end
);

revoke all on function public.create_creative_project(uuid, text, jsonb, text, text, text) from public, anon, service_role;
revoke all on function public.save_creative_project(uuid, uuid, integer, text, jsonb, text, text, text) from public, anon, service_role;
revoke all on function public.review_creative_project(uuid, uuid, integer, text, text) from public, anon, service_role;
revoke all on function public.set_creative_project_archived(uuid, uuid, integer, boolean) from public, anon, service_role;
grant execute on function public.create_creative_project(uuid, text, jsonb, text, text, text) to authenticated;
grant execute on function public.save_creative_project(uuid, uuid, integer, text, jsonb, text, text, text) to authenticated;
grant execute on function public.review_creative_project(uuid, uuid, integer, text, text) to authenticated;
grant execute on function public.set_creative_project_archived(uuid, uuid, integer, boolean) to authenticated;

commit;

