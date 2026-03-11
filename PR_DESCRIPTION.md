# feat: Bug Bounty Commands + Webhook Endpoints

## Overview

Adds two new bot commands (`/githoney report-bug` and `/githoney create-bug-bounty`) and two new backend-facing webhook endpoints (`POST /bug-bounty-confirmed`, `POST /bug-bounty-assigned`) to support the bug bounty lifecycle. Also includes several robustness improvements to webhook handling and error reporting.

---

## Changes

### 1. New Command: `/githoney report-bug --address addr1...`

Handled by `src/handlers/reportBug.ts`.

A GitHub user (the bug reporter) runs this command on an open issue to register themselves as the future contributor before a bounty exists on-chain. Flow:

1. Validates the provided Cardano address (bech32 prefix check).
2. Calls `POST /bounty/bug-report` on the backend to persist `(issueNumber, repo, org, reporterAddress, reporterGithubUser)`.
3. Adds labels `bug` and `githoney-bug-bounty` to the issue (non-blocking).
4. Replies with `REPORT_BUG_SUCCESS`.

On error, maps `BUG_ALREADY_REPORTED` and `ADDRESS_OWNED_BY_OTHER_USER` backend codes to user-facing messages.

### 2. New Command: `/githoney create-bug-bounty`

Handled by `src/handlers/createBugBounty.ts`.

A maintainer runs this after a bug report exists. Flow:

1. Calls `GET /bounty/bug-report` to retrieve the reporter's address. Rejects with `CREATE_BUG_BOUNTY_NO_REPORT` if none is found.
2. Calls `POST /bounty` with `isBugReport: true` and `reporterAddress` to create the bounty record.
3. Returns the sign URL pointing to the create-transaction signing page, identical to the regular bounty create flow.
4. Adds the `githoney-bounty` label (non-blocking).

### 3. New Endpoint: `POST /bug-bounty-confirmed`

Handled by `src/endpoint/bugBountyConfirmed.ts`. Called by the backend after the create transaction is confirmed on-chain.

1. Fetches the bounty from the backend to resolve the maintainer's wallet address.
2. Constructs a sign URL for the assign transaction (`/bounty/sign/:id/assign?addr=...`).
3. Iterates GitHub App installations to find the matching org and posts `BUG_BOUNTY_ASSIGN_LINK` as a comment, prompting the maintainer to sign the assignment.

### 4. New Endpoint: `POST /bug-bounty-assigned`

Handled by `src/endpoint/bugBountyAssigned.ts`. Called by the backend after the assign transaction is confirmed on-chain.

Finds the correct installation and posts `BUG_BOUNTY_ASSIGN_CONFIRMED` to notify the reporter they are now locked in as contributor.

Both webhook endpoints are protected by `apiKeyMiddleware` and respond `404` if no matching installation is found, without failing the confirmation flow on the backend side.

### 5. New `getEp` Helper (`src/helpers.ts`)

A GET counterpart to the existing `callEp`, used to query `GET /bounty/bug-report` and `GET /bounty/:id` from handlers and endpoint controllers.

### 6. `apiKeyMiddleware` — Multi-key Support (`src/middlewares/apiKey.middleware.ts`)

The middleware now accepts a list of valid keys (`API_KEY`, `TW_SECRET_KEY`, `BOT_KEY` env fallback) instead of a single one. Duplicate and empty values are filtered out. This allows the backend to call the bot's webhook endpoints using whichever key is configured on its side without requiring exact key alignment.

### 7. `sponsorBounty` — Pass `bountyId` (`src/handlers/sponsorBounty.ts`)

The `bountyId` parsed from the command is now forwarded to the backend's `POST /bounty/sponsor` call, enabling the backend to look up the bounty directly by ID rather than by issue number alone.

### 8. New Responses (`src/responses.ts`)

| Key | When used |
|---|---|
| `REPORT_BUG_SUCCESS` | After successful bug registration |
| `BUG_ALREADY_REPORTED` | Backend rejects duplicate report |
| `ADDRESS_OWNED_BY_OTHER_USER` | Address already linked to a different user |
| `INVALID_CARDANO_ADDRESS` | Client-side address format check fails |
| `CREATE_BUG_BOUNTY_NO_REPORT` | No prior bug report found for the issue |
| `BUG_BOUNTY_ASSIGN_LINK` | Prompts maintainer to sign assign tx |
| `BUG_BOUNTY_ASSIGN_CONFIRMED` | Notifies reporter they have been assigned |

Also updated `BOUNTY_ACCEPTED` copy to clarify that only the assigned contributor can claim the reward.

### 9. New Bot Error Codes (`src/utils/constants.ts`)

```ts
BUG_ALREADY_REPORTED:      "BugAlreadyReported"
ADDRESS_OWNED_BY_OTHER_USER: "AddressOwnedByOtherUser"
```

New command keys:
```ts
REPORT_BUG:       "report-bug"
CREATE_BUG_BOUNTY: "create-bug-bounty"
```

### 10. Webhook Robustness Improvements (`src/adapters.ts`, `src/index.ts`)

Several hardening changes made while testing the new flow:

- **`installation_repositories.added`** — now also upserts the organization record before registering repositories, and skips non-org installations.
- **EventSource error handling** — `onopen` and `onerror` callbacks added for the webhook proxy connection.
- **Signature field** — `verifyAndReceive` now prefers `x-hub-signature-256` (SHA-256) over the deprecated `x-hub-signature` (SHA-1), and handles missing signatures gracefully.
- **Delivery ID field** — falls back to `x-github-delivery` if `x-request-id` is absent.
- **`verifyAndReceive` errors** are now caught and logged instead of propagating silently.
- **`webhooks` middleware path** corrected from `/webhook` to `/webhooks` to match the frontend and backend convention.
- **`commandErrorHandler`** wrapped in try/catch so a failure to post an error reply cannot mask the original error.
- **`onAny` / `onError` listeners** added for debug-level logging of all incoming webhook events and handler errors.

---

## Files Changed

| Path | Type |
|---|---|
| `src/handlers/reportBug.ts` | New |
| `src/handlers/createBugBounty.ts` | New |
| `src/endpoint/bugBountyConfirmed.ts` | New |
| `src/endpoint/bugBountyAssigned.ts` | New |
| `src/interfaces/core.interface.ts` | `ReportBugParams`, `CreateBugBountyParams`; `bountyId` on sponsor |
| `src/helpers.ts` | `getEp`; `commandErrorHandler` hardening; new error code mappings |
| `src/middlewares/apiKey.middleware.ts` | Multi-key acceptance |
| `src/responses.ts` | 7 new response templates |
| `src/utils/constants.ts` | New commands and bot error codes |
| `src/core.ts` | Route new commands; case-insensitive prefix check |
| `src/adapters.ts` | Webhook hardening; org upsert on repo add |
| `src/index.ts` | Register new endpoints; fix webhook middleware path |
| `src/handlers/sponsorBounty.ts` | Forward `bountyId` |
| `.gitignore` | Ignore private key files |
