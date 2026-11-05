begin;

-- Physical file writes and removals go through the allowlisted API storage
-- service. Workspace JWTs retain private reads but cannot write storage.objects.
drop policy if exists creative_storage_member_insert on storage.objects;
drop policy if exists creative_storage_member_delete on storage.objects;
drop policy if exists creative_assets_manager_insert on public.creative_assets;
revoke insert on public.creative_assets from authenticated;

create table tandem_internal.creative_asset_upload_reservations (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id uuid not null unique,
  asset_type text not null check (asset_type in ('logo', 'image')),
  original_filename text not null,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  size_bytes integer not null check (size_bytes between 1 and 5242880),
  width integer not null check (width between 1 and 8192),
  height integer not null check (height between 1 and 8192),
  created_at timestamptz not null default pg_catalog.now(),
  expires_at timestamptz not null default (pg_catalog.now() + interval '20 minutes'),
  constraint creative_upload_reservation_path_valid check (
    storage_path = workspace_id::text || '/' || asset_id::text ||
      case mime_type when 'image/png' then '.png' when 'image/jpeg' then '.jpg' when 'image/webp' then '.webp' end
  ),
  constraint creative_upload_reservation_filename_valid check (
    pg_catalog.char_length(original_filename) between 1 and 255
    and pg_catalog.strpos(original_filename, '/') = 0
    and pg_catalog.strpos(original_filename, pg_catalog.chr(92)) = 0
  ),
  constraint creative_upload_reservation_pixels_valid check (width::bigint * height::bigint <= 16000000)
);
create index creative_upload_reservations_workspace_expiry_idx
  on tandem_internal.creative_asset_upload_reservations(workspace_id, expires_at);
alter table tandem_internal.creative_asset_upload_reservations enable row level security;
revoke all on tandem_internal.creative_asset_upload_reservations from public, anon, authenticated, service_role;

create or replace function public.reserve_creative_asset_upload(
  p_workspace_id uuid,
  p_user_id uuid,
  p_reservation_id uuid,
  p_asset_id uuid,
  p_asset_type text,
  p_original_filename text,
  p_mime_type text,
  p_size_bytes integer,
  p_width integer,
  p_height integer
)
returns table (reservation_id uuid, storage_path text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  workspace_lock uuid;
  object_path text;
  active_count bigint;
  active_bytes bigint;
  pending_count bigint;
  pending_bytes bigint;
begin
  if p_workspace_id is null or p_user_id is null or p_reservation_id is null or p_asset_id is null
    or p_asset_type not in ('logo', 'image')
    or p_mime_type not in ('image/png', 'image/jpeg', 'image/webp')
    or p_size_bytes not between 1 and 5242880
    or p_width not between 1 and 8192 or p_height not between 1 and 8192
    or p_width::bigint * p_height::bigint > 16000000
    or pg_catalog.char_length(p_original_filename) not between 1 and 255
    or pg_catalog.strpos(p_original_filename, '/') > 0
    or pg_catalog.strpos(p_original_filename, pg_catalog.chr(92)) > 0 then
    raise exception using errcode = '22023', message = 'Creative upload metadata is invalid.';
  end if;

  select workspace.id into workspace_lock
    from public.workspaces workspace where workspace.id = p_workspace_id for update;
  if workspace_lock is null then
    raise exception using errcode = '42501', message = 'Workspace is unavailable.';
  end if;
  if not exists (
    select 1 from public.workspace_memberships membership
    where membership.workspace_id = p_workspace_id and membership.user_id = p_user_id
      and membership.role in ('owner', 'admin', 'editor')
  ) then
    raise exception using errcode = '42501', message = 'Workspace upload permission is required.';
  end if;

  object_path := p_workspace_id::text || '/' || p_asset_id::text ||
    case p_mime_type when 'image/png' then '.png' when 'image/jpeg' then '.jpg' else '.webp' end;
  select count(*), coalesce(sum(asset.size_bytes), 0) into active_count, active_bytes
    from public.creative_assets asset
    where asset.workspace_id = p_workspace_id and asset.asset_status = 'active';
  select count(*), coalesce(sum(reservation.size_bytes), 0) into pending_count, pending_bytes
    from tandem_internal.creative_asset_upload_reservations reservation
    where reservation.workspace_id = p_workspace_id and reservation.expires_at > pg_catalog.now();
  if active_count + pending_count >= 250 or active_bytes + pending_bytes + p_size_bytes > 262144000 then
    raise exception using errcode = '54000', message = 'Workspace creative asset quota has been reached.';
  end if;

  insert into tandem_internal.creative_asset_upload_reservations (
    id, workspace_id, user_id, asset_id, asset_type, original_filename,
    storage_path, mime_type, size_bytes, width, height
  ) values (
    p_reservation_id, p_workspace_id, p_user_id, p_asset_id, p_asset_type,
    p_original_filename, object_path, p_mime_type, p_size_bytes, p_width, p_height
  );
  return query select p_reservation_id, object_path,
    (select reservation.expires_at from tandem_internal.creative_asset_upload_reservations reservation where reservation.id = p_reservation_id);
end;
$$;

create or replace function public.finalize_creative_asset_upload(p_reservation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation tandem_internal.creative_asset_upload_reservations;
  workspace_lock uuid;
  asset public.creative_assets;
begin
  select * into reservation from tandem_internal.creative_asset_upload_reservations
    where id = p_reservation_id for update;
  if not found or reservation.expires_at <= pg_catalog.now() then
    raise exception using errcode = 'P0002', message = 'Creative upload reservation expired.';
  end if;
  select workspace.id into workspace_lock from public.workspaces workspace
    where workspace.id = reservation.workspace_id for update;
  if workspace_lock is null or not exists (
    select 1 from public.workspace_memberships membership
    where membership.workspace_id = reservation.workspace_id and membership.user_id = reservation.user_id
      and membership.role in ('owner', 'admin', 'editor')
  ) then
    raise exception using errcode = '42501', message = 'Workspace upload permission is no longer valid.';
  end if;
  insert into public.creative_assets (
    id, workspace_id, asset_type, original_filename, storage_path, mime_type,
    size_bytes, width, height, uploader_user_id, tags
  ) values (
    reservation.asset_id, reservation.workspace_id, reservation.asset_type,
    reservation.original_filename, reservation.storage_path, reservation.mime_type,
    reservation.size_bytes, reservation.width, reservation.height, reservation.user_id, '{}'
  ) returning * into asset;
  delete from tandem_internal.creative_asset_upload_reservations where id = reservation.id;
  return pg_catalog.to_jsonb(asset);
end;
$$;

create or replace function public.list_expired_creative_asset_uploads()
returns table (reservation_id uuid, storage_path text)
language sql
security definer
set search_path = ''
as $$
  select reservation.id, reservation.storage_path
  from tandem_internal.creative_asset_upload_reservations reservation
  where reservation.expires_at <= pg_catalog.now()
  order by reservation.expires_at
  limit 100;
$$;

create or replace function public.cancel_creative_asset_upload(p_reservation_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$ delete from tandem_internal.creative_asset_upload_reservations where id = p_reservation_id; $$;

revoke all on function public.reserve_creative_asset_upload(uuid, uuid, uuid, uuid, text, text, text, integer, integer, integer) from public, anon, authenticated, service_role;
revoke all on function public.finalize_creative_asset_upload(uuid) from public, anon, authenticated, service_role;
revoke all on function public.list_expired_creative_asset_uploads() from public, anon, authenticated, service_role;
revoke all on function public.cancel_creative_asset_upload(uuid) from public, anon, authenticated, service_role;
grant execute on function public.reserve_creative_asset_upload(uuid, uuid, uuid, uuid, text, text, text, integer, integer, integer) to service_role;
grant execute on function public.finalize_creative_asset_upload(uuid) to service_role;
grant execute on function public.list_expired_creative_asset_uploads() to service_role;
grant execute on function public.cancel_creative_asset_upload(uuid) to service_role;

commit;
