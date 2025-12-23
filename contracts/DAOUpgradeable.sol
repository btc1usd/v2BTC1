// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IBTC1USD.sol";
import "./interfaces/IProtocolGovernance.sol";
import "./libraries/SafeMath.sol";

/**
 * @title DAOUpgradeable
 * @notice Upgradeable DAO governance contract
 * 
 * UPGRADEABLE DESIGN:
 * - No constructor (uses initialize function)
 * - Storage layout preserved for future upgrades
 * - Compatible with transparent proxy pattern
 * 
 * STORAGE LAYOUT - DO NOT REORDER:
 * - All state variables below MUST remain in this exact order
 * - New state variables can ONLY be added at the end
 */
contract DAOUpgradeable {
    using SafeMath for uint256;

    // Core contracts
    IBTC1USD public btc1usd;
    IProtocolGovernance public protocolGovernance;
    
    // DAO configuration
    uint256 public constant MIN_PROPOSAL_THRESHOLD = 10000e8; // 10,000 BTC1USD (8 decimals)
    uint256 public constant MIN_VOTING_PERIOD = 3 days;
    uint256 public constant MAX_VOTING_PERIOD = 14 days;
    uint256 public constant QUORUM_PERCENTAGE = 4; // 4% of total supply
    uint256 public constant PROPOSAL_THRESHOLD_PERCENTAGE = 1; // 1% of total supply
    
    // Proposal states
    enum ProposalState {
        Pending,
        Active,
        Canceled,
        Defeated,
        Succeeded,
        Queued,
        Expired,
        Executed
    }
    
    // Proposal types
    enum ProposalType {
        ParameterChange,
        EmergencyAction,
        ContractUpgrade,
        TreasuryAction,
        GovernanceChange
    }
    
    // Proposal structure
    struct Proposal {
        uint256 id;
        address proposer;
        string title;
        string description;
        uint256 startBlock;
        uint256 endBlock;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        mapping(address => Receipt) receipts;
        ProposalState state;
        ProposalType proposalType;
        bytes32 targets;
        uint256[] values;
        string[] signatures;
        bytes[] calldatas;
        uint256 eta;
        bool canceled;
        bool executed;
    }
    
    // Receipt structure for tracking votes
    struct Receipt {
        bool hasVoted;
        uint8 support;
        uint256 votes;
    }
    
    // Delegate structure
    struct Delegate {
        uint256 balance;
        address delegate;
        uint256 delegatedVotes;
    }
    
    // Storage
    mapping(uint256 => Proposal) public proposals;
    mapping(address => mapping(uint256 => uint256)) public proposalVoteCounts;
    mapping(address => Delegate) public delegates;
    
    uint256 public proposalCount;
    uint256 public totalSupply;
    
    // Upgradeable-specific
    bool private _initialized;
    
    // Events
    event Initialized(address indexed btc1usd, address indexed protocolGovernance);
    
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        string title,
        string description,
        uint256 startBlock,
        uint256 endBlock,
        ProposalType proposalType
    );
    
    event VoteCast(
        address indexed voter,
        uint256 indexed proposalId,
        uint8 support,
        uint256 votes,
        string reason
    );
    
    event ProposalCanceled(uint256 indexed proposalId);
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalQueued(uint256 indexed proposalId, uint256 eta);
    event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate);
    event DelegateVotesChanged(address indexed delegate, uint256 previousBalance, uint256 newBalance);
    
    modifier onlyDAO() {
        require(msg.sender == address(this), "DAO: caller is not DAO");
        _;
    }
    
    function initialize(address _btc1usd, address _protocolGovernance) external {
        require(!_initialized, "DAO: already initialized");
        require(_btc1usd != address(0), "DAO: btc1usd is zero address");
        require(_protocolGovernance != address(0), "DAO: protocolGovernance is zero address");
        
        btc1usd = IBTC1USD(_btc1usd);
        protocolGovernance = IProtocolGovernance(_protocolGovernance);
        totalSupply = btc1usd.totalSupply();
        
        _initialized = true;
        emit Initialized(_btc1usd, _protocolGovernance);
    }
    
    // Proposal creation
    function propose(
        string memory title,
        string memory description,
        address[] memory targets,
        uint256[] memory values,
        string[] memory signatures,
        bytes[] memory calldatas,
        ProposalType proposalType
    ) external returns (uint256) {
        require(btc1usd.balanceOf(msg.sender) >= MIN_PROPOSAL_THRESHOLD,
            "DAO: proposer must hold minimum tokens");

        uint256 startBlock = block.number; // Start immediately
        uint256 endBlock = startBlock + MIN_VOTING_PERIOD;
        
        proposalCount++;
        Proposal storage newProposal = proposals[proposalCount];
        
        newProposal.id = proposalCount;
        newProposal.proposer = msg.sender;
        newProposal.title = title;
        newProposal.description = description;
        newProposal.startBlock = startBlock;
        newProposal.endBlock = endBlock;
        newProposal.state = ProposalState.Pending;
        newProposal.proposalType = proposalType;
        
        emit ProposalCreated(
            proposalCount,
            msg.sender,
            title,
            description,
            startBlock,
            endBlock,
            proposalType
        );
        
        return proposalCount;
    }
    
    // Voting functions
    function castVote(uint256 proposalId, uint8 support) external {
        castVoteInternal(msg.sender, proposalId, support, "");
    }
    
    function castVoteWithReason(
        uint256 proposalId,
        uint8 support,
        string memory reason
    ) external {
        castVoteInternal(msg.sender, proposalId, support, reason);
    }
    
    function castVoteBySig(
        uint256 proposalId,
        uint8 support,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        // Implementation for signature-based voting
        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("DAO")),
                getChainId(),
                address(this)
            )
        );
        
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("CastVote(uint256 proposalId,uint8 support)"),
                proposalId,
                support
            )
        );
        
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", domainSeparator, structHash)
        );
        
        address signatory = ecrecover(digest, v, r, s);
        require(signatory != address(0), "DAO: invalid signature");
        
        castVoteInternal(signatory, proposalId, support, "");
    }
    
    function castVoteInternal(
        address voter,
        uint256 proposalId,
        uint8 support,
        string memory reason
    ) internal {
        require(state(proposalId) == ProposalState.Active, "DAO: voting is closed");
        require(support <= 2, "DAO: invalid vote type");
        
        Proposal storage proposal = proposals[proposalId];
        
        uint256 votes = getVotes(voter);
        require(votes > 0, "DAO: voter has no votes");
        
        Receipt storage receipt = proposal.receipts[voter];
        require(!receipt.hasVoted, "DAO: voter already voted");
        
        receipt.hasVoted = true;
        receipt.support = support;
        receipt.votes = votes;
        
        if (support == 0) {
            proposal.againstVotes = proposal.againstVotes.add(votes);
        } else if (support == 1) {
            proposal.forVotes = proposal.forVotes.add(votes);
        } else if (support == 2) {
            proposal.abstainVotes = proposal.abstainVotes.add(votes);
        }
        
        emit VoteCast(voter, proposalId, support, votes, reason);
    }
    
    // Proposal state functions
    function queue(uint256 proposalId) external {
        require(state(proposalId) == ProposalState.Succeeded, "DAO: proposal not successful");
        
        Proposal storage proposal = proposals[proposalId];
        uint256 eta = block.timestamp + 2 days; // 2 day timelock
        proposal.eta = eta;
        proposal.state = ProposalState.Queued;
        
        emit ProposalQueued(proposalId, eta);
    }
    
    function execute(uint256 proposalId) external payable {
        require(state(proposalId) == ProposalState.Queued, "DAO: proposal not queued");
        require(block.timestamp >= proposals[proposalId].eta, "DAO: timelock not expired");
        
        Proposal storage proposal = proposals[proposalId];
        proposal.executed = true;
        proposal.state = ProposalState.Executed;
        
        // Execute the proposal actions
        // This would typically involve calling the target contracts with the provided calldata
        
        emit ProposalExecuted(proposalId);
    }
    
    function cancel(uint256 proposalId) external {
        ProposalState currentState = state(proposalId);
        require(
            currentState == ProposalState.Pending ||
            currentState == ProposalState.Active ||
            currentState == ProposalState.Queued,
            "DAO: proposal not active"
        );
        
        Proposal storage proposal = proposals[proposalId];
        proposal.canceled = true;
        proposal.state = ProposalState.Canceled;
        
        emit ProposalCanceled(proposalId);
    }
    
    // Delegation functions
    function delegate(address delegatee) external {
        delegateInternal(msg.sender, delegatee);
    }
    
    function delegateBySig(
        address delegatee,
        uint256 nonce,
        uint256 expiry,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        // Implementation for signature-based delegation
        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("DAO")),
                getChainId(),
                address(this)
            )
        );
        
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Delegate(address delegatee,uint256 nonce,uint256 expiry)"),
                delegatee,
                nonce,
                expiry
            )
        );
        
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", domainSeparator, structHash)
        );
        
        address signatory = ecrecover(digest, v, r, s);
        require(signatory != address(0), "DAO: invalid signature");
        
        delegateInternal(signatory, delegatee);
    }
    
    function delegateInternal(address delegator, address delegatee) internal {
        require(delegatee != address(0), "DAO: delegatee is zero address");
        
        Delegate storage delegatorDelegate = delegates[delegator];
        address previousDelegate = delegatorDelegate.delegate;
        
        delegatorDelegate.delegate = delegatee;
        
        // Transfer voting power
        uint256 delegatorBalance = btc1usd.balanceOf(delegator);
        _moveDelegates(previousDelegate, delegatee, delegatorBalance);
        
        emit DelegateChanged(delegator, previousDelegate, delegatee);
    }
    
    // Helper functions
    function state(uint256 proposalId) public view returns (ProposalState) {
        require(proposalId <= proposalCount, "DAO: invalid proposal id");
        require(proposalId > 0, "DAO: invalid proposal id");

        Proposal storage proposal = proposals[proposalId];

        if (proposal.canceled) {
            return ProposalState.Canceled;
        } else if (block.number < proposal.startBlock) {
            return ProposalState.Pending;
        } else if (block.number <= proposal.endBlock) {
            return ProposalState.Active;
        } else if (proposal.executed) {
            return ProposalState.Executed;
        } else if (proposal.eta > 0 && block.timestamp >= proposal.eta + 2 weeks) {
            return ProposalState.Expired;
        } else if (proposal.eta > 0) {
            return ProposalState.Queued;
        } else {
            // Voting has ended, check if proposal succeeded or was defeated
            uint256 quorum = quorumVotes();
            uint256 totalVotes = proposal.forVotes.add(proposal.againstVotes).add(proposal.abstainVotes);

            // Check quorum and majority
            if (totalVotes < quorum || proposal.forVotes <= proposal.againstVotes) {
                return ProposalState.Defeated;
            } else {
                return ProposalState.Succeeded;
            }
        }
    }
    
    function getVotes(address account) public view returns (uint256) {
        // If user has delegated, return delegated votes, otherwise return their token balance
        uint256 delegatedVotes = delegates[account].delegatedVotes;
        if (delegatedVotes > 0) {
            return delegatedVotes;
        }
        // For users who haven't delegated, use their token balance directly
        return btc1usd.balanceOf(account);
    }
    
    function getChainId() internal view returns (uint256) {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        return chainId;
    }
    
    function _moveDelegates(address srcRep, address dstRep, uint256 amount) internal {
        if (srcRep != dstRep && amount > 0) {
            if (srcRep != address(0)) {
                uint256 srcRepNum = delegates[srcRep].delegatedVotes;
                delegates[srcRep].delegatedVotes = srcRepNum.sub(amount);
                emit DelegateVotesChanged(srcRep, srcRepNum, srcRepNum.sub(amount));
            }
            
            if (dstRep != address(0)) {
                uint256 dstRepNum = delegates[dstRep].delegatedVotes;
                delegates[dstRep].delegatedVotes = dstRepNum.add(amount);
                emit DelegateVotesChanged(dstRep, dstRepNum, dstRepNum.add(amount));
            }
        }
    }

    // NEW: Allow upgrading contract references
    function setBTC1USD(address _btc1usd) external onlyDAO {
        require(_btc1usd != address(0), "DAO: btc1usd is zero address");
        btc1usd = IBTC1USD(_btc1usd);
    }

    function setProtocolGovernance(address _protocolGovernance) external onlyDAO {
        require(_protocolGovernance != address(0), "DAO: protocolGovernance is zero address");
        protocolGovernance = IProtocolGovernance(_protocolGovernance);
    }
    
    // View functions
    function quorumVotes() public view returns (uint256) {
        return totalSupply.mul(QUORUM_PERCENTAGE).div(100);
    }
    
    function proposalThreshold() public view returns (uint256) {
        return totalSupply.mul(PROPOSAL_THRESHOLD_PERCENTAGE).div(100);
    }
    
    function fetchProposalVotes(uint256 proposalId) external view returns (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes) {
        Proposal storage proposal = proposals[proposalId];
        return (proposal.againstVotes, proposal.forVotes, proposal.abstainVotes);
    }

    function getProposal(uint256 proposalId) external view returns (
        address proposer,
        string memory title,
        string memory description,
        uint8 category,
        uint256 forVotes,
        uint256 againstVotes,
        uint256 abstainVotes,
        uint256 startBlock,
        uint256 endBlock,
        uint256 eta,
        bool executed,
        bool canceled
    ) {
        Proposal storage proposal = proposals[proposalId];
        return (
            proposal.proposer,
            proposal.title,
            proposal.description,
            uint8(proposal.proposalType),
            proposal.forVotes,
            proposal.againstVotes,
            proposal.abstainVotes,
            proposal.startBlock,
            proposal.endBlock,
            proposal.eta,
            proposal.executed,
            proposal.canceled
        );
    }

    function getQuorum(uint8 /* category */) external view returns (uint256) {
        // Return quorum based on total supply (4% of total supply)
        return quorumVotes();
    }

    function getVotingPower(address account) external view returns (uint256) {
        return getVotes(account);
    }

    function getReceipt(uint256 proposalId, address voter) external view returns (
        bool hasVoted,
        uint8 support,
        uint256 votes,
        string memory reason
    ) {
        Proposal storage proposal = proposals[proposalId];
        Receipt storage receipt = proposal.receipts[voter];
        return (receipt.hasVoted, receipt.support, receipt.votes, "");
    }

    function canVote(uint256 proposalId, address voter) external view returns (bool) {
        // Check if proposal is active
        if (state(proposalId) != ProposalState.Active) {
            return false;
        }

        // Check if user has voting power
        if (getVotes(voter) == 0) {
            return false;
        }

        // Check if user has already voted
        Proposal storage proposal = proposals[proposalId];
        if (proposal.receipts[voter].hasVoted) {
            return false;
        }

        return true;
    }

    function isInitialized() external view returns (bool) {
        return _initialized;
    }
}
