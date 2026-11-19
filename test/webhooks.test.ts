import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHmac, generateKeyPairSync } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { AddressInfo, createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Server } from "node:http";

const SECRET = "test-webhook-secret-0123456789";
const ENTRY = fileURLToPath(new URL("../src/index.ts", import.meta.url));

const dir = mkdtempSync(join(tmpdir(), "githoney-bot-test-"));
const keyPath = join(dir, "github-app.pem");
const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" }
});
writeFileSync(keyPath, privateKey);

// The bot's configuration, without WEBHOOK_PROXY_URL.
const env: Record<string, string> = {
  PORT: "3001",
  GITHUB_PRIVATE_KEY_PATH: keyPath,
  GITHUB_WEBHOOK_SECRET: SECRET,
  GITHUB_APP_ID: "12345",
  TW_BOT_URL: "http://tw-bot.invalid",
  TW_SECRET_KEY: "tw-secret",
  BACKEND_URL: "http://backend.invalid",
  FRONTEND_URL: "http://frontend.invalid",
  BACKEND_API_KEY: "backend-key",
  SOURCE: "test",
  API_KEY: "api-key"
};

// Requests the bot sends to the GitHub API, answered here instead.
const githubCalls: { method: string; url: string; body: any }[] = [];
const realFetch = globalThis.fetch;
const fakeFetch: typeof fetch = async (input, init) => {
  const url = String(input instanceof Request ? input.url : input);
  if (!url.startsWith("https://api.github.com/")) return realFetch(input, init);
  const method = init?.method ?? "GET";
  const body = init?.body ? JSON.parse(String(init.body)) : undefined;
  githubCalls.push({ method, url, body });
  const data = url.endsWith("/access_tokens")
    ? {
        token: "ghs_test",
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
        permissions: {},
        repository_selection: "all"
      }
    : { id: 1 };
  return new Response(JSON.stringify(data), {
    status: 201,
    headers: { "content-type": "application/json" }
  });
};

const payload = JSON.stringify({
  action: "created",
  installation: { id: 42 },
  sender: { login: "alice", type: "User" },
  repository: {
    name: "widgets",
    owner: { login: "acme", type: "Organization" }
  },
  issue: { number: 7, state: "open", title: "A bug", body: "" },
  comment: { id: 99, body: "/githoney help", user: { login: "alice" } }
});

// The bot reads PORT=0 as unset, so ask the OS for a free port instead.
const freePort = () =>
  new Promise<string>((resolve) => {
    const probe = createServer().listen(0, () => {
      const { port } = probe.address() as AddressInfo;
      probe.close(() => resolve(String(port)));
    });
  });

const sign = (body: string, secret: string) =>
  "sha256=" + createHmac("sha256", secret).update(body).digest("hex");

let server: Server;
let baseUrl: string;

before(async () => {
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  delete process.env.WEBHOOK_PROXY_URL;
  globalThis.fetch = fakeFetch;
  const { startServer } = await import("../src/server");
  server = startServer(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server?.close();
  globalThis.fetch = realFetch;
  rmSync(dir, { recursive: true, force: true });
});

const deliver = (signature: string) =>
  realFetch(`${baseUrl}/webhooks`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-github-event": "issue_comment",
      "x-github-delivery": "00000000-0000-0000-0000-000000000001",
      "x-hub-signature-256": signature
    },
    body: payload
  });

test("a signed delivery to /webhooks reaches the comment handler", async () => {
  githubCalls.length = 0;
  const res = await deliver(sign(payload, SECRET));
  assert.equal(res.status, 200);
  const reply = githubCalls.find(
    (c) =>
      c.method === "POST" &&
      c.url.endsWith("/repos/acme/widgets/issues/7/comments")
  );
  assert.ok(
    reply,
    `no reply posted; GitHub calls: ${JSON.stringify(githubCalls)}`
  );
});

test("a delivery with a wrong signature is rejected before any handler", async () => {
  githubCalls.length = 0;
  const res = await deliver(sign(payload, "not-the-webhook-secret"));
  assert.ok(res.status >= 400 && res.status < 500, `status ${res.status}`);
  assert.deepEqual(githubCalls, []);
});

test("the bot boots with WEBHOOK_PROXY_URL unset", async () => {
  const port = await freePort();
  const childEnv: NodeJS.ProcessEnv = { ...process.env, ...env, PORT: port };
  delete childEnv.WEBHOOK_PROXY_URL;
  // Run from an empty directory so a developer's .env cannot supply the URL.
  const child = spawn(
    process.execPath,
    ["--import", import.meta.resolve("tsx"), ENTRY],
    { cwd: dir, env: childEnv, stdio: ["ignore", "pipe", "pipe"] }
  );
  let output = "";
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`timeout:\n${output}`)),
        20000
      );
      const onData = (chunk: Buffer) => {
        output += chunk;
        if (output.includes("Bot is running")) {
          clearTimeout(timer);
          resolve();
        }
      };
      child.stdout.on("data", onData);
      child.stderr.on("data", onData);
      child.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`exited ${code}:\n${output}`));
      });
    });
  } finally {
    child.kill();
  }
});
