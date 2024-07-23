import { AxiosError } from "axios";
import { GithubFacade } from "../adapters";
import {
  callEp,
  getGithubUserData,
  isBadRequest,
  isOtherClientError,
  paramsValidationFail
} from "../helpers";
import { FundBountyParams } from "../interfaces/core.interface";
import { ONE_ADA_IN_LOVELACE } from "../utils/constants";
import chalk from "chalk";
import appConfig from "../config/app-config";

// Calls to {BACKEND_URL}/bounty/sponsor (POST)
export async function fundBounty(
  params: FundBountyParams,
  github: GithubFacade
) {
  try {
    const { fundCommentId, fundInfo, funder: username } = params;
    await github.acknowledgeCommand(fundCommentId);

    const data = await getGithubUserData(username, github);

    const tokens = fundInfo.tokens.map((t) => {
      const [name, amount] = t.split("=");
      return name.toLowerCase() === "ada"
        ? { name, amount: Number(amount) }
        : { name, amount: Number(amount) };
    });

    const {
      data: { bounty, walletId }
    } = await callEp("bounty/sponsor", {
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

    const signUrl = `${appConfig.FRONTEND_URL}/bounty/sign/${bounty.id}/funding?walletId=${walletId}`;
    await github.replyToCommand(
      fundInfo.issue,
      `Bounty funding has been created. You can sign the transaction here ${signUrl}.`
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
        "There was an error funding the bountyId. Please try again."
      );
      console.error(chalk.red(`Error creating bountyId. ${e}`));
    }
  }
}
