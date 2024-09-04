import { GithubFacade } from "./adapters";
import type { IssueComment, Issue } from "@octokit/webhooks-types";
import minimist from "minimist";
import { acceptBounty, createBounty, sponsorBounty } from "./handlers";
import { Responses } from "./responses";
import { collectWrongCommand } from "./handlers/wrongCommand";
import { HELP_COMMAND, NETWORK, VALID_COMMANDS } from "./utils/constants";

export async function handleComment(
  github: GithubFacade,
  issue: Issue,
  comment: IssueComment,
  owner: string
) {
  const commentBody = comment.body.trim();

  if (!commentBody.startsWith("/githoney")) {
    console.debug("Skipping because not directed to bot");
    return;
  }

  if (owner !== "Organization") {
    console.debug("Not an organization, ignoring.");
    return await github.replyToCommand(
      issue.number,
      Responses.USER_INSTALLATION_COMMENT
    );
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
        tokens: parsed.tokens?.split("&") || [],
        duration: parsed.duration,
        address: parsed.address,
        network: NETWORK.PREPROD
      };
      const commentId = comment.id;

      await createBounty(
        { creator: comment.user.login, issueInfo, bountyIdInfo, commentId },
        github
      );
      break;
    case VALID_COMMANDS.SPONSOR:
      if ("pull_request" in issue || issue.state === "closed")
        return await github.replyToCommand(
          issue.number,
          Responses.WRONG_COMMAND_USE
        );

      const sponsorInfo = {
        issue: issue.number,
        tokens: parsed.tokens?.split("&") || [],
        address: parsed.address,
        organization: github.owner,
        repository: github.repo
      };
      const sponsorCommentId = comment.id;

      await sponsorBounty(
        { sponsor: comment.user.login, sponsorInfo, sponsorCommentId },
        github
      );
      break;
    case VALID_COMMANDS.ACCEPT:
      if (!("pull_request" in issue) || issue.state === "closed")
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
