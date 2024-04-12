export const NETWORK = {
  MAINNET: "mainnet",
  PREPROD: "preprod",
} as const;

export type NETWORK = (typeof NETWORK)[keyof typeof NETWORK];
