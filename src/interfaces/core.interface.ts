import { GithubFacade } from "../adapters";
import { NETWORK } from "../utils/constants";
import { User } from "@octokit/webhooks-types";

interface IssueInfo {
  creator: User;
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

interface FundBountyParams {
  funder: User;
  fundInfo: {
    issue: number;
    amount: number;
    address: string;
    organization: string;
    repository: string;
  };
  fundCommentId: number;
}

interface AcceptBountyParams {
  issueNumber: number;
  commentId: number;
  contractId: string;
  address: string;
  assignee: User;
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
  FundBountyParams,
  AcceptBountyParams,
  ReclaimBountyParams,
  ContractInfo,
  PRHandler
};
