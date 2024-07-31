export const NETWORK = {
  MAINNET: "mainnet",
  PREPROD: "preprod"
} as const;

export type NETWORK = (typeof NETWORK)[keyof typeof NETWORK];

export const ONE_ADA_IN_LOVELACE = 1000000;
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const BOT_CODES = {
  BOUNTY_ALREADY_EXIST: "BountyAlreadyExist",
  BOUNTY_TAKEN: "BountyTaken",
  BOUNTY_NOT_FOUND: "BountyNotFound",
  CLOSE_ACTION_NOT_FOUND: "CloseActionNotFound"
};

export const VALID_COMMANDS = {
  HELP: "help",
  ATTACH: "attach-bounty",
  FUND: "fund-bounty",
  ACCEPT: "accept-bounty"
};
