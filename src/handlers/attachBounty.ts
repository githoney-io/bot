import { AxiosError } from "axios";
import { GithubFacade } from "../adapters";
import {
  ALREADY_EXISTING_BOUNTY,
  ATTACH_BOUNTY_RESPONSE_COMMENT,
  callEp,
  isBadRequest,
  isOtherClientError,
  paramsValidationFail
} from "../helpers";
import { IBountyCreate } from "../interfaces/bounty.interface";
import { AttachBountyParams } from "../interfaces/core.interface";
import { ONE_ADA_IN_LOVELACE, ONE_DAY_MS } from "../utils/constants";
import { StatusCodes } from "http-status-codes";
import chalk from "chalk";
import { callTwBot } from "../utils/twBot";

// Calls to {BACKEND}/bounty (POST)
export async function attachBounty(
  params: AttachBountyParams,
  github: GithubFacade
) {
  try {
    const { creator, issueInfo, contractInfo, commentId } = params;
    const { labels, source, number: issueNumber } = issueInfo;
    const { amount, deadline, address, network } = contractInfo;

    await github.acknowledgeCommand(commentId);

    const deadline_ut = deadline * ONE_DAY_MS;
    const amountADA = amount * ONE_ADA_IN_LOVELACE;

    const { data: creatorData } = await github.octokit.rest.users.getByUsername(
      {
        username: creator
      }
    );

    const {
      data: { bounty }
    }: IBountyCreate = await callEp("bounty", {
      title: issueInfo.title,
      description: issueInfo.description,
      amount: amountADA,
      deadline: deadline_ut,
      creator: {
        username: creatorData.login,
        name: creatorData.name,
        id: creatorData.id,
        email: creatorData.email,
        avatarUrl: creatorData.avatar_url,
        description: creatorData.bio,
        pageUrl: creatorData.blog,
        userUrl: creatorData.html_url,
        location: creatorData.location,
        twitterUsername: creatorData.twitter_username
      },
      network: network.toLowerCase(),
      platform: source.toLowerCase(),
      categories: labels,
      organization: issueInfo.organization,
      repository: issueInfo.repository,
      issue: issueInfo.number,
      address,
      issueUrl: issueInfo.issueUrl
    });
    console.debug(bounty);

    await github.replyToCommand(
      issueNumber,
      `## This is a mock response: ${ATTACH_BOUNTY_RESPONSE_COMMENT(
        { ...contractInfo, deadline: deadline_ut },
        "someHashContract",
        "someSignUrl",
        network
      )}`
    );

    callTwBot(
      amount,
      issueInfo.organization,
      issueInfo.repository,
      issueInfo.number,
      deadline_ut
    );
  } catch (e) {
    if (e instanceof AxiosError) {
      if (isBadRequest(e)) {
        // If the error is a 400, it means that the validation failed
        await paramsValidationFail(
          github,
          params.issueInfo.number,
          params.commentId,
          e.response?.data.error
        );
      } else if (e.response?.status === StatusCodes.PRECONDITION_FAILED) {
        await github.replyToCommand(
          params.issueInfo.number,
          ALREADY_EXISTING_BOUNTY
        );
      } else if (isOtherClientError(e)) {
        await github.replyToCommand(
          params.issueInfo.number,
          e.response?.data.error
        );
      }
    } else {
      await github.replyToCommand(
        params.issueInfo.number,
        "There was an error creating the contract. Please try again."
      );
      console.error(chalk.red(`Error creating contract. ${e}`));
    }
  }
}
