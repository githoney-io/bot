import chalk from "chalk";
import { callEp, commandErrorHandler, txUrl } from "../helpers";
import { CloseHandler } from "../interfaces/core.interface";
import { IBountyPlusNetwork } from "../interfaces/bounty.interface";
import { Responses } from "../responses";
import { getGithubOrgData, getGithubRepoData } from "../utils/githubQueries";

// Calls to {BACKEND_URL}/bounty/cancel (POST)
export async function handleBountyClosed({
  from,
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
    }: IBountyPlusNetwork = await callEp("bounty/cancel", {
      from,
      prNumber: issueNumber,
      organization: orgData,
      repository: repoData,
      platform: "github"
    });

    const txLink = txUrl(bounty.transactionHash, network.name);
    await github.replyToCommand(
      issueNumber,
      Responses.CLOSE_BOUNTY_SUCCESS(txLink, bounty.prNumber ? true : false)
    );
  } catch (e) {
    console.error(chalk.red(`Error handling cancel event: ${e}`));

    await commandErrorHandler(e, issueNumber, github, undefined, true);
  }
}
