import chalk from "chalk";
import { callEp } from "../helpers";
import { PRHandler } from "../interfaces/core.interface";

// Calls to {PUBLIC_URL}/bounty/cancel (POST)
export async function handlePRClosed({
  facade: github,
  issueNumber,
  orgName,
  repoName
}: PRHandler) {
  try {
    const res = await callEp("bounty/cancel", {
      prNumber: issueNumber,
      orgName,
      repoName,
      platform: "github"
    });

    await github.replyToCommand(
      issueNumber,
      `Cancelling contract with ID **contractId**. You can see the cancel transaction in this [link](txUrltxId)`
    );
  } catch (e) {
    await github.replyToCommand(
      issueNumber,
      "There was an error cancelling the contract. Please try again."
    );
    console.error(chalk.red(`Error cancelling contract: ${e}`));
  }
}
