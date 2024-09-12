import { GithubFacade } from "../adapters";
import { callEp, commandErrorHandler } from "../helpers";
import { IBountyCreate } from "../interfaces/bounty.interface";
import { AcceptBountyParams } from "../interfaces/core.interface";
import chalk from "chalk";
import appConfig from "../config/app-config";
import { Responses } from "../responses";
import { getGithubUserData } from "../utils/githubQueries";

// Calls to {BACKEND_URL}/bounty/assign (POST)
export async function acceptBounty(
  params: AcceptBountyParams,
  github: GithubFacade
) {
  try {
    const { issueNumber, commentId, bountyId, address, assignee } = params;

    await github.acknowledgeCommand(commentId);
    const assigneeData = await getGithubUserData(assignee, github);

    const {
      data: { bounty }
    }: IBountyCreate = await callEp("bounty/assign", {
      address,
      bountyId: bountyId,
      assignee: assigneeData,
      platform: "github"
    });
    console.debug(bounty);

    const signUrl = `${appConfig.FRONTEND_URL}/bounty/sign/${bounty.id}/assign?addr=${address}`;

    await github.replyToCommand(
      issueNumber,
      Responses.ACCEPT_BOUNTY_SUCCESS(signUrl)
    );
  } catch (e) {
    console.error(chalk.red(`Error assigning developer. ${e}`));

    await commandErrorHandler(e, params.issueNumber, github, params.commentId);
  }
}
