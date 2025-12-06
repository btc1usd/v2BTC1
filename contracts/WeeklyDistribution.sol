// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IBTC1USD.sol";
import "./interfaces/IMerkleDistributor.sol";
import "./Vault.sol";
import "./libraries/SafeMath.sol";

contract WeeklyDistribution {
    using SafeMath for uint256;

    // Distribution tiers (in percentage, with 8 decimals to match BTC1USD)
    uint256 public constant TIER_1_MIN = 1.12e8; // 112% (production value)
    uint256 public constant TIER_1_REWARD = 0.01e8; // 1¢
    
    uint256 public constant TIER_2_MIN = 1.22e8; // 122%
    uint256 public constant TIER_2_REWARD = 0.02e8; // 2¢
    
    uint256 public constant TIER_3_MIN = 1.32e8; // 132%
    uint256 public constant TIER_3_REWARD = 0.03e8; // 3¢
    
    uint256 public constant TIER_4_MIN = 1.42e8; // 142%
    uint256 public constant TIER_4_REWARD = 0.04e8; // 4¢
    
    uint256 public constant TIER_5_MIN = 1.52e8; // 152%
    uint256 public constant TIER_5_REWARD = 0.05e8; // 5¢
    
    uint256 public constant TIER_6_MIN = 1.62e8; // 162%
    uint256 public constant TIER_6_REWARD = 0.06e8; // 6¢
    
    uint256 public constant TIER_7_MIN = 1.72e8; // 172%
    uint256 public constant TIER_7_REWARD = 0.07e8; // 7¢
    
    uint256 public constant TIER_8_MIN = 1.82e8; // 182%
    uint256 public constant TIER_8_REWARD = 0.08e8; // 8¢
    
    uint256 public constant TIER_9_MIN = 1.92e8; // 192%
    uint256 public constant TIER_9_REWARD = 0.09e8; // 9¢
    
    uint256 public constant TIER_10_MIN = 2.02e8; // 202%
    uint256 public constant TIER_10_REWARD = 0.10e8; // 10¢ (max)

    // Protocol fees (added on top of holder rewards)
    uint256 public constant MERKL_FEE = 0.00001e8; // 0.001¢
    uint256 public constant ENDOWMENT_FEE = 0.0001e8; // 0.01¢
    uint256 public constant DEV_FEE = 0.001e8; // 0.10¢

    // Minimum collateral ratio after distribution
    uint256 public constant MIN_RATIO_AFTER_DISTRIBUTION = 1.10e8; // 110%

    IBTC1USD public btc1usd;
    Vault public vault;
    address public admin;
    address public devWallet;
    address public endowmentWallet;
    address public merklFeeCollector;
    IMerkleDistributor public merklDistributor;

    uint256 public lastDistributionTime;

    // ============================================
    // CONFIGURATION: PRODUCTION
    // ============================================
    // Weekly distributions - 7 days (production)
    uint256 public constant DISTRIBUTION_INTERVAL = 7 days;

    uint256 public constant FRIDAY_14_UTC = 14 * 3600; // 14:00 UTC in seconds

    // Protocol wallets excluded from receiving holder rewards
    mapping(address => bool) public isExcludedFromRewards;
    address[] public excludedAddresses;

    struct DistributionEvent {
        uint256 timestamp;
        uint256 collateralRatio;
        uint256 rewardPerToken;
        uint256 totalRewards;
        uint256 totalSupply;
    }

    mapping(uint256 => DistributionEvent) public distributions;
    uint256 public distributionCount;

    event WeeklyDistributionExecuted(
        uint256 indexed distributionId,
        uint256 collateralRatio,
        uint256 rewardPerToken,
        uint256 totalRewards,
        uint256 timestamp
    );

    event MerkleDistributionCreated(
        uint256 indexed distributionId,
        bytes32 merkleRoot,
        uint256 totalTokensForHolders,
        uint256 totalTokensForMerkl
    );

    event AddressExcludedFromRewards(address indexed account);
    event AddressIncludedInRewards(address indexed account);

    modifier onlyAdmin() {
        require(msg.sender == admin, "WeeklyDistribution: caller is not admin");
        _;
    }

    constructor(
        address _btc1usd,
        address _vault,
        address _admin,
        address _devWallet,
        address _endowmentWallet,
        address _merklFeeCollector,
        address _merklDistributor
    ) {
        btc1usd = IBTC1USD(_btc1usd);
        vault = Vault(_vault);
        admin = _admin;
        devWallet = _devWallet;
        endowmentWallet = _endowmentWallet;
        merklFeeCollector = _merklFeeCollector;
        merklDistributor = IMerkleDistributor(_merklDistributor);
        lastDistributionTime = block.timestamp;

        // Automatically exclude protocol wallets from receiving holder rewards
        _excludeAddress(_devWallet);
        _excludeAddress(_endowmentWallet);
        _excludeAddress(_merklFeeCollector);
        _excludeAddress(_merklDistributor);
    }

    function canDistribute() public view returns (bool) {
        // MAINNET MODE: Friday 14:00 UTC restriction enabled
        // Distributions occur weekly, but only on/after Friday 14:00 UTC

        bool intervalPassed = block.timestamp >= lastDistributionTime.add(DISTRIBUTION_INTERVAL);

        // MAINNET: Friday 14:00 UTC check enabled
        if (!intervalPassed) return false;

        // Once interval passed, check if we've reached Friday 14:00 UTC
        uint256 dayOfWeek = (block.timestamp / 86400 + 4) % 7; // 0 = Thursday, 1 = Friday, etc.
        uint256 timeOfDay = block.timestamp % 86400;

        // If it's before Friday, not allowed yet
        if (dayOfWeek < 1) return false;

        // If it's Friday, must be past 14:00 UTC
        if (dayOfWeek == 1 && timeOfDay < FRIDAY_14_UTC) return false;

        // If it's Friday 14:00+ or any day after Friday (Sat, Sun, Mon, etc.), allowed
        return true;

        // TESTNET MODE (disabled): Uncomment line below for simple interval check without Friday restriction
        // return intervalPassed;
    }

    function getRewardPerToken(uint256 collateralRatio) public pure returns (uint256) {
        if (collateralRatio >= TIER_10_MIN) return TIER_10_REWARD;
        if (collateralRatio >= TIER_9_MIN) return TIER_9_REWARD;
        if (collateralRatio >= TIER_8_MIN) return TIER_8_REWARD;
        if (collateralRatio >= TIER_7_MIN) return TIER_7_REWARD;
        if (collateralRatio >= TIER_6_MIN) return TIER_6_REWARD;
        if (collateralRatio >= TIER_5_MIN) return TIER_5_REWARD;
        if (collateralRatio >= TIER_4_MIN) return TIER_4_REWARD;
        if (collateralRatio >= TIER_3_MIN) return TIER_3_REWARD;
        if (collateralRatio >= TIER_2_MIN) return TIER_2_REWARD;
        if (collateralRatio >= TIER_1_MIN) return TIER_1_REWARD;
        return 0;
    }

    /**
     * @dev Execute weekly distribution with merkle tree setup
     * This function mints tokens and sets up the merkle tree in one step
     */
    function executeDistribution() external {
        require(canDistribute(), "WeeklyDistribution: cannot distribute now");

        // Get collateral ratio manually as a workaround
        uint256 collateralValue = vault.getTotalCollateralValue();
        uint256 totalSupply = btc1usd.totalSupply();
        require(totalSupply > 0, "WeeklyDistribution: no tokens in circulation");

        // Calculate eligible supply by excluding protocol wallet balances
        // Only eligible holders should receive rewards
        uint256 eligibleSupply = totalSupply;
        for (uint256 i = 0; i < excludedAddresses.length; i++) {
            uint256 excludedBalance = btc1usd.balanceOf(excludedAddresses[i]);
            eligibleSupply = eligibleSupply.sub(excludedBalance);
        }
        require(eligibleSupply > 0, "WeeklyDistribution: no eligible holders");

        // Manual collateral ratio calculation: (collateralValue * 1e8) / totalSupply
        // Using SafeMath to avoid overflow
        uint256 collateralRatio = collateralValue.mul(1e8).div(totalSupply);
        require(collateralRatio >= TIER_1_MIN, "WeeklyDistribution: ratio too low for distribution");

        uint256 rewardPerToken = getRewardPerToken(collateralRatio);
        // Calculate total holder rewards based on eligible supply only: (eligibleSupply * rewardPerToken) / 1e8
        uint256 totalHolderRewards = eligibleSupply.mul(rewardPerToken).div(1e8);

        // Calculate protocol fees based on reward tokens (to be mited) (not total supply)
        uint256 merklFee = totalHolderRewards.mul(MERKL_FEE).div(1e8);
        
        // First calculate an initial total to determine fees
       // uint256 initialTotal = totalHolderRewards.add(merklFee);
        uint256 endowmentFee = totalHolderRewards.mul(ENDOWMENT_FEE).div(1e8);
        uint256 devFee = totalHolderRewards.mul(DEV_FEE).div(1e8);
        
        // Calculate final total with all fees
        uint256 totalNewTokens = totalHolderRewards.add(merklFee).add(endowmentFee).add(devFee);
        
        // Safety check: ensure collateral ratio remains above minimum after distribution
        uint256 newTotalSupply = totalSupply.add(totalNewTokens);
        // Calculate new collateral ratio: (collateralValue * 1e8) / newTotalSupply
        uint256 newCollateralRatio = collateralValue.mul(1e8).div(newTotalSupply);
        
        if (newCollateralRatio < MIN_RATIO_AFTER_DISTRIBUTION) {
            // Scale down the distribution to maintain minimum ratio
            // Calculate max new tokens: (collateralValue * 1e8) / MIN_RATIO_AFTER_DISTRIBUTION - totalSupply
            uint256 maxNewTokens = collateralValue.mul(1e8).div(MIN_RATIO_AFTER_DISTRIBUTION).sub(totalSupply);
            uint256 scaleFactor = maxNewTokens.mul(1e8).div(totalNewTokens);
            
            totalHolderRewards = totalHolderRewards.mul(scaleFactor).div(1e8);
            merklFee = merklFee.mul(scaleFactor).div(1e8);
            endowmentFee = endowmentFee.mul(scaleFactor).div(1e8);
            devFee = devFee.mul(scaleFactor).div(1e8);
            rewardPerToken = rewardPerToken.mul(scaleFactor).div(1e8);
        }
        
        // Mint tokens for distribution
        btc1usd.mint(address(merklDistributor), totalHolderRewards);  // Only holder rewards to distributor
        btc1usd.mint(merklFeeCollector, merklFee);  // Merkl fee to fee collector
        btc1usd.mint(endowmentWallet, endowmentFee);
        btc1usd.mint(devWallet, devFee);
        
        // Record distribution (using eligible supply for accurate records)
        distributionCount++;
        distributions[distributionCount] = DistributionEvent({
            timestamp: block.timestamp,
            collateralRatio: collateralRatio,
            rewardPerToken: rewardPerToken,
            totalRewards: totalHolderRewards,
            totalSupply: eligibleSupply  // Store eligible supply, not total supply
        });
        
        lastDistributionTime = block.timestamp;
        
        emit WeeklyDistributionExecuted(
            distributionCount,
            collateralRatio,
            rewardPerToken,
            totalHolderRewards,
            block.timestamp
        );
        
        // Immediately create the merkle distribution (only with holder rewards)
        bytes32 placeholderMerkleRoot = keccak256(abi.encodePacked(block.timestamp, distributionCount));
        try merklDistributor.startNewDistribution(placeholderMerkleRoot, totalHolderRewards) {
            emit MerkleDistributionCreated(distributionCount, placeholderMerkleRoot, totalHolderRewards, merklFee);
        } catch Error(string memory reason) {
            revert(string(abi.encodePacked("WeeklyDistribution: Failed to start merkle distribution: ", reason)));
        }
    }

    /**
     * @dev Update merkle root for the latest distribution
     * This should be called after executeDistribution() with the generated merkle root
     * @param merkleRoot The merkle root for the current distribution
     * @param totalTokensForHolders Total tokens allocated for holders
     */
    function updateMerkleRoot(bytes32 merkleRoot, uint256 totalTokensForHolders) external onlyAdmin {
        require(distributionCount > 0, "WeeklyDistribution: No distribution executed yet");
        require(merkleRoot != bytes32(0), "WeeklyDistribution: Invalid merkle root");

        // Get the merkle fee from the latest distribution
        // Note: totalSupply in DistributionEvent now stores eligible supply (excluding protocol wallets)
        DistributionEvent memory latestDistribution = distributions[distributionCount];
        uint256 merklFee = latestDistribution.totalSupply.mul(MERKL_FEE).div(1e8);

        // Update the merkle root in the distributor
        merklDistributor.updateMerkleRoot(distributionCount, merkleRoot);

        emit MerkleDistributionCreated(distributionCount, merkleRoot, totalTokensForHolders, merklFee);
    }

    /**
     * @dev Get the current distribution info for merkle tree generation
     * @return distributionId Current distribution ID
     * @return rewardPerToken Reward per token for current distribution
     * @return totalSupply Total supply at time of distribution
     * @return timestamp Distribution timestamp
     */
    function getCurrentDistributionInfo() external view returns (
        uint256 distributionId,
        uint256 rewardPerToken,
        uint256 totalSupply,
        uint256 timestamp
    ) {
        require(distributionCount > 0, "WeeklyDistribution: No distributions yet");
        DistributionEvent memory latest = distributions[distributionCount];
        return (distributionCount, latest.rewardPerToken, latest.totalSupply, latest.timestamp);
    }

    function getNextDistributionTime() external view returns (uint256) {
        return lastDistributionTime.add(DISTRIBUTION_INTERVAL);
    }

    function setMerklDistributor(address _merklDistributor) external onlyAdmin {
        merklDistributor = IMerkleDistributor(_merklDistributor);
    }

    function setDevWallet(address _devWallet) external onlyAdmin {
        devWallet = _devWallet;
    }

    function setEndowmentWallet(address _endowmentWallet) external onlyAdmin {
        // Remove old address from exclusion list
        if (endowmentWallet != address(0)) {
            _includeAddress(endowmentWallet);
        }

        endowmentWallet = _endowmentWallet;

        // Exclude new address
        _excludeAddress(_endowmentWallet);
    }

    function setMerklFeeCollector(address _merklFeeCollector) external onlyAdmin {
        // Remove old address from exclusion list
        if (merklFeeCollector != address(0)) {
            _includeAddress(merklFeeCollector);
        }

        merklFeeCollector = _merklFeeCollector;

        // Exclude new address
        _excludeAddress(_merklFeeCollector);
    }

    /**
     * @dev Internal function to exclude an address from rewards
     */
    function _excludeAddress(address account) internal {
        require(account != address(0), "WeeklyDistribution: zero address");

        if (!isExcludedFromRewards[account]) {
            isExcludedFromRewards[account] = true;
            excludedAddresses.push(account);
            emit AddressExcludedFromRewards(account);
        }
    }

    /**
     * @dev Internal function to include an address in rewards
     */
    function _includeAddress(address account) internal {
        if (isExcludedFromRewards[account]) {
            isExcludedFromRewards[account] = false;

            // Remove from excludedAddresses array
            for (uint256 i = 0; i < excludedAddresses.length; i++) {
                if (excludedAddresses[i] == account) {
                    excludedAddresses[i] = excludedAddresses[excludedAddresses.length - 1];
                    excludedAddresses.pop();
                    break;
                }
            }

            emit AddressIncludedInRewards(account);
        }
    }

    /**
     * @dev Manually exclude an address from receiving rewards
     * Can be used to exclude additional protocol contracts
     */
    function excludeAddress(address account) external onlyAdmin {
        _excludeAddress(account);
    }

    /**
     * @dev Manually include an address in rewards
     * Use with caution - should only be for correcting mistakes
     */
    function includeAddress(address account) external onlyAdmin {
        _includeAddress(account);
    }

    function setAdmin(address _admin) external onlyAdmin {
        require(_admin != address(0), "WeeklyDistribution: admin is zero address");
        admin = _admin;
    }

    /**
     * @dev Get all excluded addresses
     * @return Array of addresses excluded from rewards
     */
    function getExcludedAddresses() external view returns (address[] memory) {
        return excludedAddresses;
    }

    /**
     * @dev Check if an address is excluded from rewards
     */
    function isExcluded(address account) external view returns (bool) {
        return isExcludedFromRewards[account];
    }
}