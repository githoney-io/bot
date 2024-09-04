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
    const { sponsorInfo, commentId } = params;
    const { sponsorUsername, address, organization, repository } = sponsorInfo;

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

    const {
      data: { bounty, sponsorId }
    } = await callEp("bounty/sponsor", {
      address,
      tokens,
      issueNumber: sponsorInfo.issue,
      platform: "github",
      sponsor: sponsorData,
      orgName: organization,
      repoName: repository
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
