// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "./interfaces/IPriceOracle.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * @title ChainlinkBTCOracleUpgradeable
 * @notice Upgradeable Chainlink price oracle supporting multiple collateral tokens
 *
 * UPGRADEABLE DESIGN:
 * - Uses OpenZeppelin upgradeable patterns
 * - No constructor (uses initialize function)
 * - Storage layout preserved for future upgrades
 */
contract ChainlinkBTCOracleUpgradeable is Initializable, IPriceOracle, OwnableUpgradeable {
    AggregatorV3Interface internal btcPriceFeed;
    
    mapping(address => AggregatorV3Interface) public collateralFeeds;
    mapping(address => uint8) public collateralDecimals;

    uint256 public constant STALE_THRESHOLD = 3600; // 1 hour

    event PriceUpdated(uint256 newPrice, uint256 timestamp);
    event CollateralFeedUpdated(address indexed token, address indexed feed, uint8 decimals);
    event Initialized(address indexed owner);

    /**
     * @dev Initialize function replaces constructor for upgradeable pattern
     * @param initialOwner Owner address for managing the oracle
     * @param _btcPriceFeedAddress BTC/USD price feed address
     */
    function initialize(address initialOwner, address _btcPriceFeedAddress) external initializer {
        require(initialOwner != address(0), "ChainlinkBTCOracle: owner is zero address");
        require(_btcPriceFeedAddress != address(0), "ChainlinkBTCOracle: BTC price feed is zero address");
        
        __Ownable_init(initialOwner);
        btcPriceFeed = AggregatorV3Interface(_btcPriceFeedAddress);
        
        emit Initialized(initialOwner);
    }

    /**
     * @dev Update the BTC price feed address (for mainnet/testnet switching or feed updates)
     */
    function setBTCPriceFeed(address feedAddress) external onlyOwner {
        require(feedAddress != address(0), "ChainlinkBTCOracle: feed is zero address");
        btcPriceFeed = AggregatorV3Interface(feedAddress);
    }

    function setCollateralFeed(address token, address feed, uint8 decimals) external onlyOwner {
        require(token != address(0), "ChainlinkBTCOracle: token is zero address");
        require(feed != address(0), "ChainlinkBTCOracle: feed is zero address");
        
        collateralFeeds[token] = AggregatorV3Interface(feed);
        collateralDecimals[token] = decimals;
        emit CollateralFeedUpdated(token, feed, decimals);
    }

    function getLatestPrice() public view returns (int) {
        (
            /*uint80 roundID*/,
            int price,
            /*uint startedAt*/,
            /*uint timeStamp*/,
            /*uint80 answeredInRound*/
        ) = btcPriceFeed.latestRoundData();

        return price;
    }

    function getLatestPriceNormalized() public view returns (uint256) {
        (, int price, , , ) = btcPriceFeed.latestRoundData();
        uint8 decimals = btcPriceFeed.decimals();
        return uint256(price) / (10 ** decimals);
    }

    function getBTCPrice() external view override returns (uint256) {
        (
            /*uint80 roundID*/,
            int price,
            /*uint startedAt*/,
            uint256 timeStamp,
            /*uint80 answeredInRound*/
        ) = btcPriceFeed.latestRoundData();

        require(price > 0, "ChainlinkBTCOracle: invalid price");
        require(timeStamp > 0, "ChainlinkBTCOracle: incomplete round");
        require(block.timestamp - timeStamp <= STALE_THRESHOLD, "ChainlinkBTCOracle: stale price");

        uint8 feedDecimals = btcPriceFeed.decimals();
        uint256 btcPrice = uint256(price);

        if (feedDecimals < 8) {
            btcPrice = btcPrice * (10 ** (8 - feedDecimals));
        } else if (feedDecimals > 8) {
            btcPrice = btcPrice / (10 ** (feedDecimals - 8));
        }

        return btcPrice;
    }

    function getPrice(address token) external view override returns (uint256) {
        if (token != address(0) && address(collateralFeeds[token]) != address(0)) {
            AggregatorV3Interface feed = collateralFeeds[token];
            uint8 targetDecimals = collateralDecimals[token];
            
            (
                /*uint80 roundID*/,
                int price,
                /*uint startedAt*/,
                uint256 timeStamp,
                /*uint80 answeredInRound*/
            ) = feed.latestRoundData();

            require(price > 0, "ChainlinkBTCOracle: invalid price");
            require(timeStamp > 0, "ChainlinkBTCOracle: incomplete round");
            require(block.timestamp - timeStamp <= STALE_THRESHOLD, "ChainlinkBTCOracle: stale price");

            uint256 tokenPrice = uint256(price);

            if (targetDecimals < 8) {
                tokenPrice = tokenPrice * (10 ** (8 - targetDecimals));
            } else if (targetDecimals > 8) {
                tokenPrice = tokenPrice / (10 ** (targetDecimals - 8));
            }

            return tokenPrice;
        }
        
        (
            /*uint80 roundID*/,
            int price,
            /*uint startedAt*/,
            uint256 timeStamp,
            /*uint80 answeredInRound*/
        ) = btcPriceFeed.latestRoundData();

        require(price > 0, "ChainlinkBTCOracle: invalid price");
        require(timeStamp > 0, "ChainlinkBTCOracle: incomplete round");
        require(block.timestamp - timeStamp <= STALE_THRESHOLD, "ChainlinkBTCOracle: stale price");

        uint8 feedDecimals = btcPriceFeed.decimals();
        uint256 btcPrice = uint256(price);

        if (feedDecimals < 8) {
            btcPrice = btcPrice * (10 ** (8 - feedDecimals));
        } else if (feedDecimals > 8) {
            btcPrice = btcPrice / (10 ** (feedDecimals - 8));
        }

        return btcPrice;
    }

    function getLastUpdate() external view override returns (uint256) {
        (
            /*uint80 roundID*/,
            /*int price*/,
            /*uint startedAt*/,
            uint256 timeStamp,
            /*uint80 answeredInRound*/
        ) = btcPriceFeed.latestRoundData();
        
        return timeStamp;
    }

    function isStale() external view override returns (bool) {
        (
            /*uint80 roundID*/,
            /*int price*/,
            /*uint startedAt*/,
            uint256 timeStamp,
            /*uint80 answeredInRound*/
        ) = btcPriceFeed.latestRoundData();
        
        return block.timestamp - timeStamp > STALE_THRESHOLD;
    }


    function getPriceFeedAddress() external view returns (address) {
        return address(btcPriceFeed);
    }

    function decimals() external pure returns (uint8) {
        return 8;
    }

    /**
     * @dev Chainlink oracles are automatic - these functions are no-ops for compatibility
     */
    function updatePrice() external override onlyOwner {
        // Chainlink automatically updates prices - this is a no-op for interface compatibility
        emit PriceUpdated(this.getBTCPrice(), block.timestamp);
    }

    function updatePrice(uint256 _newPrice) external override onlyOwner {
        // Chainlink automatically updates prices - manual price setting not supported
        // This function exists only for interface compatibility
        revert("ChainlinkBTCOracle: manual price updates not supported");
    }
}
