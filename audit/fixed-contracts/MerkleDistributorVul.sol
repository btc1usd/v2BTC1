// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IMerkleDistributor.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
// Add ReentrancyGuard
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MerkleDistributorFixed
 * @dev Distributes tokens using merkle proofs
 * Based on Uniswap's merkle distributor pattern with enhancements for recurring distributions
 * Fixed version that properly handles overlapping distributions and ensures tokens are available
 */
// Add ReentrancyGuard inheritance
contract MerkleDistributor is IMerkleDistributor, ReentrancyGuard, Ownable {
    // Remove SafeMath import since Solidity 0.8+ has built-in overflow protection
    using SafeERC20 for IERC20;

    address public immutable override token;
    bytes32 public override merkleRoot;
    address public admin;
    address public weeklyDistribution;

    // ============================================
    // CONFIGURATION: TESTNET vs MAINNET
    // ============================================
    // TESTNET (current): 10 hours - for rapid testing
    // MAINNET: Change to "365 days" for full claim window
    uint256 public constant CLAIM_PERIOD = 10 hours;
    
    // Current distribution information
    uint256 public currentDistributionId;
    uint256 public totalTokensInCurrentDistribution;
    uint256 public totalClaimedInCurrentDistribution;
    
    // Wallet management for batch transfers
    struct WalletInfo {
        string name;
        string description;
        bool isActive;
    }

    // Mapping of wallet addresses to their information
    mapping(address => WalletInfo) public walletInfos;

    // List of all wallet addresses
    address[] public walletAddresses;

    // Distribution tracking
    struct DistributionStats {
        uint256 totalDistributions;      // Total number of batch distributions
        uint256 totalAmountDistributed;  // Total amount distributed (in token decimals)
        uint256 totalRecipients;         // Total recipients across all distributions
        uint256 totalFailed;             // Total failed transfers
    }

    // Per-token distribution statistics
    mapping(address => DistributionStats) public distributionStats;

    // Global distribution count (across all tokens)
    uint256 public totalDistributionCount;
    
    // Historical distributions
    struct Distribution {
        bytes32 merkleRoot;
        uint256 totalTokens;
        uint256 totalClaimed;
        uint256 timestamp;
        bool finalized;
    }
    
    mapping(uint256 => Distribution) public distributions;
    
    // Track claims across all distributions: distributionId => index => claimed
    mapping(uint256 => mapping(uint256 => bool)) public claimedByDistribution;
    
    // Track total claimed by user across all distributions
    mapping(address => uint256) public totalClaimedByUser;
    
    // Emergency pause functionality
    bool public paused;
    
    // Events for wallet management
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

    // Check if index of a distribution has been claimed
    function isClaimed(uint256 distributionId, uint256 index) public view returns (bool) {
        return claimedByDistribution[distributionId][index];
    }

    // Mark index as claimed for a distribution
    function _setClaimed(uint256 distributionId, uint256 index) private {
        claimedByDistribution[distributionId][index] = true;
    }

    /**
     * @notice Claim tokens for a particular distribution.
     * @param distributionId The distribution id to claim from
     * @param index The index in the merkle tree
     * @param account The account to receive tokens (should match leaf)
     * @param amount The amount for the leaf (should match leaf)
     * @param merkleProof The merkle proof for the leaf
     */
    function claim(
        uint256 distributionId,
        uint256 index,
        address account,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external override whenNotPaused nonReentrant {
        require(distributionId > 0 && distributionId <= currentDistributionId, "MerkleDistributor: Invalid distributionId");
        require(!isClaimed(distributionId, index), "MerkleDistributor: Drop already claimed");

        // Check if claim period has expired (10 hours for testing)
        require(
            block.timestamp <= distributions[distributionId].timestamp + CLAIM_PERIOD,
            "MerkleDistributor: Claim period expired"
        );

        // Get the merkle root for this distribution (authoritative)
        bytes32 root = distributions[distributionId].merkleRoot;
        require(root != bytes32(0), "MerkleDistributor: No root for distribution");

        // Verify the merkle proof (leaf encoding must match off-chain generator)
        bytes32 node = keccak256(abi.encodePacked(index, account, amount));
        require(verify(merkleProof, root, node), "MerkleDistributor: Invalid proof");

        // Mark claimed and update totals (distribution-specific canonical total)
        _setClaimed(distributionId, index);
        distributions[distributionId].totalClaimed += amount;
        totalClaimedByUser[account] += amount;

        // If claiming current distribution, keep live stat synced
        if (distributionId == currentDistributionId) {
            totalClaimedInCurrentDistribution += amount;
            // keep global merkleRoot mirror in sync (optional)
            merkleRoot = distributions[currentDistributionId].merkleRoot;
        }

        // Check that we have enough tokens before transferring
        require(IERC20(token).balanceOf(address(this)) >= amount, "MerkleDistributor: Insufficient token balance");
        
        // Transfer tokens using SafeERC20
        IERC20(token).safeTransfer(account, amount);

        emit Claimed(index, account, amount);
    }

    // Merkle proof verification (expects sorted pair hashing)
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

    /**
     * @dev Start a new distribution (called by WeeklyDistribution contract)
     * This version does NOT finalize the previous distribution, allowing overlapping distributions
     */
    function startNewDistribution(bytes32 newMerkleRoot, uint256 totalTokens) external onlyWeeklyDistribution {
        currentDistributionId = currentDistributionId + 1;

        // Keep a mirror (optional) of global merkleRoot for compatibility
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

    /**
     * @dev Start a new distribution with finalization of previous (legacy behavior)
     */
    function startNewDistributionWithFinalization(bytes32 newMerkleRoot, uint256 totalTokens) external onlyWeeklyDistribution {
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

    /**
     * @dev Update the merkle root for a specific distribution
     * This allows for updating the root after it has been initially set
     */
    function updateMerkleRoot(uint256 distributionId, bytes32 newMerkleRoot) external onlyWeeklyDistribution {
        require(distributionId > 0 && distributionId <= currentDistributionId, "MerkleDistributor: Invalid distributionId");
        
        bytes32 oldRoot = distributions[distributionId].merkleRoot;
        distributions[distributionId].merkleRoot = newMerkleRoot;
        
        // If updating current distribution, update the global merkleRoot
        if (distributionId == currentDistributionId) {
            merkleRoot = newMerkleRoot;
        }
        
        emit MerkleRootUpdated(oldRoot, newMerkleRoot, distributionId);
    }

    /**
     * @dev Finalize current distribution and return unclaimed tokens
     */
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

    /**
     * @dev Check if a distribution is complete (all claims have been made)
     */
    function isDistributionComplete(uint256 distributionId) public view returns (bool) {
        Distribution memory dist = distributions[distributionId];
        return dist.totalClaimed == dist.totalTokens && dist.totalTokens > 0;
    }

    /**
     * @dev Get all distribution IDs
     */
    function getAllDistributionIds() public view returns (uint256[] memory) {
        uint256[] memory ids = new uint256[](currentDistributionId);
        for (uint256 i = 1; i <= currentDistributionId; i++) {
            ids[i-1] = i;
        }
        return ids;
    }

    /**
     * @dev Get distribution statistics for all distributions
     */
    function getAllDistributions() public view returns (Distribution[] memory) {
        Distribution[] memory allDists = new Distribution[](currentDistributionId);
        for (uint256 i = 1; i <= currentDistributionId; i++) {
            allDists[i-1] = distributions[i];
        }
        return allDists;
    }

    /**
     * @dev Get all incomplete distribution IDs
     */
    function getIncompleteDistributionIds() public view returns (uint256[] memory) {
        uint256[] memory allIds = getAllDistributionIds();
        uint256[] memory incompleteIds = new uint256[](allIds.length);
        uint256 count = 0;

        for (uint256 i = 0; i < allIds.length; i++) {
            if (!this.isDistributionComplete(allIds[i])) {
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

    /**
     * @dev Check if user can claim from any incomplete distribution
     * NOTE: on-chain full check by membership is expensive; prefer off-chain helpers.
     */
    function hasUnclaimedRewards(address account) public view returns (bool) {
        uint256[] memory incompleteDists = getIncompleteDistributionIds();
        return incompleteDists.length > 0 && account != address(0);
    }

    /**
     * @dev Check if user can claim for a specific distribution
     */
    function canClaim(
        uint256 distributionId,
        uint256 index,
        address account,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external view returns (bool) {
        if (distributionId > currentDistributionId || this.isDistributionComplete(distributionId)) {
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

    /**
     * @dev Get distribution information
     */
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

    /**
     * @dev Get current distribution stats
     */
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
            percentageClaimed = (totalClaimed * 10000) / totalTokens; // Basis points (100 = 1%)
        } else {
            percentageClaimed = 0;
        }
    }

    /**
     * @dev Get token balance of this contract
     */
    function getContractTokenBalance() external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    // Admin functions
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

    /**
     * @dev Emergency function to recover tokens (only admin)
     */
    function emergencyRecoverTokens(address tokenAddress, uint256 amount) external onlyAdmin {
        require(paused, "MerkleDistributor: Contract must be paused");
        IERC20(tokenAddress).safeTransfer(admin, amount);
    }
    
    // Wallet management functions for batch transfers
    
    /**
     * @notice Add a new wallet to the distribution list
     * @param wallet Wallet address to add
     * @param name Name of the wallet
     * @param description Description of the wallet
     */
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

    /**
     * @notice Update an existing wallet's information
     * @param wallet Wallet address to update
     * @param name New name of the wallet
     * @param description New description of the wallet
     */
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

    /**
     * @notice Remove a wallet from the distribution list
     * @param wallet Wallet address to remove
     */
    function removeWallet(address wallet) external onlyOwner {
        require(wallet != address(0), "MerkleDistributor: invalid wallet address");
        require(walletInfos[wallet].isActive, "MerkleDistributor: wallet does not exist");
        
        // Remove wallet from mapping
        delete walletInfos[wallet];
        
        // Remove wallet from array
        for (uint256 i = 0; i < walletAddresses.length; i++) {
            if (walletAddresses[i] == wallet) {
                walletAddresses[i] = walletAddresses[walletAddresses.length - 1];
                walletAddresses.pop();
                break;
            }
        }
        
        emit WalletRemoved(wallet);
    }

    /**
     * @notice Activate a wallet
     * @param wallet Wallet address to activate
     */
    function activateWallet(address wallet) external onlyOwner {
        require(wallet != address(0), "MerkleDistributor: invalid wallet address");
        require(walletInfos[wallet].isActive == false, "MerkleDistributor: wallet already active");
        
        walletInfos[wallet].isActive = true;
        emit WalletActivated(wallet);
    }

    /**
     * @notice Deactivate a wallet
     * @param wallet Wallet address to deactivate
     */
    function deactivateWallet(address wallet) external onlyOwner {
        require(wallet != address(0), "MerkleDistributor: invalid wallet address");
        require(walletInfos[wallet].isActive, "MerkleDistributor: wallet not active");
        
        walletInfos[wallet].isActive = false;
        emit WalletDeactivated(wallet);
    }

    /**
     * @notice Get all wallet addresses
     * @return Array of wallet addresses
     */
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

    /**
     * @notice Batch transfer tokens (non-reverting best-effort mode).
     * @param tokenToDistribute ERC20 token address to distribute.
     * @param recipients List of recipient wallet addresses.
     * @param amounts List of token amounts corresponding to each recipient.
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

            // attempt safeTransfer in low-level call to catch reverts
            (bool success, bytes memory data) = address(tokenToDistribute).call(
                abi.encodeWithSelector(tokenToDistribute.transfer.selector, to, amount)
            );

            // Some tokens return false instead of reverting — check that too
            if (success && (data.length == 0 || abi.decode(data, (bool)))) {
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

        // Increment global distribution count
        totalDistributionCount++;

        emit BatchTransferCompleted(tokenAddress, recipients.length, totalSent, totalFailed);
    }

    /**
     * @notice Get distribution statistics for a specific token
     * @param tokenToCheck Token address to query
     * @return totalDistributions Total number of batch distributions
     * @return totalAmountDistributed Total amount distributed
     * @return totalRecipients Total recipients across all distributions
     * @return totalFailed Total failed transfers
     */
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

    /**
     * @notice Get total distribution count across all tokens
     * @return Total number of distributions
     */
    function getTotalDistributionCount() external view returns (uint256) {
        return totalDistributionCount;
    }

    /**
     * @notice Allows owner to recover any ERC20 tokens mistakenly sent to this contract.
     */
    function withdrawToken(IERC20 tokenToWithdraw, address to, uint256 amount) external onlyOwner {
        tokenToWithdraw.safeTransfer(to, amount);
    }
}