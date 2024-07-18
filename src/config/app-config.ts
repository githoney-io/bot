import dotenv from "dotenv";
import { FORBIDDEN } from "http-status-codes";
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
  BACKEND_URL: string;
  FRONTEND_URL: string;
  BACKEND_API_KEY: string;
  SOURCE: string;
}

const envSchema = z.object({
  PORT: z.number(),
  GITHUB_PRIVATE_KEY_PATH: z.string(),
  GITHUB_WEBHOOK_SECRET: z.string().min(16),
  GITHUB_APP_ID: z.string(),
  WEBHOOK_PROXY_URL: z.string().url(),
  TW_BOT_URL: z.string().url(),
  TW_SECRET_KEY: z.string(),
  BACKEND_URL: z.string().url(),
  FRONTEND_URL: z.string().url(),
  BACKEND_API_KEY: z.string().min(1),
  SOURCE: z.string().min(1)
});

const nonValidatedAppConfig: AppConfig = {
  PORT: Number(process.env.PORT) || 3001,
  GITHUB_PRIVATE_KEY_PATH:
    (process.env.GITHUB_PRIVATE_KEY_PATH as string) || "githubapp.pem",
  GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET as string,
  GITHUB_APP_ID: process.env.GITHUB_APP_ID as string,
  WEBHOOK_PROXY_URL: process.env.WEBHOOK_PROXY_URL as string,
  TW_BOT_URL: process.env.TW_BOT_URL as string,
  TW_SECRET_KEY: process.env.TW_SECRET_KEY as string,
  BACKEND_URL: process.env.BACKEND_URL as string,
  FRONTEND_URL: process.env.FRONTEND_URL as string,
  BACKEND_API_KEY: process.env.BACKEND_API_KEY as string,
  SOURCE: process.env.SOURCE as string
};

export const appConfig = envSchema.parse(nonValidatedAppConfig);

export default appConfig;
