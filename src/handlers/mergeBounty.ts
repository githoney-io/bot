import chalk from "chalk";
import { callEp } from "../helpers";
import { PRHandler } from "../interfaces/core.interface";

// Calls to {PUBLIC_URL}/bounty/merge (POST)
export async function handlePRMerged({
  facade: github,
  issueNumber,
  orgName,
  repoName
}: PRHandler) {
  try {
    const res = await callEp("bounty/merge", {
      prNumber: issueNumber,
      orgName,
      repoName,
      platform: "github"
    });
    console.log(res);

    await github.replyToCommand(
      issueNumber,
      `Congrats! By merging this PR the bounty for contract contractId has been unlocked. Use this [link](signUrl to claim the reward.`
    );
  } catch (e) {
    await github.replyToCommand(
      issueNumber,
      "There was an error unlocking the contract. Please try again."
    );
    console.error(chalk.red(`"Error unlocking contract. ${e}`));
  }
}
