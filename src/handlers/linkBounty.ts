import chalk from "chalk";
import { GithubFacade } from "../adapters";
import { callEp, commandErrorHandler, getGithubUserData } from "../helpers";
import { Responses } from "../responses";
import { LinkBountyParams } from "../interfaces/core.interface";

// Calls to {BACKEND_URL}/bounty/link (POST)
export async function linkBounty(
  params: LinkBountyParams,
  github: GithubFacade
) {
  try {
    const { bountyId, commentId, contributor, issueNumber } = params;

    await github.acknowledgeCommand(commentId);
    const contributorData = await getGithubUserData(contributor, github);

    await callEp("bounty/link", {
      bountyId,
      contributor: contributorData,
      prNumber: issueNumber,
      platform: "github"
    });

    await github.replyToCommand(issueNumber, Responses.BOUTNY_LINKED);
  } catch (err) {
    console.error(chalk.red(`Error linking bounty. ${err}`));

    await commandErrorHandler(
      err,
      params.issueNumber,
      github,
      params.commentId
    );
  }
}
