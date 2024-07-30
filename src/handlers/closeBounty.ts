import chalk from "chalk";
import { callEp, txUrl } from "../helpers";
import { PRHandler } from "../interfaces/core.interface";
import {
  IBountyCreate,
  IBountyPlusNetwork
} from "../interfaces/bounty.interface";
import { Responses } from "../responses";
import { AxiosError } from "axios";
import { BOT_CODES } from "../utils/constants";

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

    if (e instanceof AxiosError) {
      if (e.response?.data.botCode === BOT_CODES.CLOSE_ACTION_NOT_FOUND) {
        await github.replyToCommand(
          issueNumber,
          Responses.CLOSE_ACTION_NOT_FOUND
        );
      } else {
        await github.replyToCommand(
          issueNumber,
          Responses.BACKEND_ERROR(e.response?.data.error)
        );
      }
    } else {
      await github.replyToCommand(issueNumber, Responses.INTERNAL_SERVER_ERROR);
    }
  }
}
