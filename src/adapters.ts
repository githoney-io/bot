import { Octokit } from "octokit";
import { createNodeMiddleware } from "@octokit/webhooks";
import EventSource from "eventsource";
import { App } from "octokit";

import { handleComment, handlePRClosed, handlePRMerged } from "./core";

export class GithubFacade {
  octokit: Octokit;
  owner: string;
  repo: string;

  constructor(octokit: Octokit, owner: string, repo: string) {
    this.octokit = octokit;
    this.owner = owner;
    this.repo = repo;
  }

  async acknowledgeCommand(commentId: number) {
    await this.octokit.rest.reactions.createForIssueComment({
      owner: this.owner,
      repo: this.repo,
      comment_id: commentId,
      content: "+1"
    });
  }

  async rejectCommand(commentId: number) {
    await this.octokit.rest.reactions.createForIssueComment({
      owner: this.owner,
      repo: this.repo,
      comment_id: commentId,
      content: "-1"
    });
  }

  async replyToCommand(issueNumber: number, body: string) {
    await this.octokit.rest.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
      body
    });
  }

  async findPRComments(issueNumber: number) {
    let comments = await this.octokit.rest.issues.listComments({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber
    });

    return comments.data;
  }
}

export type BotParams = {
  webhookProxyUrl: string;
  webhookSecret: string;
  githubAppId: string;
  githubPrivateKey: string;
};

export function startBot(params: BotParams) {
  const app = new App({
    appId: params.githubAppId,
    privateKey: params.githubPrivateKey,
    webhooks: {
      secret: params.webhookSecret
    }
  });

  app.webhooks.on("issue_comment.created", async ({ payload }) => {
    if (!payload.installation) {
      throw Error("no installation defined");
    }

    console.log(`comment for installation ${payload.installation.id}`);
    let installation = await app.getInstallationOctokit(
      payload.installation.id
    );

    let facade = new GithubFacade(
      installation,
      payload.repository.owner.login,
      payload.repository.name
    );

    await handleComment(facade, payload.issue, payload.comment);
  });

  app.webhooks.on("pull_request.closed", async ({ payload }) => {
    if (!payload.installation) {
      throw Error("no installation defined");
    }

    console.log(`PR closed for installation ${payload.installation.id}`);
    let installation = await app.getInstallationOctokit(
      payload.installation.id
    );

    let facade = new GithubFacade(
      installation,
      payload.repository.owner.login,
      payload.repository.name
    );

    if (payload.pull_request.merged) {
      await handlePRMerged(facade, payload.pull_request);
    } else {
      await handlePRClosed(facade, payload.pull_request);
    }
  });

  const source = new EventSource(params.webhookProxyUrl);

  source.onmessage = (event) => {
    const webhookEvent = JSON.parse(event.data);

    app.webhooks
      .verifyAndReceive({
        id: webhookEvent["x-request-id"],
        name: webhookEvent["x-github-event"],
        signature: webhookEvent["x-hub-signature"],
        payload: JSON.stringify(webhookEvent.body)
      })
      .catch(console.error);
  };

  return createNodeMiddleware(app.webhooks, {
    path: "/webhook"
  });
}
