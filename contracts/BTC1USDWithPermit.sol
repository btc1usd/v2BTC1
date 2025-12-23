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

    modifier onlyVaultOrDistribution() {
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

    event VaultChanged(address oldVault, address newVault);
    event WeeklyDistributionChanged(address oldDist, address newDist);
    event CriticalParamsLocked(address owner);

    constructor(address initialOwner)
        ERC20("BTC1USD", "BTC1")
        ERC20Permit("BTC1USD")
        Ownable(initialOwner)
    {}

    function decimals() public pure override(ERC20, IBTC1USD) returns (uint8) {
        return 8;
    }

    function setVault(address _vault)
        external
        onlyOwner
        onlyOwnerUnlocked
    {
        require(_vault != address(0), "zero vault");
        emit VaultChanged(vault, _vault);
        vault = _vault;
    }

    function setWeeklyDistribution(address _wd)
        external
        onlyOwner
        onlyOwnerUnlocked
    {
        require(_wd != address(0), "zero wd");
        emit WeeklyDistributionChanged(weeklyDistribution, _wd);
        weeklyDistribution = _wd;
    }

    function lockCriticalParams() external onlyOwner {
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
}
