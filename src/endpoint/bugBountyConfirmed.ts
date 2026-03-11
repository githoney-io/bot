import { Response, Request } from "express";
import { App } from "octokit";
import appConfig from "../config/app-config";
import fs from "fs";
import { z } from "zod";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { getEp } from "../helpers";
import { Responses } from "../responses";

const bugBountyConfirmedSchema = z.object({
  bountyId: z.number().int().positive(),
  issueNumber: z.number().int().positive(),
  repo: z.string().min(1),
  org: z.string().min(1)
});

export const bugBountyConfirmed = async (req: Request, res: Response) => {
  try {
    const { bountyId, issueNumber, repo, org } = bugBountyConfirmedSchema.parse(
      req.body
    );
    const normalizedOrg = org.trim().toLowerCase();

    // Fetch bounty to get maintainer address
    const {
      data: { bounty }
    } = await getEp(`bounty/${bountyId}`, {});

    const maintainerAddr: string | undefined = bounty?.fundingTransactions?.find(
      (tx: any) => tx.isInitialDeposit
    )?.wallet?.address;

    if (!maintainerAddr) {
      console.error(
        `[bug-bounty-confirmed] maintainer address not found for bounty ${bountyId}`
      );
      res
        .status(StatusCodes.UNPROCESSABLE_ENTITY)
        .send({ msg: "Maintainer address not found" });
      return;
    }

    const signUrl = `${appConfig.FRONTEND_URL}/bounty/sign/${bountyId}/assign?addr=${maintainerAddr}`;

    // Post GitHub comment via App installation octokit
    const app = new App({
      appId: appConfig.GITHUB_APP_ID,
      privateKey: fs.readFileSync(appConfig.GITHUB_PRIVATE_KEY_PATH, "utf8")
    });

    let posted = false;
    await app.eachInstallation(async ({ installation }) => {
      const installationLogin = installation.account?.login?.trim().toLowerCase();
      if (
        posted ||
        !installation.account ||
        installationLogin !== normalizedOrg
      )
        return;

      const octokit = await app.getInstallationOctokit(installation.id);
      const comment = await octokit.rest.issues.createComment({
        owner: org,
        repo,
        issue_number: issueNumber,
        body: Responses.BUG_BOUNTY_ASSIGN_LINK({ signUrl })
      });
      console.log(
        `[bug-bounty-confirmed] posted comment id=${comment.data.id} issue=${issueNumber} repo=${org}/${repo}`
      );
      posted = true;
    });

    if (!posted) {
      console.error(
        `[bug-bounty-confirmed] no matching installation/comment for org=${org} repo=${repo} issue=${issueNumber}`
      );
      res.status(StatusCodes.NOT_FOUND).send({
        msg: ReasonPhrases.NOT_FOUND,
        error: "No installation match for organization"
      });
      return;
    }

    res.status(StatusCodes.OK).send({ msg: ReasonPhrases.OK });
  } catch (e) {
    console.error("[bug-bounty-confirmed] error:", e);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .send({ msg: ReasonPhrases.INTERNAL_SERVER_ERROR });
  }
};
