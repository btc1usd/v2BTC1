// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IWeeklyDistribution {
    // View functions
    function admin() external view returns (address);
    function lastDistributionTime() external view returns (uint256);
    function canDistribute() external view returns (bool);
    
    // Distribution functions
    function distribute() external;
    function setAdmin(address _admin) external;
}
