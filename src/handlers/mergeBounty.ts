import chalk from "chalk";
import { callEp } from "../helpers";
import { PRHandler } from "../interfaces/core.interface";
import appConfig from "../config/app-config";
import { IBountyCreate } from "../interfaces/bounty.interface";
import { Responses } from "../responses";
import { AxiosError } from "axios";

// Calls to {BACKEND_URL}/bounty/merge (POST)
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
    const signUrl = `${appConfig.FRONTEND_URL}/bounty/sign/${bounty.id}/claim`;

    await github.replyToCommand(
      issueNumber,
      Responses.MERGE_BOUNTY_SUCCESS(signUrl)
    );
  } catch (e) {
    console.error(chalk.red(`Error handling merge event. ${e}`));

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
