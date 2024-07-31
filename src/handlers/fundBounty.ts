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
import chalk from "chalk";
import appConfig from "../config/app-config";
import { Responses } from "../responses";
import { BOT_CODES } from "../utils/constants";

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
        : undefined;
    });

    // TODO: remove this when the backend accepts other currencies
    if (tokens.some((t) => t === undefined)) {
      await github.replyToCommand(fundInfo.issue, Responses.PLEASE_USE_ADA);
      return;
    }

    const {
      data: { bounty, fundingId }
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

    const signUrl = `${appConfig.FRONTEND_URL}/bounty/sign/${bounty.id}/funding?fundingId=${fundingId}`;
    await github.replyToCommand(
      fundInfo.issue,
      Responses.FUND_BOUNTY_SUCCESS(signUrl)
    );
  } catch (e) {
    console.error(chalk.red(`Error funding bounty. ${e}`));

    if (e instanceof AxiosError) {
      if (isBadRequest(e)) {
        await paramsValidationFail(
          github,
          params.fundInfo.issue,
          params.fundCommentId,
          e.response?.data.error
        );
      } else if (e.response?.data.botCode === BOT_CODES.BOUNTY_NOT_FOUND) {
        await github.replyToCommand(
          params.fundInfo.issue,
          Responses.BOUNTY_NOT_FOUND
        );
      } else if (isOtherClientError(e)) {
        await github.replyToCommand(
          params.fundInfo.issue,
          Responses.BACKEND_ERROR(e.response?.data.error)
        );
      }
    } else {
      await github.replyToCommand(
        params.fundInfo.issue,
        Responses.INTERNAL_SERVER_ERROR
      );
    }
  }
}
