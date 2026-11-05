begin;

create or replace function tandem_internal.automation_rule_definition_is_valid(p_definition jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare c jsonb; pct numeric; action_name text; approval_value boolean;
begin
 if pg_catalog.jsonb_typeof(p_definition)<>'object' or p_definition->>'version'<>'1'
  or p_definition->>'trigger' not in ('manual','demo_metrics_updated','new_demo_snapshot','campaign_draft_updated','approval_state_changed')
  or p_definition->>'conditionLogic' not in ('all','any')
  or p_definition->>'action' not in ('create_recommendation','create_review_task','flag_campaign','propose_demo_budget','suggest_creative_variation','append_activity')
  or pg_catalog.jsonb_typeof(p_definition->'approvalRequired')<>'boolean'
  or pg_catalog.jsonb_typeof(p_definition->'conditions')<>'array'
  or pg_catalog.jsonb_array_length(p_definition->'conditions') not between 1 and 8 then return false; end if;
 action_name:=p_definition->>'action'; approval_value:=(p_definition->>'approvalRequired')::boolean;
 if action_name<>'append_activity' and not approval_value then return false; end if;
 for c in select value from pg_catalog.jsonb_array_elements(p_definition->'conditions') loop
  if pg_catalog.jsonb_typeof(c)<>'object' or c->>'metric' not in ('ctr','cpc','cpm','cpa','roas','conversions','spend','impressions','clicks','budget_utilization')
    or c->>'operator' not in ('lt','lte','eq','gte','gt') or tandem_internal.safe_nonnegative_numeric(c->>'threshold') is null then return false; end if;
 end loop;
 if action_name='propose_demo_budget' then
  pct:=tandem_internal.safe_nonnegative_numeric(p_definition->>'budgetAdjustmentPercent');
  if pct is null or pct<=0 or pct>50 then return false; end if;
 end if;
 return true;
exception when others then return false;
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
 if p_action='submit' then
  perform tandem_internal.notify_workspace_members(s.workspace_id,s.campaign_id,'approval_required','Budget scenario needs review','A demo budget scenario is waiting for an owner/admin decision.','/app/optimization/scenarios','scenario-approval:'||s.id::text);
 elsif p_action in ('approve','reject','apply') and s.created_by_user_id is not null and s.created_by_user_id<>actor then
  insert into public.workspace_notifications(workspace_id,recipient_user_id,campaign_id,notification_type,title,body,href,dedupe_key)
  values(s.workspace_id,s.created_by_user_id,s.campaign_id,'recommendation_decision','Budget scenario updated',case p_action when 'approve' then 'Your scenario was approved.' when 'reject' then coalesce(nullif(p_comments,''),'Your scenario was rejected.') else 'The approved demo budget was applied to a Tandem Ads draft.' end,'/app/optimization/scenarios','scenario-decision:'||s.id::text||':'||p_action)
  on conflict(workspace_id,recipient_user_id,dedupe_key) do nothing;
 end if;
 return pg_catalog.to_jsonb(s);
end; $$;

create or replace function public.decide_automation_execution(p_id uuid,p_expected_version integer,p_expected_rule_version integer,p_decision text,p_comments text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid:=(select auth.uid()); x public.automation_executions; r public.automation_rules; c public.campaigns; next_status text; previous_revision integer; rec public.optimization_recommendations;
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
  elsif x.proposed_action->>'action'='create_recommendation' then
   insert into public.optimization_recommendations(workspace_id,campaign_id,source_analytics_id,campaign_revision,recommendation_type,dedupe_key,created_by_user_id)
   values(x.workspace_id,x.campaign_id,x.source_analytics_id,c.revision,'automation_rule_match','automation-execution:'||x.id::text,actor)
   on conflict(workspace_id,campaign_id,dedupe_key) do update set dedupe_key=excluded.dedupe_key returning * into rec;
   insert into public.optimization_activity(workspace_id,campaign_id,actor_user_id,event_type,details) values(x.workspace_id,x.campaign_id,actor,'automation_recommendation_created',pg_catalog.jsonb_build_object('execution_id',x.id,'recommendation_id',rec.id,'published_externally',false));
   perform tandem_internal.notify_workspace_members(x.workspace_id,x.campaign_id,'optimization_opportunity','Automation recommendation created','An approved rule proposal created a review item from stored simulated metrics.','/app/optimization/recommendations','automation-recommendation:'||rec.id::text);
  elsif x.proposed_action->>'action'='create_review_task' then
   perform tandem_internal.notify_workspace_members(x.workspace_id,x.campaign_id,'campaign_review','Campaign review task','An approved automation rule created an internal campaign review task.','/app/campaigns/'||x.campaign_id::text||'/review','automation-review:'||x.id::text,array['owner','admin','editor']::text[]);
  end if;
  insert into public.optimization_activity(workspace_id,campaign_id,actor_user_id,event_type,details) values(x.workspace_id,x.campaign_id,actor,'automation_action_applied',pg_catalog.jsonb_build_object('execution_id',x.id,'action',x.proposed_action->>'action','published_externally',false));
  insert into public.campaign_activity(workspace_id,campaign_id,event_type,actor_user_id,details) values(x.workspace_id,x.campaign_id,'automation_action_applied',actor,pg_catalog.jsonb_build_object('execution_id',x.id,'action',x.proposed_action->>'action','provider_operation',false));
 elsif p_decision in ('approve','reject') then
  insert into public.optimization_activity(workspace_id,campaign_id,actor_user_id,event_type,details) values(x.workspace_id,x.campaign_id,actor,'automation_action_'||p_decision,pg_catalog.jsonb_build_object('execution_id',x.id,'comments',coalesce(p_comments,'')));
 end if;
 update public.automation_executions set lifecycle_status=next_status,version=version+1,reviewer_user_id=actor,decision_comments=coalesce(p_comments,''),decided_at=pg_catalog.now(),updated_at=pg_catalog.now() where id=x.id returning * into x;
 if p_decision='reject' then perform tandem_internal.notify_workspace_members(x.workspace_id,x.campaign_id,'recommendation_decision','Automation action rejected',coalesce(nullif(p_comments,''),'The local proposal was rejected.'),'/app/automation/executions','automation-rejection:'||x.id::text,array['owner','admin','editor']::text[]); end if;
 return pg_catalog.to_jsonb(x);
end; $$;

commit;
