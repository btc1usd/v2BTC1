// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IMerkleDistributor
 * @dev Interface for distributing tokens using merkle proofs
 * Based on Uniswap's merkle distributor pattern
 */
interface IMerkleDistributor {
    // Returns the address of the token distributed by this contract
    function token() external view returns (address);
    
    // Returns the merkle root of the merkle tree containing account balances available to claim
    function merkleRoot() external view returns (bytes32);
    
    // Returns true if the index has been marked claimed for a specific distribution
    function isClaimed(uint256 distributionId, uint256 index) external view returns (bool);
    
    // Claim the given amount of the token to the given address for a specific distribution. Reverts if the inputs are invalid
    function claim(uint256 distributionId, uint256 index, address account, uint256 amount, bytes32[] calldata merkleProof) external;
    
    // Start a new distribution with merkle root and total tokens (does NOT finalize previous)
    function startNewDistribution(bytes32 merkleRoot, uint256 totalTokens) external;
    
    // Start a new distribution with finalization of previous distribution
    function startNewDistributionWithFinalization(bytes32 merkleRoot, uint256 totalTokens) external;
    
    // Update the merkle root for a specific distribution
    function updateMerkleRoot(uint256 distributionId, bytes32 newMerkleRoot) external;
    
    // Check if a distribution is complete
    function isDistributionComplete(uint256 distributionId) external view returns (bool);
    
    // Get all distribution IDs
    function getAllDistributionIds() external view returns (uint256[] memory);
    
    // Get all incomplete distribution IDs
    function getIncompleteDistributionIds() external view returns (uint256[] memory);
    
    // Check if user has unclaimed rewards
    function hasUnclaimedRewards(address account) external view returns (bool);
    
    // Check if user can claim for a specific distribution
    function canClaim(
        uint256 distributionId, 
        uint256 index, 
        address account, 
        uint256 amount, 
        bytes32[] calldata merkleProof
    ) external view returns (bool);
    
    // Get distribution information
    function getDistributionInfo(uint256 distributionId) 
        external 
        view 
        returns (
            bytes32 root,
            uint256 totalTokens,
            uint256 totalClaimed,
            uint256 timestamp,
            bool finalized
        );
    
    // This event is triggered whenever a call to #claim succeeds
    event Claimed(uint256 index, address account, uint256 amount);
    
    // Event emitted when a new merkle root is set
    event MerkleRootUpdated(bytes32 oldRoot, bytes32 newRoot, uint256 distributionId);
    
    // Event emitted when tokens are deposited for distribution
    event TokensDeposited(uint256 amount, uint256 distributionId);
    
    // Event emitted when a distribution is started
    event DistributionStarted(uint256 indexed distributionId, bytes32 merkleRoot, uint256 totalTokens);
    
    // Event emitted when a distribution is finalized
    event DistributionFinalized(uint256 indexed distributionId, uint256 totalClaimed, uint256 unclaimedTokens);
    
    // Event emitted when emergency pause is toggled
    event EmergencyPause(bool paused);
    
    // Event emitted when admin is updated
    event AdminUpdated(address oldAdmin, address newAdmin);
    
    // Event emitted when weekly distribution contract is updated
    event WeeklyDistributionUpdated(address oldWeeklyDistribution, address newWeeklyDistribution);
}
