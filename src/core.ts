import { GithubFacade } from "./adapters";
import type { IssueComment, Issue, PullRequest } from "@octokit/webhooks-types";
import minimist from "minimist";
import chalk from "chalk";
import { AxiosError } from "axios";
import { ONE_ADA_IN_LOVELACE } from "./utils/constants";
import {
  AcceptBountyParams,
  AttachBountyParams,
  PRHandler,
  ReclaimBountyParams
} from "./interfaces/core.interface";
import {
  ALREADY_EXISTING_BOUNTY,
  ATTACH_BOUNTY_RESPONSE_COMMENT,
  callEp,
  getRepoLink,
  paramsValidationFail
} from "./helpers";
import appConfig from "./config/app-config";
import jwt from "jsonwebtoken";
import { IBountyCreate } from "./interfaces/bounty.interface";

export async function handleComment(
  github: GithubFacade,
  issue: Issue,
  comment: IssueComment
) {
  const commentBody = comment.body.trim();

  if (!commentBody.includes("/githoney")) {
    console.debug("Skipping because not directed to bot");
    return;
  }

  let args = commentBody
    .split(" ")
    .slice(1)
    .filter((arg) => arg !== "");
  console.debug(args);

  let parsed = minimist(args);

  if (parsed._.length === 0) {
    console.warn("bad command syntax", parsed);
    github.rejectCommand(comment.id);
    return;
  }

  const { data: creator } = await github.octokit.rest.users.getByUsername({
    username: comment.user.login
  });

  switch (parsed._[0]) {
    case "attach-bounty":
      // if (issue.labels?.length === 0 && !args.includes("--no-labels")) {
      //   github.replyToCommand(issue.number, ISSUE_WITHOUT_LABELS);
      //   return;
      // }
      const labels: string[] = []; // issue.labels?.map((label) => label.name) || [];

      const issueInfo = {
        creator,
        number: issue.number,
        title: issue.title,
        description: issue.body || "",
        link: issue.html_url,
        source: "GitHub",
        organization: github.owner,
        repository: github.repo,
        issue: issue.number,
        issueUrl: issue.html_url,
        labels
      };
      const contractInfo = {
        amount: parsed.amount,
        deadline: parsed.deadline,
        address: parsed.address,
        network: parsed.network || "preprod"
      };
      const commentId = comment.id;
      await attachBounty({ issueInfo, contractInfo, commentId }, github);
      break;
    case "accept-bounty":
      await acceptBounty(
        {
          issueNumber: issue.number,
          commentId: comment.id,
          contractId: parsed.contract,
          address: parsed.address,
          assignee: creator
        },
        github
      );
      break;
    case "reclaim-bounty":
      await reclaimBounty(
        {
          issueNumber: issue.number,
          commentId: comment.id,
          contractId: parsed.contract,
          address: parsed.address
        },
        github
      );
    default:
      console.warn("unknown command", parsed);
      github.rejectCommand(comment.id);
  }
}

// Calls to {BACKEND}/bounty (POST)
export async function attachBounty(
  params: AttachBountyParams,
  github: GithubFacade
) {
  try {
    const { issueInfo, contractInfo, commentId } = params;
    const {
      creator,
      description,
      labels,
      source,
      title,
      issue,
      organization,
      repository,
      number: issueNumber,
      issueUrl
    } = issueInfo;
    const { amount, deadline, address, network } = contractInfo;

    await github.acknowledgeCommand(commentId);

    const deadline_ut = Date.now() + deadline * 24 * 60 * 60 * 1000;
    const amountADA = amount * ONE_ADA_IN_LOVELACE;

    const {
      data: { bounty }
    }: IBountyCreate = await callEp("bounty", {
      title,
      description,
      amount: amountADA,
      deadline: deadline_ut,
      creator: {
        username: creator.login,
        id: creator.id,
        email: creator.email,
        avatarUrl: creator.avatar_url,
        description: creator.bio,
        pageUrl: creator.blog,
        userUrl: creator.html_url,
        location: creator.location,
        twitterUsername: creator.twitter_username
      },
      network: network.toLowerCase(),
      platform: source.toLowerCase(),
      categories: labels,
      organization,
      repository,
      issue,
      address,
      issueUrl
    });

    await github.replyToCommand(
      issueNumber,
      `## This is a mock response: ${ATTACH_BOUNTY_RESPONSE_COMMENT(
        { ...contractInfo, deadline: deadline_ut },
        "someHashContract",
        "someSignUrl",
        network
      )}`
    );

    const token = jwt.sign(
      { GitHubBot: "I'm the GitHubBot" },
      appConfig.TW_SECRET_KEY
    );
    const headers = { authorization: token };

    const twBotRoute = "newBounty";
    callEp(
      twBotRoute,
      {
        linkToIssue: getRepoLink(organization, repository, issue),
        amount,
        deadline: new Date(deadline_ut).toISOString(),
        contractHash: "someHashContract"
      },
      appConfig.TW_BOT_URL,
      headers
    )
      .then((response) => console.log(response))
      .catch((_e) => console.error("Tweet bot error", _e));
  } catch (e: any) {
    if (e instanceof AxiosError && e.response?.status === 400) {
      // If the error is a 400, it means that the validation failed
      await paramsValidationFail(
        github,
        params.issueInfo.number,
        params.commentId,
        e.response?.data.error
      );
    } else if (e instanceof AxiosError && e.response?.status === 412) {
      await github.replyToCommand(
        params.issueInfo.number,
        ALREADY_EXISTING_BOUNTY
      );
    } else {
      await github.replyToCommand(
        params.issueInfo.number,
        "There was an error creating the contract. Please try again."
      );
      console.error(chalk.red(`Error creating contract. ${e}`));
    }
  }
}

// Calls to {PUBLIC_URL}/bounty/assign (POST)
export async function acceptBounty(
  params: AcceptBountyParams,
  github: GithubFacade
) {
  try {
    const { issueNumber, commentId, contractId, address, assignee } = params;

    await github.acknowledgeCommand(commentId);

    const {
      data: { bounty }
    }: IBountyCreate = await callEp("bounty/assign", {
      contract: contractId,
      assignee: {
        username: assignee.login,
        id: assignee.id,
        email: assignee.email,
        avatarUrl: assignee.avatar_url,
        description: assignee.bio,
        pageUrl: assignee.blog,
        userUrl: assignee.html_url,
        location: assignee.location,
        twitterUsername: assignee.twitter_username
      },
      address,
      platform: "github",
      prNumber: issueNumber
    });

    await github.replyToCommand(
      issueNumber,
      `Bounty has been accepted and linked to this PR. The contract id is ${contractId}. See tx at txUrl/txId. You will be able to claim the reward once this PR gets merged.`
    );
  } catch (e) {
    if (e instanceof AxiosError && e.response?.status === 400) {
      // If the error is a 400, it means that the validation failed
      await paramsValidationFail(
        github,
        params.issueNumber,
        params.commentId,
        e.response?.data.error
      );
    } else if (
      e instanceof AxiosError &&
      e.response?.status &&
      e.response?.status > 400 &&
      e.response?.status < 500
    ) {
      await github.replyToCommand(params.issueNumber, e.response.data.error);
    } else {
      await github.replyToCommand(
        params.issueNumber,
        "There was an error assigning the developer. Please try again."
      );
      console.error(chalk.red(`Error assigning developer. ${e}`));
    }
  }
}

export async function reclaimBounty(
  params: ReclaimBountyParams,
  github: GithubFacade
) {
  try {
    const { issueNumber, commentId, contractId, address } = params;

    await github.acknowledgeCommand(commentId);

    // const signUrl = getSignUrl("withdraw", contractId, address);

    await github.replyToCommand(
      issueNumber,
      `Reclaiming bounty from contract with ID **${contractId}**. Maintainer with address **${address}** may reclaim the bounty using this [link]()`
    );
  } catch (e) {
    await github.replyToCommand(
      params.issueNumber,
      "There was an error reclaiming funds. Please try again."
    );
    console.error(chalk.red(`Error reclaiming funds from contract: ${e}`));
  }
}

// Calls to {PUBLIC_URL}/bounty/merge (POST)
export async function handlePRMerged({
  facade: github,
  issueNumber,
  orgName,
  repoName
}: PRHandler) {
  try {
    const res = await callEp("bounty/merge", {
      prNumber: issueNumber,
      orgName,
      repoName,
      platform: "github"
    });
    console.log(res);

    await github.replyToCommand(
      issueNumber,
      `Congrats! By merging this PR the bounty for contract contractId has been unlocked. Use this [link](signUrl to claim the reward.`
    );
  } catch (e) {
    await github.replyToCommand(
      issueNumber,
      "There was an error unlocking the contract. Please try again."
    );
    console.error(chalk.red(`"Error unlocking contract. ${e}`));
  }
}

// Calls to {PUBLIC_URL}/bounty/cancel (POST)
export async function handlePRClosed({
  facade: github,
  issueNumber,
  orgName,
  repoName
}: PRHandler) {
  try {
    const res = await callEp("bounty/cancel", {
      prNumber: issueNumber,
      orgName,
      repoName,
      platform: "github"
    });

    await github.replyToCommand(
      issueNumber,
      `Cancelling contract with ID **contractId**. You can see the cancel transaction in this [link](txUrltxId)`
    );
  } catch (e) {
    await github.replyToCommand(
      issueNumber,
      "There was an error cancelling the contract. Please try again."
    );
    console.error(chalk.red(`Error cancelling contract: ${e}`));
  }
}
