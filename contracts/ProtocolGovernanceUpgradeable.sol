// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IBTC1USD.sol";
import "./interfaces/IVault.sol";
import "./interfaces/IWeeklyDistribution.sol";
import "./interfaces/IEndowmentManager.sol";
import "./interfaces/IPriceOracle.sol";
import "./libraries/SafeMath.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * @title ProtocolGovernanceUpgradeable
 * @notice Upgradeable protocol governance contract
 *
 * UPGRADEABLE DESIGN:
 * - Uses OpenZeppelin upgradeable patterns
 * - No constructor (uses initialize function)
 * - Storage layout preserved for future upgrades
 * 
 * STORAGE LAYOUT - DO NOT REORDER:
 * - All state variables below MUST remain in this exact order
 * - New state variables can ONLY be added at the end
 */
contract ProtocolGovernanceUpgradeable is Initializable, OwnableUpgradeable {
    using SafeMath for uint256;

    // Core contracts
    IBTC1USD public btc1usd;
    IVault public vault;
    IWeeklyDistribution public weeklyDistribution;
    IEndowmentManager public endowmentManager;
    IPriceOracle public priceOracle;
    
    // Governance
    address public admin;
    address public pendingAdmin;
    address public governanceDAO; // DAO contract address
    uint256 public constant ADMIN_TRANSFER_DELAY = 2 days;
    uint256 public adminTransferTimestamp;

    // Emergency controls
    bool public emergencyPaused;
    address public emergencyCouncil;

    // Upgrade management
    mapping(string => address) public contractAddresses; // contract name => current implementation
    
    // Protocol parameters
    struct ProtocolParams {
        uint256 minCollateralRatio;
        uint256 devFeeMint;
        uint256 devFeeRedeem;
        uint256 endowmentFeeMint;
        bool parametersLocked;
    }
    
    ProtocolParams public params;
    
    // Events
    event Initialized(address indexed owner, address indexed emergencyCouncil);
    event AdminTransferInitiated(address indexed currentOwner, address indexed newOwner, uint256 effectiveTime);
    event AdminTransferCompleted(address indexed oldOwner, address indexed newOwner);
    event AdminTransferCancelled();
    event EmergencyPause();
    event EmergencyUnpause();
    event ParametersUpdated();
    event ParametersLocked();

    modifier onlyOwnerOrDAO() {
        require(
            msg.sender == owner() || msg.sender == governanceDAO,
            "ProtocolGovernance: caller is not owner or DAO"
        );
        _;
    }

    modifier onlyDAO() {
        require(msg.sender == governanceDAO, "ProtocolGovernance: caller is not DAO");
        _;
    }

    modifier onlyEmergencyCouncil() {
        require(msg.sender == emergencyCouncil, "ProtocolGovernance: caller is not emergency council");
        _;
    }
    
    modifier whenNotEmergencyPaused() {
        require(!emergencyPaused, "ProtocolGovernance: protocol is emergency paused");
        _;
    }
    
    modifier parametersNotLocked() {
        require(!params.parametersLocked, "ProtocolGovernance: parameters are locked");
        _;
    }

    function initialize(
        address initialOwner,
        address _emergencyCouncil
    ) external initializer {
        require(initialOwner != address(0), "ProtocolGovernance: owner is zero address");
        require(_emergencyCouncil != address(0), "ProtocolGovernance: emergencyCouncil is zero address");
        
        __Ownable_init(initialOwner);
        admin = initialOwner;
        emergencyCouncil = _emergencyCouncil;
        
        // Initialize default parameters
        params = ProtocolParams({
            minCollateralRatio: 1.10e18, // 110%
            devFeeMint: 0.01e18, // 1%
            devFeeRedeem: 0.001e18, // 0.1%
            endowmentFeeMint: 0.001e18, // 0.1%
            parametersLocked: false
        });
        
        emit Initialized(initialOwner, _emergencyCouncil);
    }
    
    function initializeContracts(
        address _btc1usd,
        address _vault,
        address _weeklyDistribution,
        address _endowmentManager,
        address _priceOracle
    ) external onlyOwner {
        require(address(btc1usd) == address(0), "ProtocolGovernance: contracts already initialized");
        
        btc1usd = IBTC1USD(_btc1usd);
        vault = IVault(_vault);
        weeklyDistribution = IWeeklyDistribution(_weeklyDistribution);
        endowmentManager = IEndowmentManager(_endowmentManager);
        priceOracle = IPriceOracle(_priceOracle);
    }
    
    // Admin transfer with time delay for security
    function initiateAdminTransfer(address newAdmin) external onlyOwner {
        require(newAdmin != address(0), "ProtocolGovernance: new admin is zero address");
        require(newAdmin != admin, "ProtocolGovernance: new admin is current admin");
        
        pendingAdmin = newAdmin;
        adminTransferTimestamp = block.timestamp.add(ADMIN_TRANSFER_DELAY);
        
        emit AdminTransferInitiated(admin, newAdmin, adminTransferTimestamp);
    }
    
    function completeAdminTransfer() external {
        require(msg.sender == pendingAdmin, "ProtocolGovernance: caller is not pending admin");
        require(block.timestamp >= adminTransferTimestamp, "ProtocolGovernance: transfer delay not met");
        require(pendingAdmin != address(0), "ProtocolGovernance: no pending admin");
        
        address oldAdmin = admin;
        admin = pendingAdmin;
        pendingAdmin = address(0);
        adminTransferTimestamp = 0;
        
        emit AdminTransferCompleted(oldAdmin, admin);
    }
    
    function cancelAdminTransfer() external onlyOwner {
        pendingAdmin = address(0);
        adminTransferTimestamp = 0;
        emit AdminTransferCancelled();
    }

    // Simple admin transfer for initial deployment (no time delay)
    function setAdmin(address _admin) external onlyOwner {
        require(_admin != address(0), "ProtocolGovernance: admin is zero address");
        admin = _admin;
    }

    // Emergency controls
    function emergencyPause() external onlyEmergencyCouncil {
        emergencyPaused = true;
        
        // Pause vault
        vault.pause();
        
        emit EmergencyPause();
    }
    
    function emergencyUnpause() external onlyOwner {
        emergencyPaused = false;
        
        // Unpause vault
        vault.unpause();
        
        emit EmergencyUnpause();
    }
    
    // Parameter management
    function updateMinCollateralRatio(uint256 newRatio) external onlyOwner parametersNotLocked {
        require(newRatio >= 1.05e18, "ProtocolGovernance: ratio too low"); // Minimum 105%
        require(newRatio <= 1.50e18, "ProtocolGovernance: ratio too high"); // Maximum 150%
        
        params.minCollateralRatio = newRatio;
        emit ParametersUpdated();
    }
    
    function updateDevFees(uint256 mintFee, uint256 redeemFee) external onlyOwner parametersNotLocked {
        require(mintFee <= 0.05e18, "ProtocolGovernance: mint fee too high"); // Max 5%
        require(redeemFee <= 0.01e18, "ProtocolGovernance: redeem fee too high"); // Max 1%
        
        params.devFeeMint = mintFee;
        params.devFeeRedeem = redeemFee;
        emit ParametersUpdated();
    }
    
    function updateEndowmentFee(uint256 fee) external onlyOwner parametersNotLocked {
        require(fee <= 0.01e18, "ProtocolGovernance: endowment fee too high"); // Max 1%
        
        params.endowmentFeeMint = fee;
        emit ParametersUpdated();
    }
    
    function lockParameters() external onlyOwner {
        params.parametersLocked = true;
        emit ParametersLocked();
    }
    
    // Contract management
    function addCollateralToken(address token) external onlyOwner whenNotEmergencyPaused {
        vault.addCollateral(token);
    }
    
    function removeCollateralToken(address token) external onlyOwner {
        vault.removeCollateral(token);
    }
    
    function updatePriceOracle(address newOracle) external onlyOwnerOrDAO {
        priceOracle = IPriceOracle(newOracle);
        contractAddresses["PriceOracle"] = newOracle;
    }

    function setEmergencyCouncil(address newCouncil) external onlyOwnerOrDAO {
        emergencyCouncil = newCouncil;
    }

    // DAO Integration Functions
    function setGovernanceDAO(address _governanceDAO) external onlyOwner {
        require(_governanceDAO != address(0), "ProtocolGovernance: DAO is zero address");
        governanceDAO = _governanceDAO;
    }

    // Contract Upgrade Functions (DAO-controlled)
    function upgradeVault(address newVault) external onlyDAO {
        require(newVault != address(0), "ProtocolGovernance: new vault is zero address");
        vault = IVault(newVault);
        contractAddresses["Vault"] = newVault;
    }

    function upgradeWeeklyDistribution(address newDistribution) external onlyDAO {
        require(newDistribution != address(0), "ProtocolGovernance: new distribution is zero address");
        weeklyDistribution = IWeeklyDistribution(newDistribution);
        contractAddresses["WeeklyDistribution"] = newDistribution;
    }

    function upgradeEndowmentManager(address newEndowment) external onlyDAO {
        require(newEndowment != address(0), "ProtocolGovernance: new endowment is zero address");
        endowmentManager = IEndowmentManager(newEndowment);
        contractAddresses["EndowmentManager"] = newEndowment;
    }

    function upgradeBTC1USD(address newToken) external onlyDAO {
        require(newToken != address(0), "ProtocolGovernance: new token is zero address");
        btc1usd = IBTC1USD(newToken);
        contractAddresses["BTC1USD"] = newToken;
    }

    // Parameter updates accessible by DAO
    function updateMinCollateralRatioDAO(uint256 newRatio) external onlyDAO parametersNotLocked {
        require(newRatio >= 1.05e18, "ProtocolGovernance: ratio too low");
        require(newRatio <= 1.50e18, "ProtocolGovernance: ratio too high");

        params.minCollateralRatio = newRatio;
        emit ParametersUpdated();
    }

    function updateDevFeeMint(uint256 newFee) external onlyDAO parametersNotLocked {
        require(newFee <= 0.05e18, "ProtocolGovernance: fee too high");

        params.devFeeMint = newFee;
        emit ParametersUpdated();
    }

    function updateDevFeeRedeem(uint256 newFee) external onlyDAO parametersNotLocked {
        require(newFee <= 0.01e18, "ProtocolGovernance: fee too high");

        params.devFeeRedeem = newFee;
        emit ParametersUpdated();
    }

    // NEW: Allow upgrading contract references
    function setBTC1USD(address _btc1usd) external onlyOwner {
        require(_btc1usd != address(0), "ProtocolGovernance: btc1usd is zero address");
        btc1usd = IBTC1USD(_btc1usd);
    }

    function setVault(address _vault) external onlyOwner {
        require(_vault != address(0), "ProtocolGovernance: vault is zero address");
        vault = IVault(_vault);
    }

    function setWeeklyDistribution(address _weeklyDistribution) external onlyOwner {
        require(_weeklyDistribution != address(0), "ProtocolGovernance: weeklyDistribution is zero address");
        weeklyDistribution = IWeeklyDistribution(_weeklyDistribution);
    }

    function setEndowmentManager(address _endowmentManager) external onlyOwner {
        require(_endowmentManager != address(0), "ProtocolGovernance: endowmentManager is zero address");
        endowmentManager = IEndowmentManager(_endowmentManager);
    }

    function setPriceOracle(address _priceOracle) external onlyOwner {
        require(_priceOracle != address(0), "ProtocolGovernance: priceOracle is zero address");
        priceOracle = IPriceOracle(_priceOracle);
    }
    
    // View functions
    function getProtocolStatus() external view returns (
        bool isHealthy,
        uint256 collateralRatio,
        uint256 totalSupply,
        uint256 totalCollateralValue,
        bool isPaused
    ) {
        isHealthy = vault.isHealthy();
        collateralRatio = vault.getCurrentCollateralRatio();
        totalSupply = btc1usd.totalSupply();
        totalCollateralValue = vault.getTotalCollateralValue();
        isPaused = emergencyPaused;
    }
    
    function getProtocolParams() external view returns (ProtocolParams memory) {
        return params;
    }
}
