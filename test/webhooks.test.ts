import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHmac, generateKeyPairSync } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { AddressInfo, createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ClientRequest,
  IncomingMessage,
  Server,
  ServerResponse
} from "node:http";
import { gzipSync } from "node:zlib";
import {
  WEBHOOK_BODY_LIMIT,
  WEBHOOK_MAX_INFLIGHT
} from "../src/config/express";

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

// The comment payload padded to exactly `size` bytes.
const padded = (size: number) => {
  const base = JSON.stringify({ ...JSON.parse(payload), padding: "" });
  return JSON.stringify({
    ...JSON.parse(payload),
    padding: "x".repeat(size - base.length)
  });
};

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
  // Set it empty rather than deleting it, so dotenv cannot refill it from a
  // developer's .env; the config reads an empty value as unset.
  process.env.WEBHOOK_PROXY_URL = "";
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

const deliveryHeaders = (signature: string) => ({
  "content-type": "application/json",
  "x-github-event": "issue_comment",
  "x-github-delivery": "00000000-0000-0000-0000-000000000001",
  "x-hub-signature-256": signature
});

const deliver = (
  signature: string,
  body: string | Buffer = payload,
  headers: Record<string, string> = {}
) =>
  realFetch(`${baseUrl}/webhooks`, {
    method: "POST",
    headers: { ...deliveryHeaders(signature), ...headers },
    body
  });

const replyPosted = () =>
  githubCalls.some(
    (c) =>
      c.method === "POST" &&
      c.url.endsWith("/repos/acme/widgets/issues/7/comments")
  );

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

// Installation events list every repository, so deliveries of a few MB are
// real; the route must accept up to 5 MB whatever the constant says.
const REQUIRED_BODY_SIZE = 5 * 1024 * 1024;

// Buffered bodies hold about three times their size. The chart limits the pod
// to 512Mi and the image's npm, tsx and bot processes take about 210 MiB at
// rest, so reads in flight must stay within 128 MiB.
const READ_BUDGET = 128 * 1024 * 1024;

test("the concurrent read limit keeps buffered bodies within the memory budget", () => {
  assert.ok(
    WEBHOOK_MAX_INFLIGHT * WEBHOOK_BODY_LIMIT * 3 <= READ_BUDGET,
    `${WEBHOOK_MAX_INFLIGHT} reads of ${WEBHOOK_BODY_LIMIT} bytes exceed the budget`
  );
});

test("a signed delivery just under 5 MB reaches the handler", async () => {
  githubCalls.length = 0;
  const body = padded(REQUIRED_BODY_SIZE - 4096);
  const res = await deliver(sign(body, SECRET), body);
  assert.equal(res.status, 200);
  assert.ok(replyPosted(), `no reply; GitHub calls: ${githubCalls.length}`);
});

test("a signed delivery over the body limit is refused before any handler", async () => {
  githubCalls.length = 0;
  const body = padded(WEBHOOK_BODY_LIMIT + 1);
  const res = await deliver(sign(body, SECRET), body);
  assert.equal(res.status, 413);
  assert.deepEqual(githubCalls, []);
});

test("a declared oversized body is refused before it is read", async () => {
  const url = new URL(`${baseUrl}/webhooks`);
  const status = await new Promise<number>((resolve, reject) => {
    const req = httpRequest({
      host: url.hostname,
      port: url.port,
      path: url.pathname,
      method: "POST",
      agent: false,
      headers: {
        ...deliveryHeaders(sign(payload, SECRET)),
        "content-length": String(1024 * 1024 * 1024)
      }
    });
    const timer = setTimeout(() => reject(new Error("no response")), 5000);
    req.on("response", (res) => {
      clearTimeout(timer);
      res.resume();
      resolve(res.statusCode ?? 0);
      req.destroy();
    });
    req.on("error", () => {});
    req.write(payload);
  });
  assert.equal(status, 413);
});

test("a gzip-encoded delivery is refused unread", async () => {
  githubCalls.length = 0;
  const res = await deliver(sign(payload, SECRET), gzipSync(payload), {
    "content-encoding": "gzip"
  });
  assert.equal(res.status, 415);
  assert.deepEqual(githubCalls, []);
});

test("a body-parser error is answered as JSON without a stack trace", async () => {
  const res = await deliver(sign(payload, SECRET), payload, {
    "content-type": "application/json; charset=bogus"
  });
  assert.equal(res.status, 415);
  assert.match(res.headers.get("content-type") ?? "", /^application\/json/);
  const text = await res.text();
  assert.ok(JSON.parse(text).error, text);
  assert.doesNotMatch(text, /node_modules|\bat /);
});

test("deliveries past the concurrent read limit get 503 until a slot frees", async () => {
  // Hold every read slot with requests whose bodies never finish. The
  // server's responses to them show whether each one was admitted.
  const held: ServerResponse[] = [];
  const accepted = new Promise<void>((resolve) => {
    const onRequest = (_req: IncomingMessage, res: ServerResponse) => {
      held.push(res);
      if (held.length === WEBHOOK_MAX_INFLIGHT) {
        server.off("request", onRequest);
        setImmediate(resolve);
      }
    };
    server.on("request", onRequest);
  });
  let heldResponses = 0;
  const url = new URL(`${baseUrl}/webhooks`);
  const pending: ClientRequest[] = [];
  for (let i = 0; i < WEBHOOK_MAX_INFLIGHT; i++) {
    const req = httpRequest({
      host: url.hostname,
      port: url.port,
      path: url.pathname,
      method: "POST",
      agent: false,
      headers: {
        ...deliveryHeaders(sign(payload, SECRET)),
        "content-length": String(payload.length)
      }
    });
    req.on("error", () => {});
    req.on("response", (res) => {
      heldResponses++;
      res.resume();
    });
    req.write(payload.slice(0, 10));
    pending.push(req);
  }
  try {
    await accepted;
    githubCalls.length = 0;
    const refused = await deliver(sign(payload, SECRET));
    assert.equal(refused.status, 503);
    assert.deepEqual(githubCalls, []);
    // Every held upload was admitted: none was answered, so all of them are
    // still being read when the next delivery is refused.
    const answered = held.filter((res) => res.headersSent).length;
    assert.equal(answered, 0, `${answered} held uploads were answered`);
    assert.equal(
      heldResponses,
      0,
      `${heldResponses} held uploads got a response`
    );
  } finally {
    for (const req of pending) req.destroy();
  }

  let res = await deliver(sign(payload, SECRET));
  for (let i = 0; i < 50 && res.status === 503; i++) {
    await new Promise((r) => setTimeout(r, 20));
    res = await deliver(sign(payload, SECRET));
  }
  assert.equal(res.status, 200);
  assert.ok(replyPosted(), `no reply; GitHub calls: ${githubCalls.length}`);
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
