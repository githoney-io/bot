import { AxiosError } from "axios";
import { GithubFacade } from "../adapters";
import {
  callEp,
  isBadRequest,
  isOtherClientError,
  paramsValidationFail
} from "../helpers";
import { FundBountyParams } from "../interfaces/core.interface";
import { ONE_ADA_IN_LOVELACE } from "../utils/constants";
import chalk from "chalk";

// Calls to {PUBLIC_URL}/bounty/sponsor (POST)
export async function fundBounty(
  params: FundBountyParams,
  github: GithubFacade
) {
  try {
    const { fundCommentId, fundInfo, funder: username } = params;
    await github.acknowledgeCommand(fundCommentId);

    const { data } = await github.octokit.rest.users.getByUsername({
      username: username
    });

    const tokens = fundInfo.tokens.map((t) => {
      const [name, amount] = t.split("=");
      return name.toLowerCase() === "ADA"
        ? { name, amount: Number(amount) * ONE_ADA_IN_LOVELACE }
        : { name, amount: Number(amount) };
    });

    const res = await callEp("bounty/sponsor", {
      address: fundInfo.address,
      tokens,
      issueNumber: fundInfo.issue,
      platform: "github",
      funder: {
        username: data.login,
        name: data.name,
        id: data.id,
        email: data.email,
        avatarUrl: data.avatar_url,
        description: data.bio,
        pageUrl: data.blog,
        userUrl: data.html_url,
        location: data.location,
        twitterUsername: data.twitter_username
      },
      orgName: fundInfo.organization,
      repoName: fundInfo.repository
    });

    await github.replyToCommand(
      fundInfo.issue,
      `Bounty has been funded!. You can see the transaction [here](txUrl/txId)`
    );
  } catch (e) {
    if (e instanceof AxiosError) {
      if (isBadRequest(e)) {
        await paramsValidationFail(
          github,
          params.fundInfo.issue,
          params.fundCommentId,
          e.response?.data.error
        );
      } else if (isOtherClientError(e)) {
        await github.replyToCommand(
          params.fundInfo.issue,
          e.response?.data.error
        );
      }
    } else {
      await github.replyToCommand(
        params.fundInfo.issue,
        "There was an error funding the contract. Please try again."
      );
      console.error(chalk.red(`Error creating contract. ${e}`));
    }
  }
}
