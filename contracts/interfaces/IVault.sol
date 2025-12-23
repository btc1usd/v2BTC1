// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./IPermit2.sol";

interface IVault {
    // Constants
    function DECIMALS() external view returns (uint256);
    function MIN_COLLATERAL_RATIO() external view returns (uint256);
    function MIN_COLLATERAL_RATIO_STABLE() external view returns (uint256);
    function STRESS_REDEMPTION_FACTOR() external view returns (uint256);
    function DEV_FEE_MINT() external view returns (uint256);
    function DEV_FEE_REDEEM() external view returns (uint256);
    function ENDOWMENT_FEE_MINT() external view returns (uint256);
    function PERMIT2() external view returns (address);
    
    // State variables
    function btc1usd() external view returns (address);
    function oracle() external view returns (address);
    function devWallet() external view returns (address);
    function endowmentWallet() external view returns (address);
    function paused() external view returns (bool);
    function supportedCollateral(address token) external view returns (bool);
    function collateralBalances(address token) external view returns (uint256);
    function collateralTokens(uint256 index) external view returns (address);
    
    // Admin functions
    function addCollateral(address token) external;
    function removeCollateral(address token) external;
    function pause() external;
    function unpause() external;
    
    // Mint functions
    function mintWithPermit2(
        address collateral,
        uint256 amount,
        IPermit2.PermitTransferFrom calldata permit,
        bytes calldata signature
    ) external;
    
    // Redeem functions
    function redeemWithPermit(
        uint256 btc1Amount,
        address collateral,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
    
    // View functions (for compatibility)
    function getTotalCollateralValue() external view returns (uint256);
    function isHealthy() external view returns (bool);
    function getCurrentCollateralRatio() external view returns (uint256);
    
    // Events
    event Mint(address indexed user, address collateral, uint256 amountIn, uint256 btc1Out);
    event Redeem(address indexed user, address collateral, uint256 btc1In, uint256 collateralOut);
    event CollateralAdded(address token);
    event CollateralRemoved(address token);
    event Paused();
    event Unpaused();
}
