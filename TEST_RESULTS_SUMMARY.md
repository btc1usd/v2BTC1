# 🔬 Collateral Ratio Test Results

## ✅ All Tests Passed (5/5)

Test file: `test/CollateralRatioVerification.test.js`

---

## 📊 TEST 1: Sequential Deposits - Same Collateral Type (WBTC)

### Three 1 BTC Deposits @ $100,000 each

| Deposit | Collateral Value | BTC1USD Supply | Collateral Ratio | CR Change |
|---------|-----------------|----------------|------------------|-----------|
| Start   | $0              | 0              | 120.00%          | -         |
| 1 BTC   | $100,000        | 84,250         | **118.69%** ⚠️   | -1.31%    |
| 2 BTC   | $200,000        | 168,500        | **118.69%** ⚠️   | 0.00%     |
| 3 BTC   | $300,000        | 252,750        | **118.69%** ⚠️   | 0.00%     |

### Key Findings:

1. **CR is constant at 118.69%** - Each deposit maintains the same ratio
2. **CR is BELOW 120% minimum** - Due to fee minting (1% dev + 0.1% endowment)
3. **Each deposit mints:**
   - User receives: 83,333.33 BTC1USD
   - Dev fee: 833.33 BTC1USD
   - Endowment fee: 83.33 BTC1USD
   - **Total: 84,250 BTC1USD** (from $100k collateral)

### Mathematical Verification:
```
CR = $100,000 ÷ 84,250 = 1.18694362x (118.69%) ✅ CONFIRMED
```

---

## 📊 TEST 2: Mixed Collateral Deposits (WBTC, cbBTC, tBTC)

### Deposits 4-6: 1 BTC of each collateral type

| Deposit | Token Type | User Received | CR After | Notes |
|---------|-----------|---------------|----------|-------|
| 4       | WBTC      | 83,333.33     | 118.69%  | Baseline |
| 5       | cbBTC     | 83,333.33     | 118.69%  | ✅ Same as WBTC |
| 6       | tBTC      | 83,333.33     | 118.69%  | ✅ Same as WBTC |

### Key Findings:

1. **All collateral types work identically** when prices are equal
2. **CR remains constant** regardless of collateral type
3. **Final state:** $600,000 collateral / 505,500 BTC1USD = 118.69% CR

---

## 🚨 TEST 3: BTC Price Drop Scenario

### 20% Price Drop ($100k → $80k)

| Metric | Before Drop | After Drop | Change |
|--------|------------|------------|---------|
| BTC Price | $100,000 | $80,000 | -20% |
| Total Collateral | $600,000 | $480,000 | -20% |
| Total Supply | 505,500 BTC1USD | 505,500 BTC1USD | 0% |
| **Collateral Ratio** | **118.69%** | **94.96%** 🔴 | **-20%** |

### 🔴 CRITICAL IMPACT:

- **Vault is UNDERCOLLATERALIZED** (94.96% < 120% minimum)
- **Shortfall:** 25.04% below minimum

### ⚠️ Stress Mode Redemption Activated:

```
Stress Redemption Value = CR × 0.90
                        = 94.96% × 0.90
                        = 85.46%

Loss per 100 BTC1USD = 100 - 85.46 = 14.54% loss
```

**Users redeeming during stress mode lose 14.54% of their value!**

---

## 📋 TEST 4: CR Formula Verification

### Formula: `CR = Total Collateral Value × DECIMALS ÷ Total Supply`

**Manual Calculation:**
```
CR = $480,000 × 1e8 ÷ 505,500e8
   = 48000000000000 × 100000000 ÷ 50550000000000
   = 0.94955489e8
   = 94.96%
```

**Contract Reported CR:** 94.96%

✅ **MATCH CONFIRMED** - Formula is correctly implemented

---

## 📊 TEST 5: Fee Impact Analysis - Why CR < 120%?

### Scenario: $100,000 BTC Deposit

**Expected (NO fees):**
```
Tokens minted = $100,000 ÷ 1.20 = 83,333.33 BTC1USD
CR = $100,000 ÷ 83,333.33 = 120% ✅
```

**Actual (WITH 1% dev + 0.1% endowment fees):**
```
User receives:     83,333.33 BTC1USD
Dev fee (1%):         833.33 BTC1USD
Endowment (0.1%):      83.33 BTC1USD
─────────────────────────────────────
TOTAL MINTED:      84,250.00 BTC1USD

CR = $100,000 ÷ 84,250 = 118.69% ⚠️
```

### Root Cause:

**Fee tokens (916.67 BTC1USD) are minted WITHOUT backing collateral**

This dilutes the CR by:
```
Dilution = 120% - 118.69% = 1.31%
```

**Per code comments (Vault.sol:20-23): This is BY DESIGN** ✅

---

## 🎯 Summary of Findings

### ✅ What Works Correctly:

1. **CR formula is accurate** - Matches manual calculations
2. **All collateral types are equal** - Same behavior for WBTC, cbBTC, tBTC
3. **CR stays constant** - Each deposit maintains the same ratio
4. **Math is consistent** - User receives correct token amounts

### ⚠️ Design Concerns:

1. **System starts undercollateralized** (118.69% < 120% minimum)
2. **Fee minting dilutes CR** by 1.31% on every deposit
3. **Any price drop amplifies undercollateralization**
4. **Stress mode creates user losses** (14.54% loss in 20% BTC drop)

### 🔴 Risk Assessment:

**Current Design:**
- Allows minting even when CR < 120%
- Relies on "stress mode" to handle undercollateralization
- Creates immediate user losses during price drops

**Example:**
- Deposit at BTC = $100k, CR = 118.69%
- BTC drops to $80k (-20%)
- CR drops to 94.96%
- Users lose 14.54% when redeeming

---

## 💡 Recommendations

### Option 1: Remove/Reduce Fees
```
No fees → CR = 120% (properly collateralized)
0.5% total fees → CR ≈ 119.4% (closer to minimum)
```

### Option 2: Increase Minimum CR
```
Set MIN_CR = 125% → Actual CR after fees = 123.7%
Provides buffer against price drops
```

### Option 3: Separate Fee Handling
```
Collect fees from collateral, not minted tokens
Maintains proper CR = 120%
```

### Option 4: Accept Current Design
```
Document clearly that system operates at 118.69% CR
Users accept stress mode risk
Consider insurance/reserve fund
```

---

## 📁 Test Files Created

1. `test/CollateralRatioVerification.test.js` - Full test suite
2. `COLLATERAL_RATIO_EXAMPLE.md` - Mathematical walkthrough
3. `TEST_RESULTS_SUMMARY.md` - This document

**Run tests:**
```bash
npx hardhat test test/CollateralRatioVerification.test.js
```
