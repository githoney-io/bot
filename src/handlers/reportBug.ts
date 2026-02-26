import { GithubFacade } from "../adapters";
import { callEp, commandErrorHandler } from "../helpers";
import { ReportBugParams } from "../interfaces/core.interface";
import chalk from "chalk";
import { Responses } from "../responses";

const CARDANO_ADDR_PREFIXES = ["addr1", "addr_test1"];

function isValidCardanoAddress(addr: string): boolean {
  return CARDANO_ADDR_PREFIXES.some((p) => addr.startsWith(p)) && addr.length > 40;
}

// Calls to {BACKEND_URL}/bounty/bug-report (POST)
export async function reportBug(params: ReportBugParams, github: GithubFacade) {
  const { issueNumber, commentId, reporterAddress, reporterGithubUser, org, repo } =
    params;

  try {
    if (!isValidCardanoAddress(reporterAddress)) {
      await github.rejectCommand(commentId);
      await github.replyToCommand(issueNumber, Responses.INVALID_CARDANO_ADDRESS);
      return;
    }

    await github.acknowledgeCommand(commentId);

    await callEp("bounty/bug-report", {
      issueNumber,
      repo,
      org,
      reporterAddress,
      reporterGithubUser
    });

    await github.octokit.rest.issues.addLabels({
      owner: org,
      repo,
      issue_number: issueNumber,
      labels: ["bug", "githoney-bug-bounty"]
    });

    await github.replyToCommand(
      issueNumber,
      Responses.REPORT_BUG_SUCCESS({ reporter: reporterGithubUser })
    );
  } catch (e) {
    console.error(chalk.red(`Error reporting bug. ${e}`));
    await commandErrorHandler(e, issueNumber, github, commentId);
  }
}
