import "dotenv/config";
import { z } from "zod";
const optionalSecret = z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), z.string().trim().min(1).optional());
const environmentSchema = z.object({
    APP_ENV: z.enum(["development", "test", "production"]).default("development"),
    ADS_EXECUTION_MODE: z.literal("demo").default("demo"),
    CAMPAIGN_GENERATION_MODE: z.enum(["simulation", "openai"]).default("simulation"),
    OPENAI_API_KEY: optionalSecret,
    OPENAI_CAMPAIGN_MODEL: z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), z.string().trim().min(1).max(100).optional()),
    CREATIVE_EXECUTION_MODE: z.literal("local").default("local"),
    BILLING_MODE: z.literal("simulation").default("simulation"),
    BILLING_DEMO_ADMIN_USER_IDS: z.string().optional(),
    API_HOST: z.string().trim().min(1).default("127.0.0.1"),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(4010),
    CORS_ALLOWED_ORIGINS: z.string().optional(),
    SUPABASE_URL: z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), z
        .string()
        .url()
        .refine((value) => value.startsWith("https://") || value.startsWith("http://"))
        .optional()),
    SUPABASE_PUBLISHABLE_KEY: z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), z.string().trim().min(1).optional()),
    SUPABASE_SERVICE_ROLE_KEY: optionalSecret,
    INTEGRATIONS_APP_RETURN_URL: z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), z.string().url().optional()),
    INTEGRATION_CREDENTIAL_ACTIVE_KEY_VERSION: z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), z.string().regex(/^v[1-9][0-9]*$/).optional()),
    INTEGRATION_CREDENTIAL_KEYS_JSON: optionalSecret,
    GOOGLE_ADS_CLIENT_ID: optionalSecret,
    GOOGLE_ADS_CLIENT_SECRET: optionalSecret,
    GOOGLE_ADS_DEVELOPER_TOKEN: optionalSecret,
    GOOGLE_ADS_REDIRECT_URI: z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), z.string().url().optional()),
    GOOGLE_ADS_API_VERSION: z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), z.string().regex(/^v[1-9][0-9]*$/).default("v26")),
    META_APP_ID: optionalSecret,
    META_APP_SECRET: optionalSecret,
    META_REDIRECT_URI: z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), z.string().url().optional()),
    META_GRAPH_API_VERSION: z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), z.string().regex(/^v[1-9][0-9]*\.0$/).default("v26.0")),
    META_LOGIN_CONFIG_ID: optionalSecret,
}).superRefine((value, context) => {
    if (Boolean(value.SUPABASE_URL) !== Boolean(value.SUPABASE_PUBLISHABLE_KEY)) {
        context.addIssue({
            code: "custom",
            path: ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"],
            message: "SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be configured together.",
        });
    }
    if (value.CAMPAIGN_GENERATION_MODE === "openai" && !value.OPENAI_API_KEY) {
        context.addIssue({ code: "custom", path: ["OPENAI_API_KEY"], message: "OPENAI_API_KEY is required when live campaign generation is enabled." });
    }
    if (value.CAMPAIGN_GENERATION_MODE === "openai" && !value.OPENAI_CAMPAIGN_MODEL) {
        context.addIssue({ code: "custom", path: ["OPENAI_CAMPAIGN_MODEL"], message: "OPENAI_CAMPAIGN_MODEL is required when live campaign generation is enabled." });
    }
});
const parsedEnvironment = environmentSchema.safeParse(process.env);
if (!parsedEnvironment.success) {
    throw new Error("Invalid API environment configuration. Check APP_ENV, API_HOST, API_PORT, CORS_ALLOWED_ORIGINS, Supabase settings, and campaign-generation provider settings.");
}
const developmentOrigins = [
    "http://127.0.0.1:5180",
    "http://localhost:5180",
];
const configuredOrigins = parsedEnvironment.data.CORS_ALLOWED_ORIGINS
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
export const config = {
    ...parsedEnvironment.data,
    supabaseConfigured: Boolean(parsedEnvironment.data.SUPABASE_URL &&
        parsedEnvironment.data.SUPABASE_PUBLISHABLE_KEY),
    corsAllowedOrigins: configuredOrigins ??
        (parsedEnvironment.data.APP_ENV === "development" ? developmentOrigins : []),
};
