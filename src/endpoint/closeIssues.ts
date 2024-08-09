import { Response, Request } from "express";
import { App } from "octokit";
import appConfig from "../config/app-config";
import fs from "fs";
import { z } from "zod";
import { ReasonPhrases, StatusCodes } from "http-status-codes";

const closeIssuesSchema = z.object({
  issuesToClose: z.array(
    z.object({
      owner: z.string().min(1),
      repo: z.string().min(1),
      issue_number: z.number().positive()
    })
  )
});

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
          await octokitInstallation.rest.issues.update({
            owner,
            repo,
            issue_number,
            state: "closed"
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
