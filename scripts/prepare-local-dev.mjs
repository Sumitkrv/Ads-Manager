import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
const LOCAL_API_URL = "http://127.0.0.1:4010";

function parseEnv(text) {
  return Object.fromEntries(text
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      let value = line.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      return [line.slice(0, index).trim(), value];
    }));
}

function setEnv(path, updates) {
  let content = readFileSync(path, "utf8");
  for (const [name, value] of Object.entries(updates)) {
    const lines = content.split(/\r?\n/);
    const index = lines.findIndex((line) => line.startsWith(`${name}=`));
    if (index === -1) lines.push(`${name}=${value}`);
    else lines[index] = `${name}=${value}`;
    content = lines.join("\n").replace(/\n*$/, "\n");
  }
  writeFileSync(path, content);
}

if (!existsSync("apps/web/.env.local")) copyFileSync("apps/web/.env.example", "apps/web/.env.local");
if (!existsSync("apps/api/.env")) copyFileSync("apps/api/.env.example", "apps/api/.env");

function assertNoConflictingShellOverrides(localKey, localServiceRoleKey, campaignGenerationMode) {
  const expected = {
    VITE_SUPABASE_URL: LOCAL_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: localKey,
    SUPABASE_URL: LOCAL_SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: localKey,
    SUPABASE_SERVICE_ROLE_KEY: localServiceRoleKey,
    VITE_CAMPAIGN_GENERATION_MODE: campaignGenerationMode,
  };
  for (const [name, value] of Object.entries(expected)) {
    if (process.env[name] && process.env[name] !== value) {
      throw new Error(`Conflicting inherited ${name}; unset it before starting local Tandem Ads.`);
    }
  }
  if (process.env.VITE_API_BASE_URL) {
    throw new Error("Unset VITE_API_BASE_URL for local development; the app uses Vite's same-origin local API proxy.");
  }
  const proxyTarget = process.env.VITE_API_PROXY_TARGET || LOCAL_API_URL;
  if (proxyTarget !== LOCAL_API_URL) {
    throw new Error("VITE_API_PROXY_TARGET must be http://127.0.0.1:4010 for local development.");
  }
  if (process.env.API_PORT && process.env.API_PORT !== "4010") {
    throw new Error("API_PORT must be 4010 for the configured local Vite proxy.");
  }
}

let statusText;
try {
  statusText = execFileSync("npx", ["supabase", "status", "--output", "env"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    maxBuffer: 2_000_000,
  });
} catch {
  throw new Error("Local Supabase is not running. Start it with `npx supabase start`; no hosted project will be used.");
}

const status = parseEnv(statusText);
const apiUrl = status.API_URL;
const publishableKey = status.PUBLISHABLE_KEY;
const serviceRoleKey = status.SERVICE_ROLE_KEY;
if (apiUrl !== LOCAL_SUPABASE_URL || !publishableKey || !serviceRoleKey) {
  throw new Error("Supabase CLI did not report the expected local project at 127.0.0.1:54321.");
}
const apiConfiguration = parseEnv(readFileSync("apps/api/.env", "utf8"));
const campaignGenerationMode = apiConfiguration.CAMPAIGN_GENERATION_MODE || "simulation";
if (campaignGenerationMode !== "simulation" && campaignGenerationMode !== "openai") {
  throw new Error("CAMPAIGN_GENERATION_MODE must be simulation or openai.");
}
assertNoConflictingShellOverrides(publishableKey, serviceRoleKey, campaignGenerationMode);

let authHealth;
try {
  authHealth = await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/health`, { signal: AbortSignal.timeout(3000) });
} catch {
  throw new Error("Local Supabase Auth is not responding at 127.0.0.1:54321.");
}
if (!authHealth.ok) throw new Error("Local Supabase Auth health check failed.");

setEnv("apps/web/.env.local", {
  VITE_API_BASE_URL: "",
  VITE_CAMPAIGN_GENERATION_MODE: campaignGenerationMode,
  VITE_SUPABASE_URL: LOCAL_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
});
setEnv("apps/api/.env", {
  SUPABASE_URL: LOCAL_SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY: publishableKey,
  SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
});

const web = parseEnv(readFileSync("apps/web/.env.local", "utf8"));
const api = parseEnv(readFileSync("apps/api/.env", "utf8"));
if (web.VITE_SUPABASE_URL !== api.SUPABASE_URL
  || web.VITE_SUPABASE_PUBLISHABLE_KEY !== api.SUPABASE_PUBLISHABLE_KEY
  || web.VITE_CAMPAIGN_GENERATION_MODE !== api.CAMPAIGN_GENERATION_MODE
  || api.SUPABASE_SERVICE_ROLE_KEY !== serviceRoleKey
  || web.VITE_API_BASE_URL) {
  throw new Error("Frontend and API local Supabase configuration did not match after preparation.");
}

console.info("Local dev configuration verified: web and API use Supabase at 127.0.0.1:54321; API proxy targets 127.0.0.1:4010.");
