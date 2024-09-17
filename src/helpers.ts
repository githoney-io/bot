import axios, { AxiosError } from "axios";
import appConfig from "./config/app-config";
import { GithubFacade } from "./adapters";
import { ZodIssue } from "zod";
import { StatusCodes } from "http-status-codes";
import { Responses } from "./responses";
import { BOT_CODES } from "./utils/constants";

const paramsValidationFail = async (
  github: GithubFacade,
  issueNumber: number,
  commentId: number,
  e: { issues: ZodIssue[]; name: string }
) => {
  await github.rejectCommand(commentId);

  let errors = "";
  for (const issue of e.issues) {
    errors = errors.concat(
      `> Parameter: **${issue.path.join(".")}** - Error: **${
        issue.message
      }**.\n`
    );
  }

  await github.replyToCommand(issueNumber, Responses.PARAMETERS_WRONG(errors));
};

const getRepoLink = (owner: string, repo: string, issue: number) =>
  `https://github.com/${owner}/${repo}/issues/${issue}`;

const callEp = async (
  name: string,
  param: any,
  url: string = appConfig.BACKEND_URL,
  headers: Record<string, any> = {
    "x-api-key": appConfig.BACKEND_API_KEY,
    "x-source": appConfig.SOURCE
  }
): Promise<any> => {
  return axios
    .post(`${url}/${name}`, param, { headers: headers })
    .then((response) => {
      if (
        response.status >= StatusCodes.OK &&
        response.status < StatusCodes.MULTIPLE_CHOICES
      ) {
        return response.data;
      }
      throw response;
    });
};

const isBadRequest = (e: AxiosError) =>
  e.response?.status && e.response?.status === StatusCodes.BAD_REQUEST;

const isOtherClientError = (e: AxiosError) =>
  e.response?.status &&
  e.response?.status > StatusCodes.BAD_REQUEST &&
  e.response?.status < StatusCodes.INTERNAL_SERVER_ERROR;

const txUrl = (txHash: string | null, network: string) => {
  if (!txHash) return null;

  if (network === "preprod") {
    return `https://preprod.cexplorer.io/tx/${txHash}`;
  } else {
    return `https://cexplorer.io/tx/${txHash}`;
  }
};
const BOT_ERROR_RESPONSES: { [key: string]: string } = {
  BountyAlreadyExist: Responses.ALREADY_EXISTING_BOUNTY,
  BountyTaken: Responses.ALREADY_ASSIGNED_BOUNTY,
  BountyNotFound: Responses.BOUNTY_NOT_FOUND,
  BountyHashNotFound: Responses.BOUNTY_HASH_NOT_FOUND,
  CloseWrongFrom: Responses.CLOSE_WRONG_FROM,
  NotOpenForFunding: Responses.BOUNTY_NOT_OPEN_TO_SPONSOR,
  NoSubmissionsFound: Responses.BOUNTY_STILL_OPEN,
  BountyAlreadyAccepted: Responses.BOUNTY_ACCEPTED
};

export const commandErrorHandler = async (
  e: any,
  issueNumber: number,
  github: GithubFacade,
  commentId?: number,
  isPrAction: boolean = false
) => {
  if (e instanceof AxiosError) {
    if (isBadRequest(e) && commentId) {
      // If the error is a 400, it means that the validation failed
      await paramsValidationFail(
        github,
        issueNumber,
        commentId,
        e.response?.data.error
      );
    } else if (
      isPrAction &&
      !BOT_ERROR_RESPONSES[e.response?.data.botCode as string]
    ) {
      return;
    } else if (BOT_ERROR_RESPONSES[e.response?.data.botCode as string]) {
      await github.replyToCommand(
        issueNumber,
        BOT_ERROR_RESPONSES[e.response?.data.botCode as string]
      );
    } else if (isOtherClientError(e)) {
      await github.replyToCommand(
        issueNumber,
        Responses.BACKEND_ERROR(e.response?.data.error)
      );
    }
  } else {
    await github.replyToCommand(issueNumber, Responses.INTERNAL_SERVER_ERROR);
  }
};

export {
  getRepoLink,
  paramsValidationFail,
  callEp,
  txUrl,
  isBadRequest,
  isOtherClientError
};
