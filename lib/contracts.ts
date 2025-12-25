// Contract addresses and ABIs for BTC1USD Protocol
export const CONTRACT_ADDRESSES = {
  // Updated from deployment-base-sepolia.json (2025-12-25T05:26:16.742Z)
  BTC1USD:
    process.env.NEXT_PUBLIC_BTC1USD_CONTRACT ||
    "0xEB1E6Bf4f72c47eEd17492bE45fb5C32FA7d8a24",
  BTC1USD_CONTRACT:
    process.env.NEXT_PUBLIC_BTC1USD_CONTRACT ||
    "0xEB1E6Bf4f72c47eEd17492bE45fb5C32FA7d8a24",
  VAULT:
    process.env.NEXT_PUBLIC_VAULT_CONTRACT ||
    "0x9202ff4981932d7e84D180238ad2DB7b3b6664d3",
  CHAINLINK_BTC_ORACLE:
    process.env.NEXT_PUBLIC_PRICE_ORACLE_CONTRACT ||
    "0x2054Cfd3c51842F149F6F9AF6236964f3E19bC8a",
  PRICE_ORACLE_CONTRACT:
    process.env.NEXT_PUBLIC_PRICE_ORACLE_CONTRACT ||
    "0x2054Cfd3c51842F149F6F9AF6236964f3E19bC8a",
  CHAINLINK_FEED:
    process.env.NEXT_PUBLIC_CHAINLINK_FEED ||
    "0x0FB99723Aee6f420beAD13e6bBB79b7E6F034298",
  WEEKLY_DISTRIBUTION:
    process.env.NEXT_PUBLIC_WEEKLY_DISTRIBUTION_CONTRACT ||
    "0x39d187Aa5ebFf691610EBd7F94669A8284F7E0f6",
  MERKLE_DISTRIBUTOR:
    process.env.NEXT_PUBLIC_MERKLE_DISTRIBUTOR_CONTRACT ||
    "0xcf547057B29aFea1B78fD8947700d73da0b58C3A",
  ENDOWMENT_MANAGER:
    process.env.NEXT_PUBLIC_ENDOWMENT_MANAGER_CONTRACT ||
    "0x8AA6F71dba9BD9dD54e7E3d4C6DbD10bb7Fd7d45",
  PROTOCOL_GOVERNANCE:
    process.env.NEXT_PUBLIC_PROTOCOL_GOVERNANCE_CONTRACT ||
    "0xdE01e8c1C6f858aabfcA76B56d439CE362Dd5AE5",
  GOVERNANCE_DAO:
    process.env.NEXT_PUBLIC_DAO_CONTRACT ||
    "0x7cf0750182891bb4439283a9a26fD5861aB1e54c",
  PROXY_ADMIN:
    process.env.NEXT_PUBLIC_PROXY_ADMIN_CONTRACT ||
    "0x953A81127155944149E6E8452E5fB57A09a8cf3C",

  // Wallet Smart Contract addresses (with on-chain distribution tracking)
  DEV_WALLET:
    process.env.NEXT_PUBLIC_DEV_WALLET_CONTRACT ||
    "0x23C82A1E7EF744a592925d018944c4B42f2e4809",
  ENDOWMENT_WALLET:
    process.env.NEXT_PUBLIC_ENDOWMENT_WALLET_CONTRACT ||
    "0x624B7A4aAc65924636CeAb3ab4250d185d83E898",
  MERKLE_FEE_COLLECTOR:
    process.env.NEXT_PUBLIC_MERKLE_FEE_COLLECTOR_CONTRACT ||
    "0xA5c149fB2c93F434cFcF1b2Dd35b6aa05479E18e",
  MERKLE_DISTRIBUTOR_WALLET:
    process.env.NEXT_PUBLIC_MERKLE_DISTRIBUTOR_CONTRACT ||
    "0xcf547057B29aFea1B78fD8947700d73da0b58C3A",

  // Collateral Token addresses (Mock tokens for Base Sepolia)
  WBTC_TOKEN:
    process.env.NEXT_PUBLIC_WBTC_TOKEN ||
    "0x8A2d17696D5A6dc3dbaFB374d5C633E1a2BA88C6",
  CBBTC_TOKEN:
    process.env.NEXT_PUBLIC_CBBTC_TOKEN ||
    "0xbd282E5BE062B97c50b3f7d7c113308EFB673cC8",
  TBTC_TOKEN:
    process.env.NEXT_PUBLIC_TBTC_TOKEN ||
    "0x22463d37f88D79a2eEDC7C236CA0bb5DA5E1B108",

  // Admin wallet address
  ADMIN:
    process.env.NEXT_PUBLIC_ADMIN_WALLET ||
    "0xd315dADB86EeE6391C99FB2afae6181BC146216D",
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
    // EIP-2612 Permit functions for gasless approvals
    "function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)",
    "function nonces(address owner) view returns (uint256)",
    "function DOMAIN_SEPARATOR() view returns (bytes32)",
    // Burn functions
    "function burn(uint256 amount)",
    "function burnFrom(address from, uint256 amount)",
    "event Transfer(address indexed from, address indexed to, uint256 value)",
    "event Approval(address indexed owner, address indexed spender, uint256 value)",
  ],

  VAULT: [
    "function mint(address collateralToken, uint256 btcAmount)",
    "function redeem(uint256 tokenAmount, address collateralToken)",
    // Permit2 SignatureTransfer for minting (gasless collateral approval)
    "function mintWithPermit2(address collateral, uint256 amount, tuple(tuple(address token, uint256 amount) permitted, uint256 nonce, uint256 deadline) permit, bytes signature)",
    // EIP-2612 Permit for redeeming (gasless BTC1USD approval)
    "function redeemWithPermit(uint256 btc1Amount, address collateral, uint256 deadline, uint8 v, bytes32 r, bytes32 s)",
    "function getCurrentCollateralRatio() view returns (uint256)",
    "function getCollateralRatio() view returns (uint256)",
    "function getTotalCollateralValue() view returns (uint256)",
    "function isHealthy() view returns (bool)",
    "function getSupportedCollateral() view returns (address[])",
    "function addCollateral(address token)",
    "function removeCollateral(address token)",
    "function supportedCollateral(address token) view returns (bool)",
    "function collateralBalances(address token) view returns (uint256)",
    "event Mint(address indexed user, address collateral, uint256 amountIn, uint256 btc1Out)",
    "event Redeem(address indexed user, address collateral, uint256 btc1In, uint256 collateralOut)",
    "event CollateralAdded(address indexed token)",
    "event CollateralRemoved(address indexed token)",
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
    {
      type: "function",
      name: "name",
      inputs: [],
      outputs: [{ name: "", type: "string" }],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "symbol",
      inputs: [],
      outputs: [{ name: "", type: "string" }],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "decimals",
      inputs: [],
      outputs: [{ name: "", type: "uint8" }],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "totalSupply",
      inputs: [],
      outputs: [{ name: "", type: "uint256" }],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "balanceOf",
      inputs: [{ name: "account", type: "address" }],
      outputs: [{ name: "", type: "uint256" }],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "transfer",
      inputs: [
        { name: "to", type: "address" },
        { name: "amount", type: "uint256" }
      ],
      outputs: [{ name: "", type: "bool" }],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "approve",
      inputs: [
        { name: "spender", type: "address" },
        { name: "amount", type: "uint256" }
      ],
      outputs: [{ name: "", type: "bool" }],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "allowance",
      inputs: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" }
      ],
      outputs: [{ name: "", type: "uint256" }],
      stateMutability: "view"
    },
    {
      type: "event",
      name: "Transfer",
      inputs: [
        { name: "from", type: "address", indexed: true },
        { name: "to", type: "address", indexed: true },
        { name: "value", type: "uint256", indexed: false }
      ]
    },
    {
      type: "event",
      name: "Approval",
      inputs: [
        { name: "owner", type: "address", indexed: true },
        { name: "spender", type: "address", indexed: true },
        { name: "value", type: "uint256", indexed: false }
      ]
    }
  ] as const,

  PROXY_ADMIN: [
    {
      type: "function",
      name: "getProxyImplementation",
      inputs: [{ name: "proxy", type: "address" }],
      outputs: [{ name: "", type: "address" }],
      stateMutability: "view"
    },
    {
      type: "function",
      name: "upgrade",
      inputs: [
        { name: "proxy", type: "address" },
        { name: "implementation", type: "address" }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    },
    {
      type: "function",
      name: "upgradeAndCall",
      inputs: [
        { name: "proxy", type: "address" },
        { name: "implementation", type: "address" },
        { name: "data", type: "bytes" }
      ],
      outputs: [],
      stateMutability: "payable"
    },
    {
      type: "event",
      name: "AdminChanged",
      inputs: [
        { name: "previousAdmin", type: "address", indexed: false },
        { name: "newAdmin", type: "address", indexed: false }
      ]
    }
  ] as const,
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
  chainId: Number.parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "84532"),
  chainName: process.env.NEXT_PUBLIC_CHAIN_NAME || "Base Sepolia",
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.base.org",
  blockExplorer: "https://sepolia.basescan.org",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
};

// Collateral token configuration - updated from deployment-base-sepolia.json (2025-12-20)
export const COLLATERAL_TOKENS = [
  {
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    address:
      process.env.NEXT_PUBLIC_WBTC_TOKEN ||
      "0x8A2d17696D5A6dc3dbaFB374d5C633E1a2BA88C6",
    decimals: 8,
    icon: "/icons/wbtc.svg",
  },
  {
    symbol: "cbBTC",
    name: "Coinbase Wrapped Bitcoin",
    address:
      process.env.NEXT_PUBLIC_CBBTC_TOKEN ||
      "0xbd282E5BE062B97c50b3f7d7c113308EFB673cC8",
    decimals: 8,
    icon: "/icons/cbbtc.svg",
  },
  {
    symbol: "tBTC",
    name: "Threshold Bitcoin",
    address:
      process.env.NEXT_PUBLIC_TBTC_TOKEN ||
      "0x22463d37f88D79a2eEDC7C236CA0bb5DA5E1B108",
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