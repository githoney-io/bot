import axios, { AxiosError } from "axios";
import appConfig from "./config/app-config";
import { GithubFacade } from "./adapters";
import { ZodIssue } from "zod";
import { StatusCodes } from "http-status-codes";
import { Responses } from "./responses";

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

const getGithubUserData = async (username: string, github: GithubFacade) => {
  const res = await github.octokit.rest.users.getByUsername({
    username
  });

  return res.data;
};

export {
  getRepoLink,
  paramsValidationFail,
  callEp,
  isBadRequest,
  isOtherClientError,
  getGithubUserData
};
