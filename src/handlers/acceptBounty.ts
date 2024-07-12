import { AxiosError } from "axios";
import { GithubFacade } from "../adapters";
import {
  callEp,
  getGithubUserData,
  isBadRequest,
  isOtherClientError,
  paramsValidationFail
} from "../helpers";
import { IBountyCreate } from "../interfaces/bounty.interface";
import { AcceptBountyParams } from "../interfaces/core.interface";
import chalk from "chalk";

// Calls to {PUBLIC_URL}/bounty/assign (POST)
export async function acceptBounty(
  params: AcceptBountyParams,
  github: GithubFacade
) {
  try {
    const { issueNumber, commentId, contractId, address, assignee } = params;

    await github.acknowledgeCommand(commentId);

    const assigneeData = await getGithubUserData(assignee, github);

    const {
      data: { bounty }
    }: IBountyCreate = await callEp("bounty/assign", {
      contract: contractId,
      assignee: {
        name: assigneeData.name,
        username: assigneeData.login,
        id: assigneeData.id,
        email: assigneeData.email,
        avatarUrl: assigneeData.avatar_url,
        description: assigneeData.bio,
        pageUrl: assigneeData.blog,
        userUrl: assigneeData.html_url,
        location: assigneeData.location,
        twitterUsername: assigneeData.twitter_username
      },
      address,
      platform: "github",
      prNumber: issueNumber
    });
    console.debug(bounty);

    await github.replyToCommand(
      issueNumber,
      `Bounty has been accepted and linked to this PR. The contract id is ${contractId}. See tx at txUrl/txId. You will be able to claim the reward once this PR gets merged.`
    );
  } catch (e) {
    if (e instanceof AxiosError) {
      if (isBadRequest(e)) {
        await paramsValidationFail(
          github,
          params.issueNumber,
          params.commentId,
          e.response?.data.error
        );
      } else if (isOtherClientError(e)) {
        await github.replyToCommand(params.issueNumber, e.response?.data.error);
      }
    } else {
      await github.replyToCommand(
        params.issueNumber,
        "There was an error assigning the developer. Please try again."
      );
      console.error(chalk.red(`Error assigning developer. ${e}`));
    }
  }
}
