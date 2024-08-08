import { AxiosError } from "axios";
import { GithubFacade } from "../adapters";
import { callEp, commandErrorHandler, getGithubUserData } from "../helpers";
import { FundBountyParams } from "../interfaces/core.interface";
import chalk from "chalk";
import appConfig from "../config/app-config";
import { Responses } from "../responses";

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

    await commandErrorHandler(
      e,
      params.fundInfo.issue,
      github,
      params.fundCommentId
    );
  }
}
