import { createClient } from "@supabase/supabase-js";
import { config, type ApiConfig } from "../config.js";
import { HttpError } from "../errors.js";

export type MeteredOperation = "campaign_generation_ops" | "creative_variations";
export type BillingUsageMeter = { consume(workspaceId: string, metric: MeteredOperation, idempotencyKey: string): Promise<void> };

export function createSupabaseBillingUsageMeter(accessToken: string, apiConfig: ApiConfig = config): BillingUsageMeter | null {
  if (!apiConfig.SUPABASE_URL || !apiConfig.SUPABASE_PUBLISHABLE_KEY) return null;
  const client=createClient(apiConfig.SUPABASE_URL,apiConfig.SUPABASE_PUBLISHABLE_KEY,{
    auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false},
    global:{headers:{Authorization:`Bearer ${accessToken}`}},
  });
  return {async consume(workspaceId,metric,idempotencyKey){
    const {error}=await client.rpc("billing_consume_usage",{p_workspace_id:workspaceId,p_metric_key:metric,p_idempotency_key:idempotencyKey});
    if(!error)return;
    if(error.code==="42501")throw new HttpError(403,"billing_feature_unavailable","Your workspace role or plan does not include this operation.");
    if(error.code==="54000")throw new HttpError(409,"billing_limit_reached","This workspace has reached its current plan allowance.");
    if(error.code==="23505")throw new HttpError(409,"usage_already_recorded","This operation was already counted. Start a new operation to generate another result.");
    if(error.code==="22023")throw new HttpError(400,"billing_usage_invalid","This metered operation is invalid.");
    throw new HttpError(503,"billing_usage_unavailable","Workspace usage could not be recorded.");
  }};
}
