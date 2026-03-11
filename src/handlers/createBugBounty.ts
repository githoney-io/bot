import { GithubFacade } from "../adapters";
import { callEp, getEp, commandErrorHandler } from "../helpers";
import { CreateBugBountyParams } from "../interfaces/core.interface";
import { NETWORK, ONE_DAY_MS } from "../utils/constants";
import chalk from "chalk";
import appConfig from "../config/app-config";
import { Responses } from "../responses";
import {
  getGithubOrgData,
  getGithubRepoData,
  getGithubUserData
} from "../utils/githubQueries";

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

// Calls to {BACKEND_URL}/bounty (POST) with isBugReport=true
export async function createBugBounty(
  params: CreateBugBountyParams,
  github: GithubFacade
) {
  try {
    const { bountyInfo, commentId } = params;
    const { creatorUsername, issueInfo, bountyData } = bountyInfo;
    const { duration, address, network } = bountyData;
    const { number: issueNumber } = issueInfo;

    const deadline_ut = duration * ONE_DAY_MS;

    const tokens = bountyData.tokens.map((t) => {
      const [name, amount] = t.split("=");
      return name.toLowerCase() === "ada"
        ? { name, amount: Number(amount) }
        : undefined;
    });

    if (tokens.some((t) => t === undefined)) {
      await github.rejectCommand(commentId);
      await github.replyToCommand(issueNumber, Responses.PLEASE_USE_ADA);
      return;
    }

    // Look up the reporter address stored by /githoney report-bug
    let bugReport: { reporterAddress: string } | undefined;
    try {
      const res = await getEp("bounty/bug-report", {
        issue: issueNumber,
        repo: issueInfo.repository,
        org: issueInfo.organization
      });
      bugReport = res.data;
    } catch {
      // Not found or error
    }

    if (!bugReport?.reporterAddress) {
      await github.rejectCommand(commentId);
      await github.replyToCommand(issueNumber, Responses.CREATE_BUG_BOUNTY_NO_REPORT);
      return;
    }

    await github.acknowledgeCommand(commentId);

    const creatorData = await getGithubUserData(creatorUsername, github);
    const orgData = await getGithubOrgData(issueInfo.organization, github);
    const repoData = await getGithubRepoData(
      issueInfo.organization,
      issueInfo.repository,
      github
    );

    const {
      data: { bounty, fundingId }
    } = await callEp("bounty", {
      address,
      tokens,
      title: issueInfo.title,
      description: issueInfo.description,
      duration: deadline_ut,
      creator: creatorData,
      organization: orgData,
      repository: repoData,
      network: network.toLowerCase(),
      platform: issueInfo.source.toLowerCase(),
      categories: issueInfo.labels,
      issue: issueInfo.number,
      issueUrl: issueInfo.issueUrl,
      isBugReport: true,
      reporterAddress: bugReport.reporterAddress
    });

    const signUrl = `${appConfig.FRONTEND_URL}/bounty/sign/${bounty.id}/create?fundingId=${fundingId}`;
    const adaAmount = tokens.find((t) => t!.name === "ADA")!.amount;

    await github.replyToCommand(
      issueNumber,
      Responses.CREATE_BOUNTY_SUCCESS({
        address,
        amount: adaAmount,
        bountyId: bounty.id,
        deadline: Date.now() + deadline_ut,
        signUrl,
        isTestnet: network === NETWORK.PREPROD
      })
    );

    try {
      await github.octokit.rest.issues.addLabels({
        owner: issueInfo.organization,
        repo: issueInfo.repository,
        issue_number: issueInfo.number,
        labels: ["githoney-bounty"]
      });
    } catch (err) {
      logOctokitHttpError("create-bug-bounty:addLabels", err);
      // Non-blocking: bounty was created and user already got the sign link.
    }
  } catch (e) {
    console.error(chalk.red(`Error creating bug bounty. ${e}`));
    logOctokitHttpError("create-bug-bounty", e);
    await commandErrorHandler(
      e,
      params.bountyInfo.issueInfo.number,
      github,
      params.commentId
    );
  }
}
