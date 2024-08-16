import chalk from "chalk";
import { callEp, commandErrorHandler, txUrl } from "../helpers";
import { CloseHandler } from "../interfaces/core.interface";
import { IBountyPlusNetwork } from "../interfaces/bounty.interface";
import { Responses } from "../responses";

// Calls to {BACKEND_URL}/bounty/cancel (POST)
export async function handleBountyClosed({
  from,
  facade: github,
  issueNumber,
  orgName,
  repoName,
  owner
}: CloseHandler) {
  try {
    if (owner !== "Organization") {
      console.debug("Not an organization, ignoring.");
      return await github.replyToCommand(
        issueNumber,
        Responses.USER_INSTALLATION_COMMENT
      );
    }

    const {
      data: { bounty, network }
    }: IBountyPlusNetwork = await callEp("bounty/cancel", {
      from,
      prNumber: issueNumber,
      orgName,
      repoName,
      platform: "github"
    });

    const txLink = txUrl(bounty.transactionHash, network.name);
    await github.replyToCommand(
      issueNumber,
      Responses.CLOSE_BOUNTY_SUCCESS(txLink, bounty.prNumber ? true : false)
    );
  } catch (e) {
    console.error(chalk.red(`Error handling cancel event: ${e}`));

    await commandErrorHandler(e, issueNumber, github);
  }
}
