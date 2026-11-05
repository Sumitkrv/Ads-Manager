import { z } from "zod";
export declare const AgencyRelationshipStatusSchema: z.ZodEnum<{
    pending: "pending";
    active: "active";
    paused: "paused";
    revoked: "revoked";
    ended: "ended";
}>;
export type AgencyRelationshipStatus = z.infer<typeof AgencyRelationshipStatusSchema>;
export declare const AgencyProfileInputSchema: z.ZodObject<{
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    websiteUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    specializations: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strict>;
export type AgencyProfileInput = z.infer<typeof AgencyProfileInputSchema>;
export declare const AgencyRelationshipRequestSchema: z.ZodObject<{
    otherWorkspaceId: z.ZodString;
}, z.core.$strip>;
export declare const AgencyRelationshipTransitionSchema: z.ZodObject<{
    action: z.ZodEnum<{
        accept: "accept";
        reject: "reject";
        pause: "pause";
        resume: "resume";
        revoke: "revoke";
        end: "end";
    }>;
}, z.core.$strict>;
export declare const AgencyAssignmentInputSchema: z.ZodObject<{
    relationshipId: z.ZodString;
    assigneeUserId: z.ZodString;
    responsibility: z.ZodString;
}, z.core.$strict>;
export declare const WorkspaceInvitationInputSchema: z.ZodObject<{
    email: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    role: z.ZodEnum<{
        admin: "admin";
        editor: "editor";
        viewer: "viewer";
    }>;
    relationshipId: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const InvitationTokenSchema: z.ZodString;
export declare const InvitationAcceptSchema: z.ZodObject<{
    token: z.ZodString;
}, z.core.$strip>;
export declare const ClientTaskStatusSchema: z.ZodEnum<{
    todo: "todo";
    in_progress: "in_progress";
    blocked: "blocked";
    in_review: "in_review";
    done: "done";
    cancelled: "cancelled";
}>;
export declare const ClientTaskPrioritySchema: z.ZodEnum<{
    low: "low";
    normal: "normal";
    high: "high";
    urgent: "urgent";
}>;
export declare const ClientVisibilitySchema: z.ZodEnum<{
    agency_internal: "agency_internal";
    client_visible: "client_visible";
}>;
export declare const ClientTaskInputSchema: z.ZodObject<{
    relationshipId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    assignedUserId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    dueDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    priority: z.ZodDefault<z.ZodEnum<{
        low: "low";
        normal: "normal";
        high: "high";
        urgent: "urgent";
    }>>;
    visibility: z.ZodDefault<z.ZodEnum<{
        agency_internal: "agency_internal";
        client_visible: "client_visible";
    }>>;
    relatedResourceType: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        campaign: "campaign";
        creative: "creative";
        report: "report";
    }>>>;
    relatedResourceId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strict>;
export declare const ClientTaskPatchSchema: z.ZodObject<{
    expectedVersion: z.ZodNumber;
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    assignedUserId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    dueDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    priority: z.ZodOptional<z.ZodEnum<{
        low: "low";
        normal: "normal";
        high: "high";
        urgent: "urgent";
    }>>;
    visibility: z.ZodOptional<z.ZodEnum<{
        agency_internal: "agency_internal";
        client_visible: "client_visible";
    }>>;
    status: z.ZodOptional<z.ZodEnum<{
        todo: "todo";
        in_progress: "in_progress";
        blocked: "blocked";
        in_review: "in_review";
        done: "done";
        cancelled: "cancelled";
    }>>;
}, z.core.$strict>;
export declare const ClientCommentInputSchema: z.ZodObject<{
    relationshipId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    relatedResourceType: z.ZodEnum<{
        campaign: "campaign";
        creative: "creative";
        report: "report";
        task: "task";
        workspace: "workspace";
    }>;
    relatedResourceId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    parentCommentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    visibility: z.ZodDefault<z.ZodEnum<{
        agency_internal: "agency_internal";
        client_visible: "client_visible";
    }>>;
    body: z.ZodString;
}, z.core.$strict>;
export declare const AgencyListQuerySchema: z.ZodObject<{
    search: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<{
        pending: "pending";
        active: "active";
        paused: "paused";
        revoked: "revoked";
        ended: "ended";
    }>>;
    industry: z.ZodOptional<z.ZodString>;
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    pageSize: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strict>;
//# sourceMappingURL=agency.d.ts.map