// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../../interfaces/IBTC1USD.sol";
import "../../interfaces/IPriceOracle.sol";
import "../../libraries/SafeMath.sol";
import "../../libraries/FixedPoint8.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/**
 * @title Vault - Fixed Version
 * @notice Collateralized vault for minting/redeeming BTC1USD with security fixes
 * 
 * AUDIT FIXES APPLIED:
 * - HIGH-04: Added oracle staleness checks before using prices
 * - HIGH-05: Added zero address validation for devWallet and endowmentWallet in constructor
 * - HIGH-05: Added zero address checks in setDevWallet and setEndowmentWallet
 * 
 * DESIGN NOTE:
 * - Post-mint CR check intentionally kept disabled (lines 204-213)
 * - Protocol design allows CR to drop below MIN_CR during mints due to fee token minting
 * - Stress mode on redemption (0.90 × CR) handles under-collateralization scenarios
 * - Users can mint anytime without waiting for CR to rise
 */
contract Vault {
    using SafeMath for uint256;
    using FixedPoint8 for uint256;
    using SafeERC20 for IERC20;

    // ===== Constants (8-decimal fixed point) =====
    uint256 public constant MIN_COLLATERAL_RATIO      = 1.20e8;   // 120%
    uint256 public constant MIN_COLLATERAL_RATIO_STABLE = 1.10e8;   // 110%
    
    uint256 public constant STRESS_REDEMPTION_FACTOR  = 0.90e8;   // 90%
    uint256 public constant DEV_FEE_MINT              = 0.01e8;   // 1.00%
    uint256 public constant DEV_FEE_REDEEM            = 0.001e8;  // 0.10%
    uint256 public constant ENDOWMENT_FEE_MINT        = 0.001e8;  // 0.10%
    uint256 private constant DECIMALS                 = 1e8;

    // ===== Core contracts =====
    IBTC1USD public btc1usd;
    IPriceOracle public priceOracle;

    // ===== Collateral management =====
    address[] public collateralTokens;
    mapping(address => bool) public supportedCollateral;
    mapping(address => uint256) public collateralBalances;

    // ===== Addresses / state =====
    address public admin;
    address public devWallet;
    address public endowmentWallet;
    bool public paused;

    uint256 public lastMintPrice;
    event MintPriceUpdated(uint256 newMintPrice);

    // ===== Events =====
    event Mint(address indexed user, uint256 collateralDeposited, uint256 tokensIssued, address collateralToken);
    event Redeem(address indexed user, uint256 tokensRedeemed, uint256 collateralReturned, address collateralToken);
    event CollateralAdded(address indexed token);
    event CollateralRemoved(address indexed token);
    event EmergencyPause();
    event EmergencyUnpause();
    event DevWalletSet(address indexed newDev);
    event EndowmentWalletSet(address indexed newEndowment);

    // ===== Modifiers =====
    modifier onlyAdmin() {
        require(msg.sender == admin, "Vault: caller is not admin");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Vault: paused");
        _;
    }

    modifier validCollateral(address token) {
        require(supportedCollateral[token], "Vault: unsupported collateral");
        _;
    }

    // ===== Constructor =====
    constructor(
        address _btc1usd,
        address _priceOracle,
        address _admin,
        address _devWallet,
        address _endowmentWallet
    ) {
        require(_btc1usd != address(0) && _priceOracle != address(0) && _admin != address(0), "Vault: zero addr");
        // FIXED: Added zero address checks for wallets
        require(_devWallet != address(0), "Vault: dev wallet is zero address");
        require(_endowmentWallet != address(0), "Vault: endowment wallet is zero address");
        
        btc1usd = IBTC1USD(_btc1usd);
        priceOracle = IPriceOracle(_priceOracle);
        admin = _admin;
        devWallet = _devWallet;
        endowmentWallet = _endowmentWallet;

        lastMintPrice = MIN_COLLATERAL_RATIO;
        emit MintPriceUpdated(lastMintPrice);
    }

    // ===== Admin functions =====
    function addCollateral(address token) external onlyAdmin {
        require(!supportedCollateral[token], "Vault: already supported");
        supportedCollateral[token] = true;
        collateralTokens.push(token);
        emit CollateralAdded(token);
    }

    function removeCollateral(address token) external onlyAdmin {
        require(supportedCollateral[token], "Vault: not supported");
        require(collateralBalances[token] == 0, "Vault: collateral has balance");

        for (uint i = 0; i < collateralTokens.length; i++) {
            if (collateralTokens[i] == token) {
                collateralTokens[i] = collateralTokens[collateralTokens.length - 1];
                collateralTokens.pop();
                break;
            }
        }

        supportedCollateral[token] = false;
        emit CollateralRemoved(token);
    }

    function emergencyPause() external onlyAdmin {
        paused = true;
        emit EmergencyPause();
    }

    function emergencyUnpause() external onlyAdmin {
        paused = false;
        emit EmergencyUnpause();
    }

    // FIXED: Added zero address check
    function setDevWallet(address _devWallet) external onlyAdmin {
        require(_devWallet != address(0), "Vault: dev wallet is zero address");
        devWallet = _devWallet;
        emit DevWalletSet(_devWallet);
    }

    // FIXED: Added zero address check
    function setEndowmentWallet(address _endowmentWallet) external onlyAdmin {
        require(_endowmentWallet != address(0), "Vault: endowment wallet is zero address");
        endowmentWallet = _endowmentWallet;
        emit EndowmentWalletSet(_endowmentWallet);
    }

    // ===== Core utility: dynamic vault valuation =====
    function getTotalCollateralValue() public view returns (uint256 totalValue) {
        for (uint i = 0; i < collateralTokens.length; i++) {
            address token = collateralTokens[i];
            uint256 amount = collateralBalances[token];
            if (amount == 0) continue;

            uint8 tokenDecimals = IERC20Metadata(token).decimals();
            uint256 price = priceOracle.getPrice(token);

            totalValue = totalValue.add(amount.mul(price).div(10 ** tokenDecimals));
        }
    }

    function getCurrentCollateralRatio() public view returns (uint256) {
        uint256 totalSupply = btc1usd.totalSupply();
        if (totalSupply == 0) return MIN_COLLATERAL_RATIO;
        uint256 totalCollateralUSD = getTotalCollateralValue();
        return totalCollateralUSD.multiply(DECIMALS).divide(totalSupply);
    }

    function _priceFromSnapshot(uint256 totalUSD8, uint256 supply8) internal pure returns (uint256) {
        if (supply8 == 0) return MIN_COLLATERAL_RATIO;
        uint256 p = totalUSD8.multiply(DECIMALS).divide(supply8);
        return p > MIN_COLLATERAL_RATIO ? p : MIN_COLLATERAL_RATIO;
    }

    // ===== Mint: strictly use PREVIOUS mint price, then update price for NEXT mint =====
    function mint(address collateralToken, uint256 depositAmount)
        external
        whenNotPaused
        validCollateral(collateralToken)
    {
        require(depositAmount > 0, "Vault: amount must be > 0");
        require(devWallet != address(0) && endowmentWallet != address(0), "Vault: wallets not set");
        
        // FIXED: Check oracle staleness before using price
        require(!priceOracle.isStale(), "Vault: oracle price is stale");

        // --- 1) Snapshot previous state (before deposit) ---
        uint256 prevTotalUSD     = getTotalCollateralValue();
        uint256 prevTotalSupply  = btc1usd.totalSupply();
        uint256 prevMintPrice    = _priceFromSnapshot(prevTotalUSD, prevTotalSupply);

        // --- 2) Pull collateral into the vault ---
        IERC20(collateralToken).safeTransferFrom(msg.sender, address(this), depositAmount);

        // --- 3) Update accounting for chosen collateral ---
        collateralBalances[collateralToken] = collateralBalances[collateralToken].add(depositAmount);

        // --- 4) USD value of this deposit (USD-8) based on oracle ---
        uint256 tokenPrice = priceOracle.getPrice(collateralToken);
        uint8 tokenDecimals = IERC20Metadata(collateralToken).decimals();
        uint256 usdValue = depositAmount.mul(tokenPrice).div(10 ** tokenDecimals);

        // --- 5) Compute tokens to mint using *previous* mint price ---
        uint256 tokensToMint = usdValue.multiply(DECIMALS).divide(prevMintPrice);

        // --- 6) Fees (in BTC1USD 8-dec) ---
        uint256 devFeeTokens        = tokensToMint.multiply(DEV_FEE_MINT).divide(DECIMALS);
        uint256 endowmentFeeTokens  = tokensToMint.multiply(ENDOWMENT_FEE_MINT).divide(DECIMALS);
        uint256 totalToMint         = tokensToMint.add(devFeeTokens).add(endowmentFeeTokens);

        // --- 7) Enforce post-mint CR >= MIN_CR (except first mint) ---
        // INTENTIONALLY DISABLED: Protocol design allows CR to drop below MIN_CR during mint
        // due to fee token minting. Stress mode on redemption handles under-collateralization.
        // if (prevTotalSupply > 0) {
        //     uint256 newTotalUSD    = prevTotalUSD.add(usdValue);
        //     uint256 newTotalSupply = prevTotalSupply.add(totalToMint);
        //     uint256 newCR          = newTotalUSD.multiply(DECIMALS).divide(newTotalSupply);
        //     require(newCR >= MIN_COLLATERAL_RATIO, "Vault: would break minimum collateral ratio");
        // }

        // --- 8) Mint tokens (user + fee recipients) ---
        btc1usd.mint(msg.sender, tokensToMint);
        if (devFeeTokens > 0) btc1usd.mint(devWallet, devFeeTokens);
        if (endowmentFeeTokens > 0) btc1usd.mint(endowmentWallet, endowmentFeeTokens);

        emit Mint(msg.sender, depositAmount, tokensToMint, collateralToken);

        // --- 9) Update mint price for the NEXT mint (based on post-mint state) ---
        {
            uint256 currTotalUSD    = getTotalCollateralValue();
            uint256 currTotalSupply = btc1usd.totalSupply();
            uint256 newMintPrice    = _priceFromSnapshot(currTotalUSD, currTotalSupply);
            lastMintPrice = newMintPrice;
            emit MintPriceUpdated(newMintPrice);
        }
    }

    // ===== Redeem: keep using PREVIOUS ratio snapshot logic =====
    function redeem(uint256 tokenAmount, address collateralToken)
        external
        whenNotPaused
        validCollateral(collateralToken)
    {
        require(tokenAmount > 0, "Vault: amount must be > 0");
        require(btc1usd.balanceOf(msg.sender) >= tokenAmount, "Vault: insufficient token balance");
        
        // FIXED: Check oracle staleness before using price
        require(!priceOracle.isStale(), "Vault: oracle price is stale");

        // --- 1) Snapshot previous state (before burn) ---
        uint256 prevTotalUSD    = getTotalCollateralValue();
        uint256 prevTotalSupply = btc1usd.totalSupply();
        uint256 prevCR          = prevTotalSupply == 0
                                  ? MIN_COLLATERAL_RATIO
                                  : prevTotalUSD.multiply(DECIMALS).divide(prevTotalSupply);

        // --- 2) Compute collateral amount using previous state ---
        uint256 tokenPrice = priceOracle.getPrice(collateralToken);
        uint8 tokenDecimals = IERC20Metadata(collateralToken).decimals();

        uint256 collateralAmount;
        if (prevCR >= MIN_COLLATERAL_RATIO_STABLE) {
            uint256 collateralUSD8 = tokenAmount;
            collateralAmount = collateralUSD8.mul(10 ** tokenDecimals).div(tokenPrice);
        } else {
            uint256 stressUSDperToken8 = prevCR.multiply(STRESS_REDEMPTION_FACTOR).divide(DECIMALS);
            uint256 usdValue8 = tokenAmount.multiply(stressUSDperToken8).divide(DECIMALS);
            collateralAmount = usdValue8.mul(10 ** tokenDecimals).div(tokenPrice);
        }

        // --- 3) Apply dev fee on collateral ---
        uint256 devFee = collateralAmount.multiply(DEV_FEE_REDEEM).divide(DECIMALS);
        uint256 sendAmount = collateralAmount.sub(devFee);

        // --- 4) Ensure sufficient collateral of selected token ---
        require(collateralBalances[collateralToken] >= collateralAmount, "Vault: insufficient collateral");

        // --- 5) If healthy before, ensure redemption doesn't break MIN_CR ---
        if (prevTotalSupply > 0 && prevCR >= MIN_COLLATERAL_RATIO) {
            uint256 usdRedeemed8 = collateralAmount.mul(tokenPrice).div(10 ** tokenDecimals);
            uint256 newUSD    = prevTotalUSD.sub(usdRedeemed8);
            uint256 newSupply = prevTotalSupply.sub(tokenAmount);
            if (newSupply > 0) {
                uint256 newCR = newUSD.multiply(DECIMALS).divide(newSupply);
                require(newCR >= MIN_COLLATERAL_RATIO, "Vault: redemption would break min CR");
            }
        }

        // --- 6) Burn BTC1USD and transfer collateral ---
        btc1usd.burn(msg.sender, tokenAmount);

        collateralBalances[collateralToken] = collateralBalances[collateralToken].sub(collateralAmount);
        IERC20(collateralToken).safeTransfer(msg.sender, sendAmount);
        if (devFee > 0) IERC20(collateralToken).safeTransfer(devWallet, devFee);

        emit Redeem(msg.sender, tokenAmount, sendAmount, collateralToken);

        // (Optional) Refresh lastMintPrice after redemption for observability
        {
            uint256 currTotalSupply = btc1usd.totalSupply();
            uint256 newMintPrice = _priceFromSnapshot(getTotalCollateralValue(), currTotalSupply);
            lastMintPrice = newMintPrice;
            emit MintPriceUpdated(newMintPrice);
        }
    }

    // ===== Views & helpers =====
    function getSupportedCollateral() external view returns (address[] memory) {
        return collateralTokens;
    }

    function isHealthy() external view returns (bool) {
        uint256 totalSupply = btc1usd.totalSupply();
        if (totalSupply == 0) return true;
        uint256 ratio = getTotalCollateralValue().multiply(DECIMALS).divide(totalSupply);
        return ratio >= MIN_COLLATERAL_RATIO;
    }

    function getCollateralBalance(address token) external view returns (uint256) {
        return collateralBalances[token];
    }
}
