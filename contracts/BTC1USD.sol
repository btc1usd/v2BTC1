// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IBTC1USD.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";


contract BTC1USDWithPermit is ERC20, ERC20Permit, Ownable2Step, IBTC1USD {
    address public vault;
    address public weeklyDistribution;
    bool public criticalParamsLocked;

    // Timelock for critical address changes (2-day delay)
    uint256 public constant TIMELOCK_DELAY = 2 days;
    
    struct PendingChange {
        address newAddress;
        uint256 executeAfter;
    }
    
    PendingChange public pendingVaultChange;
    PendingChange public pendingWeeklyDistributionChange;

    modifier onlyVaultOrDistribution() {
        require(
            vault != address(0) && weeklyDistribution != address(0),
            "BTC1USD: not configured"
        );
        require(
            msg.sender == vault || msg.sender == weeklyDistribution,
            "BTC1USD: unauthorized"
        );
        _;
    }

    modifier onlyOwnerUnlocked() {
        require(!criticalParamsLocked, "BTC1USD: params locked");
        _;
    }

    event VaultChanged(address indexed oldVault, address indexed newVault);
    event WeeklyDistributionChanged(address indexed oldDist, address indexed newDist);
    event CriticalParamsLocked(address owner);
    
    // Timelock events
    event VaultChangeInitiated(address indexed oldVault, address indexed newVault, uint256 executeAfter);
    event VaultChangeCancelled(address indexed cancelledVault);
    event WeeklyDistributionChangeInitiated(address indexed oldDist, address indexed newDist, uint256 executeAfter);
    event WeeklyDistributionChangeCancelled(address indexed cancelledDist);

    constructor(address initialOwner, address _vault, address _weeklyDistribution)
        ERC20("BTC1USD", "BTC1")
        ERC20Permit("BTC1USD")
        Ownable(initialOwner)
    {
        vault = _vault;
        weeklyDistribution = _weeklyDistribution;
        
        if (_vault != address(0)) {
            emit VaultChanged(address(0), _vault);
        }
        if (_weeklyDistribution != address(0)) {
            emit WeeklyDistributionChanged(address(0), _weeklyDistribution);
        }
    }

    function decimals() public pure override(ERC20, IBTC1USD) returns (uint8) {
        return 8;
    }

    /*//////////////////////////////////////////////////////////////
                    INITIAL SETUP (DEPLOYMENT ONLY)
    //////////////////////////////////////////////////////////////*/

    /// @notice Set vault address (only works if current vault is zero)
    /// @dev For initial deployment only. Use timelock functions for changes.
    function setVault(address _vault)
        external
        onlyOwner
        onlyOwnerUnlocked
    {
        require(_vault != address(0), "zero vault");
        require(vault == address(0), "vault already set - use timelock");
        vault = _vault;
        emit VaultChanged(address(0), _vault);
    }

    /// @notice Set weekly distribution address (only works if current address is zero)
    /// @dev For initial deployment only. Use timelock functions for changes.
    function setWeeklyDistribution(address _wd)
        external
        onlyOwner
        onlyOwnerUnlocked
    {
        require(_wd != address(0), "zero distribution");
        require(weeklyDistribution == address(0), "distribution already set - use timelock");
        weeklyDistribution = _wd;
        emit WeeklyDistributionChanged(address(0), _wd);
    }

    /*//////////////////////////////////////////////////////////////
                    TIMELOCK VAULT ADDRESS CHANGES
    //////////////////////////////////////////////////////////////*/

    /// @notice Initiate vault address change (step 1 of 2)
    function initiateVaultChange(address newVault)
        external
        onlyOwner
        onlyOwnerUnlocked
    {
        require(newVault != address(0), "zero vault");
        require(newVault != vault, "same vault");
        require(
            pendingVaultChange.newAddress == address(0),
            "BTC1USD: vault change pending"
        );
        
        pendingVaultChange = PendingChange({
            newAddress: newVault,
            executeAfter: block.timestamp + TIMELOCK_DELAY
        });
        
        emit VaultChangeInitiated(vault, newVault, pendingVaultChange.executeAfter);
    }

    /// @notice Execute vault address change after timelock (step 2 of 2)
    function executeVaultChange()
        external
        onlyOwner
        onlyOwnerUnlocked
    {
        require(pendingVaultChange.newAddress != address(0), "no pending change");
        require(block.timestamp >= pendingVaultChange.executeAfter, "timelock not expired");
        
        address oldVault = vault;
        vault = pendingVaultChange.newAddress;
        
        delete pendingVaultChange;
        
        emit VaultChanged(oldVault, vault);
    }

    /// @notice Cancel pending vault address change
    function cancelVaultChange() external onlyOwner {
        require(pendingVaultChange.newAddress != address(0), "no pending change");
        
        address cancelled = pendingVaultChange.newAddress;
        delete pendingVaultChange;
        
        emit VaultChangeCancelled(cancelled);
    }

    /*//////////////////////////////////////////////////////////////
                TIMELOCK WEEKLY DISTRIBUTION CHANGES
    //////////////////////////////////////////////////////////////*/

    /// @notice Initiate weekly distribution address change (step 1 of 2)
    function initiateWeeklyDistributionChange(address newDist)
        external
        onlyOwner
        onlyOwnerUnlocked
    {
        require(newDist != address(0), "zero distribution");
        require(newDist != weeklyDistribution, "same distribution");
        require(
            pendingWeeklyDistributionChange.newAddress == address(0),
            "BTC1USD: weekly dist change pending"
        );
        
        pendingWeeklyDistributionChange = PendingChange({
            newAddress: newDist,
            executeAfter: block.timestamp + TIMELOCK_DELAY
        });
        
        emit WeeklyDistributionChangeInitiated(weeklyDistribution, newDist, pendingWeeklyDistributionChange.executeAfter);
    }

    /// @notice Execute weekly distribution address change after timelock (step 2 of 2)
    function executeWeeklyDistributionChange()
        external
        onlyOwner
        onlyOwnerUnlocked
    {
        require(pendingWeeklyDistributionChange.newAddress != address(0), "no pending change");
        require(block.timestamp >= pendingWeeklyDistributionChange.executeAfter, "timelock not expired");
        
        address oldDist = weeklyDistribution;
        weeklyDistribution = pendingWeeklyDistributionChange.newAddress;
        
        delete pendingWeeklyDistributionChange;
        
        emit WeeklyDistributionChanged(oldDist, weeklyDistribution);
    }

    /// @notice Cancel pending weekly distribution address change
    function cancelWeeklyDistributionChange() external onlyOwner {
        require(pendingWeeklyDistributionChange.newAddress != address(0), "no pending change");
        
        address cancelled = pendingWeeklyDistributionChange.newAddress;
        delete pendingWeeklyDistributionChange;
        
        emit WeeklyDistributionChangeCancelled(cancelled);
    }

    function lockCriticalParams() external onlyOwner {
        require(!criticalParamsLocked, "BTC1USD: already locked");
        require(vault != address(0), "BTC1USD: vault not set");
        require(weeklyDistribution != address(0), "BTC1USD: weekly dist not set");

        criticalParamsLocked = true;
        emit CriticalParamsLocked(owner());
    }

    function mint(address to, uint256 amount)
        external
        override
        onlyVaultOrDistribution
    {
        _mint(to, amount);
    }

    function burnFrom(address from, uint256 amount) external override {
        _spendAllowance(from, msg.sender, amount);
        _burn(from, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
