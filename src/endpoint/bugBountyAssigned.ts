import { Response, Request } from "express";
import { App } from "octokit";
import appConfig from "../config/app-config";
import fs from "fs";
import { z } from "zod";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { Responses } from "../responses";

const bugBountyAssignedSchema = z.object({
  bountyId: z.number().int().positive(),
  issueNumber: z.number().int().positive(),
  repo: z.string().min(1),
  org: z.string().min(1),
  reporter: z.string().min(1)
});

export const bugBountyAssigned = async (req: Request, res: Response) => {
  try {
    const { issueNumber, repo, org, reporter } = bugBountyAssignedSchema.parse(
      req.body
    );
    const normalizedOrg = org.trim().toLowerCase();

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
        body: Responses.BUG_BOUNTY_ASSIGN_CONFIRMED({ reporter })
      });
      console.log(
        `[bug-bounty-assigned] posted comment id=${comment.data.id} issue=${issueNumber} repo=${org}/${repo} reporter=${reporter}`
      );
      posted = true;
    });

    if (!posted) {
      console.error(
        `[bug-bounty-assigned] no matching installation/comment for org=${org} repo=${repo} issue=${issueNumber}`
      );
      res.status(StatusCodes.NOT_FOUND).send({
        msg: ReasonPhrases.NOT_FOUND,
        error: "No installation match for organization"
      });
      return;
    }

    res.status(StatusCodes.OK).send({ msg: ReasonPhrases.OK });
  } catch (e) {
    console.error("[bug-bounty-assigned] error:", e);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .send({ msg: ReasonPhrases.INTERNAL_SERVER_ERROR });
  }
};
