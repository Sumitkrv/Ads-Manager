import { createClient } from "@supabase/supabase-js";
import { config, type ApiConfig } from "../config.js";
import { HttpError } from "../errors.js";

export type PlatformAdminRepository = {
  hasCapability(actorId:string,capability:string):Promise<boolean>;
  rpc(name:string,args?:Record<string,unknown>):Promise<unknown>;
  getTourProgress(userId:string):Promise<PlatformTourProgressRecord|null>;
  saveTourProgress(userId:string,stepIndex:number,status:PlatformTourProgressStatus):Promise<PlatformTourProgressRecord>;
};
export type PlatformTourProgressStatus="running"|"skipped"|"completed";
export type PlatformTourProgressRecord={tour_id:"platform-operator";step_index:number;status:PlatformTourProgressStatus;started_at:string;updated_at:string;completed_at:string|null};
export type PlatformAdminRepositoryFactory=(apiConfig?:ApiConfig)=>PlatformAdminRepository|null;
export type WorkspaceSupportRepository={
  create(workspaceId:string,category:string,subject:string,description:string):Promise<unknown>;
  list(workspaceId:string):Promise<unknown>;
  accessRequests(workspaceId:string):Promise<unknown>;
  decide(accessRequestId:string,decision:string):Promise<unknown>;
};

const allowedRpcNames=new Set([
 "platform_admin_has_capability","platform_admin_overview","platform_admin_list_tenants","platform_admin_tenant_detail",
 "platform_admin_list_users","platform_admin_user_detail","platform_admin_usage","platform_admin_audit",
 "platform_admin_set_tenant_status","platform_admin_list_support_cases","platform_admin_support_case_detail","platform_admin_create_support_case",
 "platform_admin_update_support_case","platform_admin_support_access_request","platform_admin_revoke_support_access",
 "platform_admin_settings","platform_admin_update_setting","platform_admin_update_feature_flag",
 "platform_admin_grant_role","platform_admin_revoke_role","platform_admin_health_probe","platform_admin_record_denied_attempt",
]);

function mapError(error:{code?:string}|null):never{
 if(error?.code==="42501")throw new HttpError(403,"platform_capability_required","Your account does not have this platform capability.");
 if(error?.code==="P0002")throw new HttpError(404,"platform_record_not_found","The requested operational record was not found.");
 if(error?.code==="22023"||error?.code==="23514")throw new HttpError(400,"platform_input_invalid","The requested platform operation is invalid.");
 if(error?.code==="40001"||error?.code==="23505")throw new HttpError(409,"platform_operation_conflict","The record changed or this operation was already applied.");
 throw new HttpError(503,"platform_operations_unavailable","Platform operations are temporarily unavailable.");
}

export function createSupabasePlatformAdminRepository(apiConfig:ApiConfig=config):PlatformAdminRepository|null{
 if(!apiConfig.SUPABASE_URL||!apiConfig.SUPABASE_SERVICE_ROLE_KEY)return null;
 // Narrow, named RPC-only wrapper. Never expose this client or generic table access.
 const client=createClient(apiConfig.SUPABASE_URL,apiConfig.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});
 async function rpc(name:string,args:Record<string,unknown>={}):Promise<unknown>{
  if(!allowedRpcNames.has(name))throw new HttpError(500,"platform_rpc_not_allowed","The requested administrative operation is not available.");
  const {data,error}=await client.rpc(name,args);
  if(error)mapError(error);
  return data;
 }
 async function getTourProgress(userId:string):Promise<PlatformTourProgressRecord|null>{
  const {data,error}=await client.from("user_platform_tour_progress").select("tour_id,step_index,status,started_at,updated_at,completed_at").eq("user_id",userId).maybeSingle();
  if(error)mapError(error);
  return data as PlatformTourProgressRecord|null;
 }
 async function saveTourProgress(userId:string,stepIndex:number,status:PlatformTourProgressStatus):Promise<PlatformTourProgressRecord>{
  const existing=await getTourProgress(userId);const now=new Date().toISOString();
  const {data,error}=await client.from("user_platform_tour_progress").upsert({
   user_id:userId,tour_id:"platform-operator",step_index:stepIndex,status,started_at:existing?.started_at??now,
   updated_at:now,completed_at:status==="completed"?now:null,
  },{onConflict:"user_id"}).select("tour_id,step_index,status,started_at,updated_at,completed_at").single();
  if(error)mapError(error);
  return data as PlatformTourProgressRecord;
 }
 return {rpc,getTourProgress,saveTourProgress,hasCapability:async(actorId,capability)=>{
  const result=await rpc("platform_admin_has_capability",{p_user_id:actorId,p_capability:capability});
  return result===true;
 }};
}

export function createWorkspaceSupportRepository(accessToken:string,apiConfig:ApiConfig=config):WorkspaceSupportRepository|null{
 if(!apiConfig.SUPABASE_URL||!apiConfig.SUPABASE_PUBLISHABLE_KEY)return null;
 const client=createClient(apiConfig.SUPABASE_URL,apiConfig.SUPABASE_PUBLISHABLE_KEY,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false},global:{headers:{Authorization:`Bearer ${accessToken}`}}});
 async function rpc(name:string,args:Record<string,unknown>):Promise<unknown>{
  if(!new Set(["workspace_create_support_case","workspace_list_support_cases","workspace_list_support_access_requests","workspace_decide_support_access"]).has(name))throw new HttpError(500,"support_rpc_not_allowed","Support operation is not available.");
  const {data,error}=await client.rpc(name,args);
  if(error)mapError(error);
  return data;
 }
 return {
  create:(workspaceId,category,subject,description)=>rpc("workspace_create_support_case",{p_workspace_id:workspaceId,p_category:category,p_subject:subject,p_description:description}),
  list:(workspaceId)=>rpc("workspace_list_support_cases",{p_workspace_id:workspaceId}),
  accessRequests:(workspaceId)=>rpc("workspace_list_support_access_requests",{p_workspace_id:workspaceId}),
  decide:(accessRequestId,decision)=>rpc("workspace_decide_support_access",{p_access_request_id:accessRequestId,p_decision:decision}),
 };
}

