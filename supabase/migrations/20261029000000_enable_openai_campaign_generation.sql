alter table public.campaigns drop constraint campaigns_generation_mode_valid;
alter table public.campaigns add constraint campaigns_generation_mode_valid
  check (generation_mode in ('none', 'simulation', 'openai'));

create or replace function tandem_internal.sync_campaign_generation_mode()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.plan is null then
    new.generation_mode := 'none';
  elsif new.plan #>> '{generation,mode}' = 'openai' then
    new.generation_mode := 'openai';
  else
    new.generation_mode := 'simulation';
  end if;
  return new;
end;
$$;

create trigger campaigns_sync_generation_mode
before insert or update of plan, generation_mode on public.campaigns
for each row execute function tandem_internal.sync_campaign_generation_mode();

revoke all on function tandem_internal.sync_campaign_generation_mode() from public, anon, authenticated, service_role;
