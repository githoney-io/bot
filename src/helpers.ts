import axios from "axios";
import appConfig from "./config/app-config";
import { ContractInfo } from "./interfaces/core.interface";
import { NETWORK } from "./utils/constants";
import { GithubFacade } from "./adapters";
import { ZodError } from "zod";
import { StatusCodes } from "http-status-codes";

const ATTACH_BOUNTY_RESPONSE_COMMENT = (
  params: ContractInfo,
  contractId: string,
  signUrl: string,
  network: NETWORK
) => `
  ### New bounty created for this issue! 🎊
  ${
    network === NETWORK.PREPROD
      ? "### This bounty is in the preprod network"
      : ""
  }
  
  > Reward: **${params.amount} ADA**
  > Work deadline: **${new Date(params.deadline).toUTCString()}**
  > Maintainer address: **${params.address.slice(0, 20)}..**
  
  The contract id is \`${contractId}\`
  
  You can check the on-chain data on [Marlowe scan](https://preprod.marlowescan.com/contractView?tab=info&contractId=${encodeURIComponent(
    contractId
  )})
  
  The next step is to deposit the reward amount in the contract. You can use this [link](${signUrl}) to execute the transaction.
  `;

const paramsValidationFail = async (
  github: GithubFacade,
  issueNumber: number,
  commentId: number,
  e: ZodError
) => {
  await github.rejectCommand(commentId);
  let errors = "";
  for (const issue of e.issues) {
    errors = errors.concat(
      `> Parameter: **${issue.path.join(".")}** - Error: **${
        issue.message
      }**.\n`
    );
  }
  await github.replyToCommand(
    issueNumber,
    `One or more parameters are wrong formatted:\n${errors}`
  );
};

const getSignUrl = (operation: string, contractId: string, address: string) => {
  const cid = contractId.replace("#", "%23");
  return `${appConfig.PUBLIC_URL}/sign?operation=${operation}&cid=${cid}&address=${address}`;
};

const callEp = async (
  name: string,
  param: any,
  url: string = appConfig.PUBLIC_URL,
  headers: Record<string, any> = {}
): Promise<any> => {
  return axios
    .post(`${url}/${name}`, param, { headers: headers })
    .then((response) => {
      if (
        response.status >= StatusCodes.OK &&
        response.status < StatusCodes.MULTIPLE_CHOICES
      ) {
        return response.data;
      }
      throw response;
    });
};

export {
  ATTACH_BOUNTY_RESPONSE_COMMENT,
  paramsValidationFail,
  getSignUrl,
  callEp
};
