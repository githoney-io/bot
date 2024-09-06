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

interface BountyData {
  tokens: string[];
  duration: number;
  address: string;
  network: NETWORK;
}

interface CreateBountyParams {
  bountyInfo: {
    creatorUsername: string;
    issueInfo: IssueInfo;
    bountyData: BountyData;
  };
  commentId: number;
}

interface SponsorBountyParams {
  sponsorInfo: {
    sponsorUsername: string;
    issue: number;
    tokens: string[];
    address: string;
    organization: string;
    repository: string;
  };
  commentId: number;
}

interface AcceptBountyParams {
  issueNumber: number;
  commentId: number;
  bountyId: number;
  address: string;
  assignee: string;
}

interface LinkBountyParams {
  issueNumber: number;
  commentId: number;
  bountyId: number;
  contributor: string;
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
  LinkBountyParams,
  ReclaimBountyParams,
  BountyData,
  CloseHandler
};
