import appConfig from "./config/app-config";

interface ICreateBountySuccess {
  amount: number;
  deadline: number;
  address: string;
  bountyId: number;
  signUrl: string;
  isTestnet?: boolean;
}
const CREATE_BOUNTY_SUCCESS = (params: ICreateBountySuccess) => `
  ### New bounty created for this issue! 🎊

  ${params.isTestnet ? "#### TESTNET MODE" : ""}

  > 🍯 Reward: **${params.amount} ADA**
  > ⏰ Work deadline: **${new Date(params.deadline).toUTCString()}**
  > 📍 Maintainer address: **${params.address.slice(0, 20)}..**

  The bounty id is \`${params.bountyId}\`

  The next step is to deposit the reward. You can use this [link](${
    params.signUrl
  }) to execute the transaction.
`;

const ALREADY_EXISTING_BOUNTY = `
  ### ⚠️ Warning ⚠️

  This issue already has a bounty attached.
`;

const BOUNTY_EXPIRED = `
  ### ⚠️ Warning ⚠️

  ⏳ Sorry, this bounty has expired. ⏳
`;

const SPONSOR_BOUNTY_SUCCESS = (signUrl: string) => `
  ### 🎉 The sponsorship has been accepted and is ready to be funded 🎉

  The next step is **to deposit the fund**.
  You can use this [link](${signUrl}) to execute the transaction.
`;

const ACCEPT_BOUNTY_SUCCESS = (signUrl: string) => `
  ### 🎉 The bounty has been accepted! 🎉

  You can sign the transaction [here](${signUrl}).

  You will be able to claim the reward once this PR gets merged.
`;

const MERGE_BOUNTY_SUCCESS = (
  reclaimUrl: string,
  mergeTxUrl: string,
  bountyId: number
) => `
  ### 🎉 The bounty has been merged! 🎉

  You can see the transaction [here](${mergeTxUrl}).

  Claim your reward [here](${reclaimUrl}).

  Please, for any feedback or issues, contact us in the following [link](${appConfig.FRONTEND_URL}/feedback?bountyId=${bountyId}).
`;

const CLOSE_BOUNTY_SUCCESS = (
  closeTxUrl: string,
  isPR: boolean,
  bountyId: number
) => {
  if (isPR) {
    return `
  Sorry, your PR was not accepted. 😢

  See the transaction [here](${closeTxUrl}).

  Please, for any feedback or issues, contact us in the following [link](${appConfig.FRONTEND_URL}/feedback?bountyId=${bountyId}).
`;
  } else {
    return `
  ### 🎉 The bounty has been closed! 🎉

  You can see the transaction [here](${closeTxUrl}).

  Please, for any feedback or issues, contact us in the following [link](${appConfig.FRONTEND_URL}/feedback?bountyId=${bountyId}).
`;
  }
};

const CLOSE_BOUNTY_SUCCESS_WITHOUT_URL = `
  ### 🎉 The bounty has been closed successfully! 🎉
`;

const PARAMETERS_WRONG = (errors: string) => `
  ### ⚠️ Warning ⚠️

  One or more parameters are wrongly formatted:

  ${errors}
`;

const UNKNOWN_COMMAND = `
  ### ⚠️ Warning ⚠️

  I'm sorry, I don't understand that command. 😔

  Please use the \`/githoney help\` command to see the available commands.
`;

const BOUNTY_NOT_FOUND = `
  ### ⚠️ Warning ⚠️

  I'm sorry, I couldn't find a bounty with that id. 😔
`;

const ALREADY_ASSIGNED_BOUNTY = `
  ### ⚠️ Warning ⚠️

  This bounty has already been assigned to someone.
`;

const HELP_COMMAND = `
 Hi! I'm the **Githoney Bot** 🤖. Here are the commands you can use:

### Create a new bounty:
\`create-bounty\`: Creates a new bounty, and attaches it to the GitHub issue. Can only be performed in GitHub issue without and existing bounty. 

  **Parameters:**
  
-  \`tokens\`: List of tokens and amounts to add (currently only ADA is supported). Format: _tokenA=amountA&tokenB=amountB&...&tokenZ=amountZ_
-  \`duration\`: Time limit for the bounty in days (must be at least 5 days).
-  \`address\`: The Cardano wallet address for the reward deposit.

Example:
> /githoney create-bounty --tokens ADA=200 --address addr1* --duration 14 

(Meaning: Deposit 200 ADA with a 14-day duration)

 *** 
###  Add More Rewards to a Bounty
 \`sponsor-bounty\`: Add extra rewards to an existing bounty. Can only be performed in a GitHub issue with existing bounty. 

**Parameters:**

- \`tokens\`: List of tokens and amounts to add (currently only ADA is supported). Format: _tokenA=amountA&tokenB=amountB&...&tokenZ=amountZ_
- \`address\`: The Cardano wallet address for the additional reward deposit.

Example:

> /githoney sponsor-bounty --tokens ADA=100 --address addr1*

(Meaning: Add 100 ADA to the bounty)

*** 
### Start working on the bounty as a Contributor

\`accept-bounty\`: Accept the bounty, and start working on it.

**Parameters**:

 - \`bountyId\`: The unique ID of the bounty.
 - \`address\`: The Cardano wallet address of the contributor.

Example:

> /githoney accept-bounty --bountyId 123 --address addr1*

*** 
### Link a Pull Request to a Bounty:
\`link-bounty\`: The contributor links the current PR with the bounty. Can only be performed in the description of a new PR or in the comments of an existing PR.

**Parameters:**

-  \`bountyId\`: The unique ID of the bounty.

Example:
> /githoney link-bounty --bountyId 123 

(Meaning: Link the current PR with the bounty with ID 123)

*** 
### Merge/Close Actions on GitHub

Description:  To trigger bounty completion or cancellation, use GitHub's native "Merge Pull Request" or "Close Issue" buttons. The Githoney bot will automatically handle the corresponding actions based on your interaction.
`;

// Bot error, not user error, not backend error.
const INTERNAL_SERVER_ERROR = `
  ### 🚧 Sorry, I'm having some trouble right now. 🚧

  Please try again later.
`;

// Backend error, DB inconsistency, wrong parameter from bot, etc.
const BACKEND_ERROR = (error: string) => `
  ### 🚧 Sorry, the service is having some trouble right now. 🚧

  ${error}
`;

const PLEASE_USE_ADA = `
  ### 🚧 Please use ADA for this operation. 🚧

  We're working on adding support for other currencies.
`;

const WRONG_COMMAND_USE = `
  ### Sorry, you can't use this command here. 😔

  Remember, you can only use the:
  - \`create-bounty\` command in open issues.
  - \`sponsor-bounty\` command in open issues.
  - \`accept-bounty\` command in open issues.
  - \`link-bounty\` command in open pull requests.
`;

const CLOSE_WRONG_FROM = `
  ### ⚠️ Warning ⚠️

  **Bounty already assigned.**
  The bounty for this issue has been assigned to someone, it can only be closed in the PR.
`;

const BOUNTY_HASH_NOT_FOUND = `
  ### ⚠️ Warning ⚠️

  The bounty creation transaction is not submited yet.
`;

const DEADLINE_REACHED = `
  ### 🔔 Deadline reached 🔔

  Unfortunately, the time allocated to complete this bounty has expired. As a result, the bounty is no longer valid, and the issue will be closed.
`;

const USER_INSTALLATION_COMMENT = `
  ### ⚠️ Warning ⚠️

  It seems you have installed the Githoney bot on a personal account.
  Please install it on an organization account to use it.

  🔎 See the [installation guide](https://docs.githoney.io/github_setup) for more information. 🔍
`;

const BOUNTY_NOT_OPEN_TO_SPONSOR = `
  ### ⚠️ Sorry, the bounty is closed ⚠️

  This bounty is not open to sponsor. It may have been closed or expired.
`;

const BOUNTY_STILL_OPEN = `
  ### ⚠️ Hey! This bounty is still open ⚠️

  You should go back to the corresponding issue and then link the PR again.

  If the PR is merged, you will not receive the reward.
`;

const BOUNTY_ACCEPTED = `
  ### ⚠️ Warning ⚠️

  This bounty has already been accepted.

  If the PR is merged, you will not receive the reward.
`;

const BOUNTY_LINKED = `
  ### 🎉 Bounty linked! 🎉

  The bounty has been successfully linked to this PR. Just wait for the merge to claim your reward.
`;

const PULL_REQUEST_MERGED = `
  ### 🎉 Pull Request Merged! 🎉

  The pull request has been successfully merged and the bounty is now closed.

  🍯 Congratulations to all involved 🍯
  `;

const REPORT_BUG_SUCCESS = ({ reporter }: { reporter: string }) => `
  ### 🐛 Bug reported! 🐛

  @${reporter} has been registered as the reporter/contributor for this issue.

  A maintainer can now run \`/githoney create-bug-bounty\` to fund a bounty and pre-assign it.
`;

const CREATE_BUG_BOUNTY_NO_REPORT = `
  ### ⚠️ No bug report found ⚠️

  No bug report was found for this issue. Please have the reporter run \`/githoney report-bug --address addr1...\` first.
`;

const BUG_BOUNTY_ASSIGN_LINK = ({ signUrl }: { signUrl: string }) => `
  ### ✅ Bug bounty create transaction confirmed!

  The next step is to assign the reporter as contributor. Sign the assignment transaction with your wallet:

  👉 [Sign Assign Transaction](${signUrl})

  Once signed, the reporter will be locked in as the contributor and can begin working on the fix.
`;

const INVALID_CARDANO_ADDRESS = `
  ### ⚠️ Invalid Cardano address ⚠️

  The address provided does not look like a valid Cardano address.
  Please provide a valid bech32 address starting with \`addr1\` (mainnet) or \`addr_test1\` (preprod).
`;

export const Responses = {
  ALREADY_EXISTING_BOUNTY,
  CLOSE_BOUNTY_SUCCESS,
  CLOSE_BOUNTY_SUCCESS_WITHOUT_URL,
  UNKNOWN_COMMAND,
  BOUNTY_NOT_FOUND,
  WRONG_COMMAND_USE,
  ALREADY_ASSIGNED_BOUNTY,
  BOUNTY_HASH_NOT_FOUND,
  HELP_COMMAND,
  INTERNAL_SERVER_ERROR,
  PLEASE_USE_ADA,
  PARAMETERS_WRONG,
  ACCEPT_BOUNTY_SUCCESS,
  MERGE_BOUNTY_SUCCESS,
  SPONSOR_BOUNTY_SUCCESS,
  CREATE_BOUNTY_SUCCESS,
  BACKEND_ERROR,
  BOUNTY_EXPIRED,
  CLOSE_WRONG_FROM,
  DEADLINE_REACHED,
  USER_INSTALLATION_COMMENT,
  BOUNTY_NOT_OPEN_TO_SPONSOR,
  BOUNTY_STILL_OPEN,
  BOUNTY_ACCEPTED,
  BOUNTY_LINKED,
  PULL_REQUEST_MERGED,
  REPORT_BUG_SUCCESS,
  INVALID_CARDANO_ADDRESS,
  CREATE_BUG_BOUNTY_NO_REPORT,
  BUG_BOUNTY_ASSIGN_LINK
};
