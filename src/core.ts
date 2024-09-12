import { GithubFacade } from "./adapters";
import type { IssueComment, Issue, PullRequest } from "@octokit/webhooks-types";
import minimist from "minimist";
import { acceptBounty, createBounty, sponsorBounty } from "./handlers";
import { Responses } from "./responses";
import { collectWrongCommand } from "./handlers/wrongCommand";
import { HELP_COMMAND, NETWORK, VALID_COMMANDS } from "./utils/constants";
import {
  AcceptBountyParams,
  CreateBountyParams,
  LinkBountyParams,
  SponsorBountyParams
} from "./interfaces/core.interface";
import { linkBounty } from "./handlers/linkBounty";

const getParsedData = async (
  github: GithubFacade,
  comment: string,
  issueNumber: number,
  owner: string
) => {
  const commentBody = comment.trim();

  if (!commentBody.startsWith("/githoney")) {
    console.debug("Skipping because not directed to bot");
    return;
  }

  if (owner !== "Organization") {
    console.debug("Not an organization, ignoring.");
    return await github.replyToCommand(
      issueNumber,
      Responses.USER_INSTALLATION_COMMENT
    );
  }

  let args = commentBody
    .split(" ")
    .slice(1)
    .filter((arg) => arg !== "");
  console.debug(args);

  return minimist(args);
};

export async function handleComment(
  github: GithubFacade,
  issue: Issue,
  comment: IssueComment,
  owner: string
) {
  let parsed = await getParsedData(github, comment.body, issue.number, owner);
  if (!parsed) return;

  if (parsed._.length === 0) {
    console.warn("bad command syntax", parsed);
    await github.rejectCommand(comment.id);
    await github.replyToCommand(issue.number, Responses.UNKNOWN_COMMAND);
    await collectWrongCommand(parsed);
    return;
  }

  if (
    Object.keys(parsed).length === 1 &&
    Object.values(VALID_COMMANDS).includes(parsed._[0])
  ) {
    console.warn("no args");
    await collectWrongCommand(parsed);
  }

  switch (parsed._[0]) {
    case HELP_COMMAND:
      await github.replyToCommand(issue.number, Responses.HELP_COMMAND);
      break;
    case VALID_COMMANDS.CREATE:
      if ("pull_request" in issue || issue.state === "closed")
        return await github.replyToCommand(
          issue.number,
          Responses.WRONG_COMMAND_USE
        );

      const bountyParams: CreateBountyParams = {
        bountyInfo: {
          creatorUsername: comment.user.login,
          issueInfo: {
            number: issue.number,
            title: issue.title,
            description: issue.body || "",
            source: "GitHub",
            organization: github.owner,
            repository: github.repo,
            issueUrl: issue.html_url,
            labels: []
          },
          bountyData: {
            tokens: parsed.tokens?.split("&") || [],
            duration: parsed.duration,
            address: parsed.address,
            network: NETWORK.PREPROD
          }
        },
        commentId: comment.id
      };

      await createBounty(bountyParams, github);
      break;
    case VALID_COMMANDS.SPONSOR:
      if ("pull_request" in issue || issue.state === "closed")
        return await github.replyToCommand(
          issue.number,
          Responses.WRONG_COMMAND_USE
        );

      const sponsorParams: SponsorBountyParams = {
        sponsorInfo: {
          sponsorUsername: comment.user.login,
          issue: issue.number,
          tokens: parsed.tokens?.split("&") || [],
          address: parsed.address,
          organization: github.owner,
          repository: github.repo
        },
        commentId: comment.id
      };

      await sponsorBounty(sponsorParams, github);
      break;
    case VALID_COMMANDS.ACCEPT:
      if ("pull_request" in issue || issue.state === "closed")
        return await github.replyToCommand(
          issue.number,
          Responses.WRONG_COMMAND_USE
        );

      const acceptParams: AcceptBountyParams = {
        issueNumber: issue.number,
        commentId: comment.id,
        bountyId: parsed.bountyId,
        address: parsed.address,
        assignee: comment.user.login
      };

      await acceptBounty(acceptParams, github);
      break;
    case VALID_COMMANDS.LINK:
      if (!("pull_request" in issue) || issue.state === "closed")
        return await github.replyToCommand(
          issue.number,
          Responses.WRONG_COMMAND_USE
        );

      const linkParams: LinkBountyParams = {
        bountyId: parsed.bountyId,
        commentId: comment.id,
        contributor: comment.user.login,
        issueNumber: issue.number
      };

      await linkBounty(linkParams, github);
      break;
    default:
      console.warn("unknown command", parsed);
      await github.replyToCommand(issue.number, Responses.UNKNOWN_COMMAND);
      await github.rejectCommand(comment.id);
      await collectWrongCommand(parsed);
      break;
  }
}

export async function handlePr(
  github: GithubFacade,
  pr: PullRequest,
  owner: string
) {
  if (!pr.body) return;

  const parsed = await getParsedData(github, pr.body, pr.number, owner);
  if (!parsed) return;

  if (parsed._.length === 0) {
    console.warn("bad command syntax", parsed);
    await github.replyToCommand(pr.number, Responses.UNKNOWN_COMMAND);
    await collectWrongCommand(parsed);
    return;
  }

  if (Object.keys(parsed).length === 1 && parsed._[0] === VALID_COMMANDS.LINK) {
    console.warn("no args");
    await collectWrongCommand(parsed);
  }

  if (parsed._[0] === VALID_COMMANDS.LINK) {
    const linkParams: LinkBountyParams = {
      bountyId: parsed.bountyId,
      contributor: pr.user.login,
      issueNumber: pr.number
    };

    await linkBounty(linkParams, github);
  } else {
    console.warn("unknown command", parsed);
    await github.replyToCommand(pr.number, Responses.UNKNOWN_COMMAND);
    await collectWrongCommand(parsed);
  }
}
