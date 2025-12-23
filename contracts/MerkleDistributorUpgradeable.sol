// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IMerkleDistributor.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * @title MerkleDistributorUpgradeable
 * @notice Upgradeable Merkle-based token distributor with security fixes
 *
 * UPGRADEABLE DESIGN:
 * - Uses OpenZeppelin upgradeable patterns
 * - No constructor (uses initialize function)
 * - Storage layout preserved for future upgrades
 */
contract MerkleDistributorUpgradeable is Initializable, IMerkleDistributor, ReentrancyGuard, OwnableUpgradeable {
    using SafeERC20 for IERC20;

    address public override token;
    bytes32 public override merkleRoot;
    address public weeklyDistribution;

    uint256 public constant CLAIM_PERIOD = 365 days;
    
    uint256 public currentDistributionId;
    uint256 public totalTokensInCurrentDistribution;
    uint256 public totalClaimedInCurrentDistribution;
    
    struct WalletInfo {
        string name;
        string description;
        bool isActive;
    }

    mapping(address => WalletInfo) public walletInfos;
    address[] public walletAddresses;

    struct DistributionStats {
        uint256 totalDistributions;
        uint256 totalAmountDistributed;
        uint256 totalRecipients;
        uint256 totalFailed;
    }

    mapping(address => DistributionStats) public distributionStats;
    uint256 public totalDistributionCount;
    
    struct Distribution {
        bytes32 merkleRoot;
        uint256 totalTokens;
        uint256 totalClaimed;
        uint256 timestamp;
        bool finalized;
    }
    
    mapping(uint256 => Distribution) public distributions;
    mapping(uint256 => mapping(uint256 => bool)) public claimedByDistribution;
    mapping(address => uint256) public totalClaimedByUser;
    
    bool public paused;
    
    event IndividualTransfer(address indexed token, address indexed to, uint256 amount);
    event TransferFailed(address indexed token, address indexed to, uint256 amount);
    event BatchTransferCompleted(address indexed token, uint256 totalRecipients, uint256 totalSent, uint256 totalFailed);
    event WalletAdded(address indexed wallet, string name);
    event WalletUpdated(address indexed wallet, string name);
    event WalletRemoved(address indexed wallet);
    event WalletActivated(address indexed wallet);
    event WalletDeactivated(address indexed wallet);
    event Initialized(address indexed owner);
    
    modifier onlyWeeklyDistribution() {
        require(msg.sender == weeklyDistribution, "MerkleDistributor: caller is not weekly distribution");
        _;
    }
    
    modifier whenNotPaused() {
        require(!paused, "MerkleDistributor: contract is paused");
        _;
    }
    
    /**
     * @dev Initialize function replaces constructor for upgradeable pattern
     * Note: weeklyDistribution can be zero initially to resolve circular dependency
     */
    function initialize(address initialOwner, address token_, address weeklyDistribution_) external initializer {
        require(initialOwner != address(0), "MerkleDistributor: owner is zero address");
        require(token_ != address(0), "MerkleDistributor: token is zero address");
        // weeklyDistribution can be zero initially, will be set later via setWeeklyDistribution
        
        __Ownable_init(initialOwner);
        token = token_;
        weeklyDistribution = weeklyDistribution_;
        
        emit Initialized(initialOwner);
    }

    function isClaimed(uint256 distributionId, uint256 index) public view override returns (bool) {
        return claimedByDistribution[distributionId][index];
    }

    function _setClaimed(uint256 distributionId, uint256 index) private {
        claimedByDistribution[distributionId][index] = true;
    }

    function claim(
        uint256 distributionId,
        uint256 index,
        address account,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external override whenNotPaused nonReentrant {
        require(distributionId > 0 && distributionId <= currentDistributionId, "MerkleDistributor: Invalid distributionId");
        require(!isClaimed(distributionId, index), "MerkleDistributor: Drop already claimed");

        require(
            block.timestamp <= distributions[distributionId].timestamp + CLAIM_PERIOD,
            "MerkleDistributor: Claim period expired"
        );

        bytes32 root = distributions[distributionId].merkleRoot;
        require(root != bytes32(0), "MerkleDistributor: No root for distribution");

        bytes32 node = keccak256(abi.encodePacked(index, account, amount));
        require(verify(merkleProof, root, node), "MerkleDistributor: Invalid proof");

        _setClaimed(distributionId, index);
        distributions[distributionId].totalClaimed += amount;
        totalClaimedByUser[account] += amount;

        if (distributionId == currentDistributionId) {
            totalClaimedInCurrentDistribution += amount;
            merkleRoot = distributions[currentDistributionId].merkleRoot;
        }

        require(IERC20(token).balanceOf(address(this)) >= amount, "MerkleDistributor: Insufficient token balance");
        
        IERC20(token).safeTransfer(account, amount);

        emit Claimed(index, account, amount);
    }

    function verify(bytes32[] memory proof, bytes32 root, bytes32 leaf) public pure returns (bool) {
        bytes32 computedHash = leaf;

        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];

            if (computedHash <= proofElement) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }

        return computedHash == root;
    }

    function startNewDistribution(bytes32 newMerkleRoot, uint256 totalTokens) external override onlyWeeklyDistribution {
        currentDistributionId = currentDistributionId + 1;

        bytes32 oldRoot = merkleRoot;
        merkleRoot = newMerkleRoot;

        totalTokensInCurrentDistribution = totalTokens;
        totalClaimedInCurrentDistribution = 0;

        distributions[currentDistributionId] = Distribution({
            merkleRoot: newMerkleRoot,
            totalTokens: totalTokens,
            totalClaimed: 0,
            timestamp: block.timestamp,
            finalized: false
        });

        emit MerkleRootUpdated(oldRoot, newMerkleRoot, currentDistributionId);
        emit DistributionStarted(currentDistributionId, newMerkleRoot, totalTokens);
    }

    function startNewDistributionWithFinalization(bytes32 newMerkleRoot, uint256 totalTokens) external override onlyWeeklyDistribution {
        if (currentDistributionId > 0) {
            finalizeCurrentDistribution();
        }

        currentDistributionId = currentDistributionId + 1;
        bytes32 oldRoot = merkleRoot;
        merkleRoot = newMerkleRoot;
        totalTokensInCurrentDistribution = totalTokens;
        totalClaimedInCurrentDistribution = 0;

        distributions[currentDistributionId] = Distribution({
            merkleRoot: newMerkleRoot,
            totalTokens: totalTokens,
            totalClaimed: 0,
            timestamp: block.timestamp,
            finalized: false
        });

        emit MerkleRootUpdated(oldRoot, newMerkleRoot, currentDistributionId);
        emit DistributionStarted(currentDistributionId, newMerkleRoot, totalTokens);
    }

    function updateMerkleRoot(uint256 distributionId, bytes32 newMerkleRoot) external override onlyWeeklyDistribution {
        require(distributionId > 0 && distributionId <= currentDistributionId, "MerkleDistributor: Invalid distributionId");
        require(!distributions[distributionId].finalized, "MerkleDistributor: Distribution is finalized");
        
        bytes32 oldRoot = distributions[distributionId].merkleRoot;
        distributions[distributionId].merkleRoot = newMerkleRoot;
        
        if (distributionId == currentDistributionId) {
            merkleRoot = newMerkleRoot;
        }
        
        emit MerkleRootUpdated(oldRoot, newMerkleRoot, distributionId);
    }

    function finalizeCurrentDistribution() public onlyWeeklyDistribution {
        require(currentDistributionId > 0, "MerkleDistributor: No distribution to finalize");
        require(!distributions[currentDistributionId].finalized, "MerkleDistributor: Already finalized");
        
        distributions[currentDistributionId].finalized = true;
        uint256 totalClaimed = distributions[currentDistributionId].totalClaimed;
        uint256 totalTokens = distributions[currentDistributionId].totalTokens;
        uint256 unclaimedTokens = totalTokens > totalClaimed ? totalTokens - totalClaimed : 0;
        emit DistributionFinalized(currentDistributionId, totalClaimed, unclaimedTokens);
    }


    function setWeeklyDistribution(address _weeklyDistribution) external onlyOwner {
        require(_weeklyDistribution != address(0), "MerkleDistributor: weeklyDistribution is zero address");
        weeklyDistribution = _weeklyDistribution;
    }

    function pause() external onlyOwner {
        paused = true;
    }

    function unpause() external onlyOwner {
        paused = false;
    }

    function withdrawTokens(address _token, uint256 amount) external onlyOwner {
        require(_token != address(0), "MerkleDistributor: token is zero address");
        require(amount > 0, "MerkleDistributor: amount must be positive");
        
        IERC20(_token).safeTransfer(owner(), amount);
    }

    /**
     * @dev Check if a distribution is complete (all tokens claimed or finalized)
     */
    function isDistributionComplete(uint256 distributionId) external view override returns (bool) {
        if (distributionId == 0 || distributionId > currentDistributionId) return false;
        return distributions[distributionId].finalized;
    }

    /**
     * @dev Get all distribution IDs
     */
    function getAllDistributionIds() external view override returns (uint256[] memory) {
        uint256[] memory ids = new uint256[](currentDistributionId);
        for (uint256 i = 0; i < currentDistributionId; i++) {
            ids[i] = i + 1;
        }
        return ids;
    }

    /**
     * @dev Get all incomplete (not finalized) distribution IDs
     */
    function getIncompleteDistributionIds() external view override returns (uint256[] memory) {
        uint256 incompleteCount = 0;
        for (uint256 i = 1; i <= currentDistributionId; i++) {
            if (!distributions[i].finalized) {
                incompleteCount++;
            }
        }
        
        uint256[] memory incompleteIds = new uint256[](incompleteCount);
        uint256 index = 0;
        for (uint256 i = 1; i <= currentDistributionId; i++) {
            if (!distributions[i].finalized) {
                incompleteIds[index] = i;
                index++;
            }
        }
        return incompleteIds;
    }

    /**
     * @dev Check if an account has unclaimed rewards (simplified version)
     * Note: This is a basic implementation. For production, you'd need to track user claims more efficiently
     */
    function hasUnclaimedRewards(address account) external view override returns (bool) {
        // This is a simplified check - in production you'd want a more efficient tracking mechanism
        // For now, return true if there are any incomplete distributions
        for (uint256 i = 1; i <= currentDistributionId; i++) {
            if (!distributions[i].finalized && distributions[i].totalTokens > distributions[i].totalClaimed) {
                return true;
            }
        }
        return false;
    }

    /**
     * @dev Check if a user can claim for a specific distribution
     */
    function canClaim(
        uint256 distributionId,
        uint256 index,
        address account,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external view override returns (bool) {
        if (paused) return false;
        if (distributionId == 0 || distributionId > currentDistributionId) return false;
        if (isClaimed(distributionId, index)) return false;
        if (block.timestamp > distributions[distributionId].timestamp + CLAIM_PERIOD) return false;
        
        bytes32 root = distributions[distributionId].merkleRoot;
        if (root == bytes32(0)) return false;
        
        bytes32 node = keccak256(abi.encodePacked(index, account, amount));
        return verify(merkleProof, root, node);
    }

    /**
     * @dev Get distribution information
     */
    function getDistributionInfo(uint256 distributionId)
        external
        view
        override
        returns (
            bytes32 root,
            uint256 totalTokens,
            uint256 totalClaimed,
            uint256 timestamp,
            bool finalized
        )
    {
        require(distributionId > 0 && distributionId <= currentDistributionId, "MerkleDistributor: Invalid distributionId");
        Distribution storage dist = distributions[distributionId];
        return (
            dist.merkleRoot,
            dist.totalTokens,
            dist.totalClaimed,
            dist.timestamp,
            dist.finalized
        );
    }
}
