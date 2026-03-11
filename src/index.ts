import createServer from "./config/express";
import { startBot } from "./adapters";
import appConfig from "./config/app-config";
import fs from "fs";
import figlet from "figlet";
import { closeIssues } from "./endpoint/closeIssues";
import { bugBountyConfirmed } from "./endpoint/bugBountyConfirmed";
import { bugBountyAssigned } from "./endpoint/bugBountyAssigned";
import { apiKeyMiddleware } from "./middlewares/apiKey.middleware";

const PORT = appConfig.PORT;

let webhooks = startBot({
  webhookProxyUrl: appConfig.WEBHOOK_PROXY_URL,
  webhookSecret: appConfig.GITHUB_WEBHOOK_SECRET,
  githubAppId: appConfig.GITHUB_APP_ID,
  githubPrivateKey: fs.readFileSync(appConfig.GITHUB_PRIVATE_KEY_PATH, "utf8")
});

const startServer = async () => {
  const app = createServer();

  app.post(
    "/closeIssues",
    async (req, res, next) => apiKeyMiddleware(req, res, next),
    async (req, res) => closeIssues(req, res)
  );

  app.post(
    "/bug-bounty-confirmed",
    async (req, res, next) => apiKeyMiddleware(req, res, next),
    async (req, res) => bugBountyConfirmed(req, res)
  );

  app.post(
    "/bug-bounty-assigned",
    async (req, res, next) => apiKeyMiddleware(req, res, next),
    async (req, res) => bugBountyAssigned(req, res)
  );

  // Octokit middleware handles /webhooks requests directly.
  app.use(webhooks);

  const server = app.listen(PORT, () => {
    console.log(figlet.textSync("GITHONEY BOT", { font: "Small Keyboard" }));
    console.log(`\nBot is running! 🤖\n`);
  });
  server.setTimeout(300000);
  server.keepAliveTimeout = 300000; // 5 minutes
  server.headersTimeout = 305000; // Slightly more than keepAliveTimeout
};

startServer();
