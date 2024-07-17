interface IBountyCreate {
  msg: string;
  data: { bounty: IBounty };
}

interface IBounty {
  id: number;
  title: string;
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

export { IBountyCreate };
