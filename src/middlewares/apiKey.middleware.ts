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

    if (apiKey && apiKey === appConfig.API_KEY) {
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
