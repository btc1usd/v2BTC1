// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IBTC1USD is IERC20 {
    // State variables (view functions)
    function vault() external view returns (address);
    function weeklyDistribution() external view returns (address);
    function criticalParamsLocked() external view returns (bool);
    function decimals() external pure returns (uint8);
    
    // Admin functions (note: vault and weeklyDistribution are set via constructor)
    // Changes to vault/weeklyDistribution require 2-day timelock via initiate/execute functions
    function lockCriticalParams() external;
    
    // Minting and burning
    function mint(address to, uint256 amount) external;
    function burnFrom(address from, uint256 amount) external;
    
    // Note: EIP-2612 Permit functions (permit, nonces, DOMAIN_SEPARATOR) 
    // are inherited from ERC20Permit in the implementation
    // They are not redeclared here to avoid conflicts
    
    // Note: Events are defined in the implementation contract
    // to avoid redefinition errors
}
