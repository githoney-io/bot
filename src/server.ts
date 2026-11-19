import fs from "fs";
import figlet from "figlet";
import createServer, { errorHandler } from "./config/express";
import { startBot } from "./adapters";
import appConfig from "./config/app-config";
import { closeIssues } from "./endpoint/closeIssues";
import { apiKeyMiddleware } from "./middlewares/apiKey.middleware";

// Start the GitHub App and its HTTP server on `port` (0 picks a free one).
export function startServer(port: number) {
  const webhooks = startBot({
    webhookProxyUrl: appConfig.WEBHOOK_PROXY_URL,
    webhookSecret: appConfig.GITHUB_WEBHOOK_SECRET,
    githubAppId: appConfig.GITHUB_APP_ID,
    githubPrivateKey: fs.readFileSync(appConfig.GITHUB_PRIVATE_KEY_PATH, "utf8")
  });

  const app = createServer((req, res, next) => {
    webhooks(req, res, next).catch(next);
  });

  app.post(
    "/closeIssues",
    async (req, res, next) => apiKeyMiddleware(req, res, next),
    async (req, res) => closeIssues(req, res)
  );
  app.use(errorHandler);

  const server = app.listen(port, () => {
    console.log(figlet.textSync("GITHONEY BOT", { font: "Small Keyboard" }));
    console.log(`\nBot is running! 🤖\n`);
  });
  server.setTimeout(300000);
  server.keepAliveTimeout = 300000; // 5 minutes
  server.headersTimeout = 305000; // Slightly more than keepAliveTimeout

  return server;
}
