import dotenv from "dotenv";

dotenv.config();

export interface AppConfig {
  PORT: number;
  GITHUB_PRIVATE_KEY_PATH: string;
  GITHUB_WEBHOOK_SECRET: string;
  GITHUB_APP_ID: string;
  NETWORK: string;
  PUBLIC_URL: string;
  WEBHOOK_PROXY_URL: string;
}

const appConfig: AppConfig = {
  PORT: parseInt(process.env.PORT!) || 3000,
  GITHUB_PRIVATE_KEY_PATH:
    process.env.GITHUB_PRIVATE_KEY_PATH || "githubapp.pem",
  GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET || "donotuseinprod",
  GITHUB_APP_ID: process.env.GITHUB_APP_ID || "406519",
  NETWORK: process.env.NETWORK || "Preprod",
  PUBLIC_URL:
    process.env.PUBLIC_URL ||
    `http://localhost:${parseInt(process.env.PORT!) || 3000}`,
  WEBHOOK_PROXY_URL:
    process.env.WEBHOOK_PROXY_URL || "https://smee.io/N9gchHnEoXXDt",
};

export const ENDPOINTS: { [index: string]: any } = {
  createContract: `${appConfig.PUBLIC_URL}/createContract`,
  depositPayment: `${appConfig.PUBLIC_URL}/depositPayment`,
  assignDeveloper: `${appConfig.PUBLIC_URL}/assignDeveloper`,
  unlockPayment: `${appConfig.PUBLIC_URL}/unlockPayment`,
  withdrawPayment: `${appConfig.PUBLIC_URL}/withdrawPayment`,
  cancelBounty: `${appConfig.PUBLIC_URL}/cancelBounty`,
};

export default appConfig;
