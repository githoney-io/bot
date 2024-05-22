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
}

interface ReclaimBountyParams {
  issueNumber: number;
  commentId: number;
  contractId: string;
  address: string;
}

export {
  AttachBountyParams,
  AcceptBountyParams,
  ReclaimBountyParams,
  ContractInfo
};
