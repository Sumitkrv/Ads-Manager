-- Normalize JSON null to SQL NULL before campaign row constraints run.
-- The API intentionally serializes an ungenerated draft plan as JSON null.
-- This keeps persistence semantics consistent for create and save operations.
create or replace function tandem_internal.normalize_campaign_plan()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.plan = 'null'::jsonb then
    new.plan := null;
  end if;
  return new;
end;
$$;

revoke all on function tandem_internal.normalize_campaign_plan() from public, anon, authenticated, service_role;

create trigger campaigns_normalize_plan_before_write
before insert or update of plan on public.campaigns
for each row execute function tandem_internal.normalize_campaign_plan();
