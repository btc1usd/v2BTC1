// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "../interfaces/IPriceOracle.sol";

/**
 * @title MockChainlinkOracle
 * @notice Mock oracle for testing that mimics Chainlink interface but allows manual price updates
 */
contract MockChainlinkOracle is AggregatorV3Interface, IPriceOracle {
    uint8 public immutable override decimals;
    string public override description = "Mock Chainlink BTC/USD Price Feed";
    uint256 public override version = 1;

    uint80 public roundId = 1;
    uint256 public latestPrice;
    uint256 public lastTimestamp;
    uint80 public answeredInRound = 1;

    // For AggregatorV3Interface
    uint256 public latestRoundData_called = 0;

    // For IPriceOracle interface
    address public admin;
    uint256 public constant STALE_THRESHOLD = 1800; // 30 minutes

    modifier onlyAdmin() {
        require(msg.sender == admin, "MockChainlinkOracle: caller is not admin");
        _;
    }

    constructor(
        uint8 _decimals,
        uint256 _initialPrice
    ) {
        decimals = _decimals;
        latestPrice = _initialPrice;
        lastTimestamp = block.timestamp;
        admin = msg.sender;
    }

    function setAdmin(address _admin) external onlyAdmin {
        admin = _admin;
    }

    function _setPrice(uint256 _price) internal {
        require(_price > 0, "MockChainlinkOracle: price must be positive");
        latestPrice = _price;
        lastTimestamp = block.timestamp;
        roundId++;
        answeredInRound = roundId;
    }
    
    function setPrice(uint256 _price) external onlyAdmin {
        _setPrice(_price);
    }

    function updatePriceTo(uint256 _price) external onlyAdmin {
        _setPrice(_price);
    }

    function updateTimestamp() external onlyAdmin {
        lastTimestamp = block.timestamp;
    }
    
    function updatePrice() external override onlyAdmin {
        lastTimestamp = block.timestamp;
    }
    
    function updatePrice(uint256 _newPrice) external override onlyAdmin {
        _setPrice(_newPrice);
    }
    
    function getPriceFeedDecimals() external view returns (uint8) {
        return decimals;
    }
    
    function getCurrentPrice() external view returns (uint256) {
        return latestPrice;
    }
    
    function getPriceFeedAddress() external view returns (address) {
        return address(this);
    }

    function getBTCPrice() external view override returns (uint256) {
        require(!isStale(), "MockChainlinkOracle: price is stale");
        return latestPrice;
    }

    function getPrice(address) external view override returns (uint256) {
        require(!isStale(), "MockChainlinkOracle: price is stale");
        return latestPrice;
    }

    function getLastUpdate() external view override returns (uint256) {
        return lastTimestamp;
    }

    function isStale() public view override returns (bool) {
        return block.timestamp - lastTimestamp > STALE_THRESHOLD;
    }

    // AggregatorV3Interface implementation
    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId_,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound_
        )
    {
        return (
            uint80(roundId),
            int256(latestPrice),
            lastTimestamp,
            lastTimestamp,
            uint80(answeredInRound)
        );
    }
    
    function getRoundData(uint80 _roundId)
        external
        view
        override
        returns (
            uint80 roundId_,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound_
        )
    {
        return (
            _roundId,
            int256(latestPrice),
            lastTimestamp,
            lastTimestamp,
            uint80(answeredInRound)
        );
    }
}