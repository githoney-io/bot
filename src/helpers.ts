import axios from "axios";
import appConfig from "./config/app-config";
import { AttachBountyParams } from "./interfaces/core.interface";
import { NETWORK } from "./utils/constants";
import { GithubFacade } from "./adapters";
import { ZodError } from "zod";

const ATTACH_BOUNTY_RESPONSE_COMMENT = (
  params: AttachBountyParams,
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
  
  > reward: **${params.amount} ADA**
  > work deadline: **${params.deadline} days**
  > maintainer address: **${params.address.slice(0, 20)}..**
  
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

const callEp = async (name: string, param: any): Promise<any> => {
  return axios
    .post(`${appConfig.PUBLIC_URL}/${name}`, param)
    .then((response) => {
      if (response.status === 200) {
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
