// Contract addresses and ABIs for BTC1USD Protocol
export const CONTRACT_ADDRESSES = {
  // Updated from deployment-base-sepolia.json (2025-12-05T16:46:37.980Z)
  BTC1USD:
    process.env.NEXT_PUBLIC_BTC1USD_CONTRACT ||
    "0xfe68537D62008C9953cda36E1E43390Daa434520",
  BTC1USD_CONTRACT:
    process.env.NEXT_PUBLIC_BTC1USD_CONTRACT ||
    "0xfe68537D62008C9953cda36E1E43390Daa434520",
  VAULT:
    process.env.NEXT_PUBLIC_VAULT_CONTRACT ||
    "0xb4698aC4b60F4E15a4b6b912A4FE193D9dE2552F",
  CHAINLINK_BTC_ORACLE:
    process.env.NEXT_PUBLIC_PRICE_ORACLE_CONTRACT ||
    "0x4614E5D56f07F89Ff6627F684334Ec598B097D8d",
  PRICE_ORACLE_CONTRACT:
    process.env.NEXT_PUBLIC_PRICE_ORACLE_CONTRACT ||
    "0x4614E5D56f07F89Ff6627F684334Ec598B097D8d",
  CHAINLINK_FEED:
    process.env.NEXT_PUBLIC_CHAINLINK_FEED ||
    "0x0FB99723Aee6f420beAD13e6bBB79b7E6F034298",
  WEEKLY_DISTRIBUTION:
    process.env.NEXT_PUBLIC_WEEKLY_DISTRIBUTION_CONTRACT ||
    "0xe8Ba64eE14be3c9c50610D8F707361c154a4905e",
  MERKLE_DISTRIBUTOR:
    process.env.NEXT_PUBLIC_MERKLE_DISTRIBUTOR_CONTRACT ||
    "0x2b37e550584d70B4E58ABAED8a1C699BfcDfA2Ce",
  ENDOWMENT_MANAGER:
    process.env.NEXT_PUBLIC_ENDOWMENT_MANAGER_CONTRACT ||
    "0xceC51486E1D70816d22062c47701626f8D00D4F6",
  PROTOCOL_GOVERNANCE:
    process.env.NEXT_PUBLIC_PROTOCOL_GOVERNANCE_CONTRACT ||
    "0x0a212eae63Fc4DCA032b215178FFA22317666354",
  GOVERNANCE_DAO:
    process.env.NEXT_PUBLIC_DAO_CONTRACT ||
    "0x842EE0b619f60DDb8A2315E73b47Cff7a052710E",
  PROXY_ADMIN:
    process.env.NEXT_PUBLIC_PROXY_ADMIN_CONTRACT ||
    "0x0000000000000000000000000000000000000000",

  // Wallet Smart Contract addresses (with on-chain distribution tracking)
  DEV_WALLET:
    process.env.NEXT_PUBLIC_DEV_WALLET_CONTRACT ||
    "0xdfB43140982a8bf281C70Bab03b9830E8AB7E354",
  ENDOWMENT_WALLET:
    process.env.NEXT_PUBLIC_ENDOWMENT_WALLET_CONTRACT ||
    "0xB6216bd95274E8BA5f94A1341494dC6aB73B3839",
  MERKLE_FEE_COLLECTOR:
    process.env.NEXT_PUBLIC_MERKLE_FEE_COLLECTOR_CONTRACT ||
    "0x3D8898fD448fC5599AC1DB9b318DB2C314809951",
  MERKLE_DISTRIBUTOR_WALLET:
    process.env.NEXT_PUBLIC_MERKLE_DISTRIBUTOR_CONTRACT ||
    "0x2b37e550584d70B4E58ABAED8a1C699BfcDfA2Ce",

  // Collateral Token addresses
  WBTC_TOKEN:
    process.env.NEXT_PUBLIC_WBTC_TOKEN ||
    "0x0b7fCdb2Ac3B6f1821e6FEbcAb6B94ec321802C2",
  CBBTC_TOKEN:
    process.env.NEXT_PUBLIC_CBBTC_TOKEN ||
    "0xC5D5eC386e7D07ca0aF779031e2a43bBA79353A8",
  TBTC_TOKEN:
    process.env.NEXT_PUBLIC_TBTC_TOKEN ||
    "0x977422a3E5a5974c7411e704d2d312848A74a896",

  // Admin wallet address
  ADMIN:
    process.env.NEXT_PUBLIC_ADMIN_WALLET ||
    "0x6210FfE7340dC47d5DA4b888e850c036CC6ee835",
  EMERGENCY_COUNCIL:
    process.env.NEXT_PUBLIC_EMERGENCY_COUNCIL ||
    "0x0c8852280df8eF9fCb2a24e9d76f1ee4779773E9",
};

// Simplified ABIs for frontend interaction
export const ABIS = {
  BTC1USD: [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)", // Added decimals function
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address account) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "event Transfer(address indexed from, address indexed to, uint256 value)",
    "event Approval(address indexed owner, address indexed spender, uint256 value)",
  ],

  VAULT: [
    "function mint(address collateralToken, uint256 btcAmount)",
    "function redeem(uint256 tokenAmount, address collateralToken)",
    "function getCurrentCollateralRatio() view returns (uint256)",
    "function getTotalCollateralValue() view returns (uint256)",
    "function isHealthy() view returns (bool)",
    "function getSupportedCollateral() view returns (address[])",
    "event Mint(address indexed user, uint256 btcAmount, uint256 tokensIssued, address collateralToken)",
    "event Redeem(address indexed user, uint256 tokensRedeemed, uint256 btcAmount, address collateralToken)",
  ],

  CHAINLINK_BTC_ORACLE: [
    "function getBTCPrice() view returns (uint256)",
    "function getLastUpdate() view returns (uint256)",
    "function isStale() view returns (bool)",
    "function getCurrentPrice() view returns (uint256)",
    "function getPriceFeedAddress() view returns (address)",
    "function getPriceFeedDecimals() view returns (uint8)",
    "function getLatestPrice() view returns (int256)",
    "function getLatestPriceNormalized() view returns (uint256)",
    "event PriceUpdated(uint256 newPrice, uint256 timestamp)",
  ],

  WEEKLY_DISTRIBUTION: [
    "function canDistribute() view returns (bool)",
    "function executeDistribution()",
    "function getRewardPerToken(uint256 collateralRatio) pure returns (uint256)",
    "function getNextDistributionTime() view returns (uint256)",
    "function distributions(uint256 id) view returns (tuple(uint256 timestamp, uint256 collateralRatio, uint256 rewardPerToken, uint256 totalRewards, uint256 totalSupply))",
    "function distributionCount() view returns (uint256)",
    "function merkleDistributor() view returns (address)",
    "function updateMerkleRoot(bytes32 merkleRoot, uint256 totalTokensForHolders) external",
    "event WeeklyDistribution(uint256 indexed distributionId, uint256 collateralRatio, uint256 rewardPerToken, uint256 totalRewards, uint256 timestamp)",
  ],

  MERKLE_DISTRIBUTOR: [
    // Updated ABI to match the new contract interface with distributionId parameter
    "function claim(uint256 distributionId, uint256 index, address account, uint256 amount, bytes32[] calldata merkleProof) external",
    "function isClaimed(uint256 distributionId, uint256 index) view returns (bool)",
    "function merkleRoot() view returns (bytes32)",
    "function currentDistributionId() view returns (uint256)",
    "function isDistributionComplete(uint256 distributionId) view returns (bool)",
    "function getAllDistributionIds() view returns (uint256[])",
    "function getIncompleteDistributionIds() view returns (uint256[])",
    "function hasUnclaimedRewards(address account) view returns (bool)",
    "function canClaim(uint256 distributionId, uint256 index, address account, uint256 amount, bytes32[] calldata merkleProof) view returns (bool)",
    "function getDistributionInfo(uint256 distributionId) view returns (bytes32 root, uint256 totalTokens, uint256 totalClaimed, uint256 timestamp, bool finalized)",
    "function startNewDistribution(bytes32 merkleRoot, uint256 totalTokens) external",
    "function startNewDistributionWithFinalization(bytes32 merkleRoot, uint256 totalTokens) external",
    "function updateMerkleRoot(uint256 distributionId, bytes32 newMerkleRoot) external",
    // Wallet management functions
    "function addWallet(address wallet, string name, string description) external",
    "function updateWallet(address wallet, string name, string description) external",
    "function removeWallet(address wallet) external",
    "function activateWallet(address wallet) external",
    "function deactivateWallet(address wallet) external",
    "function getWalletAddresses() view returns (address[])",
    "function getWalletInfo(address wallet) view returns (string name, string description, bool isActive)",
    "function batchTransfer(address token, address[] recipients, uint256[] amounts) external",
    "function getDistributionStats(address token) view returns (uint256 totalDistributions, uint256 totalAmountDistributed, uint256 totalRecipients, uint256 totalFailed)",
    "function getTotalDistributionCount() view returns (uint256)",
    "function withdrawToken(address token, address to, uint256 amount) external",
    "event Claimed(uint256 index, address account, uint256 amount)",
    "event MerkleRootUpdated(bytes32 oldRoot, bytes32 newRoot, uint256 distributionId)",
    "event DistributionStarted(uint256 indexed distributionId, bytes32 merkleRoot, uint256 totalTokens)",
    "event DistributionFinalized(uint256 indexed distributionId, uint256 totalClaimed, uint256 unclaimedTokens)",
    "event EmergencyPause(bool paused)",
    "event AdminUpdated(address oldAdmin, address newAdmin)",
    "event WeeklyDistributionUpdated(address oldWeeklyDistribution, address newWeeklyDistribution)",
    "event IndividualTransfer(address indexed token, address indexed to, uint256 amount)",
    "event TransferFailed(address indexed token, address indexed to, uint256 amount)",
    "event BatchTransferCompleted(address indexed token, uint256 totalRecipients, uint256 totalSent, uint256 totalFailed)",
    "event WalletAdded(address indexed wallet, string name)",
    "event WalletUpdated(address indexed wallet, string name)",
    "event WalletRemoved(address indexed wallet)",
    "event WalletActivated(address indexed wallet)",
    "event WalletDeactivated(address indexed wallet)",
  ],

  GOVERNANCE_DAO: [
    "function propose(string title, string description, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint8 proposalType) returns (uint256)",
    "function castVote(uint256 proposalId, uint8 support)",
    "function castVoteWithReason(uint256 proposalId, uint8 support, string reason)",
    "function queue(uint256 proposalId)",
    "function execute(uint256 proposalId) payable",
    "function cancel(uint256 proposalId)",
    "function delegate(address delegatee)",
    "function proposalCount() view returns (uint256)",
    "function getProposal(uint256 proposalId) view returns (address proposer, string title, string description, uint8 category, uint256 forVotes, uint256 againstVotes, uint256 abstainVotes, uint256 startBlock, uint256 endBlock, uint256 eta, bool executed, bool canceled)",
    "function state(uint256 proposalId) view returns (uint8)",
    "function getVotingPower(address account) view returns (uint256)",
    "function getQuorum(uint8 category) view returns (uint256)",
    "function getReceipt(uint256 proposalId, address voter) view returns (bool hasVoted, uint8 support, uint256 votes, string reason)",
    "function canVote(uint256 proposalId, address voter) view returns (bool)",
    "function categoryThreshold(uint8 category) view returns (uint256)",
    "function categoryQuorum(uint8 category) view returns (uint256)",
    "function proposeAddNonProfit(string title, string description, address wallet, string name, string orgDescription, string website, uint8 category) returns (uint256)",
    "function proposeEndowmentDistribution(string title, string description) returns (uint256)",
    "function proposeParameterChange(string title, string description, string parameter, uint256 newValue) returns (uint256)",
    "function proposeContractUpgrade(string title, string description, address oldContract, address newContract, string contractName) returns (uint256)",
    "function admin() view returns (address)",
    "function allowAdminProposals() view returns (bool)",
    "function allowUserProposals() view returns (bool)",
    "function setAllowAdminProposals(bool allow)",
    "function setAllowUserProposals(bool allow)",
    "function transferAdmin(address newAdmin)",
    "function acceptAdmin()",
    "event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string title, uint8 category, uint256 startBlock, uint256 endBlock)",
    "event VoteCast(address indexed voter, uint256 indexed proposalId, uint8 support, uint256 votes, string reason)",
    "event ProposalQueued(uint256 indexed proposalId, uint256 eta)",
    "event ProposalExecuted(uint256 indexed proposalId)",
    "event ProposalCanceled(uint256 indexed proposalId)",
  ],

  ENDOWMENT_MANAGER: [
    {
      type: "function",
      name: "addNonProfit",
      inputs: [
        { name: "wallet", type: "address" },
        { name: "orgName", type: "string" },
        { name: "description", type: "string" },
        { name: "website", type: "string" },
        { name: "category", type: "uint8" }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "proposeNonProfit",
      inputs: [
        { name: "wallet", type: "address" },
        { name: "orgName", type: "string" },
        { name: "description", type: "string" },
        { name: "website", type: "string" },
        { name: "category", type: "uint8" }
      ],
      outputs: [{ name: "", type: "uint256" }],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "removeNonProfit",
      inputs: [{ name: "wallet", type: "address" }],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "setNonProfitVerified",
      inputs: [
        { name: "wallet", type: "address" },
        { name: "verified", type: "bool" }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "setNonProfitWeight",
      inputs: [
        { name: "wallet", type: "address" },
        { name: "weight", type: "uint256" }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "executeMonthlyDistribution",
      inputs: [],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "voteOnProposal",
      inputs: [
        { name: "proposalId", type: "uint256" },
        { name: "support", type: "bool" }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "executeProposal",
      inputs: [{ name: "proposalId", type: "uint256" }],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "canDistribute",
      inputs: [],
      outputs: [{ name: "", type: "bool" }],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "getApprovedNonProfits",
      inputs: [],
      outputs: [{ name: "", type: "address[]" }],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "getNonProfitInfo",
      inputs: [{ name: "wallet", type: "address" }],
      outputs: [
        { name: "orgName", type: "string" },
        { name: "approved", type: "bool" },
        { name: "totalReceived", type: "uint256" },
        { name: "description", type: "string" },
        { name: "website", type: "string" },
        { name: "category", type: "uint8" },
        { name: "addedTimestamp", type: "uint256" },
        { name: "verified", type: "bool" },
        { name: "allocationWeight", type: "uint256" }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "getAllNonProfitsByCategory",
      inputs: [{ name: "category", type: "uint8" }],
      outputs: [{ name: "", type: "address[]" }],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "getProposalInfo",
      inputs: [{ name: "proposalId", type: "uint256" }],
      outputs: [
        { name: "proposer", type: "address" },
        { name: "wallet", type: "address" },
        { name: "orgName", type: "string" },
        { name: "description", type: "string" },
        { name: "website", type: "string" },
        { name: "category", type: "uint8" },
        { name: "votesFor", type: "uint256" },
        { name: "votesAgainst", type: "uint256" },
        { name: "executed", type: "bool" },
        { name: "approved", type: "bool" },
        { name: "proposalTimestamp", type: "uint256" },
        { name: "votingDeadline", type: "uint256" }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "getActiveProposals",
      inputs: [],
      outputs: [{ name: "", type: "uint256[]" }],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "getDistributionAllocation",
      inputs: [
        { name: "distributionId", type: "uint256" },
        { name: "recipient", type: "address" }
      ],
      outputs: [{ name: "", type: "uint256" }],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "getNextDistributionTime",
      inputs: [],
      outputs: [{ name: "", type: "uint256" }],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "getCurrentEndowmentBalance",
      inputs: [],
      outputs: [{ name: "", type: "uint256" }],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "distributionCount",
      inputs: [],
      outputs: [{ name: "", type: "uint256" }],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "proposalCount",
      inputs: [],
      outputs: [{ name: "", type: "uint256" }],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "hasVoted",
      inputs: [
        { name: "proposalId", type: "uint256" },
        { name: "voter", type: "address" }
      ],
      outputs: [{ name: "", type: "bool" }],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "categoryCount",
      inputs: [{ name: "category", type: "uint8" }],
      outputs: [{ name: "", type: "uint256" }],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "DISTRIBUTION_INTERVAL",
      inputs: [],
      outputs: [{ name: "", type: "uint256" }],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "VOTING_PERIOD",
      inputs: [],
      outputs: [{ name: "", type: "uint256" }],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "PROPOSAL_THRESHOLD",
      inputs: [],
      outputs: [{ name: "", type: "uint256" }],
      stateMutability: "view"
    },
    {
      type: "event",
      name: "NonProfitAdded",
      inputs: [
        { name: "wallet", type: "address", indexed: true },
        { name: "orgName", type: "string", indexed: false },
        { name: "category", type: "uint8", indexed: false }
      ]
    },
    {
      type: "event",
      name: "NonProfitRemoved",
      inputs: [{ name: "wallet", type: "address", indexed: true }]
    }
  ] as const,

  DEV_WALLET: [
    {
      type: "function",
      name: "addWallet",
      inputs: [
        { name: "wallet", type: "address" },
        { name: "walletName", type: "string" },
        { name: "description", type: "string" }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "updateWallet",
      inputs: [
        { name: "wallet", type: "address" },
        { name: "walletName", type: "string" },
        { name: "description", type: "string" }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "removeWallet",
      inputs: [{ name: "wallet", type: "address" }],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "activateWallet",
      inputs: [{ name: "wallet", type: "address" }],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "deactivateWallet",
      inputs: [{ name: "wallet", type: "address" }],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "getWalletAddresses",
      inputs: [],
      outputs: [{ name: "", type: "address[]" }],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "getWalletInfo",
      inputs: [{ name: "wallet", type: "address" }],
      outputs: [
        { name: "walletName", type: "string" },
        { name: "description", type: "string" },
        { name: "isActive", type: "bool" }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "batchTransfer",
      inputs: [
        { name: "token", type: "address" },
        { name: "recipients", type: "address[]" },
        { name: "amounts", type: "uint256[]" }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "withdrawToken",
      inputs: [
        { name: "token", type: "address" },
        { name: "to", type: "address" },
        { name: "amount", type: "uint256" }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "getDistributionStats",
      inputs: [{ name: "token", type: "address" }],
      outputs: [
        { name: "totalDistributions", type: "uint256" },
        { name: "totalAmountDistributed", type: "uint256" },
        { name: "totalRecipients", type: "uint256" },
        { name: "totalFailed", type: "uint256" }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "getTotalDistributionCount",
      inputs: [],
      outputs: [{ name: "", type: "uint256" }],
      stateMutability: "view"
    },
    {
      type: "event",
      name: "WalletAdded",
      inputs: [
        { name: "wallet", type: "address", indexed: true },
        { name: "walletName", type: "string", indexed: false }
      ]
    },
    {
      type: "event",
      name: "WalletRemoved",
      inputs: [{ name: "wallet", type: "address", indexed: true }]
    }
  ] as const,

  ENDOWMENT_WALLET: [
    {
      type: "function",
      name: "addWallet",
      inputs: [
        { name: "wallet", type: "address" },
        { name: "walletName", type: "string" },
        { name: "description", type: "string" }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "updateWallet",
      inputs: [
        { name: "wallet", type: "address" },
        { name: "walletName", type: "string" },
        { name: "description", type: "string" }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "removeWallet",
      inputs: [{ name: "wallet", type: "address" }],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "activateWallet",
      inputs: [{ name: "wallet", type: "address" }],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "deactivateWallet",
      inputs: [{ name: "wallet", type: "address" }],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "getWalletAddresses",
      inputs: [],
      outputs: [{ name: "", type: "address[]" }],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "getWalletInfo",
      inputs: [{ name: "wallet", type: "address" }],
      outputs: [
        { name: "walletName", type: "string" },
        { name: "description", type: "string" },
        { name: "isActive", type: "bool" }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "batchTransfer",
      inputs: [
        { name: "token", type: "address" },
        { name: "recipients", type: "address[]" },
        { name: "amounts", type: "uint256[]" }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "withdrawToken",
      inputs: [
        { name: "token", type: "address" },
        { name: "to", type: "address" },
        { name: "amount", type: "uint256" }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "getDistributionStats",
      inputs: [{ name: "token", type: "address" }],
      outputs: [
        { name: "totalDistributions", type: "uint256" },
        { name: "totalAmountDistributed", type: "uint256" },
        { name: "totalRecipients", type: "uint256" },
        { name: "totalFailed", type: "uint256" }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "getTotalDistributionCount",
      inputs: [],
      outputs: [{ name: "", type: "uint256" }],
      stateMutability: "view"
    },
    {
      type: "event",
      name: "WalletAdded",
      inputs: [
        { name: "wallet", type: "address", indexed: true },
        { name: "walletName", type: "string", indexed: false }
      ]
    },
    {
      type: "event",
      name: "WalletRemoved",
      inputs: [{ name: "wallet", type: "address", indexed: true }]
    }
  ] as const,

  MERKLE_FEE_COLLECTOR: [
    {
      type: "function",
      name: "addWallet",
      inputs: [
        { name: "wallet", type: "address" },
        { name: "walletName", type: "string" },
        { name: "description", type: "string" }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "updateWallet",
      inputs: [
        { name: "wallet", type: "address" },
        { name: "walletName", type: "string" },
        { name: "description", type: "string" }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "removeWallet",
      inputs: [{ name: "wallet", type: "address" }],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "activateWallet",
      inputs: [{ name: "wallet", type: "address" }],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "deactivateWallet",
      inputs: [{ name: "wallet", type: "address" }],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "getWalletAddresses",
      inputs: [],
      outputs: [{ name: "", type: "address[]" }],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "getWalletInfo",
      inputs: [{ name: "wallet", type: "address" }],
      outputs: [
        { name: "walletName", type: "string" },
        { name: "description", type: "string" },
        { name: "isActive", type: "bool" }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "batchTransfer",
      inputs: [
        { name: "token", type: "address" },
        { name: "recipients", type: "address[]" },
        { name: "amounts", type: "uint256[]" }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "withdrawToken",
      inputs: [
        { name: "token", type: "address" },
        { name: "to", type: "address" },
        { name: "amount", type: "uint256" }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "getDistributionStats",
      inputs: [{ name: "token", type: "address" }],
      outputs: [
        { name: "totalDistributions", type: "uint256" },
        { name: "totalAmountDistributed", type: "uint256" },
        { name: "totalRecipients", type: "uint256" },
        { name: "totalFailed", type: "uint256" }
      ],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "getTotalDistributionCount",
      inputs: [],
      outputs: [{ name: "", type: "uint256" }],
      stateMutability: "view"
    },
    {
      type: "event",
      name: "WalletAdded",
      inputs: [
        { name: "wallet", type: "address", indexed: true },
        { name: "walletName", type: "string", indexed: false }
      ]
    },
    {
      type: "event",
      name: "WalletRemoved",
      inputs: [{ name: "wallet", type: "address", indexed: true }]
    }
  ] as const,

  ERC20: [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address account) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "event Transfer(address indexed from, address indexed to, uint256 value)",
    "event Approval(address indexed owner, address indexed spender, uint256 value)",
  ],
};

// Endowment Category Enum mapping
export const ENDOWMENT_CATEGORIES = {
  Humanitarian: 0,
  Zakat: 1,
  Development: 2,
  Poverty: 3,
  Education: 4,
  Healthcare: 5,
  Environment: 6,
} as const;

export const CATEGORY_NAMES = [
  "Humanitarian",
  "Zakat",
  "Development",
  "Poverty",
  "Education",
  "Healthcare",
  "Environment",
] as const;

// Network configuration
export const NETWORK_CONFIG = {
  chainId: Number.parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "1337"),
  chainName: process.env.NEXT_PUBLIC_CHAIN_NAME || "Hardhat Local",
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545",
  blockExplorer: "http://localhost:8545",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
};

// Collateral token configuration - updated from deployment-base-sepolia.json (2025-10-19)
export const COLLATERAL_TOKENS = [
  {
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    address:
      process.env.NEXT_PUBLIC_WBTC_TOKEN ||
      "0x9F6CFA55Fc895E7A75c8a384caA9c5dEa8670D7F",
    decimals: 8,
    icon: "/icons/wbtc.svg",
  },
  {
    symbol: "cbBTC",
    name: "Coinbase Wrapped Bitcoin",
    address:
      process.env.NEXT_PUBLIC_CBBTC_TOKEN ||
      "0x40b80260E466BF92740fD98BF4a68712aeAe4cE7",
    decimals: 8,
    icon: "/icons/cbbtc.svg",
  },
  {
    symbol: "tBTC",
    name: "Threshold Bitcoin",
    address:
      process.env.NEXT_PUBLIC_TBTC_TOKEN ||
      "0xBb8CF642C4F111e3A6c6D87BB1346102300ADa24",
    decimals: 8,
    icon: "/icons/tbtc.svg",
  },
];

// Protocol constants
export const PROTOCOL_CONSTANTS = {
  MIN_COLLATERAL_RATIO: 1.1,
  STRESS_REDEMPTION_FACTOR: 0.9,
  DEV_FEE_MINT: 0.01,
  DEV_FEE_REDEEM: 0.001,
  ENDOWMENT_FEE_MINT: 0.001,

  // ============================================
  // CONFIGURATION: MAINNET
  // ============================================
  // Weekly distributions: 7 days (604800 seconds)
  DISTRIBUTION_INTERVAL: 7 * 24 * 60 * 60,

  FRIDAY_14_UTC: 14 * 3600, // 14:00 UTC in seconds

  // Reward tiers
  REWARD_TIERS: [
    { minRatio: 1.12, reward: 0.01 },
    { minRatio: 1.22, reward: 0.02 },
    { minRatio: 1.32, reward: 0.03 },
    { minRatio: 1.42, reward: 0.04 },
    { minRatio: 1.52, reward: 0.05 },
    { minRatio: 1.62, reward: 0.06 },
    { minRatio: 1.72, reward: 0.07 },
    { minRatio: 1.82, reward: 0.08 },
    { minRatio: 1.92, reward: 0.09 },
    { minRatio: 2.02, reward: 0.1 },
  ],
};