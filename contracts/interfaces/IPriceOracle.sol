// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IPriceOracle {
    function getBTCPrice() external view returns (uint256);
    function getLastUpdate() external view returns (uint256);
    function isStale() external view returns (bool);
    function getPrice(address token) external view returns (uint256);
    
    // Add the missing updatePrice functions for backward compatibility
    function updatePrice() external;
    function updatePrice(uint256 _newPrice) external;
}
