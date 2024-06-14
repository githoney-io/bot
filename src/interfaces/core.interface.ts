import { GithubFacade } from "../adapters";
import { NETWORK } from "../utils/constants";
import { User } from "@octokit/webhooks-types";

interface GithubUser {
  login: string;
  id: number;
  bio: string | null;
  avatar_url: string;
  blog: string | null;
  email: string | null;
  location: string | null;
  twitter_username?: string | null;
  html_url: string;
}

interface IssueInfo {
  creator: GithubUser;
  number: number;
  title: string;
  description: string;
  labels: string[];
  source: string;
  organization: string;
  repository: string;
  issue: number;
  issueUrl: string;
}

interface ContractInfo {
  amount: number;
  deadline: number;
  address: string;
  network: NETWORK;
}

interface AttachBountyParams {
  issueInfo: IssueInfo;
  contractInfo: ContractInfo;
  commentId: number;
}

interface AcceptBountyParams {
  issueNumber: number;
  commentId: number;
  contractId: string;
  address: string;
  assignee: GithubUser;
}

interface ReclaimBountyParams {
  issueNumber: number;
  commentId: number;
  contractId: string;
  address: string;
}

interface PRHandler {
  facade: GithubFacade;
  issueNumber: number;
  repoName: string;
  orgName: string;
}

export {
  AttachBountyParams,
  AcceptBountyParams,
  ReclaimBountyParams,
  ContractInfo,
  PRHandler
};
