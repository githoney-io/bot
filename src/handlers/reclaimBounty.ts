import chalk from "chalk";
import { GithubFacade } from "../adapters";
import { ReclaimBountyParams } from "../interfaces/core.interface";

// Unused
export async function reclaimBounty(
  params: ReclaimBountyParams,
  github: GithubFacade
) {
  try {
    const { issueNumber, commentId, contractId, address } = params;

    await github.acknowledgeCommand(commentId);

    // const signUrl = getSignUrl("withdraw", contractId, address);

    await github.replyToCommand(
      issueNumber,
      `Reclaiming bounty from contract with ID **${contractId}**. Maintainer with address **${address}** may reclaim the bounty using this [link]()`
    );
  } catch (e) {
    await github.replyToCommand(
      params.issueNumber,
      "There was an error reclaiming funds. Please try again."
    );
    console.error(chalk.red(`Error reclaiming funds from contract: ${e}`));
  }
}
