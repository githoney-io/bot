import express, { RequestHandler } from "express";
import morgan from "morgan";
import cors from "cors";

// GitHub caps webhook payloads at 25 MB; anything larger is refused with 413
// before it is buffered or verified.
export const WEBHOOK_BODY_LIMIT = "25mb";

// Initialize the express engine. GitHub signs the raw request body, so the
// webhook route reads it as text, within the limit, before the JSON parser.
const createServer = (webhooks: RequestHandler) => {
  const app: express.Application = express();

  app.use(morgan("dev"));
  app.post(
    "/webhooks",
    express.text({ type: () => true, limit: WEBHOOK_BODY_LIMIT }),
    webhooks
  );

  app.use(express.urlencoded({ extended: true }));
  app.use(cors());
  app.use(express.json());

  return app;
};

export default createServer;
