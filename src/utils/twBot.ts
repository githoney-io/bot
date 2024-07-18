import appConfig from "../config/app-config";
import { getRepoLink } from "../helpers";
import axios from "axios";

export const callTwBot = (
  amount: number,
  organization: string,
  repository: string,
  issue: number,
  deadline: number
) => {
  const headers = { "x-api-key": appConfig.TW_SECRET_KEY };
  const twBotRoute = "newBounty";

  axios
    .post(
      `${appConfig.TW_BOT_URL}/${twBotRoute}`,
      {
        contractHash: "todo",
        amount,
        linkToIssue: getRepoLink(organization, repository, issue),
        deadline: new Date(Date.now() + deadline).toISOString()
      },
      { headers }
    )
    .then((response) => console.log(response))
    .catch((e) => console.error("Tweet bot error", e));
};
