begin;

create table public.profiles (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint profiles_full_name_length check (
    full_name is null or pg_catalog.char_length(pg_catalog.btrim(full_name)) between 1 and 120
  ),
  constraint profiles_avatar_url_length check (
    avatar_url is null or pg_catalog.char_length(avatar_url) <= 2048
  )
);

alter table public.profiles enable row level security;

revoke all on table public.profiles from public, anon, authenticated, service_role;
grant usage on schema public to authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name, avatar_url) on table public.profiles to authenticated;

create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_full_name text;
begin
  safe_full_name := nullif(
    pg_catalog.btrim(
      pg_catalog.left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120)
    ),
    ''
  );

  insert into public.profiles (user_id, full_name)
  values (new.id, safe_full_name)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.create_profile_for_auth_user() from public, anon, authenticated, service_role;

create trigger on_auth_user_created_create_profile
  after insert on auth.users
  for each row execute function public.create_profile_for_auth_user();

create function public.touch_profile_updated_at()
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

revoke all on function public.touch_profile_updated_at() from public, anon, authenticated, service_role;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.touch_profile_updated_at();

commit;
