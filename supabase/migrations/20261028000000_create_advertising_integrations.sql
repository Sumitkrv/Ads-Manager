begin;

do $$
begin
  if to_regclass('public.workspaces') is null
      or to_regclass('public.workspace_memberships') is null then
    raise exception 'Prompt 03 workspace migration must be applied before Prompt 04.';
  end if;
end;
$$;

create table public.advertising_connections (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null check (provider in ('google_ads', 'meta_ads')),
  connection_status text not null default 'no_accounts'
    check (connection_status in ('accounts_available', 'connected', 'no_accounts', 'reauthorization_required', 'connection_error')),
  connected_by_user_id uuid not null references auth.users(id) on delete restrict,
  provider_identity_reference text,
  granted_scopes text[] not null default '{}',
  verified_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint advertising_connections_provider_workspace_unique unique (workspace_id, provider),
  constraint advertising_connections_tenant_provider_key unique (id, workspace_id, provider),
  constraint advertising_connections_identity_length check (provider_identity_reference is null or pg_catalog.char_length(provider_identity_reference) <= 300),
  constraint advertising_connections_scopes_count check (pg_catalog.cardinality(granted_scopes) <= 100)
);

create table public.advertising_accounts (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  connection_id uuid not null,
  provider text not null check (provider in ('google_ads', 'meta_ads')),
  external_account_id text not null,
  external_account_name text not null,
  account_status text,
  currency text,
  timezone text,
  is_manager boolean,
  manager_reference text,
  business_context text,
  selected boolean not null default false,
  last_synced_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint advertising_accounts_connection_tenant_fk
    foreign key (connection_id, workspace_id, provider)
    references public.advertising_connections(id, workspace_id, provider) on delete cascade,
  constraint advertising_accounts_connection_external_unique unique (connection_id, external_account_id),
  constraint advertising_accounts_external_id_length check (pg_catalog.char_length(external_account_id) between 1 and 160),
  constraint advertising_accounts_name_length check (pg_catalog.char_length(external_account_name) between 1 and 300),
  constraint advertising_accounts_provider_text_length check (
    (account_status is null or pg_catalog.char_length(account_status) <= 120)
    and (currency is null or pg_catalog.char_length(currency) <= 12)
    and (timezone is null or pg_catalog.char_length(timezone) <= 120)
    and (manager_reference is null or pg_catalog.char_length(manager_reference) <= 160)
    and (business_context is null or pg_catalog.char_length(business_context) <= 300)
  )
);

create index advertising_connections_workspace_provider_idx
  on public.advertising_connections(workspace_id, provider, updated_at desc);
create index advertising_accounts_workspace_selected_idx
  on public.advertising_accounts(workspace_id, selected, provider);
create index advertising_accounts_connection_idx
  on public.advertising_accounts(connection_id, external_account_id);

create table tandem_internal.advertising_credentials (
  connection_id uuid primary key references public.advertising_connections(id) on delete cascade,
  encryption_context_id uuid not null,
  encryption_algorithm text not null check (encryption_algorithm = 'aes-256-gcm'),
  key_version text not null check (key_version ~ '^v[1-9][0-9]*$'),
  ciphertext text not null,
  expires_at timestamptz,
  updated_at timestamptz not null default pg_catalog.now(),
  constraint advertising_credentials_ciphertext_length check (pg_catalog.char_length(ciphertext) between 1 and 100000)
);

create table tandem_internal.oauth_connection_attempts (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  initiating_user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google_ads', 'meta_ads')),
  state_hash text not null unique check (state_hash ~ '^[0-9a-f]{64}$'),
  pkce_algorithm text check (pkce_algorithm is null or pkce_algorithm = 'aes-256-gcm'),
  pkce_key_version text check (pkce_key_version is null or pkce_key_version ~ '^v[1-9][0-9]*$'),
  pkce_ciphertext text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  return_destination text not null default '/app/integrations'
    check (return_destination = '/app/integrations'),
  created_at timestamptz not null default pg_catalog.now(),
  constraint oauth_connection_attempts_pkce_complete check (
    (pkce_algorithm is null and pkce_key_version is null and pkce_ciphertext is null)
    or (pkce_algorithm is not null and pkce_key_version is not null and pkce_ciphertext is not null)
  ),
  constraint oauth_connection_attempts_ttl check (expires_at > created_at and expires_at <= created_at + interval '11 minutes')
);

create index oauth_connection_attempts_expiration_idx
  on tandem_internal.oauth_connection_attempts(expires_at)
  where consumed_at is null;
create unique index oauth_connection_attempts_one_pending_provider_idx
  on tandem_internal.oauth_connection_attempts(workspace_id, provider)
  where consumed_at is null;

create function tandem_internal.lock_workspace_integration_manager(p_workspace_id uuid, p_user_id uuid)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
begin
  perform 1 from public.workspace_memberships as membership
  where membership.workspace_id = p_workspace_id and membership.user_id = p_user_id
    and membership.role in ('owner', 'admin')
  for share;
  return found;
end;
$$;
revoke all on function tandem_internal.lock_workspace_integration_manager(uuid, uuid) from public, anon, authenticated, service_role;

alter table public.advertising_connections enable row level security;
alter table public.advertising_accounts enable row level security;
alter table tandem_internal.advertising_credentials enable row level security;
alter table tandem_internal.oauth_connection_attempts enable row level security;

revoke all on table public.advertising_connections from public, anon, authenticated, service_role;
revoke all on table public.advertising_accounts from public, anon, authenticated, service_role;
revoke all on table tandem_internal.advertising_credentials from public, anon, authenticated, service_role;
revoke all on table tandem_internal.oauth_connection_attempts from public, anon, authenticated, service_role;

grant select (
  id, workspace_id, provider, connection_status, connected_by_user_id,
  provider_identity_reference, granted_scopes, verified_at, last_error_code,
  created_at, updated_at
) on public.advertising_connections to authenticated;
grant select (
  id, workspace_id, connection_id, provider, external_account_id,
  external_account_name, account_status, currency, timezone, is_manager,
  manager_reference, business_context, selected, last_synced_at, created_at, updated_at
) on public.advertising_accounts to authenticated;

create policy advertising_connections_select_workspace_member
  on public.advertising_connections for select to authenticated
  using (tandem_internal.has_workspace_role(workspace_id, null::text[]));
create policy advertising_accounts_select_workspace_member
  on public.advertising_accounts for select to authenticated
  using (tandem_internal.has_workspace_role(workspace_id, null::text[]));

create function tandem_internal.touch_advertising_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;
revoke all on function tandem_internal.touch_advertising_updated_at() from public, anon, authenticated, service_role;
create trigger advertising_connections_touch_updated_at before update on public.advertising_connections
  for each row execute function tandem_internal.touch_advertising_updated_at();
create trigger advertising_accounts_touch_updated_at before update on public.advertising_accounts
  for each row execute function tandem_internal.touch_advertising_updated_at();

create function public.start_advertising_oauth_attempt(
  p_attempt_id uuid,
  p_workspace_id uuid,
  p_provider text,
  p_state_hash text,
  p_pkce_algorithm text,
  p_pkce_key_version text,
  p_pkce_ciphertext text,
  p_expires_at timestamptz
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid());
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required.';
  end if;
  if p_provider not in ('google_ads', 'meta_ads') then
    raise exception using errcode = '22023', message = 'Provider is invalid.';
  end if;
  if p_expires_at <= pg_catalog.now() or p_expires_at > pg_catalog.now() + interval '10 minutes' then
    raise exception using errcode = '22023', message = 'OAuth attempt expiration is invalid.';
  end if;
  if not tandem_internal.lock_workspace_integration_manager(p_workspace_id, actor_id) then
    raise exception using errcode = '42501', message = 'Workspace integration permission is required.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_workspace_id::text || ':' || p_provider, 0)
  );
  delete from tandem_internal.oauth_connection_attempts
  where workspace_id = p_workspace_id and provider = p_provider and consumed_at is null;
  delete from tandem_internal.oauth_connection_attempts
  where consumed_at < pg_catalog.now() - interval '1 day';

  insert into tandem_internal.oauth_connection_attempts (
    id, workspace_id, initiating_user_id, provider, state_hash,
    pkce_algorithm, pkce_key_version, pkce_ciphertext, expires_at
  ) values (
    p_attempt_id, p_workspace_id, actor_id, p_provider, p_state_hash,
    p_pkce_algorithm, p_pkce_key_version, p_pkce_ciphertext, p_expires_at
  );
  return p_attempt_id;
end;
$$;
revoke all on function public.start_advertising_oauth_attempt(uuid, uuid, text, text, text, text, text, timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.start_advertising_oauth_attempt(uuid, uuid, text, text, text, text, text, timestamptz) to authenticated;

create function public.consume_advertising_oauth_attempt(p_provider text, p_state_hash text)
returns table (
  attempt_id uuid, workspace_id uuid, initiating_user_id uuid,
  provider text, pkce_algorithm text, pkce_key_version text,
  pkce_ciphertext text, return_destination text
)
language plpgsql security definer set search_path = '' as $$
declare consumed tandem_internal.oauth_connection_attempts;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service operation is required.';
  end if;
  select attempt.* into consumed
  from tandem_internal.oauth_connection_attempts as attempt
  where attempt.provider = p_provider
    and attempt.state_hash = p_state_hash
    and attempt.consumed_at is null
    and attempt.expires_at > pg_catalog.now()
  for update;
  if consumed.id is null then
    raise exception using errcode = 'P0002', message = 'OAuth attempt is invalid or expired.';
  end if;
  update tandem_internal.oauth_connection_attempts
  set consumed_at = pg_catalog.now()
  where id = consumed.id and consumed_at is null;
  if not found then
    raise exception using errcode = '40001', message = 'OAuth attempt was already consumed.';
  end if;
  return query select consumed.id, consumed.workspace_id, consumed.initiating_user_id,
    consumed.provider, consumed.pkce_algorithm, consumed.pkce_key_version,
    consumed.pkce_ciphertext, consumed.return_destination;
end;
$$;
revoke all on function public.consume_advertising_oauth_attempt(text, text) from public, anon, authenticated, service_role;
grant execute on function public.consume_advertising_oauth_attempt(text, text) to service_role;

create function public.finalize_advertising_oauth(
  p_attempt_id uuid,
  p_workspace_id uuid,
  p_user_id uuid,
  p_provider text,
  p_identity_reference text,
  p_scopes text[],
  p_credential_algorithm text,
  p_credential_key_version text,
  p_credential_ciphertext text,
  p_expires_at timestamptz,
  p_accounts jsonb
)
returns table (connection_id uuid, connection_status text)
language plpgsql security definer set search_path = '' as $$
declare
  attempt tandem_internal.oauth_connection_attempts;
  connection public.advertising_connections;
  item jsonb;
  account_id text;
  account_name text;
  accounts_count integer := 0;
  final_status text;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service operation is required.';
  end if;
  if p_provider not in ('google_ads', 'meta_ads')
      or p_credential_algorithm <> 'aes-256-gcm'
      or p_credential_key_version !~ '^v[1-9][0-9]*$'
      or p_credential_ciphertext is null
      or pg_catalog.char_length(p_credential_ciphertext) > 100000
      or p_accounts is null or pg_catalog.jsonb_typeof(p_accounts) <> 'array'
      or pg_catalog.jsonb_array_length(p_accounts) > 500
      or coalesce(pg_catalog.cardinality(p_scopes), 0) > 100 then
    raise exception using errcode = '22023', message = 'Provider connection data is invalid.';
  end if;

  select * into attempt
  from tandem_internal.oauth_connection_attempts as stored
  where stored.id = p_attempt_id and stored.workspace_id = p_workspace_id
    and stored.initiating_user_id = p_user_id and stored.provider = p_provider
    and stored.consumed_at is not null and stored.consumed_at <= stored.expires_at
  for update;
  if attempt.id is null then
    raise exception using errcode = 'P0002', message = 'OAuth attempt could not be confirmed.';
  end if;
  if not tandem_internal.lock_workspace_integration_manager(p_workspace_id, p_user_id) then
    raise exception using errcode = '42501', message = 'Workspace integration permission is no longer available.';
  end if;
  if p_identity_reference is not null and pg_catalog.char_length(p_identity_reference) > 300 then
    raise exception using errcode = '22023', message = 'Provider identity is invalid.';
  end if;

  insert into public.advertising_connections (
    workspace_id, provider, connection_status, connected_by_user_id,
    provider_identity_reference, granted_scopes, verified_at, last_error_code
  ) values (
    p_workspace_id, p_provider,
    case when pg_catalog.jsonb_array_length(p_accounts) > 0 then 'accounts_available' else 'no_accounts' end,
    p_user_id, p_identity_reference, coalesce(p_scopes, '{}'), pg_catalog.now(), null
  ) on conflict (workspace_id, provider) do update set
    connection_status = excluded.connection_status,
    connected_by_user_id = excluded.connected_by_user_id,
    provider_identity_reference = excluded.provider_identity_reference,
    granted_scopes = excluded.granted_scopes,
    verified_at = excluded.verified_at,
    last_error_code = null
  returning * into connection;

  insert into tandem_internal.advertising_credentials (
    connection_id, encryption_context_id, encryption_algorithm, key_version, ciphertext, expires_at
  ) values (
    connection.id, p_attempt_id, p_credential_algorithm, p_credential_key_version,
    p_credential_ciphertext, p_expires_at
  ) on conflict (connection_id) do update set
    encryption_context_id = excluded.encryption_context_id,
    encryption_algorithm = excluded.encryption_algorithm,
    key_version = excluded.key_version,
    ciphertext = excluded.ciphertext,
    expires_at = excluded.expires_at,
    updated_at = pg_catalog.now();

  for item in select element.value from pg_catalog.jsonb_array_elements(p_accounts) as element(value)
  loop
    account_id := item ->> 'externalAccountId';
    account_name := item ->> 'name';
    if account_id is null or pg_catalog.char_length(account_id) not between 1 and 160
        or account_name is null or pg_catalog.char_length(account_name) not between 1 and 300 then
      raise exception using errcode = '22023', message = 'Provider account data is invalid.';
    end if;
    insert into public.advertising_accounts (
      workspace_id, connection_id, provider, external_account_id,
      external_account_name, account_status, currency, timezone, is_manager,
      manager_reference, business_context, selected, last_synced_at
    ) values (
      p_workspace_id, connection.id, p_provider, account_id, account_name,
      nullif(item ->> 'accountStatus', ''), nullif(item ->> 'currency', ''),
      nullif(item ->> 'timezone', ''),
      case when item ? 'isManager' and pg_catalog.jsonb_typeof(item -> 'isManager') = 'boolean' then (item ->> 'isManager')::boolean else null end,
      nullif(item ->> 'managerReference', ''), nullif(item ->> 'businessContext', ''), false, pg_catalog.now()
    ) on conflict (connection_id, external_account_id) do update set
      external_account_name = excluded.external_account_name,
      account_status = excluded.account_status,
      currency = excluded.currency,
      timezone = excluded.timezone,
      is_manager = excluded.is_manager,
      manager_reference = excluded.manager_reference,
      business_context = excluded.business_context,
      last_synced_at = excluded.last_synced_at;
    accounts_count := accounts_count + 1;
  end loop;

  delete from public.advertising_accounts as account
  where account.connection_id = connection.id
    and not exists (
      select 1 from pg_catalog.jsonb_array_elements(p_accounts) as incoming(value)
      where incoming.value ->> 'externalAccountId' = account.external_account_id
    );

  update public.advertising_connections as current
  set connection_status = case
      when accounts_count = 0 then 'no_accounts'
      when exists (select 1 from public.advertising_accounts a where a.connection_id = connection.id and a.selected) then 'connected'
      else 'accounts_available'
    end
  where current.id = connection.id
  returning current.connection_status into final_status;

  return query select connection.id, final_status;
end;
$$;
revoke all on function public.finalize_advertising_oauth(uuid, uuid, uuid, text, text, text[], text, text, text, timestamptz, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.finalize_advertising_oauth(uuid, uuid, uuid, text, text, text[], text, text, text, timestamptz, jsonb) to service_role;

create function public.select_advertising_accounts(
  p_workspace_id uuid, p_connection_id uuid, p_account_ids uuid[]
)
returns text language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := (select auth.uid());
  changed_count integer;
  selected_count integer;
begin
  if actor_id is null then raise exception using errcode = '28000', message = 'Authentication is required.'; end if;
  if not tandem_internal.lock_workspace_integration_manager(p_workspace_id, actor_id) then
    raise exception using errcode = '42501', message = 'Workspace integration permission is required.';
  end if;
  if p_account_ids is null or pg_catalog.cardinality(p_account_ids) > 100
      or pg_catalog.cardinality(p_account_ids) <> (select pg_catalog.count(distinct ids.item) from pg_catalog.unnest(p_account_ids) as ids(item)) then
    raise exception using errcode = '22023', message = 'Account selection is invalid.';
  end if;
  if not exists (select 1 from public.advertising_connections c where c.id = p_connection_id and c.workspace_id = p_workspace_id) then
    raise exception using errcode = 'P0002', message = 'Advertising connection was not found.';
  end if;
  select pg_catalog.count(*) into changed_count from public.advertising_accounts a
  where a.connection_id = p_connection_id and a.workspace_id = p_workspace_id and a.id = any(p_account_ids);
  if changed_count <> pg_catalog.cardinality(p_account_ids) then
    raise exception using errcode = '42501', message = 'Every selected account must be verified for this workspace.';
  end if;
  update public.advertising_accounts set selected = id = any(p_account_ids)
  where connection_id = p_connection_id and workspace_id = p_workspace_id;
  select pg_catalog.count(*) into selected_count from public.advertising_accounts a
  where a.connection_id = p_connection_id and a.selected;
  update public.advertising_connections set connection_status = case
    when selected_count > 0 then 'connected'
    when exists (select 1 from public.advertising_accounts a where a.connection_id = p_connection_id) then 'accounts_available'
    else 'no_accounts' end,
    last_error_code = null
  where id = p_connection_id and workspace_id = p_workspace_id;
  return case when selected_count > 0 then 'connected'
    when exists (select 1 from public.advertising_accounts a where a.connection_id = p_connection_id) then 'accounts_available'
    else 'no_accounts' end;
end;
$$;
revoke all on function public.select_advertising_accounts(uuid, uuid, uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.select_advertising_accounts(uuid, uuid, uuid[]) to authenticated;

create function public.unlink_advertising_connection(p_workspace_id uuid, p_connection_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception using errcode = '28000', message = 'Authentication is required.'; end if;
  if not tandem_internal.lock_workspace_integration_manager(p_workspace_id, (select auth.uid())) then
    raise exception using errcode = '42501', message = 'Workspace integration permission is required.';
  end if;
  delete from public.advertising_connections
  where id = p_connection_id and workspace_id = p_workspace_id;
  if not found then raise exception using errcode = 'P0002', message = 'Advertising connection was not found.'; end if;
end;
$$;
revoke all on function public.unlink_advertising_connection(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.unlink_advertising_connection(uuid, uuid) to authenticated;

create function public.get_advertising_credential(p_workspace_id uuid, p_connection_id uuid, p_actor_user_id uuid)
returns table (
  connection_id uuid, provider text, encryption_context_id uuid, encryption_algorithm text,
  key_version text, ciphertext text, expires_at timestamptz
)
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service operation is required.';
  end if;
  if not tandem_internal.lock_workspace_integration_manager(p_workspace_id, p_actor_user_id) then
    raise exception using errcode = '42501', message = 'Workspace integration permission is no longer available.';
  end if;
  return query
  select c.id, c.provider, secret.encryption_context_id, secret.encryption_algorithm, secret.key_version,
    secret.ciphertext, secret.expires_at
  from public.advertising_connections c
  join tandem_internal.advertising_credentials secret on secret.connection_id = c.id
  where c.id = p_connection_id and c.workspace_id = p_workspace_id;
end;
$$;
revoke all on function public.get_advertising_credential(uuid, uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_advertising_credential(uuid, uuid, uuid) to service_role;

create function public.sync_advertising_connection(
  p_workspace_id uuid, p_connection_id uuid, p_provider text,
  p_identity_reference text, p_scopes text[], p_credential_algorithm text,
  p_credential_key_version text, p_credential_ciphertext text,
  p_expires_at timestamptz, p_accounts jsonb, p_actor_user_id uuid,
  p_encryption_context_id uuid
)
returns text language plpgsql security definer set search_path = '' as $$
declare
  c public.advertising_connections;
  item jsonb;
  account_id text;
  account_name text;
  accounts_count integer := 0;
  final_status text;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service operation is required.';
  end if;
  select * into c from public.advertising_connections
  where id = p_connection_id and workspace_id = p_workspace_id and provider = p_provider
  for update;
  if c.id is null then raise exception using errcode = 'P0002', message = 'Advertising connection was not found.'; end if;
  if not tandem_internal.lock_workspace_integration_manager(p_workspace_id, p_actor_user_id) then
    raise exception using errcode = '42501', message = 'Workspace integration permission is no longer available.';
  end if;
  if p_credential_algorithm <> 'aes-256-gcm' or p_credential_key_version !~ '^v[1-9][0-9]*$'
      or p_accounts is null or pg_catalog.jsonb_typeof(p_accounts) <> 'array'
      or pg_catalog.jsonb_array_length(p_accounts) > 500 then
    raise exception using errcode = '22023', message = 'Provider connection data is invalid.';
  end if;
  update public.advertising_connections set provider_identity_reference = p_identity_reference,
    granted_scopes = coalesce(p_scopes, '{}'), verified_at = pg_catalog.now(), last_error_code = null
  where id = p_connection_id;
  insert into tandem_internal.advertising_credentials(connection_id, encryption_context_id, encryption_algorithm, key_version, ciphertext, expires_at)
  values (p_connection_id, p_encryption_context_id, p_credential_algorithm, p_credential_key_version, p_credential_ciphertext, p_expires_at)
  on conflict (connection_id) do update set encryption_context_id = excluded.encryption_context_id,
    encryption_algorithm = excluded.encryption_algorithm,
    key_version = excluded.key_version, ciphertext = excluded.ciphertext,
    expires_at = excluded.expires_at, updated_at = pg_catalog.now();
  for item in select element.value from pg_catalog.jsonb_array_elements(p_accounts) as element(value)
  loop
    account_id := item ->> 'externalAccountId'; account_name := item ->> 'name';
    if account_id is null or pg_catalog.char_length(account_id) not between 1 and 160
       or account_name is null or pg_catalog.char_length(account_name) not between 1 and 300 then
      raise exception using errcode = '22023', message = 'Provider account data is invalid.';
    end if;
    insert into public.advertising_accounts(workspace_id, connection_id, provider, external_account_id,
      external_account_name, account_status, currency, timezone, is_manager, manager_reference,
      business_context, selected, last_synced_at)
    values (p_workspace_id, p_connection_id, p_provider, account_id, account_name,
      nullif(item ->> 'accountStatus',''), nullif(item ->> 'currency',''), nullif(item ->> 'timezone',''),
      case when item ? 'isManager' and pg_catalog.jsonb_typeof(item -> 'isManager') = 'boolean' then (item ->> 'isManager')::boolean else null end,
      nullif(item ->> 'managerReference',''), nullif(item ->> 'businessContext',''), false, pg_catalog.now())
    on conflict (connection_id, external_account_id) do update set external_account_name = excluded.external_account_name,
      account_status = excluded.account_status, currency = excluded.currency, timezone = excluded.timezone,
      is_manager = excluded.is_manager, manager_reference = excluded.manager_reference,
      business_context = excluded.business_context, last_synced_at = excluded.last_synced_at;
    accounts_count := accounts_count + 1;
  end loop;
  delete from public.advertising_accounts a where a.connection_id = p_connection_id and not exists (
    select 1 from pg_catalog.jsonb_array_elements(p_accounts) as incoming(value)
    where incoming.value ->> 'externalAccountId' = a.external_account_id);
  update public.advertising_connections set connection_status = case
    when accounts_count = 0 then 'no_accounts'
    when exists (select 1 from public.advertising_accounts a where a.connection_id = p_connection_id and a.selected) then 'connected'
    else 'accounts_available' end
  where id = p_connection_id returning connection_status into final_status;
  return final_status;
end;
$$;
revoke all on function public.sync_advertising_connection(uuid, uuid, text, text, text[], text, text, text, timestamptz, jsonb, uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.sync_advertising_connection(uuid, uuid, text, text, text[], text, text, text, timestamptz, jsonb, uuid, uuid) to service_role;

create function public.mark_advertising_connection_error(p_workspace_id uuid, p_connection_id uuid, p_error_code text, p_actor_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service operation is required.';
  end if;
  if not tandem_internal.lock_workspace_integration_manager(p_workspace_id, p_actor_user_id) then
    raise exception using errcode = '42501', message = 'Workspace integration permission is no longer available.';
  end if;
  if p_error_code not in ('authorization_expired','provider_permission_required','provider_unavailable','provider_error') then
    raise exception using errcode = '22023', message = 'Connection error code is invalid.';
  end if;
  update public.advertising_connections set
    connection_status = case when p_error_code = 'authorization_expired' then 'reauthorization_required' else 'connection_error' end,
    last_error_code = p_error_code
  where id = p_connection_id and workspace_id = p_workspace_id;
end;
$$;
revoke all on function public.mark_advertising_connection_error(uuid, uuid, text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.mark_advertising_connection_error(uuid, uuid, text, uuid) to service_role;

commit;
