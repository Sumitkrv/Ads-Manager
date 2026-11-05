import assert from "node:assert/strict";
import { once } from "node:events";
import express, { type ErrorRequestHandler } from "express";
import test from "node:test";
import type { AuthenticatedApiUser, TokenVerifier } from "../auth.js";
import { config } from "../config.js";
import { HttpError } from "../errors.js";
import { createBillingRouter } from "./routes.js";
import type { BillingAdminRepository, BillingRepository } from "./repository.js";
import { createDemoInvoicePdf } from "./pdf.js";

const workspaceId="a1000000-0000-4000-8000-000000000001";
const invoiceId="a1000000-0000-4000-8000-000000000002";
const requestId="a1000000-0000-4000-8000-000000000003";
const owner:AuthenticatedApiUser={id:"a2000000-0000-4000-8000-000000000001",email:"owner@example.invalid",emailConfirmedAt:"2026-10-01T00:00:00.000Z",createdAt:"2026-10-01T00:00:00.000Z"};
const viewer:AuthenticatedApiUser={...owner,id:"a2000000-0000-4000-8000-000000000002"};
const actors:Record<string,AuthenticatedApiUser>={owner,viewer};
const verify:TokenVerifier=async(token)=>actors[token]?{status:"verified",user:actors[token]!}:{status:"invalid"};
const plan={id:"starter",name:"Starter",description:"Sample",currency:"USD",monthlyPriceMinor:1900,annualPriceMinor:19000,trialDays:0,features:{"campaigns.create":true},limits:{seats:3,campaigns_per_month:50},public:true,active:true,sortOrder:2,version:1,effectiveAt:"2026-10-01T00:00:00.000Z"};
const summary={mode:"simulation",subscription:{workspaceId,planId:"starter",planVersion:1,status:"active_demo",interval:"monthly",periodStart:"2026-10-01T00:00:00.000Z",periodEnd:"2026-11-01T00:00:00.000Z",trialEndsAt:null,cancelAtPeriodEnd:false,source:"demo_simulation",legacyUntil:null},plan,features:plan.features,limits:plan.limits,usage:{campaigns_created_month:4},remaining:{campaigns_per_month:46},pendingChange:null,notices:[]};

function fixture(){
  const state={requested:0,cancelled:0,activated:0,invoiceDownloads:0};
  const repo:BillingRepository={
    async plans(){return [plan];},async summary(){return summary;},async usage(){return {usage:summary.usage,limits:summary.limits,remaining:summary.remaining};},async history(){return {events:[],invoices:[]};},
    async invoice(){state.invoiceDownloads+=1;return {invoice:{id:invoiceId,plan_id:"starter",billing_interval:"monthly",currency:"USD",subtotal_minor:1900,illustrative_tax_minor:0,total_minor:1900,billing_period_start:"2026-10-01",billing_period_end:"2026-11-01",payment_status:"not_processed"},items:[{description:"Starter sample plan",quantity:1,amount_minor:1900}],workspace:{name:"Sample Workspace"}};},
    async requestPlan(_workspaceId){state.requested+=1;return {id:requestId,workspace_id:workspaceId,requested_plan_id:"growth",status:"pending"};},
    async cancel(){state.cancelled+=1;return {id:requestId,status:"pending"};},async reactivate(){return {id:requestId,status:"pending"};},
  };
  const admin:BillingAdminRepository={async catalog(){return [plan];},async subscriptions(){return [];},async activate(){state.activated+=1;return {status:"activated_demo",paymentProcessed:false};},async savePlan(){return {id:"starter",version:2};},async renew(){return {status:"renewed_demo",paymentProcessed:false};}};
  return {repo,admin,state};
}
async function withApi(run:(base:string)=>Promise<void>){
  const {repo,admin}=fixture();const app=express();app.use(express.json());
  app.use(createBillingRouter({...config,BILLING_MODE:"simulation",APP_ENV:"development"},verify,{repositoryFactory:()=>repo,adminRepositoryFactory:()=>admin,adminAllowed:(user)=>user.id===owner.id}));
  const errors:ErrorRequestHandler=(error:unknown,_request,response,_next)=>{if(error instanceof HttpError)response.status(error.statusCode).json({error:{code:error.code,message:error.message}});else response.status(500).json({error:{code:"internal_error"}});};app.use(errors);
  const server=app.listen(0,"127.0.0.1");await once(server,"listening");const address=server.address();assert.ok(address&&typeof address!=="string");
  try{await run(`http://127.0.0.1:${address.port}`);}finally{await new Promise<void>((resolve,reject)=>server.close((error)=>error?reject(error):resolve()));}
}

test("pricing catalog is public while workspace subscription data requires authentication",async()=>{
  await withApi(async(base)=>{
    const plans=await fetch(`${base}/api/billing/plans`);assert.equal(plans.status,200);assert.equal((await plans.json() as {plans:unknown[]}).plans.length,1);
    assert.equal((await fetch(`${base}/api/workspaces/${workspaceId}/billing/subscription`)).status,401);
    const summaryResponse=await fetch(`${base}/api/workspaces/${workspaceId}/billing/subscription`,{headers:{authorization:"Bearer owner"}});assert.equal(summaryResponse.status,200);assert.equal((await summaryResponse.json() as {mode:string}).mode,"simulation");
  });
});

test("plan selection records a pending request and never claims payment success",async()=>{
  await withApi(async(base)=>{
    const response=await fetch(`${base}/api/workspaces/${workspaceId}/billing/change-requests`,{method:"POST",headers:{authorization:"Bearer owner","content-type":"application/json"},body:JSON.stringify({planId:"growth",interval:"annual",idempotencyKey:"a3000000-0000-4000-8000-000000000001"})});
    assert.equal(response.status,201);const payload=await response.json() as {message:string;request:Record<string,unknown>};assert.equal(payload.request.status,"pending");assert.match(payload.message,/not a payment/i);
  });
});

test("trusted operator gate blocks a normal viewer and protects the demo transition endpoint",async()=>{
  await withApi(async(base)=>{
    assert.equal((await fetch(`${base}/api/platform-admin/billing/plans`,{headers:{authorization:"Bearer viewer"}})).status,403);
    const allowed=await fetch(`${base}/api/platform-admin/billing/demo-transitions`,{method:"POST",headers:{authorization:"Bearer owner","content-type":"application/json"},body:JSON.stringify({requestId})});
    assert.equal(allowed.status,200);assert.equal((await allowed.json() as {paymentProcessed:boolean}).paymentProcessed,false);
  });
});

test("demo invoice PDF is a valid local document and clearly disclaims payment and tax status",()=>{
  const pdf=createDemoInvoicePdf({workspaceName:"Sample Workspace",invoiceId,planName:"Starter",interval:"monthly",currency:"USD",subtotalMinor:1900,taxMinor:0,totalMinor:1900,periodStart:"2026-10-01",periodEnd:"2026-11-01",items:[{description:"Starter sample plan",quantity:1,amount_minor:1900}]});
  const content=pdf.toString("ascii");assert.ok(content.startsWith("%PDF-1.4"));assert.ok(content.endsWith("%%EOF\n"));assert.ok(content.includes("DEMO DOCUMENT - NOT A TAX INVOICE"));assert.ok(content.includes("NO PAYMENT WAS PROCESSED"));assert.ok(content.includes("USD 19.00"));
});
