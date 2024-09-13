interface IBountyCreate {
  msg: string;
  data: { bounty: IBounty };
}

interface IBountyPlusNetwork {
  msg: string;
  data: { bounty: IBounty; network: INetwork };
}

interface INetwork {
  id: number;
  name: string;
  is_mainnet: boolean;
  description: string;
}
interface IBounty {
  id: number;
  title: string;
  prNumber: number | null;
  issueNumber: number;
  description: string | null;
  amount: number;
  issueLink: string;
  expirationDate: Date;
  createdAt: Date;
  creatorId: number;
  statusId: number;
  sourceId: number;
  transactionHash: string;
}

export { IBountyCreate, IBountyPlusNetwork };
