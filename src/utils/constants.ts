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
  CLOSE_ACTION_NOT_FOUND: "CloseActionNotFound",
  BOUNTY_EXPIRED: "BountyExpired",
  CLOSE_WRONG_FROM: "CloseWrongFrom",
  BOUNTY_HASH_NOT_FOUND: "BountyHashNotFound",
  NOT_OPEN_FOR_FUNDING: "NotOpenForFunding",
  NO_SUBMISSIONS_FOUND: "NoSubmissionsFound",
  BOUNTY_ALREADY_ACCEPTED: "BountyAlreadyAccepted"
};

export const HELP_COMMAND = "help";
export const VALID_COMMANDS = {
  CREATE: "create-bounty",
  SPONSOR: "sponsor-bounty",
  ACCEPT: "accept-bounty",
  LINK: "link-bounty"
};
