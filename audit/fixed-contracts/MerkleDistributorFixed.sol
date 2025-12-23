// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../../interfaces/IMerkleDistributor.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MerkleDistributor - Fixed Version
 * @notice Merkle-based token distributor with security fixes
 * 
 * AUDIT FIXES APPLIED:
 * - CRITICAL-03: Improved batch transfer with better return value checking
 * - Already has ReentrancyGuard and nonReentrant modifiers (good practice)
 */
contract MerkleDistributor is IMerkleDistributor, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    address public immutable override token;
    bytes32 public override merkleRoot;
    address public admin;
    address public weeklyDistribution;

    uint256 public constant CLAIM_PERIOD = 10 hours; // TESTNET: 10 hours | MAINNET: 365 days
    
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
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "MerkleDistributor: caller is not admin");
        _;
    }
    
    modifier onlyWeeklyDistribution() {
        require(msg.sender == weeklyDistribution, "MerkleDistributor: caller is not weekly distribution");
        _;
    }
    
    modifier whenNotPaused() {
        require(!paused, "MerkleDistributor: contract is paused");
        _;
    }
    
    constructor(address token_, address admin_, address weeklyDistribution_) {
        token = token_;
        admin = admin_;
        weeklyDistribution = weeklyDistribution_;
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
        
        bytes32 oldRoot = distributions[distributionId].merkleRoot;
        distributions[distributionId].merkleRoot = newMerkleRoot;
        
        if (distributionId == currentDistributionId) {
            merkleRoot = newMerkleRoot;
        }
        
        emit MerkleRootUpdated(oldRoot, newMerkleRoot, distributionId);
    }

    function finalizeCurrentDistribution() public onlyAdmin {
        require(currentDistributionId > 0, "MerkleDistributor: No distribution to finalize");
        require(!distributions[currentDistributionId].finalized, "MerkleDistributor: Distribution already finalized");

        Distribution storage dist = distributions[currentDistributionId];
        dist.finalized = true;

        uint256 unclaimedTokens = dist.totalTokens - dist.totalClaimed;

        if (unclaimedTokens > 0) {
           IERC20(token).safeTransfer(admin, unclaimedTokens);
        }

        emit DistributionFinalized(currentDistributionId, dist.totalClaimed, unclaimedTokens);
    }

    function setAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "MerkleDistributor: Invalid admin address");
        address oldAdmin = admin;
        admin = newAdmin;
        emit AdminUpdated(oldAdmin, newAdmin);
    }

    function setWeeklyDistribution(address newWeeklyDistribution) external onlyAdmin {
        require(newWeeklyDistribution != address(0), "MerkleDistributor: Invalid weekly distribution address");
        address oldWeeklyDistribution = weeklyDistribution;
        weeklyDistribution = newWeeklyDistribution;
        emit WeeklyDistributionUpdated(oldWeeklyDistribution, newWeeklyDistribution);
    }

    function pause() external onlyAdmin {
        paused = true;
        emit EmergencyPause(true);
    }

    function unpause() external onlyAdmin {
        paused = false;
        emit EmergencyPause(false);
    }

    function emergencyRecoverTokens(address tokenAddress, uint256 amount) external onlyAdmin {
        require(paused, "MerkleDistributor: Contract must be paused");
        IERC20(tokenAddress).safeTransfer(admin, amount);
    }
    
    // FIXED: Improved batch transfer with better error handling
    /**
     * @notice Batch transfer tokens (best-effort, non-reverting)
     * FIXED: Better handling of non-standard ERC20 tokens
     */
    function batchTransfer(
        IERC20 tokenToDistribute,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external nonReentrant onlyOwner {
        require(recipients.length == amounts.length, "length mismatch");
        require(recipients.length > 0, "no recipients");

        uint256 totalSent = 0;
        uint256 totalFailed = 0;

        for (uint256 i = 0; i < recipients.length; ++i) {
            address to = recipients[i];
            uint256 amount = amounts[i];

            // Use low-level call for best-effort transfer
            (bool success, bytes memory data) = address(tokenToDistribute).call(
                abi.encodeWithSelector(tokenToDistribute.transfer.selector, to, amount)
            );

            // Handle both standard (returns bool) and non-standard (returns nothing) tokens
            bool transferSucceeded = false;
            if (success) {
                if (data.length == 0) {
                    // Non-standard token that doesn't return a value
                    transferSucceeded = true;
                } else if (data.length == 32) {
                    // Standard token that returns bool
                    transferSucceeded = abi.decode(data, (bool));
                }
            }

            if (transferSucceeded) {
                emit IndividualTransfer(address(tokenToDistribute), to, amount);
                totalSent += amount;
            } else {
                emit TransferFailed(address(tokenToDistribute), to, amount);
                totalFailed++;
            }
        }

        // Update distribution statistics
        address tokenAddress = address(tokenToDistribute);
        DistributionStats storage stats = distributionStats[tokenAddress];
        stats.totalDistributions++;
        stats.totalAmountDistributed += totalSent;
        stats.totalRecipients += recipients.length;
        stats.totalFailed += totalFailed;

        totalDistributionCount++;

        emit BatchTransferCompleted(tokenAddress, recipients.length, totalSent, totalFailed);
    }

    function withdrawToken(IERC20 tokenToWithdraw, address to, uint256 amount) external onlyOwner {
        tokenToWithdraw.safeTransfer(to, amount);
    }

    // ===== Wallet Management Functions =====
    
    function addWallet(
        address wallet,
        string memory name,
        string memory description
    ) external onlyOwner {
        require(wallet != address(0), "MerkleDistributor: invalid wallet address");
        require(bytes(name).length > 0, "MerkleDistributor: name cannot be empty");
        require(!walletInfos[wallet].isActive, "MerkleDistributor: wallet already exists");

        walletInfos[wallet] = WalletInfo({
            name: name,
            description: description,
            isActive: true
        });
        
        walletAddresses.push(wallet);
        
        emit WalletAdded(wallet, name);
    }

    function updateWallet(
        address wallet,
        string memory name,
        string memory description
    ) external onlyOwner {
        require(wallet != address(0), "MerkleDistributor: invalid wallet address");
        require(bytes(name).length > 0, "MerkleDistributor: name cannot be empty");
        require(walletInfos[wallet].isActive, "MerkleDistributor: wallet does not exist");
        
        walletInfos[wallet].name = name;
        walletInfos[wallet].description = description;
        
        emit WalletUpdated(wallet, name);
    }

    function removeWallet(address wallet) external onlyOwner {
        require(wallet != address(0), "MerkleDistributor: invalid wallet address");
        require(walletInfos[wallet].isActive, "MerkleDistributor: wallet does not exist");
        
        delete walletInfos[wallet];
        
        for (uint256 i = 0; i < walletAddresses.length; i++) {
            if (walletAddresses[i] == wallet) {
                walletAddresses[i] = walletAddresses[walletAddresses.length - 1];
                walletAddresses.pop();
                break;
            }
        }
        
        emit WalletRemoved(wallet);
    }

    function activateWallet(address wallet) external onlyOwner {
        require(wallet != address(0), "MerkleDistributor: invalid wallet address");
        require(walletInfos[wallet].isActive == false, "MerkleDistributor: wallet already active");
        
        walletInfos[wallet].isActive = true;
        emit WalletActivated(wallet);
    }

    function deactivateWallet(address wallet) external onlyOwner {
        require(wallet != address(0), "MerkleDistributor: invalid wallet address");
        require(walletInfos[wallet].isActive, "MerkleDistributor: wallet not active");
        
        walletInfos[wallet].isActive = false;
        emit WalletDeactivated(wallet);
    }

    function getWalletAddresses() external view returns (address[] memory) {
        return walletAddresses;
    }

    function getWalletInfo(address wallet) external view returns (
        string memory name,
        string memory description,
        bool isActive
    ) {
        WalletInfo memory info = walletInfos[wallet];
        return (info.name, info.description, info.isActive);
    }

    // ===== Distribution View Functions =====

    function isDistributionComplete(uint256 distributionId) public view override returns (bool) {
        Distribution memory dist = distributions[distributionId];
        return dist.totalClaimed == dist.totalTokens && dist.totalTokens > 0;
    }

    function getAllDistributionIds() public view override returns (uint256[] memory) {
        uint256[] memory ids = new uint256[](currentDistributionId);
        for (uint256 i = 1; i <= currentDistributionId; i++) {
            ids[i-1] = i;
        }
        return ids;
    }

    function getAllDistributions() public view returns (
        uint256[] memory ids,
        bytes32[] memory roots,
        uint256[] memory totalTokensArray,
        uint256[] memory totalClaimedArray,
        uint256[] memory timestamps,
        bool[] memory finalizedArray
    ) {
        ids = new uint256[](currentDistributionId);
        roots = new bytes32[](currentDistributionId);
        totalTokensArray = new uint256[](currentDistributionId);
        totalClaimedArray = new uint256[](currentDistributionId);
        timestamps = new uint256[](currentDistributionId);
        finalizedArray = new bool[](currentDistributionId);

        for (uint256 i = 1; i <= currentDistributionId; i++) {
            Distribution storage dist = distributions[i];
            ids[i-1] = i;
            roots[i-1] = dist.merkleRoot;
            totalTokensArray[i-1] = dist.totalTokens;
            totalClaimedArray[i-1] = dist.totalClaimed;
            timestamps[i-1] = dist.timestamp;
            finalizedArray[i-1] = dist.finalized;
        }
    }

    function getIncompleteDistributionIds() public view override returns (uint256[] memory) {
        uint256[] memory allIds = getAllDistributionIds();
        uint256[] memory incompleteIds = new uint256[](allIds.length);
        uint256 count = 0;

        for (uint256 i = 0; i < allIds.length; i++) {
            if (!isDistributionComplete(allIds[i])) {
                incompleteIds[count] = allIds[i];
                count++;
            }
        }

        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = incompleteIds[i];
        }

        return result;
    }

    function hasUnclaimedRewards(address account) public view returns (bool) {
        uint256[] memory incompleteDists = getIncompleteDistributionIds();
        return incompleteDists.length > 0 && account != address(0);
    }

    function canClaim(
        uint256 distributionId,
        uint256 index,
        address account,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external view returns (bool) {
        if (distributionId > currentDistributionId || isDistributionComplete(distributionId)) {
            return false;
        }

        if (isClaimed(distributionId, index)) {
            return false;
        }

        bytes32 root = distributions[distributionId].merkleRoot;
        if (root == bytes32(0)) return false;

        bytes32 node = keccak256(abi.encodePacked(index, account, amount));
        return verify(merkleProof, root, node);
    }

    function getDistributionInfo(uint256 distributionId)
        external
        view
        returns (
            bytes32 root,
            uint256 totalTokens,
            uint256 totalClaimed,
            uint256 timestamp,
            bool finalized
        )
    {
        Distribution memory dist = distributions[distributionId];
        return (dist.merkleRoot, dist.totalTokens, dist.totalClaimed, dist.timestamp, dist.finalized);
    }

    function getCurrentDistributionStats()
        external
        view
        returns (
            uint256 distributionId,
            uint256 totalTokens,
            uint256 totalClaimed,
            uint256 percentageClaimed
        )
    {
        distributionId = currentDistributionId;
        totalTokens = totalTokensInCurrentDistribution;
        totalClaimed = totalClaimedInCurrentDistribution;

        if (totalTokens > 0) {
            percentageClaimed = (totalClaimed * 10000) / totalTokens;
        } else {
            percentageClaimed = 0;
        }
    }

    function getContractTokenBalance() external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    function getDistributionStats(address tokenToCheck) external view returns (
        uint256 totalDistributions,
        uint256 totalAmountDistributed,
        uint256 totalRecipients,
        uint256 totalFailed
    ) {
        DistributionStats memory stats = distributionStats[tokenToCheck];
        return (
            stats.totalDistributions,
            stats.totalAmountDistributed,
            stats.totalRecipients,
            stats.totalFailed
        );
    }

    function getTotalDistributionCount() external view returns (uint256) {
        return totalDistributionCount;
    }
}
