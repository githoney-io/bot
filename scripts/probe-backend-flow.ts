import axios, { AxiosRequestConfig } from "axios";
import chalk from "chalk";
import dotenv from "dotenv";
import minimist from "minimist";

dotenv.config();

const ui = {
  step: (label: string) => chalk.black.bgCyanBright(` ${label} `),
  req: (label: string) => chalk.bold.magenta(label),
  worker: (label: string) => chalk.bold.blue(label),
  ok: (label: string) => chalk.greenBright(label),
  err: (label: string) => chalk.redBright(label),
  info: (label: string) => chalk.yellowBright(label),
  muted: (label: string) => chalk.dim(label)
};

type Command =
  | "create"
  | "assign"
  | "sponsor"
  | "link"
  | "merge"
  | "claim"
  | "cancel"
  | "full";

type HttpMethod = "GET" | "POST";

interface ProbeState {
  bountyId?: number;
  fundingId?: number;
}

interface ProbeConfig {
  backendUrl: string;
  workerUrl: string;
  workerName?: string;
  signingKey: string;
  headers: Record<string, string>;
  continueOnError: boolean;
  command: Command;
  from: "issue" | "pr";
  issue: number;
  pr: number;
  network: "preprod" | "mainnet";
  durationDays: number;
  ada: number;
  sponsorAda: number;
  org: string;
  repo: string;
  orgInPlatformId: string;
  maintainerLogin: string;
  contributorLogin: string;
  sponsorLogin: string;
  maintainerId: number;
  contributorId: number;
  sponsorId: number;
  maintainerAddress: string;
  contributorAddress: string;
  sponsorAddress: string;
}

const USAGE = `
Usage:
  npm run probe:backend -- <command> [options]

Commands:
  create   -> POST /bounty + GET /createBounty/:id + worker sign + POST /submit/:id
  assign   -> POST /bounty/assign + GET /assignBounty/:id + worker sign + POST /submit/:id
  sponsor  -> POST /bounty/sponsor + GET /fundingBounty/:id + worker sign + POST /submit/:id
  link     -> POST /bounty/link
  merge    -> POST /bounty/merge
  claim    -> GET /claimBounty/:id
  cancel   -> POST /bounty/cancel
  full     -> create -> assign -> sponsor -> link -> merge -> claim

Important:
  full usually fails unless previous on-chain submissions already set the needed tx hashes.
  Use per-command mode with existing IDs/state to test specific backend endpoints.

Common options:
  --bountyId <id>              Existing bounty id (required by assign/link/claim/cancel; sponsor resolves issue/org/repo from this id)
  --workerUrl <url>            Worker RPC base URL (default: http://localhost:3001)
  --workerName <name>          Worker RPC route name (default: githoney-worker)
  --signingKey <name>          Worker signing key (default: admin-key)
  --issue <n>                  GitHub issue number (default: 1001)
  --pr <n>                     GitHub PR number (default: issue+1)
  --org <name>                 GitHub org username (default: probe-org)
  --repo <name>                GitHub repo name (default: probe-repo)
  --network <preprod|mainnet>  (default: preprod)
  --continueOnError            Keep running next steps after failures

Address/user overrides:
  --maintainerAddress <addr>
  --contributorAddress <addr>
  --sponsorAddress <addr>
  --maintainerLogin <login> --maintainerId <id>
  --contributorLogin <login> --contributorId <id>
  --sponsorLogin <login> --sponsorId <id>
`;

const PREPROD_DEFAULT_ADDR =
  "addr_test1qpp8qndr4p5cjndgufqctlpklk7c9asf9jz6z76lcmjjyyavuam5ced7vsutn86dghwa46yz8cum5hdc42dv7fedaz6sgkx26d";

function mustInt(value: unknown, name: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new Error(`Invalid integer for ${name}: ${String(value)}`);
  }
  return parsed;
}

function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

type CmlModule = {
  Transaction: { from_cbor_hex: (cborHex: string) => { body: () => unknown } };
  hash_transaction: (txBody: unknown) => { to_hex: () => string };
};

let cmlCache: Promise<CmlModule> | null = null;

async function loadCml(): Promise<CmlModule> {
  if (!cmlCache) {
    cmlCache = (async () => {
      try {
        return (await import(
          "@anastasia-labs/cardano-multiplatform-lib-nodejs"
        )) as CmlModule;
      } catch {
        const moduleUrl = new URL(
          "../../backend/node_modules/@anastasia-labs/cardano-multiplatform-lib-nodejs/cardano_multiplatform_lib.js",
          import.meta.url
        );
        try {
          return (await import(moduleUrl.href)) as CmlModule;
        } catch (err) {
          throw new Error(
            `Could not load Cardano Multiplatform Lib to compute tx hash. Install @anastasia-labs/cardano-multiplatform-lib-nodejs in bot or backend first. Original error: ${String(
              err
            )}`
          );
        }
      }
    })();
  }
  return cmlCache;
}

async function computeTxHashFromCbor(cborHex: string): Promise<string> {
  const cml = await loadCml();
  const tx = cml.Transaction.from_cbor_hex(cborHex);
  return cml.hash_transaction(tx.body()).to_hex();
}

function clip(value: string, max = 140): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...(${value.length} chars)`;
}

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = sanitize(val);
    }
    return out;
  }
  if (typeof value === "string") {
    return clip(value);
  }
  return value;
}

function summarizeResponse(payload: any) {
  const data = payload?.data;
  return {
    msg: payload?.msg,
    botCode: payload?.botCode,
    bountyId: data?.bounty?.id,
    fundingId: data?.fundingId,
    txHash: data?.txHash ?? data?.bounty?.transactionHash,
    network: data?.network?.name ?? data?.network,
    cborLength: typeof data?.cbor === "string" ? data.cbor.length : undefined
  };
}

function logComputedTxHash(hash: string): void {
  console.log(ui.info(`computed tx hash: ${hash}`));
}

function logSignedTx(signedTx: string): void {
  console.log(`\n${ui.info("=== signed tx (full hex) ===")}`);
  console.log(signedTx);
  console.log(ui.info("=== end signed tx ==="));
}

function logSubmittedTxHash(txHash: unknown): void {
  console.log(ui.ok(`submitted tx hash: ${String(txHash ?? "unknown")}`));
}

function mkUser(login: string, id: number) {
  return {
    username: login,
    name: null,
    id,
    email: null,
    avatarUrl: `https://github.com/${login}.png`,
    description: null,
    pageUrl: null,
    userUrl: `https://github.com/${login}`,
    location: null,
    twitterUsername: null
  };
}

function mkOrg(org: string, inPlatformId: string) {
  return {
    username: org,
    name: org,
    avatarUri: `https://github.com/${org}.png`,
    description: null,
    twitterUsername: null,
    pageUrl: null,
    location: null,
    email: null,
    publicRepos: 1,
    followers: 1,
    orgUrl: `https://github.com/${org}`,
    inPlatformId
  };
}

function mkRepo(org: string, repo: string) {
  return {
    name: repo,
    link: `https://github.com/${org}/${repo}`
  };
}

interface SponsorTarget {
  issueNumber: number;
  org: string;
  repo: string;
}

interface CancelTarget {
  from: "issue" | "pr";
  prNumber: number;
  org: string;
  repo: string;
}

async function resolveSponsorTarget(
  cfg: ProbeConfig,
  state: ProbeState
): Promise<SponsorTarget> {
  if (!state.bountyId) {
    return { issueNumber: cfg.issue, org: cfg.org, repo: cfg.repo };
  }

  const bountyRes: any = await callEp(cfg, "GET", `/bounty/${state.bountyId}`);
  const bounty = bountyRes?.data?.bounty;

  const issueRaw = bounty?.issueNumber ?? bounty?.issue_number;
  const issueNumber = Number(issueRaw);
  const repo = bounty?.repository?.name;
  const org =
    bounty?.repository?.organization?.username ??
    bounty?.repository?.organization?.name;

  if (
    !Number.isInteger(issueNumber) ||
    issueNumber <= 0 ||
    typeof repo !== "string" ||
    repo.length === 0 ||
    typeof org !== "string" ||
    org.length === 0
  ) {
    throw new Error(
      `Could not resolve issue/org/repo from /bounty/${state.bountyId}`
    );
  }

  console.log(
    ui.info(
      `resolved sponsor target from bounty ${state.bountyId}: ${org}/${repo}#${issueNumber}`
    )
  );

  return { issueNumber, org, repo };
}

async function resolveCancelTarget(
  cfg: ProbeConfig,
  state: ProbeState
): Promise<CancelTarget> {
  if (!state.bountyId) {
    return {
      from: cfg.from,
      prNumber: cfg.from === "issue" ? cfg.issue : cfg.pr,
      org: cfg.org,
      repo: cfg.repo
    };
  }

  const bountyRes: any = await callEp(cfg, "GET", `/bounty/${state.bountyId}`);
  const bounty = bountyRes?.data?.bounty;

  const issueNumber = Number(bounty?.issueNumber ?? bounty?.issue_number);
  const prNumberRaw = bounty?.prNumber ?? bounty?.pr_number;
  const prNumber = Number(prNumberRaw);
  const hasLinkedPr = Number.isInteger(prNumber) && prNumber > 0;
  const from: "issue" | "pr" = hasLinkedPr ? "pr" : "issue";
  const number = hasLinkedPr ? prNumber : issueNumber;

  const repo = bounty?.repository?.name;
  const org =
    bounty?.repository?.organization?.username ??
    bounty?.repository?.organization?.name;

  if (
    !Number.isInteger(number) ||
    number <= 0 ||
    typeof repo !== "string" ||
    repo.length === 0 ||
    typeof org !== "string" ||
    org.length === 0
  ) {
    throw new Error(
      `Could not resolve cancel target from /bounty/${state.bountyId}`
    );
  }

  console.log(
    ui.info(
      `resolved cancel target from bounty ${state.bountyId}: from=${from} ${org}/${repo}#${number}`
    )
  );

  return { from, prNumber: number, org, repo };
}

async function callEp<T = any>(
  cfg: ProbeConfig,
  method: HttpMethod,
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${cfg.backendUrl}${path}`;
  const req: AxiosRequestConfig = {
    method,
    url,
    headers: {
      ...cfg.headers,
      "content-type": "application/json"
    },
    validateStatus: () => true
  };
  if (body !== undefined) {
    req.data = body;
  }

  console.log(`\n${ui.req(`>>> ${method} ${path}`)}`);
  if (body !== undefined) {
    console.log(ui.muted(`payload: ${JSON.stringify(sanitize(body), null, 2)}`));
  }

  const res = await axios.request(req);
  if (res.status >= 200 && res.status < 300) {
    console.log(ui.ok(`status: ${res.status}`));
    console.log(`response: ${JSON.stringify(summarizeResponse(res.data), null, 2)}`);
    return res.data as T;
  }

  console.log(ui.err(`status: ${res.status}`));
  console.log(ui.err(`error: ${JSON.stringify(sanitize(res.data), null, 2)}`));
  throw new Error(`${method} ${path} failed with ${res.status}`);
}

async function callWorker<T = any>(
  cfg: ProbeConfig,
  handler: string,
  params: object
): Promise<T> {
  const workerBase = cfg.workerName
    ? `${cfg.workerUrl}/${cfg.workerName}`
    : cfg.workerUrl;
  const reqBody = { method: handler, params };

  console.log(
    `\n${ui.worker(`>>> POST ${workerBase} (worker method: ${handler})`)}`
  );
  console.log(ui.muted(`payload: ${JSON.stringify(sanitize(reqBody), null, 2)}`));

  const res = await axios.post(workerBase, reqBody, {
    headers: {
      "content-type": "application/json"
    },
    validateStatus: () => true
  });

  if (res.status < 200 || res.status >= 300) {
    console.log(ui.err(`status: ${res.status}`));
    console.log(ui.err(`error: ${JSON.stringify(sanitize(res.data), null, 2)}`));
    throw new Error(`Worker call "${handler}" failed with ${res.status}`);
  }

  if (typeof res.data?.error === "string") {
    throw new Error(`Worker error for "${handler}": ${res.data.error}`);
  }

  console.log(ui.ok(`status: ${res.status}`));
  console.log(`response: ${JSON.stringify(sanitize(res.data), null, 2)}`);
  return res.data as T;
}

async function runStep(
  cfg: ProbeConfig,
  title: string,
  fn: () => Promise<void>
): Promise<void> {
  console.log(`\n${ui.step(`STEP: ${title}`)}`);
  try {
    await fn();
  } catch (err) {
    console.error(ui.err(`step error: ${String(err)}`));
    if (!cfg.continueOnError) {
      throw err;
    }
  }
}

async function stepCreate(
  cfg: ProbeConfig,
  state: ProbeState
): Promise<void> {
  const org = mkOrg(cfg.org, cfg.orgInPlatformId);
  const repo = mkRepo(cfg.org, cfg.repo);
  const maintainer = mkUser(cfg.maintainerLogin, cfg.maintainerId);

  const createPayload = {
    address: cfg.maintainerAddress,
    tokens: [{ name: "ADA", amount: cfg.ada }],
    title: `Probe bounty ${Date.now()}`,
    description: "Created by scripts/probe-backend-flow.ts",
    duration: cfg.durationDays * 24 * 60 * 60 * 1000,
    creator: maintainer,
    organization: org,
    repository: repo,
    network: cfg.network,
    platform: "github",
    categories: [],
    issue: cfg.issue,
    issueUrl: `https://github.com/${cfg.org}/${cfg.repo}/issues/${cfg.issue}`
  };

  const createRes: any = await callEp(cfg, "POST", "/bounty", createPayload);
  state.bountyId = createRes?.data?.bounty?.id;
  state.fundingId = createRes?.data?.fundingId;
  if (!state.bountyId) {
    throw new Error("Could not extract bounty id from /bounty response");
  }
  if (!state.fundingId) {
    throw new Error("Could not extract funding id from /bounty response");
  }

  const offchainRes: any = await callEp(cfg, "GET", `/createBounty/${state.bountyId}`);
  const cbor = offchainRes?.data?.cbor;
  if (typeof cbor !== "string" || cbor.length === 0) {
    throw new Error("Could not extract cbor from /createBounty response");
  }

  const hash = await computeTxHashFromCbor(cbor);
  logComputedTxHash(hash);

  const signRes: any = await callWorker(cfg, "sign-tx", {
    key_name: cfg.signingKey,
    payload: {
      hash,
      tx: cbor
    }
  });
  const signedTx = signRes?.signed_tx;
  if (typeof signedTx !== "string" || signedTx.length === 0) {
    throw new Error("Worker sign-tx did not return signed_tx");
  }
  logSignedTx(signedTx);

  const submitRes: any = await callEp(cfg, "POST", `/submit/${state.bountyId}`, {
    cbor: signedTx,
    operation: "create",
    fundingId: state.fundingId
  });
  logSubmittedTxHash(submitRes?.data?.txHash);
}

async function stepAssign(
  cfg: ProbeConfig,
  state: ProbeState
): Promise<void> {
  if (!state.bountyId) {
    throw new Error("Missing bountyId. Pass --bountyId or run create first.");
  }

  const assignPayload = {
    bountyId: state.bountyId,
    assignee: mkUser(cfg.contributorLogin, cfg.contributorId),
    address: cfg.contributorAddress,
    platform: "github"
  };

  await callEp(cfg, "POST", "/bounty/assign", assignPayload);
  const offchainRes: any = await callEp(cfg, "GET", `/assignBounty/${state.bountyId}`, {
    address: cfg.contributorAddress
  });
  const cbor = offchainRes?.data?.cbor;
  if (typeof cbor !== "string" || cbor.length === 0) {
    throw new Error("Could not extract cbor from /assignBounty response");
  }

  const hash = await computeTxHashFromCbor(cbor);
  logComputedTxHash(hash);

  const signRes: any = await callWorker(cfg, "sign-tx", {
    key_name: cfg.signingKey,
    payload: {
      hash,
      tx: cbor
    }
  });
  const signedTx = signRes?.signed_tx;
  if (typeof signedTx !== "string" || signedTx.length === 0) {
    throw new Error("Worker sign-tx did not return signed_tx");
  }
  logSignedTx(signedTx);

  const submitRes: any = await callEp(cfg, "POST", `/submit/${state.bountyId}`, {
    cbor: signedTx,
    operation: "assign",
    address: cfg.contributorAddress
  });
  logSubmittedTxHash(submitRes?.data?.txHash);
}

async function stepSponsor(
  cfg: ProbeConfig,
  state: ProbeState
): Promise<void> {
  const sponsorTarget = await resolveSponsorTarget(cfg, state);
  const sponsorPayload = {
    bountyId: state.bountyId,
    tokens: [{ name: "ADA", amount: cfg.sponsorAda }],
    address: cfg.sponsorAddress,
    sponsor: mkUser(cfg.sponsorLogin, cfg.sponsorId),
    platform: "github",
    issueNumber: sponsorTarget.issueNumber,
    organization: mkOrg(sponsorTarget.org, cfg.orgInPlatformId),
    repository: mkRepo(sponsorTarget.org, sponsorTarget.repo)
  };

  const sponsorRes: any = await callEp(cfg, "POST", "/bounty/sponsor", sponsorPayload);
  if (!state.bountyId) {
    state.bountyId = sponsorRes?.data?.bounty?.id;
  }
  state.fundingId = sponsorRes?.data?.fundingId;

  if (!state.bountyId || !state.fundingId) {
    throw new Error("Could not extract bountyId/fundingId from /bounty/sponsor response");
  }

  const offchainRes: any = await callEp(cfg, "GET", `/fundingBounty/${state.bountyId}`, {
    fundingId: state.fundingId
  });

  const cbor = offchainRes?.data?.cbor;
  if (typeof cbor !== "string" || cbor.length === 0) {
    throw new Error("Could not extract cbor from /fundingBounty response");
  }

  const hash = await computeTxHashFromCbor(cbor);
  logComputedTxHash(hash);

  const signRes: any = await callWorker(cfg, "sign-tx", {
    key_name: cfg.signingKey,
    payload: {
      hash,
      tx: cbor
    }
  });
  const signedTx = signRes?.signed_tx;
  if (typeof signedTx !== "string" || signedTx.length === 0) {
    throw new Error("Worker sign-tx did not return signed_tx");
  }
  logSignedTx(signedTx);

  const submitRes: any = await callEp(cfg, "POST", `/submit/${state.bountyId}`, {
    cbor: signedTx,
    operation: "funding",
    fundingId: state.fundingId
  });
  logSubmittedTxHash(submitRes?.data?.txHash);
}

async function stepLink(
  cfg: ProbeConfig,
  state: ProbeState
): Promise<void> {
  if (!state.bountyId) {
    throw new Error("Missing bountyId. Pass --bountyId or run create first.");
  }

  const linkPayload = {
    contributor: mkUser(cfg.contributorLogin, cfg.contributorId),
    bountyId: state.bountyId,
    prNumber: cfg.pr,
    platform: "github"
  };
  await callEp(cfg, "POST", "/bounty/link", linkPayload);
}

async function stepMerge(
  cfg: ProbeConfig
): Promise<void> {
  const payload = {
    prNumber: cfg.pr,
    organization: mkOrg(cfg.org, cfg.orgInPlatformId),
    repository: mkRepo(cfg.org, cfg.repo),
    platform: "github"
  };
  await callEp(cfg, "POST", "/bounty/merge", payload);
}

async function stepClaim(
  cfg: ProbeConfig,
  state: ProbeState
): Promise<void> {
  if (!state.bountyId) {
    throw new Error("Missing bountyId. Pass --bountyId.");
  }
  const offchainRes: any = await callEp(cfg, "GET", `/claimBounty/${state.bountyId}`);
  const cbor = offchainRes?.data?.cbor;
  if (typeof cbor !== "string" || cbor.length === 0) {
    throw new Error("Could not extract cbor from /claimBounty response");
  }

  const hash = await computeTxHashFromCbor(cbor);
  logComputedTxHash(hash);

  const signRes: any = await callWorker(cfg, "sign-tx", {
    key_name: cfg.signingKey,
    payload: {
      hash,
      tx: cbor
    }
  });
  const signedTx = signRes?.signed_tx;
  if (typeof signedTx !== "string" || signedTx.length === 0) {
    throw new Error("Worker sign-tx did not return signed_tx");
  }
  logSignedTx(signedTx);

  const submitRes: any = await callEp(cfg, "POST", `/submit/${state.bountyId}`, {
    cbor: signedTx,
    operation: "claim"
  });
  logSubmittedTxHash(submitRes?.data?.txHash);
}

async function stepCancel(
  cfg: ProbeConfig,
  state: ProbeState
): Promise<void> {
  const target = await resolveCancelTarget(cfg, state);
  const payload = {
    bountyId: state.bountyId,
    from: target.from,
    prNumber: target.prNumber,
    organization: mkOrg(target.org, cfg.orgInPlatformId),
    repository: mkRepo(target.org, target.repo),
    platform: "github"
  };
  await callEp(cfg, "POST", "/bounty/cancel", payload);
}

function parseConfig(): { cfg: ProbeConfig; state: ProbeState } {
  const args = minimist(process.argv.slice(2), {
    boolean: ["help", "continueOnError"],
    string: [
      "backendUrl",
      "workerUrl",
      "workerName",
      "signingKey",
      "from",
      "network",
      "org",
      "repo",
      "orgInPlatformId",
      "maintainerLogin",
      "contributorLogin",
      "sponsorLogin",
      "maintainerAddress",
      "contributorAddress",
      "sponsorAddress"
    ]
  });

  if (args.help) {
    console.log(USAGE);
    process.exit(0);
  }

  const command = String(args._[0] ?? "full").toLowerCase() as Command;
  const allowed: Command[] = [
    "create",
    "assign",
    "sponsor",
    "link",
    "merge",
    "claim",
    "cancel",
    "full"
  ];
  if (!allowed.includes(command)) {
    throw new Error(`Unknown command: ${command}`);
  }

  const issue = mustInt(args.issue ?? 1001, "issue");
  const pr = mustInt(args.pr ?? issue + 1, "pr");
  const network = String(args.network ?? "preprod").toLowerCase();
  if (network !== "preprod" && network !== "mainnet") {
    throw new Error(`Invalid network: ${network}`);
  }

  if (
    network === "mainnet" &&
    (!args.maintainerAddress ||
      !args.contributorAddress ||
      !args.sponsorAddress)
  ) {
    throw new Error(
      "Mainnet mode requires --maintainerAddress, --contributorAddress and --sponsorAddress"
    );
  }

  const defaultAddress = PREPROD_DEFAULT_ADDR;

  const backendUrl = stripTrailingSlash(
    String(args.backendUrl ?? process.env.BACKEND_URL ?? "http://localhost:3000")
  );
  const workerUrl = stripTrailingSlash(
    String(args.workerUrl ?? process.env.WORKER_URL ?? "http://localhost:3001")
  );
  const workerName = String(
    args.workerName ?? process.env.WORKER_NAME ?? "githoney-worker"
  );
  const signingKey = String(
    args.signingKey ?? process.env.PROBE_SIGNING_KEY ?? "admin-key"
  );
  const apiKey = process.env.BACKEND_API_KEY;
  const source = process.env.SOURCE;
  const headers: Record<string, string> = {};
  if (apiKey) headers["x-api-key"] = apiKey;
  if (source) headers["x-source"] = source;

  const cfg: ProbeConfig = {
    backendUrl,
    workerUrl,
    workerName,
    signingKey,
    headers,
    continueOnError: Boolean(args.continueOnError),
    command,
    from: String(args.from ?? "issue") === "pr" ? "pr" : "issue",
    issue,
    pr,
    network: network as "preprod" | "mainnet",
    durationDays: mustInt(args.durationDays ?? 7, "durationDays"),
    ada: mustInt(args.ada ?? 12, "ada"),
    sponsorAda: mustInt(args.sponsorAda ?? 6, "sponsorAda"),
    org: String(args.org ?? "probe-org"),
    repo: String(args.repo ?? "probe-repo"),
    orgInPlatformId: String(args.orgInPlatformId ?? "999001"),
    maintainerLogin: String(args.maintainerLogin ?? "probe-maintainer"),
    contributorLogin: String(args.contributorLogin ?? "probe-contributor"),
    sponsorLogin: String(args.sponsorLogin ?? "probe-sponsor"),
    maintainerId: mustInt(args.maintainerId ?? 910001, "maintainerId"),
    contributorId: mustInt(args.contributorId ?? 910002, "contributorId"),
    sponsorId: mustInt(args.sponsorId ?? 910003, "sponsorId"),
    maintainerAddress: String(args.maintainerAddress ?? defaultAddress),
    contributorAddress: String(args.contributorAddress ?? defaultAddress),
    sponsorAddress: String(args.sponsorAddress ?? defaultAddress)
  };

  const state: ProbeState = {};
  if (args.bountyId !== undefined) {
    state.bountyId = mustInt(args.bountyId, "bountyId");
  }
  if (args.fundingId !== undefined) {
    state.fundingId = mustInt(args.fundingId, "fundingId");
  }

  return { cfg, state };
}

async function main() {
  const { cfg, state } = parseConfig();

  console.log(ui.step("PROBE CONFIGURATION"));
  console.log(
    JSON.stringify(
      sanitize({
        command: cfg.command,
        backendUrl: cfg.backendUrl,
        workerUrl: cfg.workerUrl,
        workerName: cfg.workerName,
        signingKey: cfg.signingKey,
        issue: cfg.issue,
        pr: cfg.pr,
        org: cfg.org,
        repo: cfg.repo,
        network: cfg.network,
        continueOnError: cfg.continueOnError,
        headers: Object.keys(cfg.headers),
        initialState: state
      }),
      null,
      2
    )
  );

  switch (cfg.command) {
    case "create":
      await runStep(cfg, "create", () => stepCreate(cfg, state));
      break;
    case "assign":
      await runStep(cfg, "assign", () => stepAssign(cfg, state));
      break;
    case "sponsor":
      await runStep(cfg, "sponsor", () => stepSponsor(cfg, state));
      break;
    case "link":
      await runStep(cfg, "link", () => stepLink(cfg, state));
      break;
    case "merge":
      await runStep(cfg, "merge", () => stepMerge(cfg));
      break;
    case "claim":
      await runStep(cfg, "claim", () => stepClaim(cfg, state));
      break;
    case "cancel":
      await runStep(cfg, "cancel", () => stepCancel(cfg, state));
      break;
    case "full":
      await runStep(cfg, "create", () => stepCreate(cfg, state));
      await runStep(cfg, "assign", () => stepAssign(cfg, state));
      await runStep(cfg, "sponsor", () => stepSponsor(cfg, state));
      await runStep(cfg, "link", () => stepLink(cfg, state));
      await runStep(cfg, "merge", () => stepMerge(cfg));
      await runStep(cfg, "claim", () => stepClaim(cfg, state));
      break;
    default:
      throw new Error(`Unhandled command: ${cfg.command as string}`);
  }

  console.log(`\n${ui.step("FINAL STATE")}`);
  console.log(JSON.stringify(state, null, 2));
}

main().catch((err) => {
  console.error(`\n${ui.err(`Probe failed: ${String(err)}`)}`);
  process.exit(1);
});
