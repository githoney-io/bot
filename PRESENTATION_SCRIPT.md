# Githoney Presentation Script

Audience: client with low prior context  
Duration: 20-30 min (slides + live demo)

## 1) Opening (Slide 1)
"Today I’ll show Githoney: turning GitHub issues into on-chain funded bounties on Cardano. Then I’ll run a live flow so you can see real commands, real transactions, and payout logic."

## 2) What Githoney Is (Slide 2)
"Githoney lets a maintainer fund a GitHub issue with ADA. The reward is locked on-chain. A contributor can work the issue and get paid when the PR is merged."

## 3) Roles (Slide 3)
"There are three roles:
- Maintainer: creates and funds the bounty
- Sponsor: can add extra funds
- Contributor: accepts, links PR, and claims reward after merge"

"All bot actions follow `/githoney <command> --param value`."

## 4) Current Scope (Slide 4)
"This sprint focused on two things:
- Offchain migration to Balius + tx3
- New bug bounty flow with pre-assignment to the reporter"

## 5) Offchain Migration (Slides 5-7)
"Before: offchain tx logic lived in backend code.  
Now: backend keeps business logic and DB state, and calls a dedicated Balius worker service for tx building/signing/submission workflows."

"Architecture in practice:
1. GitHub webhook arrives at the bot
2. Bot parses command and calls backend
3. Backend persists business state and provides sign links
4. Worker handles transaction build/sign/submit and chainsync callbacks
5. Chain confirmation drives follow-up actions"

"For user-signed operations (create/fund/assign/claim), users sign from the frontend with their Cardano wallet.  
For automatic operations (merge/cancel), backend triggers worker signing with service keys."

## 6) Bug Bounty Difference (Slides 8-11)
"Standard bounty is open: anyone can accept.  
Bug bounty is pre-assigned: reporter registers first, then maintainer funds and assigns to that reporter."

"In code, this is driven by two commands:
- `/githoney report-bug --address ...`
- `/githoney create-bug-bounty --tokens ADA=... --address ... --duration ... --network preprod`"

"After the bug-bounty create tx confirms, backend callback triggers the bot to post an assign-sign link. After assign confirms, the bot announces the reporter is assigned."

## 7) Live Demo Script (Exact)

### 7.1 Setup line
"I’ll run this on preprod so I can show real transaction flow quickly."

### 7.2 Standard bounty quick pass (mental model)
1. In an open GitHub issue, from maintainer account:
```text
/githoney create-bounty --tokens ADA=20 --address <maintainer_preprod_addr> --duration 7 --network preprod
```
2. Say while signing:
"Bot returned bounty ID + sign link. I sign, and funds are now contract-locked."

3. Optional sponsor (current backend supports one sponsor per bounty):
```text
/githoney sponsor-bounty --tokens ADA=5 --address <sponsor_preprod_addr>
```

4. Contributor accepts:
```text
/githoney accept-bounty --bountyId <id> --address <contributor_preprod_addr>
```

5. Contributor links in PR comment or PR body:
```text
/githoney link-bounty --bountyId <id>
```

6. Maintainer merges PR.
Say:
"On merge webhook, backend triggers merge tx automatically and bot posts claim link."

7. Contributor signs claim from link.
Say:
"Reward is released to contributor wallet after claim signing."

### 7.3 Bug bounty flow (new feature)
1. Reporter on issue:
```text
/githoney report-bug --address <reporter_preprod_addr>
```
Say:
"This stores reporter identity/address and labels the issue for bug-bounty flow."

2. Maintainer on same issue:
```text
/githoney create-bug-bounty --tokens ADA=30 --address <maintainer_preprod_addr> --duration 7 --network preprod
```
Say:
"Now we create the bounty in bug mode with reporter pre-designated in backend state."

3. Maintainer signs create tx.
Say:
"After confirmation, bot posts the assign-sign link automatically from backend callback."

4. Maintainer signs assign tx.
Say:
"Now reporter is locked as contributor on-chain for this bounty."

5. Reporter opens PR + links bounty:
```text
/githoney link-bounty --bountyId <id>
```

6. Maintainer merges PR; reporter signs claim.
Say:
"Same finish as standard flow: merge event, claim link, payout."

## 8) Safety Lines If Something Is Slow
Use these lines live if chain confirmation is delayed:
- "The command succeeded and sign link is already generated; chain confirmation can take a bit on preprod."
- "I’ll switch to a pre-created bounty to continue the flow without waiting."
- "The important part here is the webhook-driven state transition: create confirm -> assign link -> assign confirm -> reporter assigned."

## 9) Q&A Short Answers
- Blockchain: Cardano (preprod for demo).
- Supported token today: ADA.
- Minimum bounty amount: 10 ADA.
- Expiry behavior: backend `/bounty/update` closes expired bounties and asks bot to close issue/PR.
- Merge/close automation: handled from GitHub webhooks.

## 10) Pre-demo Checklist
- Backend up (`backend`, default `:3000`)
- Bot up (`bot`, `PORT` from env; default in code is `3001`)
- Worker + tx builder up (`balius-backend`)
- Website up (`website`)
- GitHub App installed in demo org/repo
- Preprod wallets funded (maintainer/reporter/contributor/sponsor as needed)
- At least one dry-run completed
