// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";

import "./interfaces/IBTC1USD.sol";
import "./interfaces/IPriceOracle.sol";
import "./interfaces/IPermit2.sol";

contract VaultUpgradeableWithPermit is Initializable, OwnableUpgradeable {
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                                CONSTANTS
    //////////////////////////////////////////////////////////////*/

    uint256 public constant DECIMALS = 1e8;

    uint256 public constant MIN_COLLATERAL_RATIO        = 1.20e8;
    uint256 public constant MIN_COLLATERAL_RATIO_STABLE = 1.10e8;
    uint256 public constant STRESS_REDEMPTION_FACTOR    = 0.90e8;

    uint256 public constant DEV_FEE_MINT       = 0.01e8;
    uint256 public constant DEV_FEE_REDEEM     = 0.001e8;
    uint256 public constant ENDOWMENT_FEE_MINT = 0.001e8;

    address public constant PERMIT2 =
        0x000000000022D473030F116dDEE9F6B43aC78BA3;

    /*//////////////////////////////////////////////////////////////
                                STATE
    //////////////////////////////////////////////////////////////*/

    IBTC1USD public btc1usd;
    IPriceOracle public oracle;

    address[] public collateralTokens;
    mapping(address => bool) public supportedCollateral;
    mapping(address => uint256) public collateralBalances;

    address public devWallet;
    address public endowmentWallet;
    bool public paused;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event Mint(address indexed user, address collateral, uint256 amountIn, uint256 btc1Out);
    event Redeem(address indexed user, address collateral, uint256 btc1In, uint256 collateralOut);
    event CollateralAdded(address token);
    event CollateralRemoved(address token);
    event Paused();
    event Unpaused();

    /*//////////////////////////////////////////////////////////////
                                MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier whenNotPaused() {
        require(!paused, "paused");
        _;
    }

    modifier validCollateral(address token) {
        require(supportedCollateral[token], "invalid collateral");
        _;
    }

    /*//////////////////////////////////////////////////////////////
                                INIT
    //////////////////////////////////////////////////////////////*/

    function initialize(
        address owner_,
        address btc1_,
        address oracle_,
        address dev_,
        address endowment_
    ) external initializer {
        __Ownable_init(owner_);
        btc1usd = IBTC1USD(btc1_);
        oracle = IPriceOracle(oracle_);
        devWallet = dev_;
        endowmentWallet = endowment_;
    }

    /*//////////////////////////////////////////////////////////////
                                ADMIN
    //////////////////////////////////////////////////////////////*/

    function addCollateral(address token) external onlyOwner {
        supportedCollateral[token] = true;
        collateralTokens.push(token);
        emit CollateralAdded(token);
    }

    function removeCollateral(address token) external onlyOwner {
        require(collateralBalances[token] == 0, "in use");
        supportedCollateral[token] = false;
        emit CollateralRemoved(token);
    }

    function pause() external onlyOwner {
        paused = true;
        emit Paused();
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused();
    }

    /*//////////////////////////////////////////////////////////////
                                MINT
    //////////////////////////////////////////////////////////////*/

    /// @notice Single-tx mint using Permit2 (works for wBTC, cbBTC, tBTC)
    function mintWithPermit2(
        address collateral,
        uint256 amount,
        IPermit2.PermitTransferFrom calldata permit,
        bytes calldata signature
    ) external whenNotPaused validCollateral(collateral) {
        require(!oracle.isStale(), "oracle stale");
        require(permit.permitted.token == collateral, "token mismatch");
        require(permit.permitted.amount >= amount, "permit too small");
        require(permit.deadline >= block.timestamp, "permit expired");

        IPermit2(PERMIT2).permitTransferFrom(
            permit,
            IPermit2.SignatureTransferDetails({
                to: address(this),
                requestedAmount: amount
            }),
            msg.sender,
            signature
        );

        collateralBalances[collateral] += amount;

        _mintInternal(msg.sender, collateral, amount);
    }

    function _mintInternal(
        address user,
        address collateral,
        uint256 amount
    ) internal {
        uint256 price = oracle.getPrice(collateral);
        uint8 dec = IERC20Metadata(collateral).decimals();

        uint256 usdValue = amount * price / (10 ** dec);
        uint256 btc1Out = usdValue * DECIMALS / MIN_COLLATERAL_RATIO;

        uint256 devFee = btc1Out * DEV_FEE_MINT / DECIMALS;
        uint256 endFee = btc1Out * ENDOWMENT_FEE_MINT / DECIMALS;

        btc1usd.mint(user, btc1Out);
        if (devFee > 0) btc1usd.mint(devWallet, devFee);
        if (endFee > 0) btc1usd.mint(endowmentWallet, endFee);

        emit Mint(user, collateral, amount, btc1Out);
    }

    /*//////////////////////////////////////////////////////////////
                                REDEEM
    //////////////////////////////////////////////////////////////*/

    /// @notice Single-tx redeem using ERC20Permit
    function redeemWithPermit(
        uint256 btc1Amount,
        address collateral,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external whenNotPaused validCollateral(collateral) {
        IERC20Permit(address(btc1usd)).permit(
            msg.sender,
            address(this),
            btc1Amount,
            deadline,
            v, r, s
        );

        _redeem(msg.sender, btc1Amount, collateral);
    }

    function _redeem(
        address user,
        uint256 btc1Amount,
        address collateral
    ) internal {
        require(!oracle.isStale(), "oracle stale");

        uint256 price = oracle.getPrice(collateral);
        uint8 dec = IERC20Metadata(collateral).decimals();

        uint256 collateralOut = btc1Amount * (10 ** dec) / price;
        uint256 devFee = collateralOut * DEV_FEE_REDEEM / DECIMALS;

        require(collateralBalances[collateral] >= collateralOut, "insufficient collateral");

        btc1usd.burnFrom(user, btc1Amount);

        collateralBalances[collateral] -= collateralOut;

        IERC20(collateral).safeTransfer(user, collateralOut - devFee);
        if (devFee > 0) IERC20(collateral).safeTransfer(devWallet, devFee);

        emit Redeem(user, collateral, btc1Amount, collateralOut);
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Get total USD value of all collateral in vault
    function getTotalCollateralValue() external view returns (uint256) {
        uint256 totalValue = 0;
        
        for (uint256 i = 0; i < collateralTokens.length; i++) {
            address token = collateralTokens[i];
            uint256 balance = collateralBalances[token];
            
            if (balance > 0) {
                uint256 price = oracle.getPrice(token);
                uint8 dec = IERC20Metadata(token).decimals();
                totalValue += balance * price / (10 ** dec);
            }
        }
        
        return totalValue;
    }

    /// @notice Get current collateral ratio (total collateral / total supply)
    function getCurrentCollateralRatio() external view returns (uint256) {
        uint256 totalSupply = btc1usd.totalSupply();
        if (totalSupply == 0) return 0;
        
        uint256 totalValue = 0;
        for (uint256 i = 0; i < collateralTokens.length; i++) {
            address token = collateralTokens[i];
            uint256 balance = collateralBalances[token];
            
            if (balance > 0) {
                uint256 price = oracle.getPrice(token);
                uint8 dec = IERC20Metadata(token).decimals();
                totalValue += balance * price / (10 ** dec);
            }
        }
        
        return totalValue * DECIMALS / totalSupply;
    }

    /// @notice Check if protocol is healthy (ratio >= minimum)
    function isHealthy() external view returns (bool) {
        uint256 totalSupply = btc1usd.totalSupply();
        if (totalSupply == 0) return true;
        
        uint256 totalValue = 0;
        for (uint256 i = 0; i < collateralTokens.length; i++) {
            address token = collateralTokens[i];
            uint256 balance = collateralBalances[token];
            
            if (balance > 0) {
                uint256 price = oracle.getPrice(token);
                uint8 dec = IERC20Metadata(token).decimals();
                totalValue += balance * price / (10 ** dec);
            }
        }
        
        uint256 ratio = totalValue * DECIMALS / totalSupply;
        return ratio >= MIN_COLLATERAL_RATIO;
    }
}
