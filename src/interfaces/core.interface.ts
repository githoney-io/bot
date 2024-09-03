import { GithubFacade } from "../adapters";
import { NETWORK } from "../utils/constants";

interface IssueInfo {
  number: number;
  title: string;
  description: string;
  labels: string[];
  source: string;
  organization: string;
  repository: string;
  issueUrl: string;
}

interface BountyInfo {
  amount: number;
  deadline: number;
  address: string;
  network: NETWORK;
}

interface CreateBountyParams {
  creator: string;
  issueInfo: IssueInfo;
  bountyIdInfo: BountyInfo;
  commentId: number;
}

interface FundBountyParams {
  funder: string;
  fundInfo: {
    issue: number;
    tokens: string[];
    address: string;
    organization: string;
    repository: string;
  };
  fundCommentId: number;
}

interface AcceptBountyParams {
  issueNumber: number;
  commentId: number;
  bountyId: number;
  address: string;
  assignee: string;
}

interface ReclaimBountyParams {
  issueNumber: number;
  commentId: number;
  bountyId: number;
  address: string;
}

interface CloseHandler {
  from: string;
  facade: GithubFacade;
  issueNumber: number;
  repoName: string;
  orgName: string;
  owner: string;
}

export {
  CreateBountyParams,
  FundBountyParams,
  AcceptBountyParams,
  ReclaimBountyParams,
  BountyInfo,
  CloseHandler
};
