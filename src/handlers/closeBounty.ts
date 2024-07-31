import chalk from "chalk";
import { callEp, commandErrorHandler, txUrl } from "../helpers";
import { PRHandler } from "../interfaces/core.interface";
import { IBountyPlusNetwork } from "../interfaces/bounty.interface";
import { Responses } from "../responses";

// Calls to {BACKEND_URL}/bounty/cancel (POST)
export async function handlePRClosed({
  facade: github,
  issueNumber,
  orgName,
  repoName
}: PRHandler) {
  try {
    const {
      data: { bounty, network }
    }: IBountyPlusNetwork = await callEp("bounty/cancel", {
      prNumber: issueNumber,
      orgName,
      repoName,
      platform: "github"
    });

    const txLink = txUrl(bounty.transactionHash, network.name);
    await github.replyToCommand(
      issueNumber,
      Responses.CLOSE_BOUNTY_SUCCESS(txLink)
    );
  } catch (e) {
    console.error(chalk.red(`Error handling cancel event: ${e}`));

    await commandErrorHandler(e, issueNumber, github);
  }
}
