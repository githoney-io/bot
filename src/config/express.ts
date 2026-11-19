import express, { RequestHandler } from "express";
import morgan from "morgan";
import cors from "cors";

// Initialize the express engine. GitHub signs the raw request body, so the
// webhook route is mounted before any body parser can consume it.
const createServer = (webhooks: RequestHandler) => {
  const app: express.Application = express();

  app.use(morgan("dev"));
  app.post("/webhooks", webhooks);

  app.use(express.urlencoded({ extended: true }));
  app.use(cors());
  app.use(express.json());

  return app;
};

export default createServer;
