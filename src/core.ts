import { GithubFacade } from "./adapters";
import type { IssueComment, Issue, PullRequest } from "@octokit/webhooks-types";
import minimist from "minimist";
import chalk from "chalk";
import { AxiosError } from "axios";
import { ONE_ADA_IN_LOVELACE } from "./utils/constants";
import {
  AcceptBountyParams,
  AttachBountyParams,
  ReclaimBountyParams
} from "./interfaces/core.interface";
import {
  ATTACH_BOUNTY_RESPONSE_COMMENT,
  callEp,
  getSignUrl,
  paramsValidationFail
} from "./helpers";
import appConfig from "./config/app-config";

export async function handleComment(
  github: GithubFacade,
  issue: Issue,
  comment: IssueComment
) {
  const commentBody = comment.body.trim();

  if (!commentBody.includes("/githoney")) {
    console.debug("skipping because not directed to bot");
    return;
  }

  let args = commentBody
    .split(" ")
    .slice(1)
    .filter((arg) => arg !== "");
  console.debug(args);

  let parsed = minimist(args);
  console.debug(parsed);

  if (parsed._.length == 0) {
    console.warn("bad command syntax", parsed);
    github.rejectCommand(comment.id);
    return;
  }

  switch (parsed._[0]) {
    case "attach-bounty":
      await attachBounty(
        {
          issueNumber: issue.number,
          issueUrl: issue.html_url,
          commentId: comment.id,
          amount: parsed.amount,
          deadline: parsed.deadline,
          address: parsed.address,
          network: parsed.network
        },
        github
      );
      break;
    case "accept-bounty":
      await acceptBounty(
        {
          issueNumber: issue.number,
          commentId: comment.id,
          contractId: parsed.contract,
          address: parsed.address
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

// Calls to {PUBLIC_URL}/createContract
export async function attachBounty(
  params: AttachBountyParams,
  github: GithubFacade
) {
  try {
    const {
      issueNumber,
      issueUrl,
      commentId,
      amount,
      deadline,
      address,
      network
    } = params;

    await github.acknowledgeCommand(commentId);

    const deadline_ut = Date.now() + (deadline + 1) * 24 * 60 * 60 * 1000;
    const amountADA = amount * ONE_ADA_IN_LOVELACE;

    // const { contractId } = await callEp("createContract", {
    //   address,
    //   network,
    //   amount: amountADA,
    //   deadline: deadline_ut
    // });

    // const signUrl = getSignUrl("deposit", contractId, address);

    // await github.replyToCommand(
    //   issueNumber,
    //   ATTACH_BOUNTY_RESPONSE_COMMENT(params, contractId, signUrl, network)
    // );

    const twBotRoute = "newBounty";
    callEp(
      twBotRoute,
      {
        linkToIssue: issueUrl,
        amount,
        // deadline: new Date(deadline_ut).toISOString(),
        contractHash: "someHashContract"
        // contractHash: contractId
      },
      appConfig.TW_BOT_URL
    )
      .then((response) => console.log(response))
      .catch((_e) => console.error("Tweet bot error"));
  } catch (e: any) {
    if (e instanceof AxiosError && e.response?.status === 400) {
      // If the error is a 400, it means that the validation failed
      await paramsValidationFail(
        github,
        params.issueNumber,
        params.commentId,
        e.response?.data.error
      );
    } else {
      await github.replyToCommand(
        params.issueNumber,
        "There was an error creating the contract. Please try again."
      );
      console.error(chalk.red(`Error creating contract. ${e}`));
    }
  }
}

// Calls to {PUBLIC_URL}/assignDeveloper
export async function acceptBounty(
  params: AcceptBountyParams,
  github: GithubFacade
) {
  try {
    const { issueNumber, commentId, contractId, address } = params;

    await github.acknowledgeCommand(commentId);

    const { txId } = await callEp("assignDeveloper", {
      contractId,
      address,
      issueNumber
    });

    // TODO: handle this with the corresponding network
    const txUrl = `https://preprod.cexplorer.io/tx/`;

    await github.replyToCommand(
      issueNumber,
      `Bounty has been accepted and linked to this PR. The contract id is ${contractId}. The claim token has been sent to address ${address}. See tx at ${txUrl}${txId}. Holder of the token will be able to claim the reward once this PR gets merged.`
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
    } else if (e instanceof AxiosError && e.response?.status === 404) {
      // If the error is a 404, it means that the client typed an
      // invalid contract ID or the address is in the wrong network
      await github.rejectCommand(params.commentId);
      await github.replyToCommand(
        params.issueNumber,
        "The contract ID provided does not exist or you typed an address in the wrong network."
      );
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

    const signUrl = getSignUrl("withdraw", contractId, address);

    await github.replyToCommand(
      issueNumber,
      `Reclaiming bounty from contract with ID **${contractId}**. Maintainer with address **${address}** may reclaim the bounty using this [link](${signUrl})`
    );
  } catch (e) {
    await github.replyToCommand(
      params.issueNumber,
      "There was an error reclaiming funds. Please try again."
    );
    console.error(chalk.red(`Error reclaiming funds from contract: ${e}`));
  }
}

// Calls to {PUBLIC_URL}/unlockPayment
export async function handlePRMerged(github: GithubFacade, pr: PullRequest) {
  try {
    const { contractId, devAddr } = await callEp("unlockPayment", {
      prNumber: pr.number
    });

    const signUrl = getSignUrl("withdraw", contractId, devAddr);

    await github.replyToCommand(
      pr.number,
      `Congrats! By merging this PR the bounty for contract ${contractId} has been unlocked. Use this [link](${signUrl}) to claim the reward.`
    );
  } catch (e) {
    await github.replyToCommand(
      pr.number,
      "There was an error unlocking the contract. Please try again."
    );
    console.error(chalk.red(`"Error unlocking contract. ${e}`));
  }
}

// Calls to {PUBLIC_URL}/cancelBounty
export async function handlePRClosed(github: GithubFacade, pr: PullRequest) {
  try {
    const { contractId, txId } = await callEp("cancelBounty", {
      prNumber: pr.number
    });

    const txUrl = `https://preprod.cexplorer.io/tx/`;

    await github.replyToCommand(
      pr.number,
      `Cancelling contract with ID **${contractId}**. You can see the cancel transaction in this [link](${txUrl}${txId})`
    );
  } catch (e) {
    await github.replyToCommand(
      pr.number,
      "There was an error cancelling the contract. Please try again."
    );
    console.error(chalk.red(`Error cancelling contract: ${e}`));
  }
}
