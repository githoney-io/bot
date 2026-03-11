import { GithubFacade } from "../adapters";
import { callEp, commandErrorHandler } from "../helpers";
import { ReportBugParams } from "../interfaces/core.interface";
import chalk from "chalk";
import { Responses } from "../responses";

const CARDANO_ADDR_PREFIXES = ["addr1", "addr_test1"];

function isValidCardanoAddress(addr: string): boolean {
  return CARDANO_ADDR_PREFIXES.some((p) => addr.startsWith(p)) && addr.length > 40;
}

const logOctokitHttpError = (context: string, e: any) => {
  if (!e || typeof e !== "object") return;
  const status = e.status ?? e.response?.status;
  const method = e.request?.method;
  const url = e.request?.url;
  const message = e.response?.data?.message ?? e.message;
  if (status || method || url) {
    console.error(
      `[${context}] GitHub HttpError status=${status ?? "n/a"} method=${method ?? "n/a"} url=${url ?? "n/a"} message=${message ?? "unknown"}`
    );
  }
};

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

    try {
      await github.octokit.rest.issues.addLabels({
        owner: org,
        repo,
        issue_number: issueNumber,
        labels: ["bug", "githoney-bug-bounty"]
      });
    } catch (err) {
      logOctokitHttpError("report-bug:addLabels", err);
      // Non-blocking: report already persisted.
    }

    await github.replyToCommand(
      issueNumber,
      Responses.REPORT_BUG_SUCCESS({ reporter: reporterGithubUser })
    );
  } catch (e) {
    console.error(chalk.red(`Error reporting bug. ${e}`));
    logOctokitHttpError("report-bug", e);
    await commandErrorHandler(e, issueNumber, github, commentId);
  }
}
