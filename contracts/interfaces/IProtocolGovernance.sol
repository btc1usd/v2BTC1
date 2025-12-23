// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IProtocolGovernance {
    // View functions
    function admin() external view returns (address);
    function governanceDAO() external view returns (address);
    function emergencyCouncil() external view returns (address);
    function emergencyPaused() external view returns (bool);
    
    // Parameter management
    function updateMinCollateralRatio(uint256 newRatio) external;
    function updateDevFees(uint256 mintFee, uint256 redeemFee) external;
    function updateEndowmentFee(uint256 fee) external;
    
    // Emergency controls
    function emergencyPause() external;
    function emergencyUnpause() external;
    
    // Contract management
    function addCollateralToken(address token) external;
    function removeCollateralToken(address token) external;
    
    // Admin management
    function setAdmin(address _admin) external;
    function setGovernanceDAO(address _governanceDAO) external;
}
