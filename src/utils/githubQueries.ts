import { GithubFacade } from "../adapters";

export const getGithubUserData = async (
  username: string,
  github: GithubFacade
) => {
  const ghUser = await github.octokit.rest.users.getByUsername({
    username
  });

  return {
    username: ghUser.data.login,
    name: ghUser.data.name,
    id: ghUser.data.id,
    email: ghUser.data.email,
    avatarUrl: ghUser.data.avatar_url,
    description: ghUser.data.bio,
    pageUrl: ghUser.data.blog,
    userUrl: ghUser.data.html_url,
    location: ghUser.data.location,
    twitterUsername: ghUser.data.twitter_username
  };
};

export const getGithubOrgData = async (org: string, github: GithubFacade) => {
  const ghOrg = await github.octokit.rest.orgs.get({
    org
  });

  return {
    username: ghOrg.data.login,
    name: ghOrg.data.name,
    avatarUri: ghOrg.data.avatar_url,
    description: ghOrg.data.description,
    twitterUsername: ghOrg.data.twitter_username,
    pageUrl: ghOrg.data.blog,
    location: ghOrg.data.location,
    email: ghOrg.data.email,
    publicRepos: ghOrg.data.public_repos,
    followers: ghOrg.data.followers,
    orgUrl: ghOrg.data.html_url,
    inPlatformId: ghOrg.data.id.toString()
  };
};

export const getGithubRepoData = async (
  owner: string,
  repo: string,
  github: GithubFacade
) => {
  const ghRepo = await github.octokit.rest.repos.get({
    owner,
    repo
  });

  return {
    name: ghRepo.data.name,
    link: ghRepo.data.html_url
  };
};
