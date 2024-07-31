import chalk from "chalk";
import { callEp, commandErrorHandler, txUrl } from "../helpers";
import { PRHandler } from "../interfaces/core.interface";
import appConfig from "../config/app-config";
import { IBountyPlusNetwork } from "../interfaces/bounty.interface";
import { Responses } from "../responses";

// Calls to {BACKEND_URL}/bounty/merge (POST)
export async function handlePRMerged({
  facade: github,
  issueNumber,
  orgName,
  repoName
}: PRHandler) {
  try {
    const {
      data: { bounty, network }
    }: IBountyPlusNetwork = await callEp("bounty/merge", {
      prNumber: issueNumber,
      orgName,
      repoName,
      platform: "github"
    });
    console.debug(bounty);
    const signUrl = `${appConfig.FRONTEND_URL}/bounty/sign/${bounty.id}/claim`;
    const txLink = txUrl(bounty.transactionHash, network.name);
    await github.replyToCommand(
      issueNumber,
      Responses.MERGE_BOUNTY_SUCCESS(signUrl, txLink)
    );
  } catch (e) {
    console.error(chalk.red(`Error handling merge event. ${e}`));

    await commandErrorHandler(e, issueNumber, github);
  }
}
