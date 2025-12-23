// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

library FixedPoint8 {
    uint256 constant PRECISION = 1e8;
    
    function multiply(uint256 a, uint256 b) internal pure returns (uint256) {
        return (a * b) / PRECISION;
    }
    
    function divide(uint256 a, uint256 b) internal pure returns (uint256) {
        return (a * PRECISION) / b;
    }
    
    function fromUint(uint256 value) internal pure returns (uint256) {
        return value * PRECISION;
    }
    
    function toUint(uint256 value) internal pure returns (uint256) {
        return value / PRECISION;
    }
}
