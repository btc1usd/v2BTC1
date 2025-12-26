// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";

import "./interfaces/IBTC1USD.sol";
import "./interfaces/IPriceOracle.sol";
import "./interfaces/IPermit2.sol";

contract VaultUpgradeableWithPermit is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                                CONSTANTS
    //////////////////////////////////////////////////////////////*/

    uint256 public constant DECIMALS = 1e8;

    uint256 public constant MIN_COLLATERAL_RATIO        = 1.20e8;
    uint256 public constant MIN_COLLATERAL_RATIO_STABLE = 1.10e8;
    uint256 public constant STRESS_REDEMPTION_FACTOR    = 0.90e8;

    uint256 public constant DEV_FEE_MINT       = 0.01e8;   // 1%
    uint256 public constant DEV_FEE_REDEEM     = 0.001e8; // 0.1%
    uint256 public constant ENDOWMENT_FEE_MINT = 0.001e8; // 0.1%

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
        require(
            owner_ != address(0) &&
            btc1_ != address(0) &&
            oracle_ != address(0) &&
            dev_ != address(0) &&
            endowment_ != address(0),
            "zero address"
        );

        __Ownable_init(owner_);
        __ReentrancyGuard_init();

        btc1usd = IBTC1USD(btc1_);
        oracle = IPriceOracle(oracle_);
        devWallet = dev_;
        endowmentWallet = endowment_;
    }

    /*//////////////////////////////////////////////////////////////
                                ADMIN
    //////////////////////////////////////////////////////////////*/

    function addCollateral(address token) external onlyOwner {
        require(token != address(0), "zero token");
        require(!supportedCollateral[token], "already added");

        supportedCollateral[token] = true;
        collateralTokens.push(token);

        emit CollateralAdded(token);
    }

    function removeCollateral(address token) external onlyOwner {
        require(collateralBalances[token] == 0, "accounting balance not zero");
        require(IERC20(token).balanceOf(address(this)) == 0, "actual balance not zero");

        supportedCollateral[token] = false;

        // FIX: swap & pop to prevent array bloat
        uint256 len = collateralTokens.length;
        for (uint256 i = 0; i < len; i++) {
            if (collateralTokens[i] == token) {
                collateralTokens[i] = collateralTokens[len - 1];
                collateralTokens.pop();
                break;
            }
        }

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
                        INTERNAL HELPERS
    //////////////////////////////////////////////////////////////*/

    function _getTotalCollateralValueInternal() internal view returns (uint256 totalValue) {
        for (uint256 i = 0; i < collateralTokens.length; i++) {
            address token = collateralTokens[i];
            uint256 bal = collateralBalances[token];
            if (bal == 0) continue;

            uint256 price = oracle.getPrice(token);
            require(price > 0, "oracle price zero");

            uint8 dec = IERC20Metadata(token).decimals();
            totalValue += bal * price / (10 ** dec);
        }
    }

    /*//////////////////////////////////////////////////////////////
                                MINT
    //////////////////////////////////////////////////////////////*/

    function mintWithPermit2(
        address collateral,
        uint256 amount,
        IPermit2.PermitTransferFrom calldata permit,
        bytes calldata signature
    ) external whenNotPaused validCollateral(collateral) nonReentrant {
        require(amount > 0, "zero amount");
        require(!oracle.isStale(), "oracle stale");
        require(permit.permitted.token == collateral, "token mismatch");
        require(permit.permitted.amount >= amount, "permit too small");
        require(permit.deadline >= block.timestamp, "permit expired");

        // FIX: compute CR BEFORE adding new collateral
        uint256 prevUSD = _getTotalCollateralValueInternal();
        uint256 prevSupply = btc1usd.totalSupply();

        uint256 prevCR = prevSupply == 0
            ? MIN_COLLATERAL_RATIO
            : (prevUSD * DECIMALS) / prevSupply;

        uint256 mintPrice = prevCR >= MIN_COLLATERAL_RATIO
            ? prevCR
            : MIN_COLLATERAL_RATIO;

        uint256 price = oracle.getPrice(collateral);
        require(price > 0, "oracle price zero");

        uint8 dec = IERC20Metadata(collateral).decimals();
        uint256 usdValue = amount * price / (10 ** dec);
        uint256 grossMint = usdValue * DECIMALS / mintPrice;

        // FIX: fees deducted from user mint (no unbacked BTC1)
        uint256 devFee = grossMint * DEV_FEE_MINT / DECIMALS;
        uint256 endFee = grossMint * ENDOWMENT_FEE_MINT / DECIMALS;
        uint256 userMint = grossMint - devFee - endFee;

        // Pull collateral AFTER calculations
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

        btc1usd.mint(msg.sender, userMint);
        if (devFee > 0) btc1usd.mint(devWallet, devFee);
        if (endFee > 0) btc1usd.mint(endowmentWallet, endFee);

        emit Mint(msg.sender, collateral, amount, userMint);
    }

    /*//////////////////////////////////////////////////////////////
                                REDEEM
    //////////////////////////////////////////////////////////////*/

    function redeemWithPermit(
        uint256 btc1Amount,
        address collateral,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external whenNotPaused validCollateral(collateral) nonReentrant {
        require(btc1Amount > 0, "zero amount");

        IERC20Permit(address(btc1usd)).permit(
            msg.sender,
            address(this),
            btc1Amount,
            deadline,
            v, r, s
        );

        _redeem(msg.sender, btc1Amount, collateral);
    }

    function _redeem(address user, uint256 btc1Amount, address collateral) internal {
        require(!oracle.isStale(), "oracle stale");

        uint256 prevUSD = _getTotalCollateralValueInternal();
        uint256 prevSupply = btc1usd.totalSupply();

        uint256 prevCR = prevSupply == 0
            ? MIN_COLLATERAL_RATIO
            : (prevUSD * DECIMALS) / prevSupply;

        uint256 usdValue;
        if (prevCR >= MIN_COLLATERAL_RATIO_STABLE) {
            usdValue = btc1Amount;
        } else {
            uint256 stressPrice = prevCR * STRESS_REDEMPTION_FACTOR / DECIMALS;
            usdValue = btc1Amount * stressPrice / DECIMALS;
        }

        uint256 price = oracle.getPrice(collateral);
        require(price > 0, "oracle price zero");

        uint8 dec = IERC20Metadata(collateral).decimals();
        uint256 collateralOut = usdValue * (10 ** dec) / price;

        uint256 devFee = collateralOut * DEV_FEE_REDEEM / DECIMALS;
        uint256 sendAmount = collateralOut - devFee;

        require(collateralBalances[collateral] >= collateralOut, "insufficient collateral");

        if (prevCR >= MIN_COLLATERAL_RATIO && prevSupply > btc1Amount) {
            uint256 newUSD = prevUSD - (collateralOut * price / (10 ** dec));
            uint256 newSupply = prevSupply - btc1Amount;
            require(newUSD * DECIMALS / newSupply >= MIN_COLLATERAL_RATIO, "breaks min CR");
        }

        btc1usd.burnFrom(user, btc1Amount);
        collateralBalances[collateral] -= collateralOut;

        IERC20(collateral).safeTransfer(user, sendAmount);
        if (devFee > 0) IERC20(collateral).safeTransfer(devWallet, devFee);

        emit Redeem(user, collateral, btc1Amount, collateralOut);
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function getTotalCollateralValue() external view returns (uint256) {
        return _getTotalCollateralValueInternal();
    }

    function getCurrentCollateralRatio() external view returns (uint256) {
        uint256 supply = btc1usd.totalSupply();
        if (supply == 0) return 0;
        return _getTotalCollateralValueInternal() * DECIMALS / supply;
    }

    function isHealthy() external view returns (bool) {
        uint256 supply = btc1usd.totalSupply();
        if (supply == 0) return true;
        return _getTotalCollateralValueInternal() * DECIMALS / supply >= MIN_COLLATERAL_RATIO;
    }
}
