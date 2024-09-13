import { GithubFacade } from "../adapters";
import { callEp, commandErrorHandler } from "../helpers";
import { SponsorBountyParams } from "../interfaces/core.interface";
import chalk from "chalk";
import appConfig from "../config/app-config";
import { Responses } from "../responses";
import {
  getGithubOrgData,
  getGithubRepoData,
  getGithubUserData
} from "../utils/githubQueries";

// Calls to {BACKEND_URL}/bounty/sponsor (POST)
export async function sponsorBounty(
  params: SponsorBountyParams,
  github: GithubFacade
) {
  try {
    const { sponsorInfo, commentId } = params;
    const { sponsorUsername, organization, repository } = sponsorInfo;

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

    await github.acknowledgeCommand(commentId);
    const sponsorData = await getGithubUserData(sponsorUsername, github);
    const orgData = await getGithubOrgData(organization, github);
    const repoData = await getGithubRepoData(organization, repository, github);

    const {
      data: { bounty, sponsorId }
    } = await callEp("bounty/sponsor", {
      tokens,
      issueNumber: sponsorInfo.issue,
      platform: "github",
      sponsor: sponsorData,
      organization: orgData,
      repository: repoData
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
      params.commentId
    );
  }
}
