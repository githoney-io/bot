import jwt from "jsonwebtoken";
import appConfig from "../config/app-config";
import { callEp, getRepoLink } from "../helpers";

export const callTwBot = (
  amount: number,
  organization: string,
  repository: string,
  issue: number,
  deadline: number
) => {
  // const token = jwt.sign(
  //   { GitHubBot: "I'm the GitHubBot" },
  //   appConfig.TW_SECRET_KEY
  // );
  // const headers = { authorization: token };
  // const twBotRoute = "newBounty";
  // callEp(
  //   twBotRoute,
  //   {
  //     linkToIssue: getRepoLink(organization, repository, issue),
  //     amount,
  //     deadline: new Date(Date.now() + deadline).toISOString(),
  //     contractHash: "someHashContract"
  //   },
  //   appConfig.TW_BOT_URL,
  //   headers
  // )
  //   .then((response) => console.log(response))
  //   .catch((_e) => console.error("Tweet bot error", _e));
};
