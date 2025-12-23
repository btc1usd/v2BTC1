// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title DevWalletUpgradeable
 * @notice Upgradeable version of DevWallet
 * 
 * UPGRADEABLE DESIGN:
 * - No constructor (uses initialize function)
 * - Storage layout preserved for future upgrades
 * - Compatible with transparent proxy pattern
 */
contract DevWalletUpgradeable is ReentrancyGuard {
    using SafeERC20 for IERC20;

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

    address public owner;
    bool private _initialized;

    event IndividualTransfer(address indexed token, address indexed to, uint256 amount);
    event TransferFailed(address indexed token, address indexed to, uint256 amount);
    event BatchTransferCompleted(address indexed token, uint256 totalRecipients, uint256 totalSent, uint256 totalFailed);
    event WalletAdded(address indexed wallet, string name);
    event WalletUpdated(address indexed wallet, string name);
    event WalletRemoved(address indexed wallet);
    event WalletActivated(address indexed wallet);
    event WalletDeactivated(address indexed wallet);
    event Initialized(address indexed owner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "DevWallet: caller is not owner");
        _;
    }

    function initialize(address _owner) external {
        require(!_initialized, "DevWallet: already initialized");
        require(_owner != address(0), "DevWallet: owner is zero address");
        
        owner = _owner;
        _initialized = true;
        
        emit Initialized(_owner);
    }

    function addWallet(address wallet, string memory name, string memory description) external onlyOwner {
        require(wallet != address(0), "DevWallet: invalid wallet address");
        require(bytes(name).length > 0, "DevWallet: name cannot be empty");
        require(!walletInfos[wallet].isActive, "DevWallet: wallet already exists");

        walletInfos[wallet] = WalletInfo({name: name, description: description, isActive: true});
        walletAddresses.push(wallet);
        emit WalletAdded(wallet, name);
    }

    function updateWallet(address wallet, string memory name, string memory description) external onlyOwner {
        require(wallet != address(0), "DevWallet: invalid wallet address");
        require(bytes(name).length > 0, "DevWallet: name cannot be empty");
        require(walletInfos[wallet].isActive, "DevWallet: wallet does not exist");
        
        walletInfos[wallet].name = name;
        walletInfos[wallet].description = description;
        emit WalletUpdated(wallet, name);
    }

    function removeWallet(address wallet) external onlyOwner {
        require(wallet != address(0), "DevWallet: invalid wallet address");
        require(walletInfos[wallet].isActive, "DevWallet: wallet does not exist");
        
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
        require(wallet != address(0), "DevWallet: invalid wallet address");
        require(walletInfos[wallet].isActive == false, "DevWallet: wallet already active");
        walletInfos[wallet].isActive = true;
        emit WalletActivated(wallet);
    }

    function deactivateWallet(address wallet) external onlyOwner {
        require(wallet != address(0), "DevWallet: invalid wallet address");
        require(walletInfos[wallet].isActive, "DevWallet: wallet not active");
        walletInfos[wallet].isActive = false;
        emit WalletDeactivated(wallet);
    }

    function batchTransfer(IERC20 token, address[] calldata recipients, uint256[] calldata amounts) external nonReentrant onlyOwner {
        require(recipients.length == amounts.length, "length mismatch");
        require(recipients.length > 0, "no recipients");

        uint256 totalSent = 0;
        uint256 totalFailed = 0;

        for (uint256 i = 0; i < recipients.length; ++i) {
            address to = recipients[i];
            uint256 amount = amounts[i];

            (bool success, bytes memory data) = address(token).call(
                abi.encodeWithSelector(token.transfer.selector, to, amount)
            );

            if (success && (data.length == 0 || abi.decode(data, (bool)))) {
                emit IndividualTransfer(address(token), to, amount);
                totalSent += amount;
            } else {
                emit TransferFailed(address(token), to, amount);
                totalFailed++;
            }
        }

        address tokenAddress = address(token);
        DistributionStats storage stats = distributionStats[tokenAddress];
        stats.totalDistributions++;
        stats.totalAmountDistributed += totalSent;
        stats.totalRecipients += recipients.length;
        stats.totalFailed += totalFailed;
        totalDistributionCount++;

        emit BatchTransferCompleted(tokenAddress, recipients.length, totalSent, totalFailed);
    }

    function getWalletAddresses() external view returns (address[] memory) {
        return walletAddresses;
    }
    
    function getWalletInfo(address wallet) external view returns (string memory name, string memory description, bool isActive) {
        WalletInfo memory info = walletInfos[wallet];
        return (info.name, info.description, info.isActive);
    }

    function getDistributionStats(address token) external view returns (uint256 totalDistributions, uint256 totalAmountDistributed, uint256 totalRecipients, uint256 totalFailed) {
        DistributionStats memory stats = distributionStats[token];
        return (stats.totalDistributions, stats.totalAmountDistributed, stats.totalRecipients, stats.totalFailed);
    }

    function getTotalDistributionCount() external view returns (uint256) {
        return totalDistributionCount;
    }

    function withdrawToken(IERC20 token, address to, uint256 amount) external onlyOwner {
        token.safeTransfer(to, amount);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "DevWallet: new owner is zero address");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    function isInitialized() external view returns (bool) {
        return _initialized;
    }
}
