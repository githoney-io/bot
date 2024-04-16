import { z } from "zod";
import { bech32 } from "bech32";
import { NETWORK } from "../utils/constants";

interface AttachBountyParams {
  issueNumber: number;
  commentId: number;
  amount: number;
  deadline: number;
  address: string;
  network: NETWORK;
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

export { AttachBountyParams, AcceptBountyParams, ReclaimBountyParams };
