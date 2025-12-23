// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./libraries/FixedPoint.sol";

contract DebugMath {
    using FixedPoint for uint256;
    
    function testMultiply(uint256 a, uint256 b) external pure returns (uint256) {
        return a.multiply(b);
    }
    
    function testDivide(uint256 a, uint256 b) external pure returns (uint256) {
        return a.divide(b);
    }
}
