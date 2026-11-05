begin;

-- The summary expires trials and appends a lifecycle event, so it must not be
-- declared STABLE. Keep the derived usage wrapper volatile for the same reason.
alter function public.billing_workspace_summary(uuid) volatile;
alter function public.billing_workspace_usage(uuid) volatile;

create or replace function public.billing_workspace_summary(p_workspace_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare ctx jsonb; s jsonb; p jsonb; v jsonb; usage jsonb; pending jsonb; notice_array jsonb:='[]'::jsonb; ended public.workspace_subscriptions;
begin
  if auth.uid() is null then raise exception using errcode='28000',message='Authentication is required.'; end if;
  if not tandem_internal.has_workspace_role(p_workspace_id,array['owner','admin','editor','viewer']::text[]) then raise exception using errcode='P0002',message='Workspace not found.'; end if;
  update public.workspace_subscriptions set status='expired',updated_at=pg_catalog.now()
    where workspace_id=p_workspace_id and status='trialing' and trial_ends_at<=pg_catalog.now();
  if found then
    insert into public.subscription_events(workspace_id,event_type,prior_state,next_state,source,idempotency_key)
      values(p_workspace_id,'trial_expired','{"status":"trialing"}'::jsonb,'{"status":"expired"}'::jsonb,'system','trial-expired:'||p_workspace_id::text)
      on conflict(workspace_id,idempotency_key) do nothing;
  end if;
  update public.workspace_subscriptions set status=case when cancel_at_period_end then 'cancelled' else 'expired' end,
      cancel_at_period_end=false,updated_at=pg_catalog.now()
    where workspace_id=p_workspace_id and status in ('active_demo','cancel_scheduled') and period_end<=pg_catalog.now()
    returning * into ended;
  if found then
    insert into public.subscription_events(workspace_id,event_type,prior_state,next_state,source,idempotency_key)
      values(p_workspace_id,case when ended.status='cancelled' then 'subscription_cancelled' else 'subscription_expired' end,
        pg_catalog.to_jsonb(ended),pg_catalog.jsonb_build_object('status',ended.status,'period_end',ended.period_end),'system',
        case when ended.status='cancelled' then 'period-cancelled:' else 'period-expired:' end||p_workspace_id::text)
      on conflict(workspace_id,idempotency_key) do nothing;
  end if;
  ctx:=tandem_internal.billing_context(p_workspace_id);
  if ctx is null then raise exception using errcode='55000',message='Workspace billing setup is unavailable.'; end if;
  s:=ctx->'subscription'; p:=ctx->'plan'; v:=ctx->'version';
  select pg_catalog.jsonb_build_object(
    'campaigns_created_month',(select count(*) from public.workspace_usage_events e where e.workspace_id=p_workspace_id and e.metric_key='campaigns_created' and e.period_start=pg_catalog.date_trunc('month',pg_catalog.now())::date),
    'active_campaigns',(select count(*) from public.campaigns c where c.workspace_id=p_workspace_id and c.archived_at is null),
    'creative_projects',(select count(*) from public.creative_projects c where c.workspace_id=p_workspace_id and c.lifecycle_status<>'archived'),
    'storage_bytes',(select coalesce(sum(a.size_bytes),0) from public.creative_assets a where a.workspace_id=p_workspace_id and a.asset_status='active'),
    'automation_rules',(select count(*) from public.automation_rules r where r.workspace_id=p_workspace_id and r.archived_at is null and r.enabled),
    'automation_executions_month',(select count(*) from public.workspace_usage_events e where e.workspace_id=p_workspace_id and e.metric_key='automation_executions' and e.period_start=pg_catalog.date_trunc('month',pg_catalog.now())::date),
    'saved_reports',(select count(*) from public.report_definitions r where r.workspace_id=p_workspace_id and r.status='active'),
    'pdf_exports_month',(select count(*) from public.workspace_usage_events e where e.workspace_id=p_workspace_id and e.metric_key='pdf_exports' and e.period_start=pg_catalog.date_trunc('month',pg_catalog.now())::date),
    'seats',(select count(*) from public.workspace_memberships m where m.workspace_id=p_workspace_id)
  ) into usage;
  select pg_catalog.to_jsonb(r) into pending from public.subscription_change_requests r where r.workspace_id=p_workspace_id and r.status='pending' order by r.created_at desc limit 1;
  if s->>'status'='trialing' then notice_array:=notice_array||pg_catalog.jsonb_build_array('Free trial. No payment method is stored and no automatic renewal occurs.'); end if;
  if s->>'status'='legacy_access' then notice_array:=notice_array||pg_catalog.jsonb_build_array('Legacy transition access is temporary; review the plan catalog before the transition window ends.'); end if;
  if s->>'status'='expired' then notice_array:=notice_array||pg_catalog.jsonb_build_array('Subscription period ended. Existing data is preserved; new resource creation requires an active plan.'); end if;
  if s->>'cancel_at_period_end'='true' then notice_array:=notice_array||pg_catalog.jsonb_build_array('Cancellation is scheduled at the end of this simulated period.'); end if;
  return pg_catalog.jsonb_build_object('mode','simulation','subscription',pg_catalog.jsonb_build_object(
    'workspaceId',s->>'workspace_id','planId',s->>'plan_id','planVersion',(s->>'plan_version')::integer,'status',s->>'status','interval',s->>'billing_interval',
    'periodStart',s->>'period_start','periodEnd',s->>'period_end','trialEndsAt',s->>'trial_ends_at','cancelAtPeriodEnd',(s->>'cancel_at_period_end')::boolean,
    'source',s->>'source','legacyUntil',s->>'legacy_until'),
    'plan',pg_catalog.jsonb_build_object('id',p->>'id','name',p->>'display_name','description',p->>'description','currency',v->>'currency',
      'monthlyPriceMinor',(v->>'monthly_price_minor')::bigint,'annualPriceMinor',(v->>'annual_price_minor')::bigint,'trialDays',(v->>'trial_days')::integer,
      'features',v->'features','limits',v->'limits','public',p->>'is_public'='true','active',p->>'is_active'='true','sortOrder',(p->>'sort_order')::integer,'version',(v->>'version')::integer,'effectiveAt',v->>'effective_at'),
    'features',v->'features','limits',v->'limits','usage',usage,'remaining',pg_catalog.jsonb_build_object(
      'campaigns_per_month',case when (v->'limits'->>'campaigns_per_month')::bigint<0 then null else greatest(0,(v->'limits'->>'campaigns_per_month')::bigint-(usage->>'campaigns_created_month')::bigint) end,
      'active_campaigns',case when (v->'limits'->>'active_campaigns')::bigint<0 then null else greatest(0,(v->'limits'->>'active_campaigns')::bigint-(usage->>'active_campaigns')::bigint) end,
      'creative_projects',case when (v->'limits'->>'creative_projects')::bigint<0 then null else greatest(0,(v->'limits'->>'creative_projects')::bigint-(usage->>'creative_projects')::bigint) end,
      'storage_bytes',case when (v->'limits'->>'storage_bytes')::bigint<0 then null else greatest(0,(v->'limits'->>'storage_bytes')::bigint-(usage->>'storage_bytes')::bigint) end,
      'seats',case when (v->'limits'->>'seats')::bigint<0 then null else greatest(0,(v->'limits'->>'seats')::bigint-(usage->>'seats')::bigint) end),
    'pendingChange',pending,'notices',notice_array);
end $$;

-- Reject idempotency-key reuse for a different requested operation. Exact
-- retries continue to return the existing request through the existing unique
-- constraint/upsert.
create function tandem_internal.guard_billing_request_idempotency()
returns trigger language plpgsql security definer set search_path = '' as $$
declare prior public.subscription_change_requests;
begin
  select * into prior from public.subscription_change_requests r
    where r.workspace_id=new.workspace_id and r.idempotency_key=new.idempotency_key;
  if found and (
    prior.request_type is distinct from new.request_type or
    prior.requested_plan_id is distinct from new.requested_plan_id or
    prior.requested_plan_version is distinct from new.requested_plan_version or
    prior.requested_interval is distinct from new.requested_interval or
    prior.reason is distinct from new.reason
  ) then
    raise exception using errcode='23505',message='The idempotency key was already used for a different billing request.';
  end if;
  if new.request_type='plan_change' and new.requested_plan_id='free_trial' then
    raise exception using errcode='22023',message='A trial is assigned once when a workspace is created and cannot be requested again.';
  end if;
  return new;
end $$;
revoke all on function tandem_internal.guard_billing_request_idempotency() from public,anon,authenticated,service_role;
create trigger billing_request_idempotency_guard before insert on public.subscription_change_requests
  for each row execute function tandem_internal.guard_billing_request_idempotency();

create or replace function public.billing_request_plan_change(p_workspace_id uuid,p_plan_id text,p_interval text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid:=auth.uid(); plan public.subscription_plans; ver public.subscription_plan_versions; result public.subscription_change_requests;
begin
  if actor is null then raise exception using errcode='28000',message='Authentication is required.'; end if;
  if p_interval not in ('monthly','annual') or p_idempotency_key is null then raise exception using errcode='22023',message='Plan request is invalid.'; end if;
  if not tandem_internal.has_workspace_role(p_workspace_id,array['owner','admin']::text[]) then raise exception using errcode='42501',message='Workspace owner or admin permission is required.'; end if;
  perform 1 from public.workspace_subscriptions where workspace_id=p_workspace_id for update;
  if not found then raise exception using errcode='P0002',message='Workspace subscription not found.'; end if;
  select * into result from public.subscription_change_requests where workspace_id=p_workspace_id and idempotency_key=p_idempotency_key;
  if found then
    if result.request_type<>'plan_change' or result.requested_plan_id is distinct from p_plan_id or result.requested_interval is distinct from p_interval then
      raise exception using errcode='23505',message='The idempotency key was already used for a different billing request.';
    end if;
    return pg_catalog.to_jsonb(result);
  end if;
  select * into plan from public.subscription_plans where id=p_plan_id and is_public and is_active;
  if not found then raise exception using errcode='22023',message='The selected plan is unavailable.'; end if;
  select * into ver from public.subscription_plan_versions where plan_id=plan.id and version=plan.current_version;
  if p_interval='annual' and ver.annual_price_minor is null then raise exception using errcode='22023',message='Annual billing is unavailable for this plan.'; end if;
  insert into public.subscription_change_requests(workspace_id,requested_by,requested_plan_id,requested_plan_version,requested_interval,request_type,idempotency_key)
    values(p_workspace_id,actor,plan.id,ver.version,p_interval,'plan_change',p_idempotency_key) returning * into result;
  insert into public.subscription_events(workspace_id,actor_user_id,event_type,next_state,source,idempotency_key)
    values(p_workspace_id,actor,'plan_change_requested',pg_catalog.jsonb_build_object('plan_id',plan.id,'version',ver.version,'interval',p_interval),'demo_simulation','plan-request:'||p_idempotency_key::text)
    on conflict(workspace_id,idempotency_key) do nothing;
  return pg_catalog.to_jsonb(result);
end $$;

create or replace function public.billing_request_cancellation(p_workspace_id uuid,p_idempotency_key uuid,p_reason text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid:=auth.uid(); s public.workspace_subscriptions; result public.subscription_change_requests;
begin
  if actor is null then raise exception using errcode='28000',message='Authentication is required.'; end if;
  if p_idempotency_key is null or pg_catalog.char_length(coalesce(p_reason,''))>500 then raise exception using errcode='22023',message='Cancellation request is invalid.'; end if;
  if not tandem_internal.has_workspace_role(p_workspace_id,array['owner','admin']::text[]) then raise exception using errcode='42501',message='Workspace owner or admin permission is required.'; end if;
  select * into s from public.workspace_subscriptions where workspace_id=p_workspace_id for update;
  if not found then raise exception using errcode='P0002',message='Subscription not found.'; end if;
  select * into result from public.subscription_change_requests where workspace_id=p_workspace_id and idempotency_key=p_idempotency_key;
  if found then
    if result.request_type<>'cancellation' or result.reason is distinct from coalesce(p_reason,'') then raise exception using errcode='23505',message='The idempotency key was already used for a different billing request.'; end if;
    return pg_catalog.to_jsonb(result);
  end if;
  if s.status not in ('trialing','active_demo','past_due_demo','cancel_scheduled','legacy_access') then raise exception using errcode='22023',message='This subscription cannot be cancelled.'; end if;
  insert into public.subscription_change_requests(workspace_id,requested_by,requested_plan_id,requested_plan_version,requested_interval,request_type,idempotency_key,reason,status)
    values(p_workspace_id,actor,s.plan_id,s.plan_version,s.billing_interval,'cancellation',p_idempotency_key,coalesce(p_reason,''),'pending') returning * into result;
  update public.workspace_subscriptions set cancel_at_period_end=true,status='cancel_scheduled',updated_at=pg_catalog.now() where workspace_id=p_workspace_id;
  insert into public.subscription_events(workspace_id,actor_user_id,event_type,prior_state,next_state,reason,source,idempotency_key)
    values(p_workspace_id,actor,'cancellation_requested',pg_catalog.to_jsonb(s),'{"status":"cancel_scheduled"}'::jsonb,coalesce(p_reason,''),'demo_simulation','cancel:'||p_idempotency_key::text)
    on conflict(workspace_id,idempotency_key) do nothing;
  return pg_catalog.to_jsonb(result);
end $$;

create or replace function public.billing_request_reactivation(p_workspace_id uuid,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid:=auth.uid(); s public.workspace_subscriptions; result public.subscription_change_requests;
begin
  if actor is null then raise exception using errcode='28000',message='Authentication is required.'; end if;
  if p_idempotency_key is null then raise exception using errcode='22023',message='Reactivation request is invalid.'; end if;
  if not tandem_internal.has_workspace_role(p_workspace_id,array['owner','admin']::text[]) then raise exception using errcode='42501',message='Workspace owner or admin permission is required.'; end if;
  select * into s from public.workspace_subscriptions where workspace_id=p_workspace_id for update;
  if not found then raise exception using errcode='P0002',message='Subscription not found.'; end if;
  select * into result from public.subscription_change_requests where workspace_id=p_workspace_id and idempotency_key=p_idempotency_key;
  if found then
    if result.request_type<>'reactivation' then raise exception using errcode='23505',message='The idempotency key was already used for a different billing request.'; end if;
    return pg_catalog.to_jsonb(result);
  end if;
  if not found or not s.cancel_at_period_end then raise exception using errcode='22023',message='No scheduled cancellation can be reversed.'; end if;
  insert into public.subscription_change_requests(workspace_id,requested_by,requested_plan_id,requested_plan_version,requested_interval,request_type,idempotency_key)
    values(p_workspace_id,actor,s.plan_id,s.plan_version,s.billing_interval,'reactivation',p_idempotency_key) returning * into result;
  update public.workspace_subscriptions set status=case when trial_ends_at>pg_catalog.now() then 'trialing' else 'active_demo' end,cancel_at_period_end=false,updated_at=pg_catalog.now() where workspace_id=p_workspace_id;
  insert into public.subscription_events(workspace_id,actor_user_id,event_type,prior_state,next_state,source,idempotency_key)
    values(p_workspace_id,actor,'subscription_reactivated',pg_catalog.to_jsonb(s),'{"cancel_at_period_end":false}'::jsonb,'demo_simulation','reactivate:'||p_idempotency_key::text)
    on conflict(workspace_id,idempotency_key) do nothing;
  return pg_catalog.to_jsonb(result);
end $$;

-- Legacy workspaces receive a finite migration grace period. Once it expires,
-- existing data stays readable but new quota-protected writes stop.
create or replace function tandem_internal.billing_guard_resource(
 p_workspace_id uuid,p_feature text,p_metric text,p_current_usage bigint,p_quantity bigint default 1
) returns void language plpgsql security definer set search_path = '' as $$
declare ctx jsonb; sub jsonb; features jsonb; limits jsonb; entitlement bigint; legacy_until timestamptz;
begin
  if p_workspace_id is null then raise exception using errcode='22023',message='Workspace is required.'; end if;
  perform 1 from public.workspaces w where w.id=p_workspace_id for update;
  if not found then raise exception using errcode='P0002',message='Workspace not found.'; end if;
  ctx:=tandem_internal.billing_context(p_workspace_id);
  if ctx is null then raise exception using errcode='55000',message='Workspace billing setup is unavailable.'; end if;
  sub:=ctx->'subscription'; features:=ctx->'version'->'features'; limits:=ctx->'version'->'limits';
  if sub->>'status'='legacy_access' then
    legacy_until:=(sub->>'legacy_until')::timestamptz;
    if legacy_until is not null and legacy_until>pg_catalog.now() then return; end if;
    raise exception using errcode='54000',message='The workspace migration allowance has expired. Existing records are preserved; select a plan to resume creating resources.';
  end if;
  if sub->>'status'='trialing' and (sub->>'trial_ends_at')::timestamptz<=pg_catalog.now() then
    raise exception using errcode='54000',message='The workspace trial has expired. Existing records remain available; select a plan to resume creating resources.';
  end if;
  if sub->>'status' in ('active_demo','cancel_scheduled') and (sub->>'period_end')::timestamptz<=pg_catalog.now() then
    raise exception using errcode='54000',message='The simulated subscription period has ended. Existing records remain available; a trusted demo renewal or a plan request is required to resume writes.';
  end if;
  if sub->>'status' in ('expired','cancelled','suspended') and (sub->>'period_end')::timestamptz<=pg_catalog.now() then
    raise exception using errcode='54000',message='This subscription is read-only. Select a plan to create new resources.';
  end if;
  if coalesce((features->>p_feature)::boolean,false)=false then
    raise exception using errcode='42501',message='This workspace plan does not include the requested feature.';
  end if;
  entitlement:=coalesce((limits->>p_metric)::bigint,0);
  if entitlement>=0 and p_current_usage+p_quantity>entitlement then
    raise exception using errcode='54000',message='The workspace plan quota has been reached.';
  end if;
end $$;
revoke all on function tandem_internal.billing_guard_resource(uuid,text,text,bigint,bigint) from public,anon,authenticated,service_role;

alter table public.subscription_events drop constraint subscription_events_event_type_check;
alter table public.subscription_events add constraint subscription_events_event_type_check check (event_type in (
  'trial_started','plan_change_requested','demo_plan_activated','downgrade_scheduled','cancellation_requested',
  'subscription_cancelled','subscription_reactivated','subscription_expired','trial_expired','plan_catalog_changed','renewal_simulated'
));

-- A local trusted operator can advance a demo subscription period. This is
-- deliberately separate from billing-provider renewal and never records a
-- processed payment.
create function public.billing_simulate_renewal(p_workspace_id uuid,p_actor_id uuid,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.workspace_subscriptions; v public.subscription_plan_versions; inv public.billing_demo_invoices;
  next_start timestamptz; next_end timestamptz; total bigint; existing_event public.subscription_events;
begin
  if auth.role()<>'service_role' or p_actor_id is null or p_idempotency_key is null then
    raise exception using errcode='42501',message='Trusted local billing operator authorization is required.';
  end if;
  select * into s from public.workspace_subscriptions where workspace_id=p_workspace_id for update;
  if not found then raise exception using errcode='P0002',message='Workspace subscription not found.'; end if;
  select * into existing_event from public.subscription_events where workspace_id=p_workspace_id and idempotency_key='renewal:'||p_idempotency_key::text;
  if found then return existing_event.next_state||pg_catalog.jsonb_build_object('status','already_simulated','paymentProcessed',false); end if;
  if s.status<>'active_demo' or s.cancel_at_period_end then
    raise exception using errcode='22023',message='Only an active demo subscription without scheduled cancellation can be renewed.';
  end if;
  select * into v from public.subscription_plan_versions where plan_id=s.plan_id and version=s.plan_version;
  next_start:=greatest(s.period_end,pg_catalog.now());
  next_end:=next_start+case when s.billing_interval='annual' then interval '1 year' else interval '1 month' end;
  total:=case when s.billing_interval='annual' then coalesce(v.annual_price_minor,0) else coalesce(v.monthly_price_minor,0) end;
  insert into public.billing_demo_invoices(workspace_id,plan_id,plan_version,billing_interval,currency,subtotal_minor,total_minor,billing_period_start,billing_period_end,generated_by)
    values(p_workspace_id,v.plan_id,v.version,s.billing_interval,v.currency,total,total,next_start::date,next_end::date,p_actor_id) returning * into inv;
  insert into public.billing_demo_invoice_items(invoice_id,description,quantity,unit_amount_minor,amount_minor)
    values(inv.id,v.plan_id||' sample renewal · '||s.billing_interval,1,total,total);
  update public.workspace_subscriptions set period_start=next_start,period_end=next_end,updated_at=pg_catalog.now()
    where workspace_id=p_workspace_id;
  insert into public.subscription_events(workspace_id,actor_user_id,event_type,prior_state,next_state,source,idempotency_key)
    values(p_workspace_id,p_actor_id,'renewal_simulated',pg_catalog.to_jsonb(s),pg_catalog.jsonb_build_object(
      'status','active_demo','period_start',next_start,'period_end',next_end,'invoice_id',inv.id,'payment_processed',false
    ),'demo_simulation','renewal:'||p_idempotency_key::text);
  insert into public.platform_admin_audit_events(actor_user_id,action,target_id,summary)
    values(p_actor_id,'demo_subscription_renewal',p_workspace_id::text,pg_catalog.jsonb_build_object('invoice_id',inv.id,'payment_processed',false));
  return pg_catalog.jsonb_build_object('workspaceId',p_workspace_id,'status','renewed_demo','invoiceId',inv.id,'periodStart',next_start,'periodEnd',next_end,'mode','simulation','paymentProcessed',false);
end $$;

revoke all on function public.billing_simulate_renewal(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.billing_simulate_renewal(uuid,uuid,uuid) to service_role;

commit;
