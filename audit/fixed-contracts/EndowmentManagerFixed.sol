// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../../interfaces/IBTC1USD.sol";
import "../../libraries/SafeMath.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title EndowmentManager - Fixed Version
 * @notice Manages non-profit endowments with security fixes
 * 
 * AUDIT FIXES APPLIED:
 * - HIGH-02: Added ReentrancyGuard and nonReentrant modifier to executeMonthlyDistribution
 * - MEDIUM-08: Fixed PROPOSAL_THRESHOLD to use 8 decimals instead of 18
 * - HIGH-05: Added zero address checks in constructor
 */
contract EndowmentManager is ReentrancyGuard {
    using SafeMath for uint256;

    IBTC1USD public btc1usd;
    address public admin;
    address public governanceDAO;
    address public endowmentWallet;
    
    enum NonProfitCategory {
        Humanitarian,
        Zakat,
        Development,
        Poverty,
        Education,
        Healthcare,
        Environment
    }

    struct NonProfit {
        string name;
        address wallet;
        bool approved;
        uint256 totalReceived;
        string description;
        string website;
        NonProfitCategory category;
        uint256 addedTimestamp;
        bool verified;
        uint256 allocationWeight;
    }

    mapping(address => NonProfit) public nonProfits;
    address[] public approvedNonProfits;

    mapping(NonProfitCategory => uint256) public categoryCount;

    struct NonProfitProposal {
        address proposer;
        address wallet;
        string name;
        string description;
        string website;
        NonProfitCategory category;
        uint256 votesFor;
        uint256 votesAgainst;
        bool executed;
        bool approved;
        uint256 proposalTimestamp;
        uint256 votingDeadline;
    }

    mapping(uint256 => NonProfitProposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    uint256 public proposalCount;
    uint256 public constant VOTING_PERIOD = 7 days;
    
    // FIXED: Corrected to 8 decimals (was 18)
    uint256 public constant PROPOSAL_THRESHOLD = 1000 * 10**8; // 1000 BTC1USD with 8 decimals
    
    uint256 public totalEndowmentBalance;
    uint256 public lastDistributionTime;
    uint256 public constant DISTRIBUTION_INTERVAL = 30 days;
    
    struct MonthlyDistribution {
        uint256 timestamp;
        uint256 totalAmount;
        uint256 recipientCount;
        mapping(address => uint256) allocations;
    }
    
    mapping(uint256 => MonthlyDistribution) public monthlyDistributions;
    uint256 public distributionCount;
    
    event NonProfitAdded(address indexed wallet, string name, NonProfitCategory category);
    event NonProfitRemoved(address indexed wallet);
    event NonProfitVerified(address indexed wallet, bool verified);
    event NonProfitWeightUpdated(address indexed wallet, uint256 newWeight);
    event MonthlyDistributionExecuted(uint256 indexed distributionId, uint256 totalAmount, uint256 recipientCount);
    event FundsAllocated(address indexed recipient, uint256 amount, uint256 distributionId);
    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, address wallet, string name);
    event ProposalVoted(uint256 indexed proposalId, address indexed voter, bool support, uint256 votingPower);
    event ProposalExecuted(uint256 indexed proposalId, bool approved);
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "EndowmentManager: caller is not admin");
        _;
    }

    modifier onlyAdminOrDAO() {
        require(
            msg.sender == admin || msg.sender == governanceDAO,
            "EndowmentManager: caller is not admin or DAO"
        );
        _;
    }

    modifier onlyDAO() {
        require(msg.sender == governanceDAO, "EndowmentManager: caller is not DAO");
        _;
    }

    modifier onlyEndowmentWallet() {
        require(msg.sender == endowmentWallet, "EndowmentManager: caller is not endowment wallet");
        _;
    }
    
    constructor(address _btc1usd, address _admin, address _endowmentWallet) {
        // FIXED: Added zero address checks
        require(_btc1usd != address(0), "EndowmentManager: btc1usd is zero address");
        require(_admin != address(0), "EndowmentManager: admin is zero address");
        require(_endowmentWallet != address(0), "EndowmentManager: endowment wallet is zero address");
        
        btc1usd = IBTC1USD(_btc1usd);
        admin = _admin;
        endowmentWallet = _endowmentWallet;
        lastDistributionTime = block.timestamp;
    }
    
    function setGovernanceDAO(address _governanceDAO) external onlyAdmin {
        require(_governanceDAO != address(0), "EndowmentManager: DAO is zero address");
        governanceDAO = _governanceDAO;
    }

    function addNonProfit(
        address wallet,
        string memory name,
        string memory description,
        string memory website,
        NonProfitCategory category
    ) external onlyAdminOrDAO {
        require(wallet != address(0), "EndowmentManager: invalid wallet address");
        require(!nonProfits[wallet].approved, "EndowmentManager: non-profit already exists");

        nonProfits[wallet] = NonProfit({
            name: name,
            wallet: wallet,
            approved: true,
            totalReceived: 0,
            description: description,
            website: website,
            category: category,
            addedTimestamp: block.timestamp,
            verified: false,
            allocationWeight: 100
        });

        approvedNonProfits.push(wallet);
        categoryCount[category]++;
        emit NonProfitAdded(wallet, name, category);
    }
    
    function removeNonProfit(address wallet) external onlyAdmin {
        require(nonProfits[wallet].approved, "EndowmentManager: non-profit not found");

        NonProfitCategory category = nonProfits[wallet].category;
        nonProfits[wallet].approved = false;
        categoryCount[category]--;

        for (uint i = 0; i < approvedNonProfits.length; i++) {
            if (approvedNonProfits[i] == wallet) {
                approvedNonProfits[i] = approvedNonProfits[approvedNonProfits.length - 1];
                approvedNonProfits.pop();
                break;
            }
        }

        emit NonProfitRemoved(wallet);
    }

    function setNonProfitVerified(address wallet, bool verified) external onlyAdmin {
        require(nonProfits[wallet].approved, "EndowmentManager: non-profit not found");
        nonProfits[wallet].verified = verified;
        emit NonProfitVerified(wallet, verified);
    }

    function setNonProfitWeight(address wallet, uint256 weight) external onlyAdmin {
        require(nonProfits[wallet].approved, "EndowmentManager: non-profit not found");
        require(weight > 0 && weight <= 500, "EndowmentManager: weight must be between 1 and 500");
        nonProfits[wallet].allocationWeight = weight;
        emit NonProfitWeightUpdated(wallet, weight);
    }
    
    function canDistribute() public view returns (bool) {
        return block.timestamp >= lastDistributionTime.add(DISTRIBUTION_INTERVAL) && 
               approvedNonProfits.length > 0 &&
               btc1usd.balanceOf(endowmentWallet) > 0;
    }
    
    // FIXED: Added nonReentrant modifier to prevent reentrancy attacks
    function executeMonthlyDistribution() external onlyAdminOrDAO nonReentrant {
        require(canDistribute(), "EndowmentManager: cannot distribute now");

        uint256 totalBalance = btc1usd.balanceOf(endowmentWallet);
        require(totalBalance > 0, "EndowmentManager: no funds to distribute");

        uint256 recipientCount = approvedNonProfits.length;

        // Calculate total weight
        uint256 totalWeight = 0;
        for (uint i = 0; i < approvedNonProfits.length; i++) {
            totalWeight = totalWeight.add(nonProfits[approvedNonProfits[i]].allocationWeight);
        }

        distributionCount++;
        MonthlyDistribution storage distribution = monthlyDistributions[distributionCount];
        distribution.timestamp = block.timestamp;
        distribution.totalAmount = totalBalance;
        distribution.recipientCount = recipientCount;

        // Distribute funds based on allocation weights
        for (uint i = 0; i < approvedNonProfits.length; i++) {
            address recipient = approvedNonProfits[i];
            uint256 weight = nonProfits[recipient].allocationWeight;

            uint256 allocation = totalBalance.mul(weight).div(totalWeight);

            // Transfer tokens from endowment wallet to non-profit
            btc1usd.transferFrom(endowmentWallet, recipient, allocation);

            // Update records after successful transfer
            nonProfits[recipient].totalReceived = nonProfits[recipient].totalReceived.add(allocation);
            distribution.allocations[recipient] = allocation;

            emit FundsAllocated(recipient, allocation, distributionCount);
        }

        lastDistributionTime = block.timestamp;
        emit MonthlyDistributionExecuted(distributionCount, totalBalance, recipientCount);
    }

    function proposeNonProfit(
        address wallet,
        string memory name,
        string memory description,
        string memory website,
        NonProfitCategory category
    ) external returns (uint256) {
        require(btc1usd.balanceOf(msg.sender) >= PROPOSAL_THRESHOLD, "EndowmentManager: insufficient tokens to propose");
        require(wallet != address(0), "EndowmentManager: invalid wallet address");
        require(!nonProfits[wallet].approved, "EndowmentManager: non-profit already exists");

        proposalCount++;
        proposals[proposalCount] = NonProfitProposal({
            proposer: msg.sender,
            wallet: wallet,
            name: name,
            description: description,
            website: website,
            category: category,
            votesFor: 0,
            votesAgainst: 0,
            executed: false,
            approved: false,
            proposalTimestamp: block.timestamp,
            votingDeadline: block.timestamp.add(VOTING_PERIOD)
        });

        emit ProposalCreated(proposalCount, msg.sender, wallet, name);
        return proposalCount;
    }

    function voteOnProposal(uint256 proposalId, bool support) external {
        require(proposalId <= proposalCount && proposalId > 0, "EndowmentManager: invalid proposal");
        NonProfitProposal storage proposal = proposals[proposalId];
        require(block.timestamp <= proposal.votingDeadline, "EndowmentManager: voting period ended");
        require(!proposal.executed, "EndowmentManager: proposal already executed");
        require(!hasVoted[proposalId][msg.sender], "EndowmentManager: already voted");

        uint256 votingPower = btc1usd.balanceOf(msg.sender);
        require(votingPower > 0, "EndowmentManager: no voting power");

        hasVoted[proposalId][msg.sender] = true;

        if (support) {
            proposal.votesFor = proposal.votesFor.add(votingPower);
        } else {
            proposal.votesAgainst = proposal.votesAgainst.add(votingPower);
        }

        emit ProposalVoted(proposalId, msg.sender, support, votingPower);
    }

    function executeProposal(uint256 proposalId) external {
        require(proposalId <= proposalCount && proposalId > 0, "EndowmentManager: invalid proposal");
        NonProfitProposal storage proposal = proposals[proposalId];
        require(block.timestamp > proposal.votingDeadline, "EndowmentManager: voting period not ended");
        require(!proposal.executed, "EndowmentManager: proposal already executed");

        proposal.executed = true;

        if (proposal.votesFor > proposal.votesAgainst) {
            proposal.approved = true;

            nonProfits[proposal.wallet] = NonProfit({
                name: proposal.name,
                wallet: proposal.wallet,
                approved: true,
                totalReceived: 0,
                description: proposal.description,
                website: proposal.website,
                category: proposal.category,
                addedTimestamp: block.timestamp,
                verified: false,
                allocationWeight: 100
            });

            approvedNonProfits.push(proposal.wallet);
            categoryCount[proposal.category]++;
            emit NonProfitAdded(proposal.wallet, proposal.name, proposal.category);
        }

        emit ProposalExecuted(proposalId, proposal.approved);
    }
    
    function getApprovedNonProfits() external view returns (address[] memory) {
        return approvedNonProfits;
    }
    
    function getNonProfitInfo(address wallet) external view returns (
        string memory name,
        bool approved,
        uint256 totalReceived,
        string memory description,
        string memory website,
        NonProfitCategory category,
        uint256 addedTimestamp,
        bool verified,
        uint256 allocationWeight
    ) {
        NonProfit memory np = nonProfits[wallet];
        return (
            np.name,
            np.approved,
            np.totalReceived,
            np.description,
            np.website,
            np.category,
            np.addedTimestamp,
            np.verified,
            np.allocationWeight
        );
    }

    function getDistributionAllocation(uint256 distributionId, address recipient) external view returns (uint256) {
        return monthlyDistributions[distributionId].allocations[recipient];
    }
    
    function getNextDistributionTime() external view returns (uint256) {
        return lastDistributionTime.add(DISTRIBUTION_INTERVAL);
    }
    
    function getCurrentEndowmentBalance() external view returns (uint256) {
        return btc1usd.balanceOf(endowmentWallet);
    }
    
    function setEndowmentWallet(address _endowmentWallet) external onlyAdmin {
        require(_endowmentWallet != address(0), "EndowmentManager: endowment wallet is zero address");
        endowmentWallet = _endowmentWallet;
    }
}
