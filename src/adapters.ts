import { Octokit } from "octokit";
import { createNodeMiddleware } from "@octokit/webhooks";
import EventSource from "eventsource";
import { App } from "octokit";
import { handleComment, handlePr } from "./core";
import { callEp } from "./helpers";
import { handlePRMerged, handleBountyClosed } from "./handlers";

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

  app.webhooks.onAny(({ name, payload }) => {
    const action = (payload as { action?: string }).action;
    const repo = (payload as { repository?: { full_name?: string } }).repository
      ?.full_name;
    console.log(
      `[webhooks] received ${name}${action ? `.${action}` : ""}${
        repo ? ` repo=${repo}` : ""
      }`
    );
  });

  app.webhooks.onError((error) => {
    console.error("[webhooks] handler error", error);
  });

  app.webhooks.on("installation", async ({ payload }) => {
    try {
      if (payload.action === "created") {
        let installation = await app.getInstallationOctokit(
          payload.installation.id
        );

        if (payload.installation.account.type !== "Organization") {
          return await callEp("metrics/userInstallation", {
            user: payload.installation.account.login
          });
        }

        const { data } = await installation.rest.orgs.get({
          org: payload.installation.account.login
        });

        console.log("Installation event started");
        await callEp("organization", {
          name: data.name,
          username: payload.installation.account.login,
          avatarUri: payload.installation.account.avatar_url,
          inPlatformId: payload.installation.account.id.toString(),
          source: "github",
          repositories: payload.repositories?.map((repo) => ({
            name: repo.name,
            url: `https://github.com/${repo.full_name}`
          })),
          orgUrl: payload.installation.account.html_url,
          description: data.description,
          email: data.email,
          twitterUsername: data.twitter_username,
          location: data.location,
          pageUrl: data.blog,
          publicRepos: data.public_repos,
          followers: data.followers
        });
      } else {
        console.log("Uninstallation event, ignoring.");
      }
    } catch (err) {
      console.error("Installation event error: ", err);
    }
  });

  app.webhooks.on("installation_repositories.added", async ({ payload }) => {
    try {
      if (payload.installation.account.type !== "Organization") {
        return;
      }

      const installation = await app.getInstallationOctokit(
        payload.installation.id
      );

      const { data } = await installation.rest.orgs.get({
        org: payload.installation.account.login
      });

      const repositories = payload.repositories_added.map((repo) => ({
        name: repo.name,
        url: `https://github.com/${repo.full_name}`
      }));

      console.log("Installation repositories event started");
      await callEp("organization", {
        name: data.name,
        username: payload.installation.account.login,
        avatarUri: payload.installation.account.avatar_url,
        inPlatformId: payload.installation.account.id.toString(),
        source: "github",
        orgUrl: payload.installation.account.html_url,
        description: data.description,
        email: data.email,
        twitterUsername: data.twitter_username,
        location: data.location,
        pageUrl: data.blog,
        publicRepos: data.public_repos,
        followers: data.followers
      });
      await callEp("repository", {
        repositories,
        organizationName: payload.installation.account.login,
        source: "github"
      });
      console.log("Installation repositories event completed");
    } catch (err) {
      console.error("Installation repositories event error: ", err);
    }
  });

  const processIssueComment = async (payload: any) => {
    if (!payload.installation) {
      throw Error("no installation defined");
    }

    if (payload.sender.type !== "User") {
      console.log(
        `[issue_comment] ignored sender type=${payload.sender.type} issue=${payload.issue.number}`
      );
      return;
    }

    console.log(
      `[issue_comment] processing installation=${payload.installation.id} issue=${payload.issue.number} repo=${payload.repository.full_name}`
    );
    let installation = await app.getInstallationOctokit(
      payload.installation.id
    );

    let facade = new GithubFacade(
      installation,
      payload.repository.owner.login,
      payload.repository.name
    );

    try {
      await handleComment(
        facade,
        payload.issue,
        payload.comment,
        payload.repository.owner.type
      );
    } catch (err) {
      console.error(
        `[issue_comment] handler failed installation=${payload.installation.id} issue=${payload.issue.number} repo=${payload.repository.full_name}`,
        err
      );
    }
  };

  app.webhooks.on("issue_comment.created", async ({ payload }) =>
    processIssueComment(payload)
  );

  app.webhooks.on("issues.closed", async ({ payload }) => {
    if (!payload.installation) {
      throw Error("no installation defined");
    }

    if (payload.repository.owner.type !== "Organization") {
      return;
    }

    console.log(`Issue closed for installation ${payload.installation.id}`);
    let installation = await app.getInstallationOctokit(
      payload.installation.id
    );

    let facade = new GithubFacade(
      installation,
      payload.repository.owner.login,
      payload.repository.name
    );

    const issueHandleObject = {
      from: "issue",
      facade,
      issueNumber: payload.issue.number,
      repoName: payload.repository.name,
      orgName: payload.repository.owner.login,
      owner: payload.repository.owner.type
    };

    await handleBountyClosed(issueHandleObject);
  });

  app.webhooks.on("pull_request.opened", async ({ payload }) => {
    if (!payload.installation) {
      throw Error("no installation defined");
    }

    if (!payload.pull_request.body) return;

    console.log(`PR opened for installation ${payload.installation.id}`);
    let installation = await app.getInstallationOctokit(
      payload.installation.id
    );

    let facade = new GithubFacade(
      installation,
      payload.repository.owner.login,
      payload.repository.name
    );

    await handlePr(facade, payload.pull_request, payload.repository.owner.type);
  });

  app.webhooks.on("pull_request.closed", async ({ payload }) => {
    if (!payload.installation) {
      throw Error("no installation defined");
    }

    if (payload.repository.owner.type !== "Organization") {
      return;
    }
    if (payload.sender.type !== "User") {
      return;
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

    const prHandleObject = {
      from: "pr",
      facade,
      issueNumber: payload.pull_request.number,
      repoName: payload.repository.name,
      orgName: payload.repository.owner.login
    };

    if (payload.pull_request.merged) {
      await handlePRMerged(prHandleObject);
    } else {
      await handleBountyClosed(prHandleObject);
    }
  });

  const source = new EventSource(params.webhookProxyUrl);

  source.onopen = () => {
    console.log(`[webhooks] Connected to proxy: ${params.webhookProxyUrl}`);
  };

  source.onerror = (error) => {
    console.error("[webhooks] Proxy connection error", error);
  };

  source.onmessage = (event) => {
    try {
      const webhookEvent = JSON.parse(event.data);
      const signature =
        webhookEvent["x-hub-signature-256"] ?? webhookEvent["x-hub-signature"];

      if (!signature) {
        console.warn("[webhooks] Missing webhook signature");
        return;
      }

      app.webhooks
        .verifyAndReceive({
          id:
            webhookEvent["x-request-id"] ?? webhookEvent["x-github-delivery"],
          name: webhookEvent["x-github-event"],
          signature,
          payload: JSON.stringify(webhookEvent.body)
        })
        .catch((error) =>
          console.error("[webhooks] verifyAndReceive failed", error)
        );
    } catch (error) {
      console.error("[webhooks] Failed to parse proxied event", error);
    }
  };

  return createNodeMiddleware(app.webhooks, {
    path: "/webhooks"
  });
}
