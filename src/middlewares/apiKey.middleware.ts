import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { appConfig } from "../config/app-config";
import { NextFunction, Request, Response } from "express";

export const apiKeyMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const apiKey = req.headers["x-api-key"];

    if (typeof apiKey !== "string") throw new Error();

    const incoming = apiKey.trim();
    const acceptedKeys = [
      appConfig.API_KEY,
      appConfig.TW_SECRET_KEY,
      process.env.BOT_KEY // fallback for local setups that export BOT_KEY in bot process
    ]
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter((value, index, arr) => value.length > 0 && arr.indexOf(value) === index);

    if (acceptedKeys.includes(incoming)) {
      return next();
    } else {
      throw new Error();
    }
  } catch (err) {
    return res.status(StatusCodes.FORBIDDEN).send({
      msg: ReasonPhrases.FORBIDDEN,
      error: ReasonPhrases.FORBIDDEN
    });
  }
};
