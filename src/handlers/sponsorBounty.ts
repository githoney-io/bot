import { GithubFacade } from "../adapters";
import { callEp, commandErrorHandler, getGithubUserData } from "../helpers";
import { SponsorBountyParams } from "../interfaces/core.interface";
import chalk from "chalk";
import appConfig from "../config/app-config";
import { Responses } from "../responses";

// Calls to {BACKEND_URL}/bounty/sponsor (POST)
export async function sponsorBounty(
  params: SponsorBountyParams,
  github: GithubFacade
) {
  try {
    const { sponsorCommentId, sponsorInfo, sponsor: username } = params;
    await github.acknowledgeCommand(sponsorCommentId);

    const data = await getGithubUserData(username, github);

    const tokens = sponsorInfo.tokens.map((t) => {
      const [name, amount] = t.split("=");
      return name.toLowerCase() === "ada"
        ? { name, amount: Number(amount) }
        : undefined;
    });

    // TODO: remove this when the backend accepts other currencies
    if (tokens.some((t) => t === undefined)) {
      await github.replyToCommand(sponsorInfo.issue, Responses.PLEASE_USE_ADA);
      return;
    }

    const {
      data: { bounty, sponsorId }
    } = await callEp("bounty/sponsor", {
      address: sponsorInfo.address,
      tokens,
      issueNumber: sponsorInfo.issue,
      platform: "github",
      sponsor: {
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
      orgName: sponsorInfo.organization,
      repoName: sponsorInfo.repository
    });

    const signUrl = `${appConfig.FRONTEND_URL}/bounty/sign/${bounty.id}/funding?fundingId=${sponsorId}`;
    await github.replyToCommand(
      sponsorInfo.issue,
      Responses.SPONSOR_BOUNTY_SUCCESS(signUrl)
    );
  } catch (e) {
    console.error(chalk.red(`Error sponsoring bounty. ${e}`));

    await commandErrorHandler(
      e,
      params.sponsorInfo.issue,
      github,
      params.sponsorCommentId
    );
  }
}
