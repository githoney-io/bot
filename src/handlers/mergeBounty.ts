import chalk from "chalk";
import { callEp } from "../helpers";
import { PRHandler } from "../interfaces/core.interface";
import { config } from "dotenv";
import appConfig from "../config/app-config";
import { IBountyCreate } from "../interfaces/bounty.interface";

// Calls to {PUBLIC_URL}/bounty/merge (POST)
export async function handlePRMerged({
  facade: github,
  issueNumber,
  orgName,
  repoName
}: PRHandler) {
  try {
    const {
      data: { bounty }
    }: IBountyCreate = await callEp("bounty/merge", {
      prNumber: issueNumber,
      orgName,
      repoName,
      platform: "github"
    });
    console.debug(bounty);
    const signUrl = `${appConfig.FRONTEND_URL}/claim/${bounty.id}`;

    await github.replyToCommand(
      issueNumber,
      `Congrats! By merging this PR the bounty for bounty ${bounty.id} has been unlocked. Use this link ${signUrl} to claim the reward.`
    );
  } catch (e) {
    await github.replyToCommand(
      issueNumber,
      "There was an error unlocking the bountyId. Please try again."
    );
    console.error(chalk.red(`"Error unlocking bountyId. ${e}`));
  }
}
