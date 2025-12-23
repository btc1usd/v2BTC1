// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IEndowmentManager {
    // View functions
    function admin() external view returns (address);
    function totalDistributed() external view returns (uint256);
    function endowmentWallet() external view returns (address);
    
    // Distribution functions
    function distributeToEndowment(uint256 amount) external;
    function setAdmin(address _admin) external;
    function setEndowmentWallet(address _wallet) external;
}
