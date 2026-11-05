import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import dotenv from "dotenv";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: path.join(projectRoot, "apps/api/.env"), quiet: true });
const webEnvText = await readFile(path.join(projectRoot, "apps/web/.env.local"), "utf8");
const apiUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appEnv = process.env.APP_ENV;
const webUrl = webEnvText.match(/^VITE_SUPABASE_URL=(.*)$/m)?.[1]?.trim();
const loopback = new Set(["127.0.0.1", "localhost", "::1"]);

if (appEnv !== "development" || !apiUrl || !serviceKey || !webUrl) {
  throw new Error("Local test requires development mode and configured Supabase targets.");
}
if (apiUrl !== webUrl || !loopback.has(new URL(apiUrl).hostname)) {
  throw new Error("Frontend and API must target the same loopback Supabase instance.");
}

const frontendOrigin = "http://127.0.0.1:5181";
const apiOrigin = "http://127.0.0.1:4011";
for (const url of [`${frontendOrigin}/login`, `${apiOrigin}/api/health`]) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Local test service unavailable (${response.status}).`);
}

const admin = createClient(apiUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
const suffix = randomBytes(10).toString("hex");
const email = `prompt11-smoke-${suffix}@example.test`;
const password = randomBytes(32).toString("base64url");
const created = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { local_test_fixture: "prompt11-auth-smoke" },
});
if (created.error || !created.data.user) throw new Error("Could not provision an isolated local auth fixture.");

const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const profile = await mkdtemp(path.join(os.tmpdir(), "tandem-p11-chrome-"));
let browser;
let fixtureRemoved;
let summary;
let ws;
let commandId = 0;
const pending = new Map();
const observedResponses = [];

function send(method, params = {}) {
  const id = ++commandId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Browser command timed out: ${method}`));
    }, 10000);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (result.exceptionDetails) throw new Error("Browser page evaluation failed.");
  return result.result?.value;
}

async function waitFor(check, label, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const result = await check();
      if (result) return result;
    } catch {
      // Cross-document navigation can briefly destroy the current execution context.
    }
    await delay(200);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

try {
  browser = spawn(chrome, [
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--no-sandbox",
    "--remote-debugging-port=0",
    "--remote-allow-origins=*",
    `--user-data-dir=${profile}`,
    "about:blank",
  ], { stdio: "ignore" });

  const activePortFile = path.join(profile, "DevToolsActivePort");
  const portLines = await waitFor(async () => {
    try {
      return (await readFile(activePortFile, "utf8")).trim().split("\n");
    } catch {
      return null;
    }
  }, "Chrome DevTools startup");
  const targets = await (await fetch(`http://127.0.0.1:${portLines[0]}/json/list`)).json();
  const page = targets.find((target) => target.type === "page");
  if (!page?.webSocketDebuggerUrl) throw new Error("Chrome did not expose a page target.");

  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.method === "Network.responseReceived") {
      const response = message.params.response;
      if (response.url.includes("/api/")) observedResponses.push({ url: response.url, status: response.status });
    }
    if (message.id && pending.has(message.id)) {
      const item = pending.get(message.id);
      pending.delete(message.id);
      clearTimeout(item.timer);
      if (message.error) item.reject(new Error(message.error.message));
      else item.resolve(message.result ?? {});
    }
  });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Page.navigate", { url: `${frontendOrigin}/login` });
  await waitFor(async () => evaluate("document.readyState === 'complete' && !!document.querySelector('#email')"), "login form");

  const emailInput = JSON.stringify(email);
  const passwordInput = JSON.stringify(password);
  await evaluate(`(() => {
    const set = (el, value) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set(document.querySelector('#email'), ${emailInput});
    set(document.querySelector('#password'), ${passwordInput});
    document.querySelector('form button[type="submit"]').click();
    return true;
  })()`);

  const signedIn = await waitFor(async () => evaluate(`(() => {
    const key = Object.keys(localStorage).find((item) => item.includes('auth-token'));
    if (!key) return null;
    try { const session = JSON.parse(localStorage.getItem(key)); return session?.access_token ? true : null; }
    catch { return null; }
  })()`), "authenticated browser session");
  if (!signedIn) throw new Error("Supabase session was not persisted in the browser.");

  const accessProbe = await evaluate(`(async () => {
    const key = Object.keys(localStorage).find((item) => item.includes('auth-token'));
    const session = JSON.parse(localStorage.getItem(key));
    const workspaces = await fetch('/api/workspaces', { headers: { Authorization: 'Bearer ' + session.access_token } });
    const access = await fetch('/api/platform-admin/access', { headers: { Authorization: 'Bearer ' + session.access_token } });
    const overview = await fetch('/api/platform-admin/overview', { headers: { Authorization: 'Bearer ' + session.access_token } });
    return { workspaceStatus: workspaces.status, workspaceCount: (await workspaces.json()).workspaces?.length ?? null,
      accessStatus: access.status, allowed: (await access.json()).allowed, overviewStatus: overview.status };
  })()`);
  if (accessProbe.workspaceStatus !== 200 || accessProbe.accessStatus !== 200 || accessProbe.allowed !== false || accessProbe.overviewStatus !== 403) {
    throw new Error("Authenticated workspace access or platform-role denial did not meet expected statuses.");
  }

  await send("Page.reload", { ignoreCache: true });
  const afterRefresh = await waitFor(async () => evaluate(`(() => {
    const key = Object.keys(localStorage).find((item) => item.includes('auth-token'));
    if (!key) return null;
    try { return JSON.parse(localStorage.getItem(key))?.access_token ? true : null; }
    catch { return null; }
  })()`), "session after refresh");
  if (!afterRefresh) throw new Error("Session did not survive browser refresh.");

  await send("Page.navigate", { url: `${frontendOrigin}/app/platform-admin` });
  const denialView = await waitFor(async () => evaluate(`document.body.innerText.includes('This account is not a platform operator.') && document.body.innerText`), "ordinary-user platform denial view");
  const pageSummary = String(denialView).slice(0, 1600);
  if (!pageSummary.includes("This account is not a platform operator.")) {
    throw new Error("The platform-admin route did not render its ordinary-user denial state.");
  }
  const unauthWorkspaceResponses = observedResponses.filter((item) => item.url.endsWith("/api/workspaces") && item.status === 401).length;
  if (unauthWorkspaceResponses > 0) throw new Error("Authenticated workspace fetch returned 401 during the smoke flow.");

  await waitFor(async () => evaluate(`Array.from(document.querySelectorAll('button')).some((button) => button.textContent.trim() === 'Sign out')`), "visible sign-out control");
  await evaluate(`(() => { Array.from(document.querySelectorAll('button')).find((button) => button.textContent.trim() === 'Sign out')?.click(); return true; })()`);
  await waitFor(async () => evaluate(`location.pathname === '/login' && !Object.keys(localStorage).some((item) => item.includes('auth-token'))`), "logout and private-session cleanup");

  summary = {
    status: "PASS",
    environment: "isolated loopback only",
    authenticatedWorkspaceList: accessProbe.workspaceStatus,
    workspaceCount: accessProbe.workspaceCount,
    ordinaryUserPlatformAccess: accessProbe.allowed,
    protectedPlatformOverview: accessProbe.overviewStatus,
    sessionSurvivedRefresh: true,
    authenticatedWorkspace401Count: unauthWorkspaceResponses,
    platformRouteDeniedInUI: true,
    logoutClearedSession: true,
    browser: "headless Chrome via CDP",
  };
} finally {
  try { ws?.close(); } catch { /* The browser may already have closed its page socket. */ }
  if (browser && browser.exitCode === null) browser.kill("SIGTERM");
  try {
    const result = await admin.auth.admin.deleteUser(created.data.user.id);
    fixtureRemoved = !result.error;
  } catch {
    fixtureRemoved = false;
  }
  await rm(profile, { recursive: true, force: true });
  if (!fixtureRemoved) console.error("Local auth fixture cleanup did not complete.");
}

console.log(JSON.stringify({ ...summary, fixtureCleanup: fixtureRemoved ? "removed" : "failed" }));
