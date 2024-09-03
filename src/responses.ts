interface ICreateBountySuccess {
  amount: number;
  deadline: number;
  address: string;
  bountyId: number;
  signUrl: string;
  isDev?: boolean;
}
const CREATE_BOUNTY_SUCCESS = (params: ICreateBountySuccess) => `
  ### New bounty created for this issue! 🎊

  ${params.isDev ? "#### Dev mode" : ""}

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

const FUND_BOUNTY_SUCCESS = (signUrl: string) => `
  ### 🎉 The bounty has been funded! 🎉

  You can sign the transaction [here](${signUrl}).
`;

const ACCEPT_BOUNTY_SUCCESS = (signUrl: string) => `
  ### 🎉 The bounty has been accepted! 🎉

  You can sign the transaction [here](${signUrl}).

  You will be able to claim the reward once this PR gets merged.
`;

const MERGE_BOUNTY_SUCCESS = (reclaimUrl: string, mergeTxUrl: string) => `
  ### 🎉 The bounty has been merged! 🎉

  You can see the transaction [here](${mergeTxUrl}).

  Claim your reward [here](${reclaimUrl}).
`;

const CLOSE_BOUNTY_SUCCESS = (closeTxUrl: string, isPR: boolean) => {
  if (isPR) {
    return `
  Sorry, your PR was not accepted. 😢

  See the transaction [here](${closeTxUrl}).
`;
  } else {
    return `
  ### 🎉 The bounty has been closed! 🎉

  You can see the transaction [here](${closeTxUrl}).
`;
  }
};

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
 Hi! I'm the **Githoney Bot**🤖. Here are the commands you can use:

### Create a new bounty:
\`create-bounty\`: Creates a new bounty, and attaches it to the GitHub issue. Can only be performed in GitHub issue without and existing bounty. 

  **Parameters:**
  
-  \`amount\`: The ADA amount for the bounty (must be greater than 10 ADA).
-  \`duration\`: Time limit for the bounty in days (must be at least 5 days).
-  \`address\`: The Cardano wallet address for the reward deposit.

Example:
> /githoney create-bounty --amount 200 --address addr1* --duration 14 

(Meaning: Deposit 200 ADA with a 14-day duraiton)

 *** 
###  Add More Rewards to a Bounty
 \`fund-bounty\`: Add extra rewards to an existing bounty. Can only be performed in a GitHub issue with existing bounty. 

**Parameters:**

- \`tokens\`: List of tokens and amounts to add (currently only ADA is supported). Format: tokenA=amountA&tokenB=amountB&...&tokenZ=amountZ
- \`address\`: The Cardano wallet address for the additional reward deposit.

Example:

> /githoney fund-bounty --tokens ADA=100 --address addr1*

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
  - \`fund-bounty\` command in open issues.
  - \`accept-bounty\` command in open PRs.
`;

const CLOSE_WRONG_FROM = `
  ### ⚠️ Warning ⚠️

  **Bounty already assigned.**
  The bounty for this issue has been assigned to someone, it can only be closed in the PR.
`;

const BOUNTY_HASH_NOT_FOUND = `
  ### ⚠️ Warning ⚠️

  This Bounty creation transaction is not submited yet.
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

const BOUNTY_NOT_OPEN_FOR_FUNDING = `
  ### ⚠️ Sorry, the bounty is closed ⚠️

  This bounty is not open for funding. It may have been closed or expired.
`;

export const Responses = {
  ALREADY_EXISTING_BOUNTY,
  CLOSE_BOUNTY_SUCCESS,
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
  FUND_BOUNTY_SUCCESS,
  CREATE_BOUNTY_SUCCESS,
  BACKEND_ERROR,
  BOUNTY_EXPIRED,
  CLOSE_WRONG_FROM,
  DEADLINE_REACHED,
  USER_INSTALLATION_COMMENT,
  BOUNTY_NOT_OPEN_FOR_FUNDING
};
