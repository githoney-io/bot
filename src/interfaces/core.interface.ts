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
  tokens: string[];
  duration: number;
  address: string;
  network: NETWORK;
}

interface CreateBountyParams {
  creator: string;
  issueInfo: IssueInfo;
  bountyIdInfo: BountyInfo;
  commentId: number;
}

interface SponsorBountyParams {
  sponsor: string;
  sponsorInfo: {
    issue: number;
    tokens: string[];
    address: string;
    organization: string;
    repository: string;
  };
  sponsorCommentId: number;
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
  SponsorBountyParams,
  AcceptBountyParams,
  ReclaimBountyParams,
  BountyInfo,
  CloseHandler
};
