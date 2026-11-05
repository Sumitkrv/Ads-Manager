begin;

create table public.user_platform_tour_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tour_id text not null default 'platform-operator',
  step_index smallint not null default 0,
  status text not null default 'running',
  started_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  completed_at timestamptz,
  constraint platform_tour_id_valid check (tour_id = 'platform-operator'),
  constraint platform_tour_step_valid check (step_index between 0 and 8),
  constraint platform_tour_status_valid check (status in ('running', 'skipped', 'completed')),
  constraint platform_tour_completion_valid check ((status = 'completed') = (completed_at is not null))
);

alter table public.user_platform_tour_progress enable row level security;
revoke all on public.user_platform_tour_progress from public, anon, authenticated, service_role;
grant select, insert, update on public.user_platform_tour_progress to service_role;

commit;
