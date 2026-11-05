begin;

-- Record denied, authenticated capability attempts without allowing callers to
-- write arbitrary audit events. Repeated actor/capability pairs are throttled.
create function public.platform_admin_record_denied_attempt(p_actor uuid,p_capability text)
returns boolean language plpgsql security definer set search_path=''
as $$ begin
 if p_actor is null or p_capability not in (
  'platform.dashboard.read','platform.tenants.read','platform.tenants.manage',
  'platform.users.read','platform.support.manage','platform.billing.read',
  'platform.billing.manage','platform.usage.read','platform.audit.read',
  'platform.health.read','platform.settings.manage','platform.admin.provision'
 ) then raise exception using errcode='22023',message='Invalid denied-capability audit request.'; end if;

 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor::text||':'||p_capability,0));
 if exists(
  select 1 from public.platform_admin_events e
  where e.actor_user_id=p_actor
    and e.action='platform.authorization.denied'
    and e.target_id=p_capability
    and e.created_at>now()-interval '1 minute'
 ) then return false; end if;

 insert into public.platform_admin_events(actor_user_id,actor_role,action,target_type,target_id,reason,outcome,safe_metadata)
 values(p_actor,coalesce(tandem_internal.platform_admin_role(p_actor),'unassigned'),
  'platform.authorization.denied','capability',p_capability,
  'Required platform capability is not assigned.','denied',jsonb_build_object('capability',p_capability));
 return true;
end; $$;

revoke all on function public.platform_admin_record_denied_attempt(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.platform_admin_record_denied_attempt(uuid,text) to service_role;

comment on function public.platform_admin_record_denied_attempt(uuid,text) is
 'Server-only, allowlisted, one-per-minute denied capability audit. Caller identity must be verified by the API before use.';

commit;
