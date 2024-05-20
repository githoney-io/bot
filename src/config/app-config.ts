import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

export interface AppConfig {
  PORT: number;
  GITHUB_PRIVATE_KEY_PATH: string;
  GITHUB_WEBHOOK_SECRET: string;
  GITHUB_APP_ID: string;
  WEBHOOK_PROXY_URL: string;
  TW_BOT_URL: string;
  TW_SECRET_KEY: string;
}

const envSchema = z.object({
  PORT: z.number(),
  GITHUB_PRIVATE_KEY_PATH: z.string(),
  GITHUB_WEBHOOK_SECRET: z.string().min(16),
  GITHUB_APP_ID: z.string(),
  WEBHOOK_PROXY_URL: z.string().url(),
  TW_BOT_URL: z.string().url(),
  TW_SECRET_KEY: z.string()
});

const nonValidatedAppConfig: AppConfig = {
  PORT: Number(process.env.PORT) || 3001,
  GITHUB_PRIVATE_KEY_PATH:
    (process.env.GITHUB_PRIVATE_KEY_PATH as string) || "githubapp.pem",
  GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET as string,
  GITHUB_APP_ID: process.env.GITHUB_APP_ID as string,
  WEBHOOK_PROXY_URL: process.env.WEBHOOK_PROXY_URL as string,
  TW_BOT_URL: process.env.TW_BOT_URL as string,
  TW_SECRET_KEY: process.env.TW_SECRET_KEY as string
};

export const appConfig = envSchema.parse(nonValidatedAppConfig);

export default appConfig;
