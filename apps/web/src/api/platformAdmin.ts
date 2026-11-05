import { PlatformTourProgressApiResponseSchema, PlatformTourProgressInputSchema } from "@ai-ads/shared";

const apiBaseUrl=(import.meta.env.VITE_API_BASE_URL??"").replace(/\/+$/,"");
export type PlatformRow=Record<string,unknown>;
export class PlatformAdminApiError extends Error{constructor(readonly status:number,message:string){super(message);this.name="PlatformAdminApiError";}}
async function request<T>(path:string,token:string,init:RequestInit={}):Promise<T>{
 let response:Response;
 try{response=await fetch(apiBaseUrl+path,{...init,cache:"no-store",headers:{Accept:"application/json",Authorization:`Bearer ${token}`,...(init.body?{"Content-Type":"application/json"}:{}),...init.headers}});}
 catch{throw new PlatformAdminApiError(0,"Platform operations could not be reached.");}
 if(!response.ok){let message="Platform operation could not be completed.";try{const body=await response.json() as {error?:{message?:unknown}};if(typeof body.error?.message==="string")message=body.error.message;}catch{/* safe fallback */}throw new PlatformAdminApiError(response.status,message);}
 return await response.json() as T;
}
const query=(values:Record<string,string|number|undefined>)=>{const params=new URLSearchParams();for(const [key,value] of Object.entries(values))if(value!==undefined&&value!=="")params.set(key,String(value));const suffix=params.toString();return suffix?`?${suffix}`:"";};
const json=(method:string,body:unknown):RequestInit=>({method,body:JSON.stringify(body)});
export const getPlatformAdminAccess=(token:string)=>request<{allowed:boolean;capabilities:Record<string,boolean>}>('/api/platform-admin/access',token);
export async function getPlatformTourProgress(token:string){
 return PlatformTourProgressApiResponseSchema.parse(await request<unknown>('/api/platform-admin/tour-progress',token));
}
export async function savePlatformTourProgress(token:string,input:{tourId:'platform-operator';stepIndex:number;status:'running'|'skipped'|'completed'}){
 const validated=PlatformTourProgressInputSchema.parse(input);
 return PlatformTourProgressApiResponseSchema.parse(await request<unknown>('/api/platform-admin/tour-progress',token,json('POST',validated)));
}
export const getPlatformOverview=(token:string)=>request<PlatformRow>('/api/platform-admin/overview',token);
export const getPlatformTenants=(token:string,filters:Record<string,string|number|undefined>)=>request<PlatformRow>(`/api/platform-admin/tenants${query(filters)}`,token);
export const getPlatformTenant=(token:string,id:string)=>request<PlatformRow>(`/api/platform-admin/tenants/${encodeURIComponent(id)}`,token);
export const flagPlatformTenant=(token:string,id:string,reason:string)=>request<PlatformRow>(`/api/platform-admin/tenants/${encodeURIComponent(id)}/flag`,token,json("POST",{reason}));
export const setPlatformTenantStatus=(token:string,id:string,status:string,reason:string)=>request<PlatformRow>(`/api/platform-admin/tenants/${encodeURIComponent(id)}/status`,token,json("POST",{status,reason}));
export const getPlatformUsers=(token:string,filters:Record<string,string|number|undefined>)=>request<PlatformRow>(`/api/platform-admin/users${query(filters)}`,token);
export const getPlatformUser=(token:string,id:string)=>request<PlatformRow>(`/api/platform-admin/users/${encodeURIComponent(id)}`,token);
export const getPlatformUsage=(token:string,filters:Record<string,string|number|undefined>)=>request<PlatformRow>(`/api/platform-admin/usage${query(filters)}`,token);
export const getPlatformHealth=(token:string)=>request<PlatformRow>('/api/platform-admin/health',token);
export const getPlatformAudit=(token:string,filters:Record<string,string|number|undefined>)=>request<PlatformRow>(`/api/platform-admin/audit${query(filters)}`,token);
export const getPlatformSupport=(token:string,filters:Record<string,string|number|undefined>)=>request<PlatformRow>(`/api/platform-admin/support${query(filters)}`,token);
export const getPlatformSupportCase=(token:string,id:string)=>request<PlatformRow>(`/api/platform-admin/support/${encodeURIComponent(id)}`,token);
export const createPlatformSupportCase=(token:string,input:PlatformRow)=>request<PlatformRow>('/api/platform-admin/support',token,json("POST",input));
export const updatePlatformSupportCase=(token:string,id:string,input:PlatformRow)=>request<PlatformRow>(`/api/platform-admin/support/${encodeURIComponent(id)}`,token,json("PATCH",input));
export const requestPlatformSupportAccess=(token:string,id:string,input:PlatformRow)=>request<PlatformRow>(`/api/platform-admin/support/${encodeURIComponent(id)}/access-requests`,token,json("POST",input));
export const revokePlatformSupportAccess=(token:string,id:string,reason:string)=>request<PlatformRow>(`/api/platform-admin/support/access-requests/${encodeURIComponent(id)}/revoke`,token,json("POST",{reason}));
export const getPlatformSettings=(token:string)=>request<PlatformRow>('/api/platform-admin/settings',token);
export const updatePlatformSetting=(token:string,key:string,value:unknown,reason:string)=>request<PlatformRow>(`/api/platform-admin/settings/${encodeURIComponent(key)}`,token,json("PATCH",{value,reason}));
export const updatePlatformFeatureFlag=(token:string,key:string,enabled:boolean,reason:string)=>request<PlatformRow>(`/api/platform-admin/feature-flags/${encodeURIComponent(key)}`,token,json("PATCH",{enabled,reason}));
export const grantPlatformRole=(token:string,userId:string,role:string,reason:string)=>request<PlatformRow>(`/api/platform-admin/users/${encodeURIComponent(userId)}/roles`,token,json("POST",{role,reason}));
export const revokePlatformRole=(token:string,assignmentId:string,reason:string)=>request<PlatformRow>(`/api/platform-admin/roles/${encodeURIComponent(assignmentId)}/revoke`,token,json("POST",{reason}));

export const getWorkspaceSupport=(token:string,workspaceId:string)=>request<{cases:PlatformRow[];accessRequests:PlatformRow[]}>(`/api/workspaces/${encodeURIComponent(workspaceId)}/support/cases`,token);
export const createWorkspaceSupport=(token:string,workspaceId:string,input:PlatformRow)=>request<PlatformRow>(`/api/workspaces/${encodeURIComponent(workspaceId)}/support/cases`,token,json("POST",input));
export const decideWorkspaceSupportAccess=(token:string,workspaceId:string,requestId:string,decision:"APPROVED"|"REJECTED")=>request<PlatformRow>(`/api/workspaces/${encodeURIComponent(workspaceId)}/support/access-requests/${encodeURIComponent(requestId)}/decision`,token,json("POST",{decision}));
