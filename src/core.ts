import { GithubFacade } from "./adapters";
import type { IssueComment, Issue } from "@octokit/webhooks-types";
import minimist from "minimist";
import { acceptBounty, attachBounty, fundBounty } from "./handlers";
import { Responses } from "./responses";
import { collectWrongCommand } from "./handlers/wrongCommand";
import { VALID_COMMANDS } from "./utils/constants";

export async function handleComment(
  github: GithubFacade,
  issue: Issue,
  comment: IssueComment
) {
  const commentBody = comment.body.trim();

  if (!commentBody.startsWith("/githoney")) {
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
    await github.rejectCommand(comment.id);
    await github.replyToCommand(issue.number, Responses.UNKNOWN_COMMAND);
    await collectWrongCommand(parsed);
    return;
  }

  if (Object.keys(parsed).length === 1) {
    console.warn("no args");
    await collectWrongCommand(parsed);
  }

  switch (parsed._[0]) {
    case VALID_COMMANDS.HELP:
      await github.replyToCommand(issue.number, Responses.HELP_COMMAND);
      break;
    case VALID_COMMANDS.ATTACH:
      if ("pull_request" in issue)
        return await github.replyToCommand(
          issue.number,
          Responses.WRONG_COMMAND_USE
        );

      const issueInfo = {
        number: issue.number,
        title: issue.title,
        description: issue.body || "",
        link: issue.html_url,
        source: "GitHub",
        organization: github.owner,
        repository: github.repo,
        issueUrl: issue.html_url,
        labels: []
      };
      const bountyIdInfo = {
        amount: parsed.amount,
        deadline: parsed.deadline,
        address: parsed.address,
        network: parsed.network || "preprod"
      };
      const commentId = comment.id;

      await attachBounty(
        { creator: comment.user.login, issueInfo, bountyIdInfo, commentId },
        github
      );
      break;
    case VALID_COMMANDS.FUND:
      if ("pull_request" in issue)
        return await github.replyToCommand(
          issue.number,
          Responses.WRONG_COMMAND_USE
        );

      const fundInfo = {
        issue: issue.number,
        tokens: parsed.tokens?.split("&") || [],
        address: parsed.address,
        organization: github.owner,
        repository: github.repo
      };
      const fundCommentId = comment.id;

      await fundBounty(
        { funder: comment.user.login, fundInfo, fundCommentId },
        github
      );
      break;
    case VALID_COMMANDS.ACCEPT:
      if (!("pull_request" in issue))
        return await github.replyToCommand(
          issue.number,
          Responses.WRONG_COMMAND_USE
        );

      await acceptBounty(
        {
          issueNumber: issue.number,
          commentId: comment.id,
          bountyId: parsed.bountyId,
          address: parsed.address,
          assignee: comment.user.login
        },
        github
      );
      break;
    default:
      console.warn("unknown command", parsed);
      await github.replyToCommand(issue.number, Responses.UNKNOWN_COMMAND);
      await github.rejectCommand(comment.id);
      await collectWrongCommand(parsed);
      break;
  }
}
