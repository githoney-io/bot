import chalk from "chalk";
import { callEp } from "../helpers";
import { PRHandler } from "../interfaces/core.interface";
import { IBountyCreate } from "../interfaces/bounty.interface";

// Calls to {PUBLIC_URL}/bounty/cancel (POST)
export async function handlePRClosed({
  facade: github,
  issueNumber,
  orgName,
  repoName
}: PRHandler) {
  try {
    const {
      data: { bounty }
    }: IBountyCreate = await callEp("bounty/cancel", {
      prNumber: issueNumber,
      orgName,
      repoName,
      platform: "github"
    });

    await github.replyToCommand(
      issueNumber,
      `Cancelling bounty with ID ${bounty.id}` // TODO: Add link to transaction
    );
  } catch (e) {
    await github.replyToCommand(
      issueNumber,
      "There was an error cancelling the bountyId. Please try again."
    );
    console.error(chalk.red(`Error cancelling bountyId: ${e}`));
  }
}
