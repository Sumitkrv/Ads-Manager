begin;

do $$ begin
  if to_regclass('public.campaigns') is null or to_regclass('public.demo_campaign_analytics') is null
     or to_regprocedure('tandem_internal.has_workspace_role(uuid,text[])') is null then
    raise exception 'Prompt 07 requires the Prompt 03 workspace and Prompt 05 campaign migrations.';
  end if;
end $$;

alter table public.demo_campaign_analytics add constraint demo_analytics_optimization_pair_unique unique (id,campaign_id,workspace_id);

create table public.optimization_recommendations (
 id uuid primary key default pg_catalog.gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 campaign_id uuid not null, source_analytics_id uuid not null, campaign_revision integer not null,
 recommendation_type text not null, dedupe_key text not null, lifecycle_status text not null default 'new', version integer not null default 1,
 created_by_user_id uuid references auth.users(id) on delete set null, reviewer_user_id uuid references auth.users(id) on delete set null,
 decision_comments text not null default '', decided_at timestamptz, applied_at timestamptz,
 created_at timestamptz not null default pg_catalog.now(), updated_at timestamptz not null default pg_catalog.now(),
 foreign key(campaign_id,workspace_id) references public.campaigns(id,workspace_id) on delete cascade,
 foreign key(source_analytics_id,campaign_id,workspace_id) references public.demo_campaign_analytics(id,campaign_id,workspace_id) on delete cascade,
 constraint optimization_recommendation_type check (recommendation_type in ('review_low_ctr','spend_without_conversions','low_demo_budget_utilization','simulated_ctr_decline','automation_rule_match')),
 constraint optimization_recommendation_status check (lifecycle_status in ('new','reviewed','approved','rejected','applied_to_demo','dismissed','superseded')),
 constraint optimization_recommendation_version check (version>0), constraint optimization_recommendation_comments check (pg_catalog.char_length(decision_comments)<=2000),
 unique(workspace_id,campaign_id,dedupe_key)
);
create index optimization_recommendations_recent_idx on public.optimization_recommendations(workspace_id,lifecycle_status,created_at desc);

create table public.optimization_scenarios (
 id uuid primary key default pg_catalog.gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 campaign_id uuid not null, source_analytics_id uuid not null, campaign_revision integer not null, scenario_name text not null,
 budget_type text not null, currency text not null, current_budget numeric(14,2) not null, proposed_budget numeric(14,2) not null,
 adjustment_type text not null, lifecycle_status text not null default 'draft', version integer not null default 1,
 created_by_user_id uuid references auth.users(id) on delete set null, approver_user_id uuid references auth.users(id) on delete set null,
 decision_comments text not null default '', approved_at timestamptz, applied_at timestamptz,
 created_at timestamptz not null default pg_catalog.now(), updated_at timestamptz not null default pg_catalog.now(),
 foreign key(campaign_id,workspace_id) references public.campaigns(id,workspace_id) on delete cascade,
 foreign key(source_analytics_id,campaign_id,workspace_id) references public.demo_campaign_analytics(id,campaign_id,workspace_id) on delete cascade,
 constraint optimization_scenario_name check (pg_catalog.char_length(scenario_name) between 1 and 120),
 constraint optimization_scenario_budget_type check (budget_type in ('daily','lifetime')),
 constraint optimization_scenario_currency check (currency ~ '^[A-Z]{3}$'),
 constraint optimization_scenario_amount check (current_budget between 0.01 and 10000000 and proposed_budget between 0.01 and 10000000),
 constraint optimization_scenario_adjustment check (adjustment_type in ('absolute','percentage')),
 constraint optimization_scenario_status check (lifecycle_status in ('draft','needs_approval','approved','rejected','applied','stale')),
 constraint optimization_scenario_version check (version>0), constraint optimization_scenario_comments check (pg_catalog.char_length(decision_comments)<=2000)
);
create index optimization_scenarios_recent_idx on public.optimization_scenarios(workspace_id,created_at desc);

create table public.automation_rules (
 id uuid primary key default pg_catalog.gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 name text not null, definition jsonb not null, version integer not null default 1, enabled boolean not null default false,
 created_by_user_id uuid references auth.users(id) on delete set null, updated_by_user_id uuid references auth.users(id) on delete set null,
 archived_at timestamptz, created_at timestamptz not null default pg_catalog.now(), updated_at timestamptz not null default pg_catalog.now(),
 unique(id,workspace_id), constraint automation_rule_name check (pg_catalog.char_length(pg_catalog.btrim(name)) between 1 and 120),
 constraint automation_rule_definition_object check (pg_catalog.jsonb_typeof(definition)='object'), constraint automation_rule_version check (version>0)
);
create unique index automation_rules_workspace_name_idx on public.automation_rules(workspace_id,pg_catalog.lower(name)) where archived_at is null;
create index automation_rules_enabled_idx on public.automation_rules(workspace_id,enabled,updated_at desc) where archived_at is null;

create table public.automation_rule_versions (
 id uuid primary key default pg_catalog.gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 rule_id uuid not null, version integer not null, name text not null, definition jsonb not null, enabled boolean not null,
 authored_by_user_id uuid references auth.users(id) on delete set null, created_at timestamptz not null default pg_catalog.now(),
 foreign key(rule_id,workspace_id) references public.automation_rules(id,workspace_id) on delete cascade, unique(rule_id,version)
);
create index automation_rule_versions_idx on public.automation_rule_versions(workspace_id,rule_id,version desc);

create table public.automation_executions (
 id uuid primary key default pg_catalog.gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 rule_id uuid not null, campaign_id uuid not null, source_analytics_id uuid not null, rule_version integer not null, campaign_revision integer not null,
 trigger_type text not null, idempotency_key uuid not null, condition_result jsonb not null, input_snapshot jsonb not null,
 matched boolean not null, proposed_action jsonb, lifecycle_status text not null, version integer not null default 1,
 error_code text, reviewer_user_id uuid references auth.users(id) on delete set null, decision_comments text not null default '', decided_at timestamptz,
 created_at timestamptz not null default pg_catalog.now(), updated_at timestamptz not null default pg_catalog.now(),
 foreign key(rule_id,workspace_id) references public.automation_rules(id,workspace_id) on delete cascade,
 foreign key(campaign_id,workspace_id) references public.campaigns(id,workspace_id) on delete cascade,
 foreign key(source_analytics_id,campaign_id,workspace_id) references public.demo_campaign_analytics(id,campaign_id,workspace_id) on delete cascade,
 constraint automation_execution_trigger check (trigger_type in ('manual','demo_metrics_updated','new_demo_snapshot','campaign_draft_updated','approval_state_changed')),
 constraint automation_execution_status check (lifecycle_status in ('evaluated','awaiting_approval','approved','rejected','applied','failed','skipped','stale')),
 constraint automation_execution_payload check (pg_catalog.jsonb_typeof(condition_result)='array' and pg_catalog.jsonb_typeof(input_snapshot)='object' and (proposed_action is null or pg_catalog.jsonb_typeof(proposed_action)='object')),
 constraint automation_execution_comments check (pg_catalog.char_length(decision_comments)<=2000), unique(workspace_id,idempotency_key)
);
create index automation_executions_recent_idx on public.automation_executions(workspace_id,created_at desc);
create index automation_executions_rule_idx on public.automation_executions(workspace_id,rule_id,created_at desc);

create table public.optimization_activity (
 id uuid primary key default pg_catalog.gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 campaign_id uuid, actor_user_id uuid references auth.users(id) on delete set null, event_type text not null,
 details jsonb not null default '{}'::jsonb, created_at timestamptz not null default pg_catalog.now(),
 foreign key(campaign_id,workspace_id) references public.campaigns(id,workspace_id) on delete cascade,
 constraint optimization_activity_details_object check (pg_catalog.jsonb_typeof(details)='object')
);
create index optimization_activity_recent_idx on public.optimization_activity(workspace_id,created_at desc);

create table public.workspace_notifications (
 id uuid primary key default pg_catalog.gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 recipient_user_id uuid not null references auth.users(id) on delete cascade, campaign_id uuid,
 notification_type text not null, title text not null, body text not null, href text, dedupe_key text not null,
 read_at timestamptz, dismissed_at timestamptz, created_at timestamptz not null default pg_catalog.now(),
 foreign key(campaign_id,workspace_id) references public.campaigns(id,workspace_id) on delete cascade,
 constraint workspace_notification_type check (notification_type in ('optimization_opportunity','rule_execution','rule_failed','approval_required','recommendation_decision','campaign_review','demo_threshold')),
 constraint workspace_notification_title check (pg_catalog.char_length(title) between 1 and 160),
 constraint workspace_notification_body check (pg_catalog.char_length(body) between 1 and 1000),
 constraint workspace_notification_local_href check (href is null or (pg_catalog.left(href,5)='/app/' and pg_catalog.strpos(href,'://')=0)),
 unique(workspace_id,recipient_user_id,dedupe_key)
);
create index workspace_notifications_recipient_recent_idx on public.workspace_notifications(workspace_id,recipient_user_id,created_at desc);

create or replace function tandem_internal.safe_nonnegative_numeric(p_value text)
returns numeric language plpgsql immutable set search_path = '' as $$
begin
 if p_value is null or p_value !~ '^[0-9]+(\.[0-9]+)?$' then return null; end if;
 if p_value::numeric > 10000000 then return null; end if;
 return p_value::numeric;
exception when others then return null;
end; $$;

create or replace function tandem_internal.automation_rule_definition_is_valid(p_definition jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare c jsonb; pct numeric;
begin
 if pg_catalog.jsonb_typeof(p_definition)<>'object' or p_definition->>'version'<>'1'
  or p_definition->>'trigger' not in ('manual','demo_metrics_updated','new_demo_snapshot','campaign_draft_updated','approval_state_changed')
  or p_definition->>'conditionLogic' not in ('all','any')
  or p_definition->>'action' not in ('create_recommendation','create_review_task','flag_campaign','propose_demo_budget','suggest_creative_variation','append_activity')
  or pg_catalog.jsonb_typeof(p_definition->'approvalRequired')<>'boolean'
  or pg_catalog.jsonb_typeof(p_definition->'conditions')<>'array'
  or pg_catalog.jsonb_array_length(p_definition->'conditions') not between 1 and 8 then return false; end if;
 for c in select value from pg_catalog.jsonb_array_elements(p_definition->'conditions') loop
  if pg_catalog.jsonb_typeof(c)<>'object' or c->>'metric' not in ('ctr','cpc','cpm','cpa','roas','conversions','spend','impressions','clicks','budget_utilization')
    or c->>'operator' not in ('lt','lte','eq','gte','gt') or tandem_internal.safe_nonnegative_numeric(c->>'threshold') is null then return false; end if;
 end loop;
 if p_definition->>'action'='propose_demo_budget' then
  pct:=tandem_internal.safe_nonnegative_numeric(p_definition->>'budgetAdjustmentPercent');
  if pct is null or pct>50 then return false; end if;
 end if;
 return true;
exception when others then return false;
end; $$;
revoke all on function tandem_internal.safe_nonnegative_numeric(text) from public,anon,authenticated,service_role;
revoke all on function tandem_internal.automation_rule_definition_is_valid(jsonb) from public,anon,authenticated,service_role;

create or replace function tandem_internal.notify_workspace_members(p_workspace_id uuid,p_campaign_id uuid,p_type text,p_title text,p_body text,p_href text,p_key text,p_roles text[] default array['owner','admin']::text[])
returns void language plpgsql security definer set search_path = '' as $$
declare m record;
begin
 for m in select user_id from public.workspace_memberships where workspace_id=p_workspace_id and role=any(p_roles) loop
  insert into public.workspace_notifications(workspace_id,recipient_user_id,campaign_id,notification_type,title,body,href,dedupe_key)
  values(p_workspace_id,m.user_id,p_campaign_id,p_type,p_title,p_body,p_href,p_key||':'||m.user_id::text)
  on conflict(workspace_id,recipient_user_id,dedupe_key) do nothing;
 end loop;
end; $$;
revoke all on function tandem_internal.notify_workspace_members(uuid,uuid,text,text,text,text,text,text[]) from public,anon,authenticated,service_role;

create or replace function public.create_optimization_recommendation(p_workspace_id uuid,p_campaign_id uuid,p_analytics_id uuid,p_type text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid:=(select auth.uid()); c public.campaigns; a public.demo_campaign_analytics; r public.optimization_recommendations;
begin
 if actor is null or not tandem_internal.has_workspace_role(p_workspace_id,array['owner','admin','editor']::text[]) then raise exception using errcode='42501',message='Optimization permission is required.'; end if;
 select * into c from public.campaigns where id=p_campaign_id and workspace_id=p_workspace_id for update;
 if not found or c.lifecycle_status<>'demo_published' or c.published_externally then raise exception using errcode='22023',message='Only demo-published campaigns can be analyzed.'; end if;
 select * into a from public.demo_campaign_analytics where id=p_analytics_id and campaign_id=p_campaign_id and workspace_id=p_workspace_id;
 if not found or a.data_source<>'demo_simulation' or a.metrics->>'label'<>'Simulated Data — Not Actual Ad Performance' then raise exception using errcode='22023',message='Stored simulated metrics are required.'; end if;
 if p_type not in ('review_low_ctr','spend_without_conversions','low_demo_budget_utilization','simulated_ctr_decline','automation_rule_match') then raise exception using errcode='22023',message='Recommendation type is not supported.'; end if;
 insert into public.optimization_recommendations(workspace_id,campaign_id,source_analytics_id,campaign_revision,recommendation_type,dedupe_key,created_by_user_id)
 values(p_workspace_id,p_campaign_id,p_analytics_id,c.revision,p_type,p_analytics_id::text||':'||p_type,actor)
 on conflict(workspace_id,campaign_id,dedupe_key) do update set dedupe_key=excluded.dedupe_key returning * into r;
 insert into public.optimization_activity(workspace_id,campaign_id,actor_user_id,event_type,details) values(p_workspace_id,p_campaign_id,actor,'recommendation_created',pg_catalog.jsonb_build_object('recommendation_id',r.id,'type',p_type,'analytics_id',p_analytics_id));
 perform tandem_internal.notify_workspace_members(p_workspace_id,p_campaign_id,'optimization_opportunity','Optimization review available','A rule-based recommendation is ready to inspect.','/app/optimization/recommendations','recommendation:'||r.id::text);
 return pg_catalog.to_jsonb(r);
end; $$;

create or replace function public.transition_optimization_recommendation(p_id uuid,p_expected_version integer,p_action text,p_comments text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid:=(select auth.uid()); r public.optimization_recommendations; c public.campaigns; next_status text;
begin
 select * into r from public.optimization_recommendations where id=p_id for update;
 if not found or actor is null or not tandem_internal.has_workspace_role(r.workspace_id,null::text[]) then raise exception using errcode='P0002',message='Recommendation was not found.'; end if;
 if r.version<>p_expected_version then raise exception using errcode='40001',message='Recommendation changed; reload the current version.'; end if;
 if pg_catalog.char_length(coalesce(p_comments,''))>2000 then raise exception using errcode='22023',message='Decision comments are too long.'; end if;
 if p_action in ('approve','reject','apply_demo') and not tandem_internal.has_workspace_role(r.workspace_id,array['owner','admin']::text[]) then raise exception using errcode='42501',message='Owner or admin approval is required.'; end if;
 if p_action in ('review','dismiss') and not tandem_internal.has_workspace_role(r.workspace_id,array['owner','admin','editor']::text[]) then raise exception using errcode='42501',message='Workspace optimization permission is required.'; end if;
 select * into c from public.campaigns where id=r.campaign_id and workspace_id=r.workspace_id;
 if c.revision<>r.campaign_revision and r.lifecycle_status not in ('applied_to_demo','rejected','dismissed','superseded') then
  update public.optimization_recommendations set lifecycle_status='superseded',version=version+1,updated_at=pg_catalog.now() where id=r.id returning * into r; return pg_catalog.to_jsonb(r); end if;
 next_status:=case p_action when 'review' then 'reviewed' when 'approve' then 'approved' when 'reject' then 'rejected' when 'dismiss' then 'dismissed' when 'apply_demo' then 'applied_to_demo' else null end;
 if next_status is null or not ((r.lifecycle_status='new' and next_status in ('reviewed','dismissed')) or (r.lifecycle_status='reviewed' and next_status in ('approved','rejected','dismissed')) or (r.lifecycle_status='approved' and next_status='applied_to_demo')) then raise exception using errcode='22023',message='Recommendation transition is invalid.'; end if;
 update public.optimization_recommendations set lifecycle_status=next_status,version=version+1,reviewer_user_id=case when p_action in ('approve','reject') then actor else reviewer_user_id end,decision_comments=coalesce(p_comments,''),decided_at=case when p_action in ('approve','reject') then pg_catalog.now() else decided_at end,applied_at=case when p_action='apply_demo' then pg_catalog.now() else applied_at end,updated_at=pg_catalog.now() where id=r.id returning * into r;
 if p_action='apply_demo' then
  insert into public.campaign_activity(workspace_id,campaign_id,event_type,actor_user_id,details) values(r.workspace_id,r.campaign_id,'optimization_demo_action',actor,pg_catalog.jsonb_build_object('recommendation_id',r.id,'type',r.recommendation_type,'provider_action',false));
  insert into public.optimization_activity(workspace_id,campaign_id,actor_user_id,event_type,details) values(r.workspace_id,r.campaign_id,actor,'recommendation_applied_to_demo',pg_catalog.jsonb_build_object('recommendation_id',r.id));
 end if;
 return pg_catalog.to_jsonb(r);
end; $$;

create or replace function public.create_optimization_scenario(p_workspace_id uuid,p_campaign_id uuid,p_analytics_id uuid,p_name text,p_proposed_budget numeric,p_adjustment text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid:=(select auth.uid()); c public.campaigns; a public.demo_campaign_analytics; s public.optimization_scenarios;
begin
 if actor is null or not tandem_internal.has_workspace_role(p_workspace_id,array['owner','admin','editor']::text[]) then raise exception using errcode='42501',message='Optimization permission is required.'; end if;
 select * into c from public.campaigns where id=p_campaign_id and workspace_id=p_workspace_id and lifecycle_status='demo_published' and published_externally=false for update;
 if not found then raise exception using errcode='P0002',message='Demo-published campaign was not found.'; end if;
 select * into a from public.demo_campaign_analytics where id=p_analytics_id and campaign_id=p_campaign_id and workspace_id=p_workspace_id;
 if not found or a.data_source<>'demo_simulation' then raise exception using errcode='22023',message='Stored simulated metrics are required.'; end if;
 if pg_catalog.char_length(pg_catalog.btrim(p_name)) not between 1 and 120 or p_proposed_budget not between 0.01 and 10000000 or p_adjustment not in ('absolute','percentage') then raise exception using errcode='22023',message='Budget scenario input is invalid.'; end if;
 insert into public.optimization_scenarios(workspace_id,campaign_id,source_analytics_id,campaign_revision,scenario_name,budget_type,currency,current_budget,proposed_budget,adjustment_type,created_by_user_id)
 values(p_workspace_id,p_campaign_id,p_analytics_id,c.revision,pg_catalog.btrim(p_name),coalesce(c.brief->>'budgetType','daily'),c.brief->>'currency',(c.brief->>'budgetAmount')::numeric,p_proposed_budget,p_adjustment,actor) returning * into s;
 insert into public.optimization_activity(workspace_id,campaign_id,actor_user_id,event_type,details) values(p_workspace_id,p_campaign_id,actor,'budget_scenario_created',pg_catalog.jsonb_build_object('scenario_id',s.id,'version',s.version));
 return pg_catalog.to_jsonb(s);
end; $$;

create or replace function public.transition_optimization_scenario(p_id uuid,p_expected_version integer,p_action text,p_comments text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid:=(select auth.uid()); s public.optimization_scenarios; c public.campaigns; next_status text; prior_revision integer;
begin
 select * into s from public.optimization_scenarios where id=p_id for update;
 if not found or actor is null or not tandem_internal.has_workspace_role(s.workspace_id,null::text[]) then raise exception using errcode='P0002',message='Budget scenario was not found.'; end if;
 if s.version<>p_expected_version then raise exception using errcode='40001',message='Budget scenario changed; reload the current version.'; end if;
 if pg_catalog.char_length(coalesce(p_comments,''))>2000 then raise exception using errcode='22023',message='Decision comments are too long.'; end if;
 if p_action in ('approve','reject','apply') and not tandem_internal.has_workspace_role(s.workspace_id,array['owner','admin']::text[]) then raise exception using errcode='42501',message='Owner or admin approval is required.'; end if;
 if p_action='submit' and not tandem_internal.has_workspace_role(s.workspace_id,array['owner','admin','editor']::text[]) then raise exception using errcode='42501',message='Workspace optimization permission is required.'; end if;
 select * into c from public.campaigns where id=s.campaign_id and workspace_id=s.workspace_id for update;
 if p_action='apply' and c.revision<>s.campaign_revision then update public.optimization_scenarios set lifecycle_status='stale',version=version+1,updated_at=pg_catalog.now() where id=s.id returning * into s; return pg_catalog.to_jsonb(s); end if;
 next_status:=case p_action when 'submit' then 'needs_approval' when 'approve' then 'approved' when 'reject' then 'rejected' when 'apply' then 'applied' else null end;
 if next_status is null or not ((s.lifecycle_status='draft' and next_status='needs_approval') or (s.lifecycle_status='needs_approval' and next_status in ('approved','rejected')) or (s.lifecycle_status='approved' and next_status='applied')) then raise exception using errcode='22023',message='Budget scenario transition is invalid.'; end if;
 if p_action='apply' then
  prior_revision:=c.revision;
  update public.campaigns set brief=pg_catalog.jsonb_set(brief,'{budgetAmount}',pg_catalog.to_jsonb(s.proposed_budget),true),revision=revision+1,approved_revision=null,lifecycle_status='generated_simulation',updated_by_user_id=actor,updated_at=pg_catalog.now() where id=c.id and workspace_id=c.workspace_id returning * into c;
  insert into public.campaign_revisions(workspace_id,campaign_id,revision,name,objective,brief,plan,changed_by_user_id) values(c.workspace_id,c.id,c.revision,c.name,c.objective,c.brief,c.plan,actor);
  insert into public.campaign_activity(workspace_id,campaign_id,event_type,actor_user_id,details) values(c.workspace_id,c.id,'demo_budget_scenario_applied',actor,pg_catalog.jsonb_build_object('scenario_id',s.id,'previous_revision',prior_revision,'new_revision',c.revision,'currency',s.currency,'published_externally',false));
  insert into public.optimization_activity(workspace_id,campaign_id,actor_user_id,event_type,details) values(s.workspace_id,s.campaign_id,actor,'budget_scenario_applied',pg_catalog.jsonb_build_object('scenario_id',s.id,'campaign_revision',c.revision));
 end if;
 update public.optimization_scenarios set lifecycle_status=next_status,version=version+1,approver_user_id=case when p_action in ('approve','reject') then actor else approver_user_id end,decision_comments=coalesce(p_comments,''),approved_at=case when p_action='approve' then pg_catalog.now() else approved_at end,applied_at=case when p_action='apply' then pg_catalog.now() else applied_at end,updated_at=pg_catalog.now() where id=s.id returning * into s;
 return pg_catalog.to_jsonb(s);
end; $$;

create or replace function public.save_automation_rule(p_workspace_id uuid,p_rule_id uuid,p_expected_version integer,p_name text,p_definition jsonb,p_enabled boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid:=(select auth.uid()); r public.automation_rules;
begin
 if actor is null or not tandem_internal.has_workspace_role(p_workspace_id,array['owner','admin','editor']::text[]) then raise exception using errcode='42501',message='Automation permission is required.'; end if;
 if not tandem_internal.automation_rule_definition_is_valid(p_definition) or pg_catalog.char_length(pg_catalog.btrim(p_name)) not between 1 and 120 then raise exception using errcode='22023',message='Automation rule definition is invalid.'; end if;
 if p_rule_id is null then
  insert into public.automation_rules(workspace_id,name,definition,enabled,created_by_user_id,updated_by_user_id) values(p_workspace_id,pg_catalog.btrim(p_name),p_definition,p_enabled,actor,actor) returning * into r;
 else
  select * into r from public.automation_rules where id=p_rule_id and workspace_id=p_workspace_id for update;
  if not found then raise exception using errcode='P0002',message='Automation rule was not found.'; end if;
  if r.version<>p_expected_version then raise exception using errcode='40001',message='Automation rule changed; reload the latest version.'; end if;
  update public.automation_rules set name=pg_catalog.btrim(p_name),definition=p_definition,enabled=p_enabled,version=version+1,updated_by_user_id=actor,updated_at=pg_catalog.now() where id=r.id returning * into r;
 end if;
 insert into public.automation_rule_versions(workspace_id,rule_id,version,name,definition,enabled,authored_by_user_id) values(r.workspace_id,r.id,r.version,r.name,r.definition,r.enabled,actor);
 insert into public.optimization_activity(workspace_id,actor_user_id,event_type,details) values(p_workspace_id,actor,'automation_rule_saved',pg_catalog.jsonb_build_object('rule_id',r.id,'version',r.version,'enabled',r.enabled));
 return pg_catalog.to_jsonb(r);
end; $$;

create or replace function public.execute_automation_rule(p_workspace_id uuid,p_rule_id uuid,p_campaign_id uuid,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 actor uuid:=(select auth.uid()); r public.automation_rules; c public.campaigns; a public.demo_campaign_analytics; old public.automation_executions; x public.automation_executions;
 day_item jsonb; condition jsonb; chosen jsonb; cond_results jsonb:='[]'::jsonb; metric_doc jsonb; field_name text; actual numeric; threshold numeric; op text; cond_ok boolean; n_total integer:=0; n_matched integer:=0; use_all boolean; did_match boolean; ask_approval boolean; action_doc jsonb;
 impressions numeric:=0; clicks numeric:=0; conversions numeric:=0; spend numeric:=0; rev numeric:=0; has_rev boolean:=false; days_count integer:=0; ctr_value numeric; cpc_value numeric; cpm_value numeric; cpa_value numeric; roas_value numeric; util_value numeric; current_budget numeric; new_budget numeric;
begin
 if actor is null or not tandem_internal.has_workspace_role(p_workspace_id,array['owner','admin','editor']::text[]) then raise exception using errcode='42501',message='Automation permission is required.'; end if;
 select * into old from public.automation_executions where workspace_id=p_workspace_id and idempotency_key=p_idempotency_key;
 if found then return pg_catalog.to_jsonb(old); end if;
 select * into r from public.automation_rules where id=p_rule_id and workspace_id=p_workspace_id and archived_at is null for update;
 if not found or not r.enabled then raise exception using errcode='P0002',message='Enabled automation rule was not found.'; end if;
 if not tandem_internal.automation_rule_definition_is_valid(r.definition) or r.definition->>'trigger'<>'manual' then raise exception using errcode='22023',message='This trigger is not available for manual evaluation.'; end if;
 select * into c from public.campaigns where id=p_campaign_id and workspace_id=p_workspace_id and lifecycle_status='demo_published' and published_externally=false;
 if not found then raise exception using errcode='P0002',message='Demo-published campaign was not found.'; end if;
 select * into a from public.demo_campaign_analytics where workspace_id=p_workspace_id and campaign_id=p_campaign_id order by simulated_at desc limit 1;
 if not found or a.data_source<>'demo_simulation' or a.metrics->>'label'<>'Simulated Data — Not Actual Ad Performance' or pg_catalog.jsonb_typeof(a.metrics->'days')<>'array' then raise exception using errcode='22023',message='Stored simulated metrics are required.'; end if;
 select coalesce(pg_catalog.jsonb_agg(v.value order by v.ordinality desc),'[]'::jsonb) into chosen from pg_catalog.jsonb_array_elements(a.metrics->'days') with ordinality v(value,ordinality) where v.ordinality>(select greatest(0,pg_catalog.count(*)-7) from pg_catalog.jsonb_array_elements(a.metrics->'days'));
 for day_item in select value from pg_catalog.jsonb_array_elements(chosen) loop
  impressions:=impressions+coalesce(tandem_internal.safe_nonnegative_numeric(day_item->>'impressions'),0);
  clicks:=clicks+coalesce(tandem_internal.safe_nonnegative_numeric(day_item->>'clicks'),0);
  conversions:=conversions+coalesce(tandem_internal.safe_nonnegative_numeric(day_item->>'conversions'),0);
  spend:=spend+coalesce(tandem_internal.safe_nonnegative_numeric(day_item->>'spend'),0);
  if tandem_internal.safe_nonnegative_numeric(day_item->>'roas') is not null and tandem_internal.safe_nonnegative_numeric(day_item->>'spend')>0 then rev:=rev+(day_item->>'roas')::numeric*(day_item->>'spend')::numeric; has_rev:=true; end if;
  days_count:=days_count+1;
 end loop;
 ctr_value:=case when impressions>0 then clicks/impressions*100 end; cpc_value:=case when clicks>0 then spend/clicks end; cpm_value:=case when impressions>0 then spend/impressions*1000 end; cpa_value:=case when conversions>0 then spend/conversions end; roas_value:=case when has_rev and spend>0 then rev/spend end;
 current_budget:=tandem_internal.safe_nonnegative_numeric(c.brief->>'budgetAmount');
 util_value:=case when current_budget>0 and coalesce(c.brief->>'budgetType','daily')='daily' then spend/(current_budget*greatest(days_count,1))*100 when current_budget>0 then spend/current_budget*100 end;
 metric_doc:=pg_catalog.jsonb_build_object('ctr',ctr_value,'cpc',cpc_value,'cpm',cpm_value,'cpa',cpa_value,'roas',roas_value,'conversions',conversions,'spend',spend,'impressions',impressions,'clicks',clicks,'budget_utilization',util_value,'currency',c.brief->>'currency','days',days_count,'label','Simulated Data — Not Actual Ad Performance');
 use_all:=r.definition->>'conditionLogic'='all';
 for condition in select value from pg_catalog.jsonb_array_elements(r.definition->'conditions') loop
  field_name:=condition->>'metric'; actual:=tandem_internal.safe_nonnegative_numeric(metric_doc->>field_name); threshold:=(condition->>'threshold')::numeric; op:=condition->>'operator'; cond_ok:=false;
  if actual is not null then cond_ok:=case op when 'lt' then actual<threshold when 'lte' then actual<=threshold when 'eq' then actual=threshold when 'gte' then actual>=threshold when 'gt' then actual>threshold else false end; end if;
  n_total:=n_total+1; if cond_ok then n_matched:=n_matched+1; end if;
  cond_results:=cond_results||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('metric',field_name,'operator',op,'threshold',threshold,'observed',actual,'matched',cond_ok));
 end loop;
 did_match:=case when use_all then n_matched=n_total else n_matched>0 end;
 ask_approval:=coalesce((r.definition->>'approvalRequired')::boolean,true) or r.definition->>'action'='propose_demo_budget';
 if did_match and r.definition->>'action'='propose_demo_budget' then
  new_budget:=pg_catalog.round(current_budget*(1-(r.definition->>'budgetAdjustmentPercent')::numeric/100),2);
  if new_budget<=0 then raise exception using errcode='22023',message='Proposed demo budget must remain positive.'; end if;
  action_doc:=pg_catalog.jsonb_build_object('action','set_demo_budget','currentBudget',current_budget,'proposedBudget',new_budget,'currency',c.brief->>'currency','campaignRevision',c.revision,'publishedExternally',false);
 elsif did_match then action_doc:=pg_catalog.jsonb_build_object('action',r.definition->>'action','campaignRevision',c.revision,'publishedExternally',false); end if;
 insert into public.automation_executions(workspace_id,rule_id,campaign_id,source_analytics_id,rule_version,campaign_revision,trigger_type,idempotency_key,condition_result,input_snapshot,matched,proposed_action,lifecycle_status)
 values(p_workspace_id,r.id,c.id,a.id,r.version,c.revision,'manual',p_idempotency_key,cond_results,pg_catalog.jsonb_build_object('metrics',metric_doc,'analytics_id',a.id,'label','Simulated Data — Not Actual Ad Performance'),did_match,action_doc,case when not did_match then 'evaluated' when ask_approval then 'awaiting_approval' else 'applied' end) returning * into x;
 if did_match then
  insert into public.optimization_activity(workspace_id,campaign_id,actor_user_id,event_type,details) values(p_workspace_id,c.id,actor,'automation_rule_matched',pg_catalog.jsonb_build_object('execution_id',x.id,'rule_id',r.id,'version',r.version));
  if ask_approval then perform tandem_internal.notify_workspace_members(p_workspace_id,c.id,'approval_required','Automation action requires approval','A rule matched stored demo metrics and is awaiting an owner/admin decision.','/app/automation/executions','automation-approval:'||x.id::text); end if;
 end if;
 return pg_catalog.to_jsonb(x);
end; $$;

create or replace function public.decide_automation_execution(p_id uuid,p_expected_version integer,p_expected_rule_version integer,p_decision text,p_comments text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid:=(select auth.uid()); x public.automation_executions; r public.automation_rules; c public.campaigns; next_status text; previous_revision integer;
begin
 select * into x from public.automation_executions where id=p_id for update;
 if not found or actor is null or not tandem_internal.has_workspace_role(x.workspace_id,array['owner','admin']::text[]) then raise exception using errcode='42501',message='Owner or admin approval is required.'; end if;
 if x.version<>p_expected_version or x.rule_version<>p_expected_rule_version then raise exception using errcode='40001',message='Execution or rule changed; reload the latest version.'; end if;
 if pg_catalog.char_length(coalesce(p_comments,''))>2000 then raise exception using errcode='22023',message='Decision comments are too long.'; end if;
 select * into r from public.automation_rules where id=x.rule_id and workspace_id=x.workspace_id;
 select * into c from public.campaigns where id=x.campaign_id and workspace_id=x.workspace_id for update;
 if c.revision<>x.campaign_revision or r.version<>x.rule_version then update public.automation_executions set lifecycle_status='stale',version=version+1,updated_at=pg_catalog.now() where id=x.id returning * into x; return pg_catalog.to_jsonb(x); end if;
 if p_decision='approve' and x.lifecycle_status='awaiting_approval' then next_status:='approved';
 elsif p_decision='reject' and x.lifecycle_status='awaiting_approval' then next_status:='rejected';
 elsif p_decision='apply' and x.lifecycle_status='approved' then next_status:='applied';
 else raise exception using errcode='22023',message='Automation execution transition is invalid.'; end if;
 if p_decision='apply' then
  if x.proposed_action->>'action'='set_demo_budget' then
   previous_revision:=c.revision;
   update public.campaigns set brief=pg_catalog.jsonb_set(brief,'{budgetAmount}',x.proposed_action->'proposedBudget',true),revision=revision+1,approved_revision=null,lifecycle_status='generated_simulation',updated_by_user_id=actor,updated_at=pg_catalog.now() where id=c.id and workspace_id=c.workspace_id returning * into c;
   insert into public.campaign_revisions(workspace_id,campaign_id,revision,name,objective,brief,plan,changed_by_user_id) values(c.workspace_id,c.id,c.revision,c.name,c.objective,c.brief,c.plan,actor);
   insert into public.campaign_activity(workspace_id,campaign_id,event_type,actor_user_id,details) values(c.workspace_id,c.id,'automation_demo_budget_applied',actor,pg_catalog.jsonb_build_object('execution_id',x.id,'prior_revision',previous_revision,'new_revision',c.revision,'published_externally',false));
  end if;
  insert into public.optimization_activity(workspace_id,campaign_id,actor_user_id,event_type,details) values(x.workspace_id,x.campaign_id,actor,'automation_action_applied',pg_catalog.jsonb_build_object('execution_id',x.id,'action',x.proposed_action->>'action','published_externally',false));
 end if;
 update public.automation_executions set lifecycle_status=next_status,version=version+1,reviewer_user_id=actor,decision_comments=coalesce(p_comments,''),decided_at=pg_catalog.now(),updated_at=pg_catalog.now() where id=x.id returning * into x;
 if p_decision='reject' then perform tandem_internal.notify_workspace_members(x.workspace_id,x.campaign_id,'recommendation_decision','Automation action rejected',coalesce(nullif(p_comments,''),'The local proposal was rejected.'),'/app/automation/executions','automation-rejection:'||x.id::text,array['owner','admin','editor']::text[]); end if;
 return pg_catalog.to_jsonb(x);
end; $$;

create or replace function public.update_workspace_notification(p_id uuid,p_action text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid:=(select auth.uid()); n public.workspace_notifications;
begin
 select * into n from public.workspace_notifications where id=p_id and recipient_user_id=actor for update;
 if not found or actor is null or not tandem_internal.has_workspace_role(n.workspace_id,null::text[]) then raise exception using errcode='P0002',message='Notification was not found.'; end if;
 if p_action not in ('read','unread','dismiss') then raise exception using errcode='22023',message='Notification action is invalid.'; end if;
 update public.workspace_notifications set read_at=case when p_action='read' then pg_catalog.now() when p_action='unread' then null else read_at end,dismissed_at=case when p_action='dismiss' then pg_catalog.now() else dismissed_at end where id=n.id returning * into n;
 return pg_catalog.to_jsonb(n);
end; $$;

alter table public.optimization_recommendations enable row level security;
alter table public.optimization_scenarios enable row level security;
alter table public.automation_rules enable row level security;
alter table public.automation_rule_versions enable row level security;
alter table public.automation_executions enable row level security;
alter table public.optimization_activity enable row level security;
alter table public.workspace_notifications enable row level security;
revoke all on public.optimization_recommendations,public.optimization_scenarios,public.automation_rules,public.automation_rule_versions,public.automation_executions,public.optimization_activity,public.workspace_notifications from public,anon,authenticated,service_role;
grant select on public.optimization_recommendations,public.optimization_scenarios,public.automation_rules,public.automation_rule_versions,public.automation_executions,public.optimization_activity,public.workspace_notifications to authenticated;
grant update (read_at,dismissed_at) on public.workspace_notifications to authenticated;
create policy optimization_recommendations_member_read on public.optimization_recommendations for select to authenticated using (tandem_internal.has_workspace_role(workspace_id,null::text[]));
create policy optimization_scenarios_member_read on public.optimization_scenarios for select to authenticated using (tandem_internal.has_workspace_role(workspace_id,null::text[]));
create policy automation_rules_member_read on public.automation_rules for select to authenticated using (tandem_internal.has_workspace_role(workspace_id,null::text[]));
create policy automation_rule_versions_member_read on public.automation_rule_versions for select to authenticated using (tandem_internal.has_workspace_role(workspace_id,null::text[]));
create policy automation_executions_member_read on public.automation_executions for select to authenticated using (tandem_internal.has_workspace_role(workspace_id,null::text[]));
create policy optimization_activity_member_read on public.optimization_activity for select to authenticated using (tandem_internal.has_workspace_role(workspace_id,null::text[]));
create policy workspace_notifications_recipient_read on public.workspace_notifications for select to authenticated using (recipient_user_id=(select auth.uid()) and tandem_internal.has_workspace_role(workspace_id,null::text[]));
create policy workspace_notifications_recipient_update on public.workspace_notifications for update to authenticated using (recipient_user_id=(select auth.uid()) and tandem_internal.has_workspace_role(workspace_id,null::text[])) with check (recipient_user_id=(select auth.uid()) and tandem_internal.has_workspace_role(workspace_id,null::text[]));

revoke all on function public.create_optimization_recommendation(uuid,uuid,uuid,text) from public,anon,service_role;
revoke all on function public.transition_optimization_recommendation(uuid,integer,text,text) from public,anon,service_role;
revoke all on function public.create_optimization_scenario(uuid,uuid,uuid,text,numeric,text) from public,anon,service_role;
revoke all on function public.transition_optimization_scenario(uuid,integer,text,text) from public,anon,service_role;
revoke all on function public.save_automation_rule(uuid,uuid,integer,text,jsonb,boolean) from public,anon,service_role;
revoke all on function public.execute_automation_rule(uuid,uuid,uuid,uuid) from public,anon,service_role;
revoke all on function public.decide_automation_execution(uuid,integer,integer,text,text) from public,anon,service_role;
revoke all on function public.update_workspace_notification(uuid,text) from public,anon,service_role;
grant execute on function public.create_optimization_recommendation(uuid,uuid,uuid,text) to authenticated;
grant execute on function public.transition_optimization_recommendation(uuid,integer,text,text) to authenticated;
grant execute on function public.create_optimization_scenario(uuid,uuid,uuid,text,numeric,text) to authenticated;
grant execute on function public.transition_optimization_scenario(uuid,integer,text,text) to authenticated;
grant execute on function public.save_automation_rule(uuid,uuid,integer,text,jsonb,boolean) to authenticated;
grant execute on function public.execute_automation_rule(uuid,uuid,uuid,uuid) to authenticated;
grant execute on function public.decide_automation_execution(uuid,integer,integer,text,text) to authenticated;
grant execute on function public.update_workspace_notification(uuid,text) to authenticated;

commit;
