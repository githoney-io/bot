import { GithubFacade } from "../adapters";
import { callEp, commandErrorHandler, getGithubUserData } from "../helpers";
import { CreateBountyParams } from "../interfaces/core.interface";
import { NETWORK, ONE_ADA_IN_LOVELACE, ONE_DAY_MS } from "../utils/constants";
import chalk from "chalk";
import { callTwBot } from "../utils/twBot";
import appConfig from "../config/app-config";
import { Responses } from "../responses";

// Calls to {BACKEND_URL}/bounty (POST)
export async function createBounty(
  params: CreateBountyParams,
  github: GithubFacade
) {
  try {
    const { bountyInfo, commentId } = params;
    const { creatorUsername, issueInfo, bountyData } = bountyInfo;
    const { duration, address, network } = bountyData;
    const { labels, source, number: issueNumber } = issueInfo;

    const deadline_ut = duration * ONE_DAY_MS;

    const tokens = bountyData.tokens.map((t) => {
      const [name, amount] = t.split("=");
      return name.toLowerCase() === "ada"
        ? { name, amount: Number(amount) }
        : undefined;
    });

    // TODO: remove this when the backend accepts other currencies
    if (tokens.some((t) => t === undefined)) {
      await github.rejectCommand(commentId);
      await github.replyToCommand(issueNumber, Responses.PLEASE_USE_ADA);
      return;
    }

    await github.acknowledgeCommand(commentId);
    const creatorData = await getGithubUserData(creatorUsername, github);

    const {
      data: { bounty, fundingId }
    } = await callEp("bounty", {
      address,
      tokens,
      title: issueInfo.title,
      description: issueInfo.description,
      duration: deadline_ut,
      creator: creatorData,
      network: network.toLowerCase(),
      platform: source.toLowerCase(),
      categories: labels,
      organization: issueInfo.organization,
      repository: issueInfo.repository,
      issue: issueInfo.number,
      issueUrl: issueInfo.issueUrl
    });
    console.debug(bounty);

    const signUrl = `${appConfig.FRONTEND_URL}/bounty/sign/${bounty.id}/create?fundingId=${fundingId}`;
    console.log(tokens);
    const adaAmount = tokens.find((t) => t!.name === "ada")!.amount;
    console.log(adaAmount);
    await github.replyToCommand(
      issueNumber,
      Responses.CREATE_BOUNTY_SUCCESS({
        address,
        amount: adaAmount,
        bountyId: bounty.id,
        deadline: Date.now() + deadline_ut,
        signUrl,
        isTestnet: network === NETWORK.PREPROD
      })
    );

    callTwBot(
      adaAmount,
      issueInfo.organization,
      issueInfo.repository,
      issueInfo.number,
      deadline_ut
    );
  } catch (e) {
    console.error(chalk.red(`Error creating bounty. ${e}`));

    await commandErrorHandler(
      e,
      params.bountyInfo.issueInfo.number,
      github,
      params.commentId
    );
  }
}
