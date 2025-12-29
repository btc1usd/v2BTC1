// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IBTC1USD.sol";
import "./interfaces/IMerkleDistributor.sol";
import "./interfaces/IVault.sol";
import "./libraries/SafeMath.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

/**
 * @title WeeklyDistributionUpgradeable
 * @notice Upgradeable weekly distribution contract
 *
 * UPGRADEABLE DESIGN:
 * - Uses OpenZeppelin upgradeable patterns
 * - No constructor (uses initialize function)
 * - Storage layout preserved for future upgrades
 */
contract WeeklyDistributionUpgradeable is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable {
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
    IVault public vault;

    address public devWallet;
    address public endowmentWallet;
    address public merklFeeCollector;
    IMerkleDistributor public merklDistributor;

    uint256 public lastDistributionTime;

    // Daily distributions - 1 day interval
    uint256 public constant DISTRIBUTION_INTERVAL = 1 days;
    uint256 public constant CLAIM_EXPIRY = 365 days;
    
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
    event Initialized(address indexed owner);

    /**
     * @dev Initialize function replaces constructor for upgradeable pattern
     */
    function initialize(
        address initialOwner,
        address _btc1usd,
        address _vault,
        address _devWallet,
        address _endowmentWallet,
        address _merklFeeCollector,
        address _merklDistributor
    ) external initializer {
        require(initialOwner != address(0), "WeeklyDistribution: owner is zero address");
        require(_btc1usd != address(0), "WeeklyDistribution: btc1usd is zero address");
        require(_vault != address(0), "WeeklyDistribution: vault is zero address");
        
        __Ownable_init(initialOwner);
        __ReentrancyGuard_init();
        __Pausable_init();
        btc1usd = IBTC1USD(_btc1usd);
        vault = IVault(_vault);
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
        
        emit Initialized(initialOwner);
    }

    function canDistribute() public view returns (bool) {
        // Simple 1-day interval check - distribution allowed anytime after interval passes
        return block.timestamp >= lastDistributionTime.add(DISTRIBUTION_INTERVAL);
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

    function executeDistribution() external onlyOwner nonReentrant whenNotPaused {
        require(canDistribute(), "WeeklyDistribution: cannot distribute now");

        uint256 collateralValue = vault.getTotalCollateralValue();
        uint256 totalSupply = btc1usd.totalSupply();
        require(totalSupply > 0, "WeeklyDistribution: no tokens in circulation");

        uint256 eligibleSupply = totalSupply;
        for (uint256 i = 0; i < excludedAddresses.length; i++) {
            uint256 excludedBalance = btc1usd.balanceOf(excludedAddresses[i]);
            eligibleSupply = eligibleSupply.sub(excludedBalance);
        }
        require(eligibleSupply > 0, "WeeklyDistribution: no eligible holders");

        uint256 collateralRatio = collateralValue.mul(1e8).div(totalSupply);
        require(collateralRatio >= TIER_1_MIN, "WeeklyDistribution: ratio too low for distribution");

        uint256 rewardPerToken = getRewardPerToken(collateralRatio);
        uint256 totalHolderRewards = eligibleSupply.mul(rewardPerToken).div(1e8);

        // OPTIMIZED: Calculate fees with proper rounding to ensure fairness
        // Round up to prevent fees from being underpaid
        uint256 merklFee = (totalHolderRewards.mul(MERKL_FEE).add(1e8 - 1)).div(1e8);
        uint256 endowmentFee = (totalHolderRewards.mul(ENDOWMENT_FEE).add(1e8 - 1)).div(1e8);
        uint256 devFee = (totalHolderRewards.mul(DEV_FEE).add(1e8 - 1)).div(1e8);
        
        uint256 totalNewTokens = totalHolderRewards.add(merklFee).add(endowmentFee).add(devFee);
        
        uint256 newTotalSupply = totalSupply.add(totalNewTokens);
        uint256 newCollateralRatio = collateralValue.mul(1e8).div(newTotalSupply);
        
        if (newCollateralRatio < MIN_RATIO_AFTER_DISTRIBUTION) {
            uint256 maxNewTokens = collateralValue.mul(1e8).div(MIN_RATIO_AFTER_DISTRIBUTION).sub(totalSupply);
            uint256 scaleFactor = maxNewTokens.mul(1e8).div(totalNewTokens);
            
            totalHolderRewards = totalHolderRewards.mul(scaleFactor).div(1e8);
            merklFee = merklFee.mul(scaleFactor).div(1e8);
            endowmentFee = endowmentFee.mul(scaleFactor).div(1e8);
            devFee = devFee.mul(scaleFactor).div(1e8);
            rewardPerToken = rewardPerToken.mul(scaleFactor).div(1e8);
        }
        
        btc1usd.mint(address(merklDistributor), totalHolderRewards);
        btc1usd.mint(merklFeeCollector, merklFee);
        btc1usd.mint(endowmentWallet, endowmentFee);
        btc1usd.mint(devWallet, devFee);
        
        distributionCount++;
        distributions[distributionCount] = DistributionEvent({
            timestamp: block.timestamp,
            collateralRatio: collateralRatio,
            rewardPerToken: rewardPerToken,
            totalRewards: totalHolderRewards,
            totalSupply: eligibleSupply
        });
        
        lastDistributionTime = block.timestamp;
        
        emit WeeklyDistributionExecuted(
            distributionCount,
            collateralRatio,
            rewardPerToken,
            totalHolderRewards,
            block.timestamp
        );
        
        bytes32 placeholderMerkleRoot = keccak256(abi.encodePacked(block.timestamp, distributionCount));
        try merklDistributor.startNewDistribution(placeholderMerkleRoot, totalHolderRewards) {
            emit MerkleDistributionCreated(distributionCount, placeholderMerkleRoot, totalHolderRewards, merklFee);
        } catch Error(string memory reason) {
            revert(string(abi.encodePacked("WeeklyDistribution: Failed to start merkle distribution: ", reason)));
        }
    }

    function updateMerkleRoot(bytes32 merkleRoot, uint256 totalTokensForHolders) external onlyOwner {
        require(distributionCount > 0, "WeeklyDistribution: No distribution executed yet");
        require(merkleRoot != bytes32(0), "WeeklyDistribution: Invalid merkle root");

        DistributionEvent memory latestDistribution = distributions[distributionCount];
        uint256 merklFee = latestDistribution.totalSupply.mul(MERKL_FEE).div(1e8);

        merklDistributor.updateMerkleRoot(distributionCount, merkleRoot);

        emit MerkleDistributionCreated(distributionCount, merkleRoot, totalTokensForHolders, merklFee);
    }

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

    function setMerklDistributor(address _merklDistributor) external onlyOwner {
        require(_merklDistributor != address(0), "WeeklyDistribution: merklDistributor is zero address");
        merklDistributor = IMerkleDistributor(_merklDistributor);
    }

    function setDevWallet(address _devWallet) external onlyOwner {
        require(_devWallet != address(0), "WeeklyDistribution: devWallet is zero address");
        devWallet = _devWallet;
    }

    function setEndowmentWallet(address _endowmentWallet) external onlyOwner {
        if (endowmentWallet != address(0)) {
            _includeAddress(endowmentWallet);
        }
        endowmentWallet = _endowmentWallet;
        _excludeAddress(_endowmentWallet);
    }

    function setMerklFeeCollector(address _merklFeeCollector) external onlyOwner {
        if (merklFeeCollector != address(0)) {
            _includeAddress(merklFeeCollector);
        }
        merklFeeCollector = _merklFeeCollector;
        _excludeAddress(_merklFeeCollector);
    }

    function _excludeAddress(address account) internal {
        require(account != address(0), "WeeklyDistribution: zero address");
        if (!isExcludedFromRewards[account]) {
            isExcludedFromRewards[account] = true;
            excludedAddresses.push(account);
            emit AddressExcludedFromRewards(account);
        }
    }

    function _includeAddress(address account) internal {
        if (isExcludedFromRewards[account]) {
            isExcludedFromRewards[account] = false;
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

    function excludeAddress(address account) external onlyOwner {
        _excludeAddress(account);
    }

    function includeAddress(address account) external onlyOwner {
        _includeAddress(account);
    }


    function getExcludedAddresses() external view returns (address[] memory) {
        return excludedAddresses;
    }

    function isExcluded(address account) external view returns (bool) {
        return isExcludedFromRewards[account];
    }

    // NEW: Allow upgrading vault reference
    function setVault(address _vault) external onlyOwner {
        require(_vault != address(0), "WeeklyDistribution: vault is zero address");
        vault = IVault(_vault);
    }

    // NEW: Allow upgrading BTC1USD reference
    function setBTC1USD(address _btc1usd) external onlyOwner {
        require(_btc1usd != address(0), "WeeklyDistribution: btc1usd is zero address");
        btc1usd = IBTC1USD(_btc1usd);
    }

    // Emergency pause/unpause functions
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
