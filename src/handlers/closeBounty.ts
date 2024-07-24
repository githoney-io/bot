import chalk from "chalk";
import { callEp } from "../helpers";
import { PRHandler } from "../interfaces/core.interface";
import { IBountyCreate } from "../interfaces/bounty.interface";
import { Responses } from "../responses";
import { AxiosError } from "axios";

// Calls to {BACKEND_URL}/bounty/cancel (POST)
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

    await github.replyToCommand(issueNumber, Responses.CLOSE_BOUNTY_SUCCESS);
  } catch (e) {
    console.error(chalk.red(`Error handling cancel event: ${e}`));

    if (e instanceof AxiosError) {
      await github.replyToCommand(
        issueNumber,
        Responses.BACKEND_ERROR(e.response?.data.error)
      );
    } else {
      await github.replyToCommand(issueNumber, Responses.INTERNAL_SERVER_ERROR);
    }
  }
}
