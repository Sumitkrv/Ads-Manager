import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_USER_PREFERENCES,
  DEFAULT_WORKSPACE_PREFERENCES,
  UserPreferencesSchema,
  WorkspaceInvitationSchema,
  WorkspacePreferencesSchema,
  WorkspaceSettingsAuditSchema,
  WorkspaceTeamMemberSchema,
  type UserPreferences,
  type WorkspacePreferences,
  type WorkspaceTeamResponse,
} from "@ai-ads/shared";
import { config, type ApiConfig } from "../config.js";
import { HttpError } from "../errors.js";

export interface SettingsRepository {
  getUserPreferences(userId: string): Promise<UserPreferences>;
  saveUserPreferences(userId: string, preferences: UserPreferences): Promise<UserPreferences>;
  getWorkspaceRole(workspaceId: string, userId: string): Promise<string | null>;
  getWorkspacePreferences(workspaceId: string): Promise<WorkspacePreferences>;
  saveWorkspacePreferences(workspaceId: string, preferences: WorkspacePreferences): Promise<WorkspacePreferences>;
  getTeam(workspaceId: string, role: string): Promise<WorkspaceTeamResponse>;
  createInvitation(input: { workspaceId: string; email: string; role: string; tokenHash: string; expiresAt: string }): Promise<Record<string, unknown>>;
  revokeInvitation(workspaceId: string, invitationId: string): Promise<Record<string, unknown>>;
  updateMemberRole(workspaceId: string, userId: string, role: string): Promise<Record<string, unknown>>;
  removeMember(workspaceId: string, userId: string): Promise<Record<string, unknown>>;
  activity(workspaceId: string): Promise<Record<string, unknown>[]>;
  requestClosure(scope: "account" | "workspace", workspaceId: string | null): Promise<Record<string, unknown>>;
  closureRequests(scope: "account" | "workspace", userId: string, workspaceId: string | null): Promise<Record<string, unknown>[]>;
  accountExport(userId: string): Promise<Record<string, unknown>>;
  workspaceExport(workspaceId: string): Promise<Record<string, unknown> | null>;
}

export type SettingsRepositoryFactory = (accessToken: string) => SettingsRepository | null;

function mapError(error: { code?: string; message?: string } | null): never {
  if (error?.code === "42501") throw new HttpError(403, "settings_forbidden", "Your current role does not allow this settings action.");
  if (error?.code === "P0002") throw new HttpError(404, "settings_record_not_found", "The requested settings record was not found.");
  if (error?.code === "40001") throw new HttpError(409, "settings_conflict", "This workspace changed. Reload the page and try again.");
  if (["22023", "23514", "23503", "23505"].includes(error?.code ?? "")) throw new HttpError(409, "settings_request_conflict", "The settings request could not be applied in its current state.");
  throw new HttpError(503, "settings_service_unavailable", "Settings storage is temporarily unavailable.");
}

function asRows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null) : [];
}

function asRow(value: unknown): Record<string, unknown> {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== "object" || candidate === null) throw new HttpError(503, "settings_response_invalid", "Settings storage returned an invalid response.");
  return candidate as Record<string, unknown>;
}

function userPreferencesFromRow(value: Record<string, unknown>): UserPreferences {
  const parsed = UserPreferencesSchema.safeParse({
    themePreference: value.theme_preference,
    preferredLanguage: value.preferred_language,
    timezone: value.timezone,
    dateFormat: value.date_format,
    timeFormat: value.time_format,
    displayCurrency: value.display_currency,
    notifications: value.notification_preferences,
  });
  if (!parsed.success) throw new HttpError(503, "settings_response_invalid", "Account preferences returned an invalid response.");
  return parsed.data;
}

function workspacePreferencesFromRow(value: Record<string, unknown>): WorkspacePreferences {
  const parsed = WorkspacePreferencesSchema.safeParse({
    businessDescription: value.business_description ?? "",
    businessCategory: value.business_category ?? "",
    operatingRegion: value.operating_region ?? "",
    defaultCurrency: value.default_currency ?? "USD",
    defaultLandingPage: value.default_landing_page,
    defaultCampaignFormat: value.default_campaign_format,
    defaultReportDateRange: value.default_report_date_range,
    defaultMarketingObjective: value.default_marketing_objective,
    displayDensity: value.display_density,
  });
  if (!parsed.success) throw new HttpError(503, "settings_response_invalid", "Workspace defaults returned an invalid response.");
  return parsed.data;
}

async function teamAvatarUrl(client: SupabaseClient, value: unknown): Promise<string | null> {
  if (typeof value !== "string" || !value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const prefix = "tandem-user-avatars/";
  if (!value.startsWith(prefix)) return null;
  const { data, error } = await client.storage.from("tandem-user-avatars").createSignedUrl(value.slice(prefix.length), 3600);
  if (error) mapError(error);
  return data?.signedUrl ?? null;
}

export function createSupabaseSettingsRepository(accessToken: string, apiConfig: ApiConfig = config): SettingsRepository | null {
  if (!apiConfig.SUPABASE_URL || !apiConfig.SUPABASE_PUBLISHABLE_KEY) return null;
  const client = createClient(apiConfig.SUPABASE_URL, apiConfig.SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  return {
    async getUserPreferences(userId) {
      const { data, error } = await client.from("user_preferences").select("theme_preference,preferred_language,timezone,date_format,time_format,display_currency,notification_preferences").eq("user_id", userId).maybeSingle();
      if (error) mapError(error);
      return data ? userPreferencesFromRow(data) : DEFAULT_USER_PREFERENCES;
    },
    async saveUserPreferences(userId, preferences) {
      const valid = UserPreferencesSchema.parse(preferences);
      const { data, error } = await client.from("user_preferences").upsert({
        user_id: userId,
        theme_preference: valid.themePreference,
        preferred_language: valid.preferredLanguage,
        timezone: valid.timezone,
        date_format: valid.dateFormat,
        time_format: valid.timeFormat,
        display_currency: valid.displayCurrency,
        notification_preferences: valid.notifications,
      }, { onConflict: "user_id" }).select("theme_preference,preferred_language,timezone,date_format,time_format,display_currency,notification_preferences").single();
      if (error) mapError(error);
      if (!data) throw new HttpError(503, "settings_response_invalid", "Account preferences could not be confirmed.");
      return userPreferencesFromRow(data);
    },
    async getWorkspaceRole(workspaceId, userId) {
      const { data, error } = await client.from("workspace_memberships").select("role").eq("workspace_id", workspaceId).eq("user_id", userId).maybeSingle();
      if (error) mapError(error);
      return typeof data?.role === "string" ? data.role : null;
    },
    async getWorkspacePreferences(workspaceId) {
      const { data, error } = await client.from("workspace_preferences").select("business_description,business_category,operating_region,default_currency,default_landing_page,default_campaign_format,default_report_date_range,default_marketing_objective,display_density").eq("workspace_id", workspaceId).maybeSingle();
      if (error) mapError(error);
      return data ? workspacePreferencesFromRow(data) : DEFAULT_WORKSPACE_PREFERENCES;
    },
    async saveWorkspacePreferences(workspaceId, preferences) {
      const valid = WorkspacePreferencesSchema.parse(preferences);
      const { data, error } = await client.from("workspace_preferences").upsert({
        workspace_id: workspaceId,
        business_description: valid.businessDescription,
        business_category: valid.businessCategory,
        operating_region: valid.operatingRegion,
        default_currency: valid.defaultCurrency,
        default_landing_page: valid.defaultLandingPage,
        default_campaign_format: valid.defaultCampaignFormat,
        default_report_date_range: valid.defaultReportDateRange,
        default_marketing_objective: valid.defaultMarketingObjective,
        display_density: valid.displayDensity,
      }, { onConflict: "workspace_id" }).select("business_description,business_category,operating_region,default_currency,default_landing_page,default_campaign_format,default_report_date_range,default_marketing_objective,display_density").single();
      if (error) mapError(error);
      if (!data) throw new HttpError(503, "settings_response_invalid", "Workspace defaults could not be confirmed.");
      return workspacePreferencesFromRow(data);
    },
    async getTeam(workspaceId, role) {
      const { data: memberRows, error: memberError } = await client.from("workspace_memberships").select("id,user_id,role,created_at").eq("workspace_id", workspaceId).order("created_at", { ascending: true }).limit(500);
      if (memberError) mapError(memberError);
      const members = asRows(memberRows);
      const ids = members.map((member) => member.user_id).filter((value): value is string => typeof value === "string");
      const { data: profileRows, error: profileError } = ids.length
        ? await client.from("profiles").select("user_id,full_name,avatar_url").in("user_id", ids)
        : { data: [], error: null };
      if (profileError) mapError(profileError);
      const profiles = new Map(asRows(profileRows).map((profile) => [String(profile.user_id), profile]));
      const { data: identityRows, error: identityError } = await client.rpc("workspace_team_member_identities", { p_workspace_id: workspaceId });
      if (identityError) mapError(identityError);
      const identities = new Map(asRows(identityRows).map((identity) => [String(identity.user_id), identity]));
      const parsedMembers = await Promise.all(members.map(async (member) => {
        const profile = profiles.get(String(member.user_id));
        const identity = identities.get(String(member.user_id));
        const parsed = WorkspaceTeamMemberSchema.safeParse({
          id: member.id,
          userId: member.user_id,
          fullName: typeof profile?.full_name === "string" ? profile.full_name : null,
          email: typeof identity?.verified_email === "string" ? identity.verified_email : null,
          emailVerified: identity?.email_verified === true,
          avatarUrl: await teamAvatarUrl(client, profile?.avatar_url),
          role: member.role,
          joinedAt: member.created_at,
        });
        if (!parsed.success) throw new HttpError(503, "settings_response_invalid", "Team membership returned an invalid response.");
        return parsed.data;
      }));
      const { data: invitationRows, error: invitationError } = await client.from("workspace_invitations").select("id,workspace_id,relationship_id,invited_email,invited_role,status,created_by,expires_at,created_at").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(100);
      if (invitationError) mapError(invitationError);
      const parsedInvitations = asRows(invitationRows).map((invitation) => {
        const parsed = WorkspaceInvitationSchema.safeParse({
          id: invitation.id,
          workspaceId: invitation.workspace_id,
          relationshipId: typeof invitation.relationship_id === "string" ? invitation.relationship_id : null,
          email: invitation.invited_email,
          role: invitation.invited_role,
          status: invitation.status,
          createdBy: invitation.created_by,
          expiresAt: invitation.expires_at,
          createdAt: invitation.created_at,
        });
        if (!parsed.success) throw new HttpError(503, "settings_response_invalid", "Workspace invitations returned an invalid response.");
        return parsed.data;
      });
      return { members: parsedMembers, invitations: parsedInvitations, role: role as WorkspaceTeamResponse["role"], emailDelivery: "not_emailed" };
    },
    async createInvitation(input) {
      const { data, error } = await client.rpc("create_workspace_invitation", {
        p_workspace_id: input.workspaceId,
        p_relationship_id: null,
        p_email: input.email,
        p_role: input.role,
        p_token_hash: input.tokenHash,
        p_expires_at: input.expiresAt,
      });
      if (error) mapError(error);
      return asRow(data);
    },
    async revokeInvitation(workspaceId, invitationId) {
      const { data: current, error: lookupError } = await client.from("workspace_invitations").select("id,workspace_id").eq("id", invitationId).eq("workspace_id", workspaceId).maybeSingle();
      if (lookupError) mapError(lookupError);
      if (!current) throw new HttpError(404, "invitation_not_found", "The pending invitation was not found in this workspace.");
      const { data, error } = await client.rpc("revoke_workspace_invitation", { p_invitation_id: invitationId });
      if (error) mapError(error);
      return asRow(data);
    },
    async updateMemberRole(workspaceId, userId, role) {
      const { data, error } = await client.rpc("update_workspace_member_role", { p_workspace_id: workspaceId, p_user_id: userId, p_role: role });
      if (error) mapError(error);
      return asRow(data);
    },
    async removeMember(workspaceId, userId) {
      const { data, error } = await client.rpc("remove_workspace_member", { p_workspace_id: workspaceId, p_user_id: userId });
      if (error) mapError(error);
      return asRow(data);
    },
    async activity(workspaceId) {
      const { data, error } = await client.from("workspace_settings_audit").select("id,action,target_user_id,changed_fields,actor_user_id,created_at").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(100);
      if (error) mapError(error);
      return asRows(data).map((item) => {
        const parsed = WorkspaceSettingsAuditSchema.safeParse({
          id: item.id,
          action: item.action,
          targetUserId: item.target_user_id,
          changedFields: item.changed_fields,
          actorUserId: item.actor_user_id,
          createdAt: item.created_at,
        });
        if (!parsed.success) throw new HttpError(503, "settings_response_invalid", "Workspace activity returned an invalid response.");
        return parsed.data;
      });
    },
    async requestClosure(scope, workspaceId) {
      const { data, error } = await client.rpc("request_account_closure", { p_scope: scope, p_workspace_id: workspaceId });
      if (error) mapError(error);
      return asRow(data);
    },
    async closureRequests(scope, userId, workspaceId) {
      let query = client.from("account_closure_requests").select("id,scope,status,created_at,workspace_id,requester_user_id").eq("scope", scope).order("created_at", { ascending: false }).limit(20);
      query = scope === "account" ? query.eq("requester_user_id", userId) : query.eq("workspace_id", workspaceId ?? "");
      const { data, error } = await query;
      if (error) mapError(error);
      return asRows(data);
    },
    async accountExport(userId) {
      const [{ data: profile, error: profileError }, preferences] = await Promise.all([
        client.from("profiles").select("full_name,avatar_url,created_at,updated_at").eq("user_id", userId).maybeSingle(),
        this.getUserPreferences(userId),
      ]);
      if (profileError) mapError(profileError);
      return { profile: profile ?? null, preferences };
    },
    async workspaceExport(workspaceId) {
      const [{ data: workspace, error: workspaceError }, preferences] = await Promise.all([
        client.from("workspaces").select("id,name,slug,industry_key,industry_custom_label,website_url,country_code,timezone,logo_url,created_at,updated_at").eq("id", workspaceId).maybeSingle(),
        this.getWorkspacePreferences(workspaceId),
      ]);
      if (workspaceError) mapError(workspaceError);
      if (!workspace) return null;
      return { workspace, preferences, availableDataCategories: ["campaigns", "creative projects", "Brand Kit assets", "analytics reports", "agency collaboration"], exportScope: "Workspace metadata and defaults only; use the existing campaign, creative and report exports for their records." };
    },
  };
}
