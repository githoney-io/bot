import express, {
  ErrorRequestHandler,
  Request,
  RequestHandler,
  Response
} from "express";
import morgan from "morgan";
import cors from "cors";

// The subscribed events carry text fields capped at 65,536 characters (issue,
// pull request and comment bodies) and, on installation events, the list of
// repositories; 5 MB covers both with room to spare. A request declaring a
// larger body gets 413 before any slot is taken; a chunked one is read up to
// the cap.
export const WEBHOOK_BODY_LIMIT = 5 * 1024 * 1024;

// Bodies read at once on POST /webhooks; further requests get 503 unread.
// A read holds about three times its size while buffered, so the route holds
// about 120 MiB at most, on top of the npm, tsx and bot processes at rest.
export const WEBHOOK_MAX_INFLIGHT = 8;

// Refuse a declared body over `limit` without taking a slot: answer 413 and
// discard the body as it arrives, so the client can read the answer.
const refuseOversized = (limit: number): RequestHandler => {
  return (req: Request, res: Response, next) => {
    if (Number(req.headers["content-length"]) > limit) {
      req.resume();
      res.status(413).json({ error: "Payload too large" });
      return;
    }
    next();
  };
};

// Hold one of the route's read slots until the body is consumed or the
// request ends, whichever comes first.
const limitInflight = (max: number): RequestHandler => {
  let inflight = 0;
  return (req: Request, res: Response, next) => {
    if (inflight >= max) {
      res.set("Connection", "close");
      res.status(503).json({ error: "Too many concurrent deliveries" });
      return;
    }
    inflight++;
    let held = true;
    const release = () => {
      if (held) {
        held = false;
        inflight--;
      }
    };
    req.once("end", release);
    req.once("close", release);
    res.once("close", release);
    next();
  };
};

// Answer errors as JSON, never with the default HTML page and its stack trace.
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = Number.isInteger(err?.status) ? err.status : 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: err?.expose ? err.message : "Internal Server Error"
  });
};

// Initialize the express engine. GitHub signs the raw request body, so the
// webhook route reads it as text, within the limit and without decoding any
// content encoding, before the JSON parser.
const createServer = (webhooks: RequestHandler) => {
  const app: express.Application = express();

  app.use(morgan("dev"));
  app.post(
    "/webhooks",
    refuseOversized(WEBHOOK_BODY_LIMIT),
    limitInflight(WEBHOOK_MAX_INFLIGHT),
    express.text({
      type: () => true,
      limit: WEBHOOK_BODY_LIMIT,
      inflate: false
    }),
    webhooks
  );

  app.use(express.urlencoded({ extended: true }));
  app.use(cors());
  app.use(express.json());

  return app;
};

export default createServer;
