import chalk from "chalk";
import { callEp, commandErrorHandler, txUrl } from "../helpers";
import { CloseHandler } from "../interfaces/core.interface";
import appConfig from "../config/app-config";
import { IBountyPlusNetwork } from "../interfaces/bounty.interface";
import { Responses } from "../responses";
import { getGithubOrgData, getGithubRepoData } from "../utils/githubQueries";

// Calls to {BACKEND_URL}/bounty/merge (POST)
export async function handlePRMerged({
  facade: github,
  issueNumber,
  orgName,
  repoName
}: CloseHandler) {
  try {
    const orgData = await getGithubOrgData(orgName, github);
    const repoData = await getGithubRepoData(orgName, repoName, github);

    const {
      data: { bounty, network }
    }: IBountyPlusNetwork = await callEp("bounty/merge", {
      prNumber: issueNumber,
      organization: orgData,
      repository: repoData,
      platform: "github"
    });
    console.debug(bounty);
    const signUrl = `${appConfig.FRONTEND_URL}/bounty/sign/${bounty.id}/claim`;
    const txLink = txUrl(bounty.transactionHash, network.name);
    await github.replyToCommand(
      issueNumber,
      Responses.MERGE_BOUNTY_SUCCESS(signUrl, txLink!)
    );
    await github.replyToCommand(
      bounty.issueNumber,
      Responses.PULL_REQUEST_MERGED
    );
  } catch (e) {
    console.error(chalk.red(`Error handling merge event. ${e}`));

    await commandErrorHandler(e, issueNumber, github, undefined, true);
  }
}
