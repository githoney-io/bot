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

  > Reward: **${params.amount} ADA**
  > Work deadline: **${new Date(params.deadline).toUTCString()}**
  > Maintainer address: **${params.address.slice(0, 20)}..**

  The bounty id is \`${params.bountyId}\`

  The next step is to deposit the reward amount in the bountyId. You can use this [link](${
    params.signUrl
  }) to execute the transaction.
`;

const ALREADY_EXISTING_BOUNTY = `
  ### ⚠️ Warning ⚠️

  This issue already has a bounty attached.
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

const MERGE_BOUNTY_SUCCESS = (reclaimUrl: string) => `
  ### 🎉 The bounty has been merged! 🎉

  You can now claim the reward clicking [here](${reclaimUrl}).
`;

const CLOSE_BOUNTY_SUCCESS = `
  Sorry, your PR was not accepted. 😢
`;

const PARAMETERS_WRONG = (errors: string) => `
  ### ⚠️ Warning ⚠️
  
  One or more parameters are wrong formatted:

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

const ALREADY_COMPLETED_BOUNTY = `
  ### ⚠️ Warning ⚠️

  This bounty has already been completed.
`;

const HELP_COMMAND = `
  Hi! I'm the **Githoney Bot**🤖. Here are the commands you can use:

  > Create ...
`;

const INTERNAL_SERVER_ERROR = `
  ### ⚠ Sorry, I'm having some trouble right now. ⚠

  Please try again later.
`;

const PLEASE_USE_ADA = `
  ### ⚠ Please use ADA for this operation. ⚠

  We're working on adding support for other currencies.
`;

export const Responses = {
  ALREADY_EXISTING_BOUNTY,
  CLOSE_BOUNTY_SUCCESS,
  UNKNOWN_COMMAND,
  BOUNTY_NOT_FOUND,
  ALREADY_ASSIGNED_BOUNTY,
  ALREADY_COMPLETED_BOUNTY,
  HELP_COMMAND,
  INTERNAL_SERVER_ERROR,
  PLEASE_USE_ADA,
  PARAMETERS_WRONG,
  ACCEPT_BOUNTY_SUCCESS,
  MERGE_BOUNTY_SUCCESS,
  FUND_BOUNTY_SUCCESS,
  CREATE_BOUNTY_SUCCESS
};
