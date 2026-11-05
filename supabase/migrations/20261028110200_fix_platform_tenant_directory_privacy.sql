begin;

-- Internal authorization helpers are only called from narrowly scoped
-- SECURITY DEFINER functions and triggers. Authenticated clients need no
-- direct schema visibility.
revoke usage on schema tandem_internal from public,anon,authenticated;

create or replace function public.platform_admin_list_tenants(
 p_actor uuid,p_page int default 1,p_page_size int default 25,p_search text default null,
 p_industry text default null,p_status text default null,p_plan text default null
)
returns jsonb language plpgsql stable security definer set search_path=''
as $$ declare result jsonb; begin
 perform tandem_internal.platform_admin_require(p_actor,'platform.tenants.read');
 if p_page<1 or p_page_size not between 1 and 100 then raise exception using errcode='22023',message='Invalid page.'; end if;
 with rows as (
  select w.id,w.name,w.industry_key,w.industry_custom_label,w.created_at,
   coalesce(s.status,'ACTIVE') workspace_status,sub.plan_id,sub.status subscription_status,
   coalesce(m.members,0) membership_count,coalesce(c.campaigns,0) campaign_count,
   coalesce(cr.creatives,0) creative_count,coalesce(a.storage_bytes,0) storage_bytes,
   case when ap.agency_workspace_id is not null then 'agency' else 'business' end operating_mode,
   (select max(e.created_at) from public.platform_admin_events e where e.target_type='workspace' and e.target_id=w.id::text) last_admin_activity
  from public.workspaces w
  left join public.platform_tenant_lifecycle s on s.workspace_id=w.id
  left join public.workspace_subscriptions sub on sub.workspace_id=w.id
  left join lateral (select count(*)::bigint members from public.workspace_memberships m0 where m0.workspace_id=w.id) m on true
  left join lateral (select count(*)::bigint campaigns from public.campaigns c0 where c0.workspace_id=w.id) c on true
  left join lateral (select count(*)::bigint creatives from public.creative_projects cr0 where cr0.workspace_id=w.id) cr on true
  left join lateral (select coalesce(sum(size_bytes),0)::bigint storage_bytes from public.creative_assets a0 where a0.workspace_id=w.id) a on true
  left join public.agency_profiles ap on ap.agency_workspace_id=w.id
  where (p_search is null or w.name ilike '%'||left(p_search,120)||'%' or w.id::text ilike '%'||left(p_search,120)||'%')
   and (p_industry is null or w.industry_key=p_industry)
   and (p_status is null or coalesce(s.status,'ACTIVE')=p_status)
   and (p_plan is null or sub.plan_id=p_plan)
 ), page_rows as (select * from rows order by created_at desc,id limit p_page_size offset (p_page-1)*p_page_size)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(x)) from page_rows x),'[]'::jsonb),
  'total',(select count(*) from rows),'page',p_page,'page_size',p_page_size) into result;
 return result;
end; $$;

revoke all on function public.platform_admin_list_tenants(uuid,int,int,text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.platform_admin_list_tenants(uuid,int,int,text,text,text,text) to service_role;

commit;
