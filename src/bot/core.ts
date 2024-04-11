import { GithubFacade } from "./adapters";
import type { IssueComment, Issue, PullRequest } from "@octokit/webhooks-types";
import minimist from "minimist";
import chalk from "chalk";
import z, { ZodError } from "zod";
import appConfig, { ENDPOINTS } from "../config/app-config";
import axios from "axios";

const ONE_ADA_IN_LOVELACE = 1000000;

const CONTRACT_ID_REGEX = /^[0-9a-fA-F]{64}#\d+$/;
const zContractId = z
  .string()
  .regex(
    CONTRACT_ID_REGEX,
    "ContractId must be 64 characters long: a 62 hex string, followed by a '#' and a number."
  );

const ADDRESS_REGEX = /^(addr1|addr_test1)[0-9a-z]+$/i;
const zAddress = z
  .string()
  .length(63)
  .regex(
    ADDRESS_REGEX,
    "Address must be 68 or 103 characters long, bech32 encoding."
  )
  .or(
    z
      .string()
      .length(108)
      .regex(
        ADDRESS_REGEX,
        "Address must be 68 or 103 characters long, bech32 encoding."
      )
  );

const ATTACH_BOUNTY_RESPONSE_COMMENT = (
  params: AttachBountyParams,
  contractId: string,
  signUrl: string
) => `
### New bounty created for this issue! 🎊
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

const AttachBountyParamsSchema = z.object({
  issueNumber: z.number().nonnegative(),
  commentId: z.number().nonnegative(),
  amount: z.number().nonnegative().min(10, "Amount must be at least 10 ADA"),
  deadline: z.number().nonnegative().min(6, "Deadline must be at least 6 days"),
  address: zAddress,
});

type AttachBountyParams = z.infer<typeof AttachBountyParamsSchema>;

export async function attachBounty(
  params: AttachBountyParams,
  github: GithubFacade
) {
  try {
    const { issueNumber, commentId, amount, deadline, address } =
      AttachBountyParamsSchema.parse(params);

    await github.acknowledgeCommand(commentId);

    const deadline_ut = Date.now() + (deadline + 1) * 24 * 60 * 60 * 1000;
    const amountADA = amount * ONE_ADA_IN_LOVELACE;

    const { contractId } = await callEp(
      "createContract",
      {
        maintainerAddr: address,
        depositAmount: amountADA,
        releaseDeadline: deadline_ut,
      }
    );

    const signUrl = getSignUrl("deposit", contractId, address)

    await github.replyToCommand(
      issueNumber,
      ATTACH_BOUNTY_RESPONSE_COMMENT(params, contractId, signUrl)
    );
  } catch (e) {
    if (e instanceof ZodError) {
      await paramsValidationFail(
        github,
        params.issueNumber,
        params.commentId,
        e
      );
    }
    console.error(chalk.red(`Error creating contract. ${e}`));
  }
}

const AcceptBountyParamsSchema = z.object({
  issueNumber: z.number().nonnegative(),
  commentId: z.number().nonnegative(),
  contractId: zContractId,
  address: zAddress,
});

type AcceptBountyParams = z.infer<typeof AcceptBountyParamsSchema>;

export async function acceptBounty(
  params: AcceptBountyParams,
  github: GithubFacade
) {
  try {
    const { issueNumber, commentId, contractId, address } =
      AcceptBountyParamsSchema.parse(params);

    await github.acknowledgeCommand(commentId);

    const { txId } = await callEp("assignDeveloper", {
      contractId: contractId,
      devAddr: address,
      issueNumber: issueNumber,
    });

    const txUrl = `https://preprod.cexplorer.io/tx/`;

    await github.replyToCommand(
      issueNumber,
      `Bounty has been accepted and linked to this PR. The contract id is ${contractId}. The claim token has been sent to address ${address}. See tx at ${txUrl}${txId}. Holder of the token will be able to claim the reward once this PR gets merged.`
    );
  } catch (e) {
    if (e instanceof ZodError) {
      await paramsValidationFail(
        github,
        params.issueNumber,
        params.commentId,
        e
      );
    }
    console.error(chalk.red(`Error assigning developer. ${e}`));
  }
}

const reclaimBountyParamsSchema = z.object({
  issueNumber: z.number().nonnegative(),
  commentId: z.number().nonnegative(),
  contractId: zContractId,
  address: zAddress,
});

type ReclaimBountyParams = z.infer<typeof reclaimBountyParamsSchema>;

export async function reclaimBounty(
  params: ReclaimBountyParams,
  github: GithubFacade
) {
  try {
    const { issueNumber, commentId, contractId, address } =
      AcceptBountyParamsSchema.parse(params);

    await github.acknowledgeCommand(commentId);

    const signUrl = getSignUrl("withdraw",contractId, address);

    await github.replyToCommand(
      issueNumber,
      `Reclaiming bounty from contract with ID **${contractId}**. Maintainer with address **${address}** may reclaim the bounty using this [link](${signUrl})`
    );
  } catch (e) {
    if (e instanceof ZodError) {
      await paramsValidationFail(
        github,
        params.issueNumber,
        params.commentId,
        e
      );
    }
    console.error(chalk.red(`Error reclaiming funds from contract: ${e}`));
  }
}

export type FulfillBountyParams = {
  issueNumber: number;
  contractId: string;
  address: string;
};


export async function handleComment(
  github: GithubFacade,
  issue: Issue,
  comment: IssueComment
) {
  const commentBody = comment.body;

  if (!commentBody.includes("/githoney")) {
    console.debug("skipping because not directed to bot");
    return;
  }

  let args = comment.body
    .split(" ")
    .slice(1)
    .filter((arg) => arg !== "");
  console.debug(args);

  let parsed = minimist(args);
  console.debug(parsed);

  if (parsed._.length == 0) {
    console.warn("bad command syntax", parsed);
    github.rejectCommand(comment.id);
    return;
  }

  switch (parsed._[0]) {
    case "attach-bounty":
      await attachBounty(
        {
          issueNumber: issue.number,
          commentId: comment.id,
          amount: parsed.amount,
          deadline: parsed.deadline,
          address: parsed.address,
        },
        github
      );
      break;
    case "accept-bounty":
      await acceptBounty(
        {
          issueNumber: issue.number,
          commentId: comment.id,
          contractId: parsed.contract,
          address: parsed.address,
        },
        github
      );
      break;
    case "reclaim-bounty":
      await reclaimBounty(
        {
          issueNumber: issue.number,
          commentId: comment.id,
          contractId: parsed.contract,
          address: parsed.address,
        },
        github
      );
    default:
      console.warn("unknown command", parsed);
      github.rejectCommand(comment.id);
  }
}

export async function handlePRMerged(
  github: GithubFacade,
  pr: PullRequest
) {

  try {
    const { contractId, devAddr } = await callEp("unlockPayment", {
      prNumber: pr.number,
    });

    const signUrl = getSignUrl("withdraw", contractId, devAddr);

    await github.replyToCommand(
      pr.number,
      `Congrats! By merging this PR the bounty for contract ${contractId} has been unlocked. Use this [link](${signUrl}) to claim the reward.`
    );
  } catch (e) {
    console.error(chalk.red(`"Error unlocking contract. ${e}`));
  }
}

export async function handlePRClosed(
  github: GithubFacade,
  pr: PullRequest
) {

  try {
    const { contractId, txId } = await callEp("cancelBounty", {prNumber: pr.number})

    const txUrl = `https://preprod.cexplorer.io/tx/`;

    await github.replyToCommand(
      pr.number,
      `Cancelling contract with ID **${contractId}**. You can see the cancel transaction in this [link](${txUrl}${txId})`
    );


  } catch (e) {
    console.error(chalk.red(`Error cancelling contract: ${e}`));
  }

}


const callEp = async (name: string, param: any): Promise<any> => {
  return axios.post(ENDPOINTS[name], param).then((response) => {
    if (response.status === 200) {
      return response.data;
    }
    throw response;
  });
};

const getSignUrl = (operation: string, contractId:string, address:string) => {
  const cid = contractId.replace("#", "%23");
  return `${appConfig.PUBLIC_URL}/sign?operation=${operation}&cid=${cid}&address=${address}`;
}