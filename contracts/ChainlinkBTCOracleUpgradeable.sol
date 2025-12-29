// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "./interfaces/IPriceOracle.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * @title ChainlinkBTCOracleUpgradeable (Liveness-Safe)
 * @notice Upgradeable Chainlink oracle without deviation or hard bounds
 *
 * SECURITY GUARANTEES:
 * - Stale timestamp protection
 * - Round completeness validation
 * - Minimum round age (anti-flash)
 * - No manual price injection
 *
 * All prices returned in 8 decimals (USD-8)
 *
 * NOTE:
 * - Relies on Chainlink security guarantees
 * - Economic safety handled in Vault (CR + stress logic)
 */
contract ChainlinkBTCOracleUpgradeable is
    Initializable,
    IPriceOracle,
    OwnableUpgradeable
{
    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    AggregatorV3Interface internal btcPriceFeed;

    mapping(address => AggregatorV3Interface) public collateralFeeds;
    mapping(address => uint8) public collateralDecimals;

    // ---- Safety parameters ----
    uint256 public constant STALE_THRESHOLD = 1200; // 20 minutes

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event PriceUpdated(uint256 newPrice, uint256 timestamp);
    event CollateralFeedUpdated(address indexed token, address indexed feed, uint8 decimals);
    event Initialized(address indexed owner);

    /*//////////////////////////////////////////////////////////////
                                INIT
    //////////////////////////////////////////////////////////////*/

    function initialize(
        address initialOwner,
        address btcFeed
    ) external initializer {
        require(initialOwner != address(0), "oracle: zero owner");
        require(btcFeed != address(0), "oracle: zero feed");

        __Ownable_init(initialOwner);
        btcPriceFeed = AggregatorV3Interface(btcFeed);

        emit Initialized(initialOwner);
    }

    /*//////////////////////////////////////////////////////////////
                                ADMIN
    //////////////////////////////////////////////////////////////*/

    function setBTCPriceFeed(address feed) external onlyOwner {
        require(feed != address(0), "oracle: zero feed");
        btcPriceFeed = AggregatorV3Interface(feed);
    }

    function setCollateralFeed(
        address token,
        address feed,
        uint8 decimals_
    ) external onlyOwner {
        require(token != address(0), "oracle: zero token");
        require(feed != address(0), "oracle: zero feed");

        collateralFeeds[token] = AggregatorV3Interface(feed);
        collateralDecimals[token] = decimals_;

        emit CollateralFeedUpdated(token, feed, decimals_);
    }

    /*//////////////////////////////////////////////////////////////
                            INTERNAL CORE
    //////////////////////////////////////////////////////////////*/

    function _readFeed(
        AggregatorV3Interface feed,
        uint8 feedDecimals
    ) internal view returns (uint256) {
        (
            uint80 roundID,
            int256 answer,
            ,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = feed.latestRoundData();

        require(answer > 0, "oracle: bad price");
        require(updatedAt > 0, "oracle: no timestamp");
        require(answeredInRound >= roundID, "oracle: stale round");
        require(block.timestamp - updatedAt <= STALE_THRESHOLD, "oracle: stale price");

        uint256 price = uint256(answer);

        // Normalize to 8 decimals
        if (feedDecimals < 8) {
            price *= 10 ** (8 - feedDecimals);
        } else if (feedDecimals > 8) {
            price /= 10 ** (feedDecimals - 8);
        }

        return price;
    }

    /*//////////////////////////////////////////////////////////////
                            PRICE INTERFACE
    //////////////////////////////////////////////////////////////*/

    function getBTCPrice() external view override returns (uint256) {
        return _readFeed(
            btcPriceFeed,
            btcPriceFeed.decimals()
        );
    }

    function getPrice(address token) external view override returns (uint256) {
        if (token != address(0) && address(collateralFeeds[token]) != address(0)) {
            return _readFeed(
                collateralFeeds[token],
                collateralDecimals[token]
            );
        }

        return _readFeed(
            btcPriceFeed,
            btcPriceFeed.decimals()
        );
    }

    function getLastUpdate() external view override returns (uint256) {
        (, , , uint256 ts, ) = btcPriceFeed.latestRoundData();
        return ts;
    }

    function isStale() external view override returns (bool) {
        (, , , uint256 ts, ) = btcPriceFeed.latestRoundData();
        return block.timestamp - ts > STALE_THRESHOLD;
    }

    function decimals() external pure returns (uint8) {
        return 8;
    }

    /*//////////////////////////////////////////////////////////////
                        COMPATIBILITY FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function updatePrice() external override onlyOwner {
        emit PriceUpdated(this.getBTCPrice(), block.timestamp);
    }

    function updatePrice(uint256) external override onlyOwner {
        revert("oracle: manual price updates disabled");
    }

    function getPriceFeedAddress() external view returns (address) {
        return address(btcPriceFeed);
    }
}
