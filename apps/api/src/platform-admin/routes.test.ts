import assert from "node:assert/strict";
import {once} from "node:events";
import express,{type ErrorRequestHandler} from "express";
import test from "node:test";
import type {AuthenticatedApiUser,TokenVerifier} from "../auth.js";
import {config} from "../config.js";
import {HttpError} from "../errors.js";
import {createPlatformAdminRouter} from "./routes.js";
import type {PlatformAdminRepository,PlatformTourProgressRecord,PlatformTourProgressStatus} from "./repository.js";
import type {PlatformAdminRouteDependencies} from "./routes.js";

const admin:AuthenticatedApiUser={id:"c1000000-0000-4000-8000-000000000001",email:"ops@example.invalid",emailConfirmedAt:"2026-10-01T00:00:00.000Z",createdAt:"2026-10-01T00:00:00.000Z"};
const regular:AuthenticatedApiUser={...admin,id:"c1000000-0000-4000-8000-000000000002",email:"owner@example.invalid"};
const support:AuthenticatedApiUser={...admin,id:"c1000000-0000-4000-8000-000000000003",email:"support@example.invalid"};
const tokenUsers:Record<string,AuthenticatedApiUser>={admin,regular,support};
const verify:TokenVerifier=async(token)=>tokenUsers[token]?{status:"verified",user:tokenUsers[token]!}:{status:"invalid"};
const workspaceId="c2000000-0000-4000-8000-000000000001";
const caseId="c3000000-0000-4000-8000-000000000001";
const accessId="c4000000-0000-4000-8000-000000000001";

type ApiFixture={repository:PlatformAdminRepository;calls:{name:string;args:Record<string,unknown>}[];tourActors:string[];supportRepositoryFactory:NonNullable<PlatformAdminRouteDependencies["supportRepositoryFactory"]>;supportCalls:string[]};
function fixture():ApiFixture{
 const calls:{name:string;args:Record<string,unknown>}[]=[];
 const tourActors:string[]=[];const tourProgress=new Map<string,PlatformTourProgressRecord>();
 const capabilities:Record<string,string[]>={
  [admin.id]:["platform.dashboard.read","platform.tenants.read","platform.tenants.manage","platform.users.read","platform.support.manage","platform.usage.read","platform.health.read","platform.audit.read","platform.settings.manage","platform.admin.provision"],
  [regular.id]:[],[support.id]:["platform.dashboard.read","platform.support.manage"],
 };
 const repository:PlatformAdminRepository={
  async hasCapability(actor,cap){return (capabilities[actor]??[]).includes(cap);},
  async rpc(name,args={}){calls.push({name,args});if(name==="platform_admin_health_probe")return {database:"HEALTHY",checked_at:"now",source:"probe"};return {ok:true,name};},
  async getTourProgress(userId){tourActors.push(`read:${userId}`);return tourProgress.get(userId)??null;},
  async saveTourProgress(userId,stepIndex,status:PlatformTourProgressStatus){tourActors.push(`write:${userId}`);const now="2026-10-29T12:00:00.000Z";const existing=tourProgress.get(userId);const row:PlatformTourProgressRecord={tour_id:"platform-operator",step_index:stepIndex,status,started_at:existing?.started_at??now,updated_at:now,completed_at:status==="completed"?now:null};tourProgress.set(userId,row);return row;},
 };
 const supportCalls:string[]=[];
 const supportRepositoryFactory=()=>({
  async create(){supportCalls.push("create");return {id:caseId,status:"OPEN"};},
  async list(){supportCalls.push("list");return [{id:caseId,subject:"My ticket"}];},
  async accessRequests(){supportCalls.push("accessRequests");return [{id:accessId,status:"PENDING"}];},
  async decide(id:string,decision:string){supportCalls.push(`decide:${id}:${decision}`);return {id,status:decision,access_granted:false};},
 });
 return {repository,calls,tourActors,supportRepositoryFactory,supportCalls};
}
async function withApi(run:(base:string,fixture:ApiFixture)=>Promise<void>){
 const f=fixture();const app=express();app.use(express.json());app.use(createPlatformAdminRouter({...config,SUPABASE_URL:"http://127.0.0.1:54321",APP_ENV:"development"},verify,{repositoryFactory:()=>f.repository,supportRepositoryFactory:f.supportRepositoryFactory}));
 const errors:ErrorRequestHandler=(error:unknown,_req,res,_next)=>{if(error instanceof HttpError)res.status(error.statusCode).json({error:{code:error.code,message:error.message}});else res.status(500).json({error:{code:"internal_error"}});};app.use(errors);
 const server=app.listen(0,"127.0.0.1");await once(server,"listening");const address=server.address();assert.ok(address&&typeof address!=="string");
 try{await run(`http://127.0.0.1:${address.port}`,f);}finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
}

test("platform admin APIs require an authenticated trusted capability",async()=>withApi(async(base,f)=>{
 assert.equal((await fetch(`${base}/api/platform-admin/overview`)).status,401);
 const denied=await fetch(`${base}/api/platform-admin/tenants`,{headers:{authorization:"Bearer regular"}});
 assert.equal(denied.status,403);assert.equal(f.calls[0]?.name,"platform_admin_record_denied_attempt");
 assert.deepEqual(f.calls[0]?.args,{p_actor:regular.id,p_capability:"platform.tenants.read"});
 const access=await fetch(`${base}/api/platform-admin/access`,{headers:{authorization:"Bearer regular"}});
 assert.equal(access.status,200);assert.equal((await access.json() as {allowed:boolean}).allowed,false);
}));

test("platform operator tour progress is user scoped and requires a trusted capability",async()=>withApi(async(base,f)=>{
 const denied=await fetch(`${base}/api/platform-admin/tour-progress`,{headers:{authorization:"Bearer regular"}});
 assert.equal(denied.status,403);assert.deepEqual(f.tourActors,[]);
 const start=await fetch(`${base}/api/platform-admin/tour-progress`,{method:"POST",headers:{authorization:"Bearer support","content-type":"application/json"},body:JSON.stringify({tourId:"platform-operator",stepIndex:1,status:"running"})});
 assert.equal(start.status,200);assert.deepEqual(f.tourActors,[`write:${support.id}`]);
 const stored=await start.json() as {progress:{tourId:string;stepIndex:number;status:string}};assert.deepEqual(stored.progress,{tourId:"platform-operator",stepIndex:1,status:"running",startedAt:"2026-10-29T12:00:00.000Z",updatedAt:"2026-10-29T12:00:00.000Z",completedAt:null});
 const resume=await fetch(`${base}/api/platform-admin/tour-progress`,{headers:{authorization:"Bearer support"}});assert.equal(resume.status,200);assert.deepEqual(f.tourActors.at(-1),`read:${support.id}`);
 const forged=await fetch(`${base}/api/platform-admin/tour-progress`,{method:"POST",headers:{authorization:"Bearer admin","content-type":"application/json"},body:JSON.stringify({tourId:"platform-operator",stepIndex:1,status:"completed",userId:support.id})});assert.equal(forged.status,400);
}));

test("operator queries are bounded, workspace scoped and pass only verified actor identity",async()=>withApi(async(base,f)=>{
 const response=await fetch(`${base}/api/platform-admin/tenants?page=2&pageSize=50&search=clinic&industry=healthcare_clinics`,{headers:{authorization:"Bearer admin"}});
 assert.equal(response.status,200);assert.equal(f.calls[0]?.name,"platform_admin_list_tenants");
 assert.equal(f.calls[0]?.args.p_actor,admin.id);assert.equal(f.calls[0]?.args.p_page,2);assert.equal(f.calls[0]?.args.p_page_size,50);assert.equal(f.calls[0]?.args.p_search,"clinic");
 const bad=await fetch(`${base}/api/platform-admin/tenants?pageSize=1000`,{headers:{authorization:"Bearer admin"}});assert.equal(bad.status,400);
}));

test("least-privilege support agent cannot read tenants or change settings",async()=>withApi(async(base,f)=>{
 assert.equal((await fetch(`${base}/api/platform-admin/tenants`,{headers:{authorization:"Bearer support"}})).status,403);
 assert.equal((await fetch(`${base}/api/platform-admin/settings`,{headers:{authorization:"Bearer support"}})).status,403);
 const queue=await fetch(`${base}/api/platform-admin/support`,{headers:{authorization:"Bearer support"}});assert.equal(queue.status,200);assert.equal(f.calls.at(-1)?.name,"platform_admin_list_support_cases");
}));

test("platform lifecycle requests validate state and require an audit reason",async()=>withApi(async(base,f)=>{
 const bad=await fetch(`${base}/api/platform-admin/tenants/${workspaceId}/status`,{method:"POST",headers:{authorization:"Bearer admin","content-type":"application/json"},body:JSON.stringify({status:"SUSPENDED",reason:"short"})});assert.equal(bad.status,400);
 const valid=await fetch(`${base}/api/platform-admin/tenants/${workspaceId}/status`,{method:"POST",headers:{authorization:"Bearer admin","content-type":"application/json"},body:JSON.stringify({status:"SUSPENSION_PENDING",reason:"Investigate a reported abuse event"})});assert.equal(valid.status,200);assert.equal(f.calls.at(-1)?.name,"platform_admin_set_tenant_status");
}));

test("support access request records a limited proposal and does not grant content access",async()=>withApi(async(base,f)=>{
 const response=await fetch(`${base}/api/platform-admin/support/${caseId}/access-requests`,{method:"POST",headers:{authorization:"Bearer support","content-type":"application/json"},body:JSON.stringify({scopeKeys:["workspace_metadata","storage_diagnostics"],reason:"Investigate a reported local asset failure"})});
 assert.equal(response.status,201);assert.equal(f.calls.at(-1)?.name,"platform_admin_support_access_request");
 const malformed=await fetch(`${base}/api/platform-admin/support/${caseId}/access-requests`,{method:"POST",headers:{authorization:"Bearer support","content-type":"application/json"},body:JSON.stringify({scopeKeys:["all_customer_content"],reason:"Investigate a private campaign"})});assert.equal(malformed.status,400);
}));

test("workspace support uses the caller session and consent endpoints are explicitly scoped",async()=>withApi(async(base,f)=>{
 const list=await fetch(`${base}/api/workspaces/${workspaceId}/support/cases`,{headers:{authorization:"Bearer regular"}});assert.equal(list.status,200);assert.deepEqual(f.supportCalls,["list","accessRequests"]);
 const create=await fetch(`${base}/api/workspaces/${workspaceId}/support/cases`,{method:"POST",headers:{authorization:"Bearer regular","content-type":"application/json"},body:JSON.stringify({category:"permissions",subject:"Workspace access question",description:"Please help investigate this local permission test."})});assert.equal(create.status,201);
 const decision=await fetch(`${base}/api/workspaces/${workspaceId}/support/access-requests/${accessId}/decision`,{method:"POST",headers:{authorization:"Bearer regular","content-type":"application/json"},body:JSON.stringify({decision:"REJECTED"})});assert.equal(decision.status,200);assert.equal(f.supportCalls.at(-1),`decide:${accessId}:REJECTED`);
}));

test("health only reports measured API and database states",async()=>withApi(async(base)=>{
 const response=await fetch(`${base}/api/platform-admin/health`,{headers:{authorization:"Bearer admin"}});assert.equal(response.status,200);const data=await response.json() as {api:{status:string};database:{status:string};storage:{status:string};backgroundWorkers:{status:string}};
 assert.equal(data.api.status,"HEALTHY");assert.equal(data.database.status,"HEALTHY");assert.equal(data.storage.status,"UNKNOWN");assert.equal(data.backgroundWorkers.status,"UNKNOWN");
}));
