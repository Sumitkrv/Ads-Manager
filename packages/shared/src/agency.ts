import { z } from "zod";

const uuid = z.string().uuid();
const cleanOptionalText = (max: number) => z.string().trim().max(max).nullable().optional();

export const AgencyRelationshipStatusSchema = z.enum(["pending", "active", "paused", "revoked", "ended"]);
export type AgencyRelationshipStatus = z.infer<typeof AgencyRelationshipStatusSchema>;

export const AgencyProfileInputSchema = z.object({
  description: cleanOptionalText(1200),
  websiteUrl: z.string().trim().url().max(2048).nullable().optional(),
  specializations: z.array(z.string().trim().min(1).max(80)).max(16).default([]),
}).strict();
export type AgencyProfileInput = z.infer<typeof AgencyProfileInputSchema>;

export const AgencyRelationshipRequestSchema = z.object({ otherWorkspaceId: uuid });
export const AgencyRelationshipTransitionSchema = z.object({
  action: z.enum(["accept", "reject", "pause", "resume", "revoke", "end"]),
}).strict();

export const AgencyAssignmentInputSchema = z.object({
  relationshipId: uuid,
  assigneeUserId: uuid,
  responsibility: z.string().trim().min(2).max(120),
}).strict();

export const WorkspaceInvitationInputSchema = z.object({
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
  role: z.enum(["admin", "editor", "viewer"]),
  relationshipId: uuid.optional(),
}).strict();

export const InvitationTokenSchema = z.string().min(32).max(128).regex(/^[A-Za-z0-9_-]+$/);
export const InvitationAcceptSchema = z.object({ token: InvitationTokenSchema });

export const ClientTaskStatusSchema = z.enum(["todo", "in_progress", "blocked", "in_review", "done", "cancelled"]);
export const ClientTaskPrioritySchema = z.enum(["low", "normal", "high", "urgent"]);
export const ClientVisibilitySchema = z.enum(["agency_internal", "client_visible"]);

export const ClientTaskInputSchema = z.object({
  relationshipId: uuid.nullable().optional(),
  title: z.string().trim().min(2).max(180),
  description: cleanOptionalText(4000),
  assignedUserId: uuid.nullable().optional(),
  dueDate: z.string().date().nullable().optional(),
  priority: ClientTaskPrioritySchema.default("normal"),
  visibility: ClientVisibilitySchema.default("client_visible"),
  relatedResourceType: z.enum(["campaign", "creative", "report"]).nullable().optional(),
  relatedResourceId: uuid.nullable().optional(),
}).strict().superRefine((value, context) => {
  if (Boolean(value.relatedResourceType) !== Boolean(value.relatedResourceId)) {
    context.addIssue({ code: "custom", path: ["relatedResourceId"], message: "Choose both a related resource type and ID." });
  }
});

export const ClientTaskPatchSchema = z.object({
  expectedVersion: z.number().int().positive(),
  title: z.string().trim().min(2).max(180).optional(),
  description: cleanOptionalText(4000),
  assignedUserId: uuid.nullable().optional(),
  dueDate: z.string().date().nullable().optional(),
  priority: ClientTaskPrioritySchema.optional(),
  visibility: ClientVisibilitySchema.optional(),
  status: ClientTaskStatusSchema.optional(),
}).strict().refine((value) => Object.keys(value).some((key) => key !== "expectedVersion"), "Provide a task change.");

export const ClientCommentInputSchema = z.object({
  relationshipId: uuid.nullable().optional(),
  relatedResourceType: z.enum(["campaign", "creative", "report", "task", "workspace"]),
  relatedResourceId: uuid.nullable().optional(),
  parentCommentId: uuid.nullable().optional(),
  visibility: ClientVisibilitySchema.default("client_visible"),
  body: z.string().trim().min(1).max(5000),
}).strict();

export const AgencyListQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: AgencyRelationshipStatusSchema.optional(),
  industry: z.string().trim().max(64).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
}).strict();
