import { Response, Request } from "express";
import { App, Octokit } from "octokit";
import appConfig from "../config/app-config";
import fs from "fs";
import { z } from "zod";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { Responses } from "../responses";

const closeIssuesSchema = z.object({
  issuesToClose: z.array(
    z.object({
      owner: z.string().min(1),
      repo: z.string().min(1),
      issue_number: z.array(z.number().positive().nullable())
    })
  )
});

const closeAndComment = async (
  installation: Octokit,
  {
    owner,
    repo,
    issue_number
  }: { owner: string; repo: string; issue_number: number }
) => {
  await installation.rest.issues.update({
    owner,
    repo,
    issue_number,
    state: "closed"
  });
  await installation.rest.issues.createComment({
    owner,
    repo,
    issue_number,
    body: Responses.DEADLINE_REACHED
  });
};

export const closeIssues = async (req: Request, res: Response) => {
  try {
    const { issuesToClose } = closeIssuesSchema.parse(req.body);

    const app = new App({
      appId: appConfig.GITHUB_APP_ID,
      privateKey: fs.readFileSync(appConfig.GITHUB_PRIVATE_KEY_PATH, "utf8")
    });

    let id = 0;
    const owners = issuesToClose.map((issue) => issue.owner);
    await app.eachInstallation(async ({ installation }) => {
      if (installation.account && owners.includes(installation.account.login)) {
        id = installation.id;

        const octokitInstallation = await app.getInstallationOctokit(
          installation.id
        );

        const issues = issuesToClose.filter(
          (i) => i.owner === installation.account!.login
        );

        issues.forEach(async ({ owner, repo, issue_number }) => {
          // Close issues
          await closeAndComment(octokitInstallation, {
            owner,
            repo,
            issue_number: issue_number[0]!
          });

          // Close PRs if there are any
          if (issue_number[1])
            await closeAndComment(octokitInstallation, {
              owner,
              repo,
              issue_number: issue_number[1]
            });
        });
      }
    });

    res.status(StatusCodes.OK).send({ msg: ReasonPhrases.OK });
  } catch (err) {
    console.error(err);
    res
      .status(StatusCodes.OK)
      .send({ msg: ReasonPhrases.INTERNAL_SERVER_ERROR });
  }
};
