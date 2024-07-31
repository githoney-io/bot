export const NETWORK = {
  MAINNET: "mainnet",
  PREPROD: "preprod"
} as const;

export type NETWORK = (typeof NETWORK)[keyof typeof NETWORK];

export const ONE_ADA_IN_LOVELACE = 1000000;
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;