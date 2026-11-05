begin;

-- The compatibility decision RPC is customer-only and must not be executable
-- by anonymous callers. Decisions remain owner/admin scoped in the function.
revoke all on function public.platform_support_decide_access(uuid,text) from public,anon,service_role;
grant execute on function public.platform_support_decide_access(uuid,text) to authenticated;

create unique index if not exists platform_support_one_pending_access_per_case
  on public.platform_support_access_requests(case_id) where status='PENDING';

create or replace function public.platform_admin_list_support_cases(p_actor uuid,p_page int default 1,p_page_size int default 25,p_status text default null,p_search text default null)
returns jsonb language plpgsql stable security definer set search_path=''
as $$ declare result jsonb; begin
 perform tandem_internal.platform_admin_require(p_actor,'platform.support.manage');
 if p_page<1 or p_page_size not between 1 and 100 then raise exception using errcode='22023',message='Invalid page.'; end if;
 with rows as (
  select c.id,c.workspace_id,w.name workspace_name,c.requester_user_id,u.email requester_email,c.category,c.priority,c.status,c.subject,c.description,c.assigned_to,c.resolution_summary,c.created_at,c.updated_at,
   (select coalesce(jsonb_agg(jsonb_build_object('id',ar.id,'scope_keys',to_jsonb(ar.scope_keys),'reason',ar.reason,'status',ar.status,'requested_by',ar.requested_by,'decided_by',ar.decided_by,'expires_at',ar.expires_at,'created_at',ar.created_at) order by ar.created_at desc),'[]'::jsonb) from public.platform_support_access_requests ar where ar.case_id=c.id) access_requests
  from public.platform_support_cases c left join public.workspaces w on w.id=c.workspace_id left join auth.users u on u.id=c.requester_user_id
  where (p_status is null or c.status=p_status) and (p_search is null or c.subject ilike '%'||left(p_search,120)||'%' or c.id::text ilike '%'||left(p_search,120)||'%')
 ), page_rows as (select * from rows order by case priority when 'urgent' then 1 when 'high' then 2 when 'normal' then 3 else 4 end,updated_at desc limit p_page_size offset (p_page-1)*p_page_size)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(x)) from page_rows x),'[]'::jsonb),'total',(select count(*) from rows),'page',p_page,'page_size',p_page_size) into result;
 return result;
end; $$;

create function public.platform_admin_support_case_detail(p_actor uuid,p_case_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$ declare result jsonb; begin
 perform tandem_internal.platform_admin_require(p_actor,'platform.support.manage');
 select jsonb_build_object('case',jsonb_build_object('id',c.id,'workspace_id',c.workspace_id,'workspace_name',w.name,'requester_user_id',c.requester_user_id,'requester_email',u.email,'category',c.category,'priority',c.priority,'status',c.status,'subject',c.subject,'description',c.description,'assigned_to',c.assigned_to,'resolution_summary',c.resolution_summary,'created_at',c.created_at,'updated_at',c.updated_at),
  'internal_notes',(select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'author_user_id',n.author_user_id,'body',n.body,'created_at',n.created_at) order by n.created_at),'[]'::jsonb) from public.platform_support_internal_notes n where n.case_id=c.id),
  'access_requests',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'scope_keys',to_jsonb(r.scope_keys),'reason',r.reason,'status',r.status,'requested_by',r.requested_by,'decided_by',r.decided_by,'expires_at',r.expires_at,'created_at',r.created_at) order by r.created_at desc),'[]'::jsonb) from public.platform_support_access_requests r where r.case_id=c.id))
 into result from public.platform_support_cases c left join public.workspaces w on w.id=c.workspace_id left join auth.users u on u.id=c.requester_user_id where c.id=p_case_id;
 if result is null then raise exception using errcode='P0002',message='Support case not found.'; end if; return result;
end; $$;

create or replace function public.platform_admin_update_support_case(p_actor uuid,p_case_id uuid,p_status text,p_assigned_to uuid,p_resolution text,p_note text)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare row public.platform_support_cases; begin
 perform tandem_internal.platform_admin_require(p_actor,'platform.support.manage');
 if p_assigned_to is not null and not tandem_internal.platform_admin_has_capability(p_assigned_to,'platform.support.manage') then raise exception using errcode='22023',message='Support assignment target is not an authorized operator.'; end if;
 if p_status not in ('OPEN','IN_PROGRESS','WAITING_ON_CUSTOMER','RESOLVED','CLOSED') or (p_resolution is not null and char_length(p_resolution)>2000) or (p_note is not null and char_length(btrim(p_note)) not between 1 and 4000) then raise exception using errcode='22023',message='Invalid support update.'; end if;
 select * into row from public.platform_support_cases where id=p_case_id for update;
 if not found then raise exception using errcode='P0002',message='Support case not found.'; end if;
 if row.status<>p_status and not ((row.status='OPEN' and p_status in ('IN_PROGRESS','WAITING_ON_CUSTOMER','RESOLVED','CLOSED')) or (row.status='IN_PROGRESS' and p_status in ('OPEN','WAITING_ON_CUSTOMER','RESOLVED','CLOSED')) or (row.status='WAITING_ON_CUSTOMER' and p_status in ('OPEN','IN_PROGRESS','RESOLVED','CLOSED')) or (row.status='RESOLVED' and p_status in ('OPEN','CLOSED')) or (row.status='CLOSED' and p_status='OPEN')) then raise exception using errcode='23514',message='Invalid support status transition.'; end if;
 update public.platform_support_cases set status=p_status,assigned_to=p_assigned_to,resolution_summary=nullif(btrim(coalesce(p_resolution,'')),''),updated_at=now() where id=p_case_id returning * into row;
 if p_note is not null then insert into public.platform_support_internal_notes(case_id,author_user_id,body) values(row.id,p_actor,btrim(p_note)); end if;
 perform tandem_internal.platform_admin_audit(p_actor,'support.case.updated','support_case',row.id::text,'Support case updated',jsonb_build_object('status',p_status));
 return jsonb_build_object('id',row.id,'status',row.status,'assigned_to',row.assigned_to,'updated_at',row.updated_at);
end; $$;

revoke all on function public.platform_admin_list_support_cases(uuid,int,int,text,text),public.platform_admin_support_case_detail(uuid,uuid),public.platform_admin_update_support_case(uuid,uuid,text,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.platform_admin_list_support_cases(uuid,int,int,text,text),public.platform_admin_support_case_detail(uuid,uuid),public.platform_admin_update_support_case(uuid,uuid,text,uuid,text,text) to service_role;

-- Global rollout flags are an additional write guard only. They never grant
-- workspace permissions, plan entitlements, or external provider access.
create function tandem_internal.guard_platform_feature_flag()
returns trigger language plpgsql security definer set search_path=''
as $$ declare v_flag_key text; enabled boolean; begin
 v_flag_key:=case
  when tg_table_name in ('campaigns','campaign_revisions','campaign_reviews','campaign_activity') then 'campaign_studio_enabled'
  when tg_table_name='demo_publish_attempts' then 'demo_publishing_enabled'
  when tg_table_name in ('creative_assets','workspace_brand_kits','creative_projects','creative_project_revisions','creative_project_assets','creative_project_reviews','creative_campaign_links') then 'creative_studio_enabled'
  when tg_table_name in ('optimization_recommendations','optimization_scenarios','optimization_activity') then 'optimization_studio_enabled'
  when tg_table_name in ('automation_rules','automation_rule_versions','automation_executions') then 'automation_studio_enabled'
  when tg_table_name in ('analytics_saved_views','report_definitions','report_revisions','report_exports') then 'advanced_analytics_enabled'
  when tg_table_name in ('agency_profiles','agency_client_relationships','agency_team_assignments','agency_membership_grants','workspace_invitations','client_tasks','client_collaboration_comments','agency_activity_events') then 'agency_portal_enabled'
  else null end;
 if v_flag_key is null then if tg_op='DELETE' then return old; else return new; end if; end if;
 select f.enabled into enabled from public.platform_feature_flags f where f.flag_key=v_flag_key;
 if enabled is distinct from true then raise exception using errcode='55000',message='This workspace feature is temporarily unavailable.'; end if;
 if tg_op='DELETE' then return old; else return new; end if;
end; $$;
revoke all on function tandem_internal.guard_platform_feature_flag() from public,anon,authenticated,service_role;
do $$ declare t text; begin
 foreach t in array array['campaigns','campaign_revisions','campaign_reviews','campaign_activity','demo_publish_attempts','creative_assets','workspace_brand_kits','creative_projects','creative_project_revisions','creative_project_assets','creative_project_reviews','creative_campaign_links','optimization_recommendations','optimization_scenarios','optimization_activity','automation_rules','automation_rule_versions','automation_executions','analytics_saved_views','report_definitions','report_revisions','report_exports','agency_profiles','agency_client_relationships','agency_team_assignments','agency_membership_grants','workspace_invitations','client_tasks','client_collaboration_comments','agency_activity_events'] loop
  execute format('create trigger b_platform_feature_guard before insert or update or delete on public.%I for each row execute function tandem_internal.guard_platform_feature_flag()',t);
 end loop;
end $$;

commit;
