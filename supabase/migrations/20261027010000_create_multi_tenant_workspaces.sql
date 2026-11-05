begin;

create schema if not exists tandem_internal;
revoke all on schema tandem_internal from public, anon, authenticated, service_role;
grant usage on schema tandem_internal to authenticated;
comment on schema tandem_internal is
  'Private Tandem Ads authorization and workspace implementation. Keep this schema out of Supabase Data API exposed schemas.';

create table public.workspaces (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  name text not null,
  slug text not null,
  industry_key text not null,
  industry_custom_label text,
  website_url text,
  country_code text,
  timezone text not null default 'UTC',
  logo_url text,
  created_by uuid not null references auth.users (id) on delete restrict,
  creation_request_id uuid not null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint workspaces_name_length check (
    pg_catalog.char_length(pg_catalog.btrim(name)) between 2 and 120
  ),
  constraint workspaces_slug_format check (
    pg_catalog.char_length(slug) between 3 and 48
    and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint workspaces_industry_key_valid check (
    industry_key in (
      'real_estate', 'ecommerce_retail', 'healthcare_clinics', 'education_coaching',
      'gyms_fitness', 'restaurants_cafes', 'hotels_hospitality', 'travel_tourism',
      'automobile_dealerships', 'salons_beauty', 'professional_services',
      'marketing_agencies', 'home_services', 'finance_insurance', 'events_entertainment', 'other'
    )
  ),
  constraint workspaces_custom_industry_valid check (
    (industry_key = 'other' and industry_custom_label is not null
      and pg_catalog.char_length(pg_catalog.btrim(industry_custom_label)) between 1 and 100)
    or (industry_key <> 'other' and industry_custom_label is null)
  ),
  constraint workspaces_website_url_valid check (
    website_url is null or (
      pg_catalog.char_length(website_url) <= 2048
      and website_url ~* '^https?://[^/@[:space:]]+([/?#][^[:space:]]*)?$'
    )
  ),
  constraint workspaces_country_code_valid check (
    country_code is null or country_code ~ '^[A-Z]{2}$'
  ),
  constraint workspaces_timezone_length check (
    pg_catalog.char_length(timezone) between 1 and 100
  ),
  constraint workspaces_logo_url_length check (
    logo_url is null or pg_catalog.char_length(logo_url) <= 2048
  ),
  constraint workspaces_creator_request_unique unique (created_by, creation_request_id),
  constraint workspaces_slug_unique unique (slug)
);

create table public.workspace_memberships (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint workspace_memberships_role_valid check (role in ('owner', 'admin', 'editor', 'viewer')),
  constraint workspace_memberships_user_unique unique (workspace_id, user_id)
);

create index workspace_memberships_user_created_idx
  on public.workspace_memberships (user_id, created_at);
create unique index workspace_memberships_single_owner_idx
  on public.workspace_memberships (workspace_id)
  where role = 'owner';

alter table public.workspaces enable row level security;
alter table public.workspace_memberships enable row level security;

revoke all on table public.workspaces from public, anon, authenticated, service_role;
revoke all on table public.workspace_memberships from public, anon, authenticated, service_role;
grant select (
  id, name, slug, industry_key, industry_custom_label, website_url,
  country_code, timezone, logo_url, created_by, created_at, updated_at
) on table public.workspaces to authenticated;
grant select (id, workspace_id, user_id, role, created_at, updated_at)
  on table public.workspace_memberships to authenticated;

create function tandem_internal.has_workspace_role(
  p_workspace_id uuid,
  p_allowed_roles text[] default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_memberships as membership
    where membership.workspace_id = p_workspace_id
      and membership.user_id = (select auth.uid())
      and (p_allowed_roles is null or membership.role = any (p_allowed_roles))
  );
$$;

revoke all on function tandem_internal.has_workspace_role(uuid, text[]) from public, anon, authenticated, service_role;
grant execute on function tandem_internal.has_workspace_role(uuid, text[]) to authenticated;

create policy workspaces_select_member
  on public.workspaces
  for select
  to authenticated
  using (tandem_internal.has_workspace_role(id, null::text[]));

create policy memberships_select_self_or_workspace_admin
  on public.workspace_memberships
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or tandem_internal.has_workspace_role(workspace_id, array['owner', 'admin']::text[])
  );

create function tandem_internal.touch_workspace_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function tandem_internal.touch_workspace_updated_at() from public, anon, authenticated, service_role;

create trigger workspaces_touch_updated_at
  before update on public.workspaces
  for each row execute function tandem_internal.touch_workspace_updated_at();

create trigger workspace_memberships_touch_updated_at
  before update on public.workspace_memberships
  for each row execute function tandem_internal.touch_workspace_updated_at();

create function tandem_internal.create_workspace_privileged(
  p_name text,
  p_slug text,
  p_industry_key text,
  p_industry_custom_label text,
  p_website_url text,
  p_country_code text,
  p_timezone text,
  p_request_id uuid
)
returns table (
  id uuid,
  name text,
  slug text,
  industry_key text,
  industry_custom_label text,
  website_url text,
  country_code text,
  timezone text,
  logo_url text,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  clean_name text;
  clean_slug text;
  clean_industry_label text;
  clean_website_url text;
  clean_country_code text;
  clean_timezone text;
  created_workspace public.workspaces;
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required.';
  end if;

  if p_request_id is null then
    raise exception using errcode = '22023', message = 'A request identifier is required.';
  end if;

  clean_name := pg_catalog.btrim(coalesce(p_name, ''));
  clean_slug := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  clean_industry_label := nullif(pg_catalog.btrim(coalesce(p_industry_custom_label, '')), '');
  clean_website_url := nullif(pg_catalog.btrim(coalesce(p_website_url, '')), '');
  clean_country_code := nullif(pg_catalog.upper(pg_catalog.btrim(coalesce(p_country_code, ''))), '');
  clean_timezone := pg_catalog.btrim(coalesce(p_timezone, ''));

  if pg_catalog.char_length(clean_name) not between 2 and 120 then
    raise exception using errcode = '22023', message = 'Business name is invalid.';
  end if;

  if pg_catalog.char_length(clean_slug) not between 3 and 48
      or clean_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception using errcode = '22023', message = 'Workspace URL is invalid.';
  end if;

  if p_industry_key is null or p_industry_key not in (
      'real_estate', 'ecommerce_retail', 'healthcare_clinics', 'education_coaching',
      'gyms_fitness', 'restaurants_cafes', 'hotels_hospitality', 'travel_tourism',
      'automobile_dealerships', 'salons_beauty', 'professional_services',
      'marketing_agencies', 'home_services', 'finance_insurance', 'events_entertainment', 'other'
    ) then
    raise exception using errcode = '22023', message = 'Industry selection is invalid.';
  end if;

  if (p_industry_key = 'other' and (clean_industry_label is null or pg_catalog.char_length(clean_industry_label) > 100))
      or (p_industry_key <> 'other' and clean_industry_label is not null) then
    raise exception using errcode = '22023', message = 'Custom industry label is invalid.';
  end if;

  if clean_website_url is not null and (
      pg_catalog.char_length(clean_website_url) > 2048
      or clean_website_url !~* '^https?://[^/@[:space:]]+([/?#][^[:space:]]*)?$'
    ) then
    raise exception using errcode = '22023', message = 'Website URL is invalid.';
  end if;

  if clean_country_code is not null and clean_country_code !~ '^[A-Z]{2}$' then
    raise exception using errcode = '22023', message = 'Country code is invalid.';
  end if;

  if pg_catalog.char_length(clean_timezone) not between 1 and 100
      or not exists (
        select 1 from pg_catalog.pg_timezone_names as zone where zone.name = clean_timezone
      ) then
    raise exception using errcode = '22023', message = 'Time zone is invalid.';
  end if;

  insert into public.workspaces (
    name, slug, industry_key, industry_custom_label, website_url,
    country_code, timezone, created_by, creation_request_id
  ) values (
    clean_name, clean_slug, p_industry_key, clean_industry_label, clean_website_url,
    clean_country_code, clean_timezone, actor_id, p_request_id
  )
  on conflict on constraint workspaces_creator_request_unique do nothing
  returning * into created_workspace;

  if created_workspace.id is null then
    select workspace.*
    into created_workspace
    from public.workspaces as workspace
    where workspace.created_by = actor_id
      and workspace.creation_request_id = p_request_id;

    if created_workspace.id is null then
      raise exception using errcode = '40001', message = 'Workspace creation could not be confirmed.';
    end if;

    if created_workspace.name is distinct from clean_name
        or created_workspace.slug is distinct from clean_slug
        or created_workspace.industry_key is distinct from p_industry_key
        or created_workspace.industry_custom_label is distinct from clean_industry_label
        or created_workspace.website_url is distinct from clean_website_url
        or created_workspace.country_code is distinct from clean_country_code
        or created_workspace.timezone is distinct from clean_timezone then
      raise exception using errcode = '22023', message = 'Request identifier was already used for different workspace details.';
    end if;

    perform 1
    from public.workspace_memberships as membership
    where membership.workspace_id = created_workspace.id
      and membership.user_id = actor_id
      and membership.role = 'owner'
    for share;

    if not found then
      raise exception using errcode = '42501', message = 'Workspace ownership could not be confirmed.';
    end if;
  else
    insert into public.workspace_memberships (workspace_id, user_id, role)
    values (created_workspace.id, actor_id, 'owner');
  end if;

  return query select
    created_workspace.id,
    created_workspace.name,
    created_workspace.slug,
    created_workspace.industry_key,
    created_workspace.industry_custom_label,
    created_workspace.website_url,
    created_workspace.country_code,
    created_workspace.timezone,
    created_workspace.logo_url,
    created_workspace.created_by,
    created_workspace.created_at,
    created_workspace.updated_at;
end;
$$;

revoke all on function tandem_internal.create_workspace_privileged(text, text, text, text, text, text, text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function tandem_internal.create_workspace_privileged(text, text, text, text, text, text, text, uuid)
  to authenticated;

create function public.create_workspace(
  p_name text,
  p_slug text,
  p_industry_key text,
  p_industry_custom_label text,
  p_website_url text,
  p_country_code text,
  p_timezone text,
  p_request_id uuid
)
returns table (
  id uuid,
  name text,
  slug text,
  industry_key text,
  industry_custom_label text,
  website_url text,
  country_code text,
  timezone text,
  logo_url text,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from tandem_internal.create_workspace_privileged($1, $2, $3, $4, $5, $6, $7, $8);
$$;

revoke all on function public.create_workspace(text, text, text, text, text, text, text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.create_workspace(text, text, text, text, text, text, text, uuid)
  to authenticated;

create function tandem_internal.update_workspace_settings_privileged(
  p_workspace_id uuid,
  p_name text,
  p_industry_key text,
  p_industry_custom_label text,
  p_website_url text,
  p_country_code text,
  p_timezone text
)
returns table (
  id uuid,
  name text,
  slug text,
  industry_key text,
  industry_custom_label text,
  website_url text,
  country_code text,
  timezone text,
  logo_url text,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  clean_name text := pg_catalog.btrim(coalesce(p_name, ''));
  clean_industry_label text := nullif(pg_catalog.btrim(coalesce(p_industry_custom_label, '')), '');
  clean_website_url text := nullif(pg_catalog.btrim(coalesce(p_website_url, '')), '');
  clean_country_code text := nullif(pg_catalog.upper(pg_catalog.btrim(coalesce(p_country_code, ''))), '');
  clean_timezone text := pg_catalog.btrim(coalesce(p_timezone, ''));
  updated_workspace public.workspaces;
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required.';
  end if;

  perform 1
  from public.workspace_memberships as membership
  where membership.workspace_id = p_workspace_id
    and membership.user_id = actor_id
    and membership.role in ('owner', 'admin')
  for share;

  if not found then
    raise exception using errcode = '42501', message = 'Workspace settings permission is required.';
  end if;

  if pg_catalog.char_length(clean_name) not between 2 and 120 then
    raise exception using errcode = '22023', message = 'Business name is invalid.';
  end if;

  if p_industry_key is null or p_industry_key not in (
      'real_estate', 'ecommerce_retail', 'healthcare_clinics', 'education_coaching',
      'gyms_fitness', 'restaurants_cafes', 'hotels_hospitality', 'travel_tourism',
      'automobile_dealerships', 'salons_beauty', 'professional_services',
      'marketing_agencies', 'home_services', 'finance_insurance', 'events_entertainment', 'other'
    ) then
    raise exception using errcode = '22023', message = 'Industry selection is invalid.';
  end if;

  if (p_industry_key = 'other' and (clean_industry_label is null or pg_catalog.char_length(clean_industry_label) > 100))
      or (p_industry_key <> 'other' and clean_industry_label is not null) then
    raise exception using errcode = '22023', message = 'Custom industry label is invalid.';
  end if;

  if clean_website_url is not null and (
      pg_catalog.char_length(clean_website_url) > 2048
      or clean_website_url !~* '^https?://[^/@[:space:]]+([/?#][^[:space:]]*)?$'
    ) then
    raise exception using errcode = '22023', message = 'Website URL is invalid.';
  end if;

  if clean_country_code is not null and clean_country_code !~ '^[A-Z]{2}$' then
    raise exception using errcode = '22023', message = 'Country code is invalid.';
  end if;

  if pg_catalog.char_length(clean_timezone) not between 1 and 100
      or not exists (
        select 1 from pg_catalog.pg_timezone_names as zone where zone.name = clean_timezone
      ) then
    raise exception using errcode = '22023', message = 'Time zone is invalid.';
  end if;

  update public.workspaces as workspace
  set name = clean_name,
      industry_key = p_industry_key,
      industry_custom_label = clean_industry_label,
      website_url = clean_website_url,
      country_code = clean_country_code,
      timezone = clean_timezone
  where workspace.id = p_workspace_id
  returning workspace.* into updated_workspace;

  if updated_workspace.id is null then
    raise exception using errcode = 'P0002', message = 'Workspace was not found.';
  end if;

  return query select
    updated_workspace.id,
    updated_workspace.name,
    updated_workspace.slug,
    updated_workspace.industry_key,
    updated_workspace.industry_custom_label,
    updated_workspace.website_url,
    updated_workspace.country_code,
    updated_workspace.timezone,
    updated_workspace.logo_url,
    updated_workspace.created_by,
    updated_workspace.created_at,
    updated_workspace.updated_at;
end;
$$;

revoke all on function tandem_internal.update_workspace_settings_privileged(uuid, text, text, text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function tandem_internal.update_workspace_settings_privileged(uuid, text, text, text, text, text, text)
  to authenticated;

create function public.update_workspace_settings(
  p_workspace_id uuid,
  p_name text,
  p_industry_key text,
  p_industry_custom_label text,
  p_website_url text,
  p_country_code text,
  p_timezone text
)
returns table (
  id uuid,
  name text,
  slug text,
  industry_key text,
  industry_custom_label text,
  website_url text,
  country_code text,
  timezone text,
  logo_url text,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from tandem_internal.update_workspace_settings_privileged($1, $2, $3, $4, $5, $6, $7);
$$;

revoke all on function public.update_workspace_settings(uuid, text, text, text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.update_workspace_settings(uuid, text, text, text, text, text, text)
  to authenticated;

commit;
