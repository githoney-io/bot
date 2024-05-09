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
  TW_BOT_URL: string;
  TW_SECRET_KEY: string;
}

const appConfig: AppConfig = {
  PORT: parseInt(process.env.PORT!) || 3000,
  GITHUB_PRIVATE_KEY_PATH:
    process.env.GITHUB_PRIVATE_KEY_PATH || "githubapp.pem",
  GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET || "donotuseinprod",
  GITHUB_APP_ID: process.env.GITHUB_APP_ID || "406519",
  NETWORK: process.env.NETWORK || "preprod",
  PUBLIC_URL:
    process.env.PUBLIC_URL ||
    `http://localhost:${parseInt(process.env.PORT!) || 3000}`,
  WEBHOOK_PROXY_URL:
    process.env.WEBHOOK_PROXY_URL || "https://smee.io/N9gchHnEoXXDt",
  TW_BOT_URL: process.env.TW_BOT_URL as string,
  TW_SECRET_KEY: process.env.TW_SECRET_KEY as string
};

export default appConfig;
