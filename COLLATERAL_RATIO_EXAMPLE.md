# Collateral Ratio & Minting Price - Step-by-Step Example

## Setup
- **BTC Price**: $100,000 (100000e8 in 8 decimals)
- **WBTC decimals**: 8
- **1 BTC deposit**: 1e8 WBTC units = 100,000,000 units
- **MIN_COLLATERAL_RATIO**: 1.20e8 = 120%
- **DEV_FEE_MINT**: 0.01e8 = 1%
- **ENDOWMENT_FEE_MINT**: 0.001e8 = 0.1%

---

## 📊 DEPOSIT 1: First 1 BTC

### Before Deposit
```
Total Collateral Value:  $0
Total BTC1USD Supply:    0 BTC1USD
Current CR:              120% (default when supply = 0)
```

### Mint Calculation (Vault.sol:200-248)

**Step 1:** Calculate previous mint price
```solidity
prevTotalUSD = 0
prevTotalSupply = 0
prevMintPrice = _priceFromSnapshot(0, 0) = MIN_COLLATERAL_RATIO = 1.20e8
```

**Step 2:** Deposit collateral
```solidity
depositAmount = 1e8 (1 BTC)
collateralBalances[WBTC] = 1e8
```

**Step 3:** Calculate USD value
```solidity
usdValue = depositAmount × tokenPrice ÷ 10^tokenDecimals
         = 1e8 × 100000e8 ÷ 1e8
         = 100000e8 ($100,000)
```

**Step 4:** Calculate tokens to mint using PREVIOUS mint price
```solidity
// Using FixedPoint8: multiply = (a × b) ÷ 1e8, divide = (a × 1e8) ÷ b
tokensToMint = usdValue.multiply(DECIMALS).divide(prevMintPrice)
             = (100000e8 × 1e8 ÷ 1e8) × 1e8 ÷ 1.20e8
             = 100000e8 × 1e8 ÷ 1.20e8
             = 10000000000000000 ÷ 120000000
             = 83333.33333333 BTC1USD (83333_33333333 in 8 decimals)
```

**Step 5:** Calculate fees
```solidity
devFeeTokens = tokensToMint × DEV_FEE_MINT ÷ DECIMALS
             = 83333_33333333 × 0.01e8 ÷ 1e8
             = 833.33333333 BTC1USD (833_33333333)

endowmentFeeTokens = tokensToMint × ENDOWMENT_FEE_MINT ÷ DECIMALS
                   = 83333_33333333 × 0.001e8 ÷ 1e8
                   = 83.33333333 BTC1USD (83_33333333)

totalToMint = 83333_33333333 + 833_33333333 + 83_33333333
            = 84250.00000000 BTC1USD (84250_00000000)
```

**Step 6:** Mint tokens
```
✅ User receives:         83,333.33333333 BTC1USD
✅ Dev wallet receives:      833.33333333 BTC1USD
✅ Endowment receives:        83.33333333 BTC1USD
```

**Step 7:** Update mint price for NEXT mint
```solidity
currTotalUSD = getTotalCollateralValue()
             = 1e8 × 100000e8 ÷ 1e8
             = 100000e8 ($100,000)

currTotalSupply = btc1usd.totalSupply()
                = 84250e8

// Calculate new mint price
calculated_price = currTotalUSD × DECIMALS ÷ currTotalSupply
                 = 100000e8 × 1e8 ÷ 84250e8
                 = 1.1869436202e8 (118.69%)

// But _priceFromSnapshot returns max(calculated, MIN_CR)
lastMintPrice = max(1.1869e8, 1.20e8) = 1.20e8 (120%)
```

### After Deposit 1
```
Total Collateral Value:  $100,000
Total BTC1USD Supply:    84,250 BTC1USD
Actual CR:               100000 ÷ 84250 = 118.69% ⚠️
Mint Price (for next):   120% (protected by MIN_CR)
```

**⚠️ IMPORTANT:** CR is below 120% minimum! But minting is allowed by design.

---

## 📊 DEPOSIT 2: Second 1 BTC

### Before Deposit
```
Total Collateral Value:  $100,000
Total BTC1USD Supply:    84,250 BTC1USD
Current CR:              118.69%
```

### Mint Calculation

**Step 1:** Calculate previous mint price
```solidity
prevTotalUSD = 100000e8
prevTotalSupply = 84250e8
prevMintPrice = _priceFromSnapshot(100000e8, 84250e8)
              = max(100000e8 × 1e8 ÷ 84250e8, 1.20e8)
              = max(1.1869e8, 1.20e8)
              = 1.20e8 (120%)
```

**Step 2-6:** Same calculations as Deposit 1
```
tokensToMint = 83,333.33333333 BTC1USD
totalToMint = 84,250.00000000 BTC1USD
```

**Step 7:** Update mint price
```solidity
currTotalUSD = 2e8 × 100000e8 ÷ 1e8 = 200000e8 ($200,000)
currTotalSupply = 84250e8 + 84250e8 = 168500e8

calculated_price = 200000e8 × 1e8 ÷ 168500e8 = 1.1869e8 (118.69%)
lastMintPrice = max(1.1869e8, 1.20e8) = 1.20e8 (120%)
```

### After Deposit 2
```
Total Collateral Value:  $200,000
Total BTC1USD Supply:    168,500 BTC1USD
Actual CR:               118.69% ⚠️ (SAME AS BEFORE!)
Mint Price (for next):   120%
```

---

## 📊 DEPOSIT 3: Third 1 BTC

### After Deposit 3
```
Total Collateral Value:  $300,000
Total BTC1USD Supply:    252,750 BTC1USD
Actual CR:               118.69% ⚠️ (STILL THE SAME!)
Mint Price (for next):   120%
```

---

## 🔍 Key Findings

### 1. **CR Stays Constant at 118.69%**
The collateral ratio doesn't increase with more deposits because:
```
CR = Total Collateral ÷ Total Supply
   = (n × $100,000) ÷ (n × 84,250)
   = $100,000 ÷ 84,250
   = 118.69% (constant)
```

### 2. **Why CR < 120% Minimum?**
Because of fee minting:
```
$100,000 collateral ÷ 120% mint price = 83,333.33 tokens (fair)
But we also mint 1.1% in fees = +916.67 tokens
Total minted = 84,250 tokens
Actual CR = $100,000 ÷ 84,250 = 118.69% ❌
```

### 3. **Mint Price Protected by MIN_CR**
Even though actual CR is 118.69%, the mint price uses 120% because:
```solidity
lastMintPrice = max(calculated_CR, MIN_COLLATERAL_RATIO)
              = max(118.69%, 120%)
              = 120%
```

This prevents CR from dropping further!

---

## 🚨 What Happens if BTC Price Drops?

### Scenario: BTC drops to $80,000 (-20%)

```
Total Collateral Value:  3 BTC × $80,000 = $240,000
Total BTC1USD Supply:    252,750 BTC1USD
Actual CR:               $240,000 ÷ 252,750 = 94.95% 🔴

This is BELOW the minimum 120%!
Vault is now undercollateralized!
```

### Stress Mode Redemption Kicks In
From Vault.sol redemption logic:
- Normal redemption: 1 BTC1USD = 1/CR worth of collateral
- Stress mode (CR < MIN_CR): Users get 90% of CR
```
Stress redemption value = 94.95% × 0.90 = 85.45%
User burns 100 BTC1USD → receives $85.45 worth of BTC
```

This creates a **bank run risk** where redeemers get less value!

---

## ✅ Conclusion

### Your Question: "Does adding collateral increase CR?"

**Answer: NO!** Adding collateral through `mint()` keeps CR constant (or decreases it if fees change).

### Why?
- You deposit $X of collateral
- You receive $X/1.20 worth of tokens (at 120% mint price)
- Protocol mints additional 1.1% in fees
- **Result:** CR = $X ÷ ($X/1.20 + fees) = ~118.69%

### Is This Correct?
From code comments: **YES, by design** (Vault.sol:20-23)
```
"Protocol design allows CR to drop below MIN_CR during mints
due to fee token minting"
```

### Risks
1. ⚠️ System starts undercollateralized (118.69% < 120%)
2. 🔴 Any BTC price drop makes it worse
3. 💸 Stress mode redemptions create loss for users

### How to Actually Increase CR
1. **Donate collateral** (no minting) - needs separate function
2. **Burn tokens** without withdrawing collateral
3. **Reduce/eliminate minting fees**
4. **Over-collateralize** by minting fewer tokens per deposit
