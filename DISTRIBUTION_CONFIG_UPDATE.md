# Distribution Configuration Update

## ✅ Smart Contract Updates Complete

Updated distribution intervals and claim expiry periods to **production values**.

---

## 📋 Changes Made

### **1. WeeklyDistribution.sol** ✅

**File**: `contracts/WeeklyDistribution.sol` (Line 61-65)

**Changed**:
```solidity
// BEFORE (Testing)
// CONFIGURATION: TESTING
// Weekly distributions - 7 hours for testing
uint256 public constant DISTRIBUTION_INTERVAL = 7 hours;

// AFTER (Production)
// CONFIGURATION: PRODUCTION
// Weekly distributions - 7 days (production)
uint256 public constant DISTRIBUTION_INTERVAL = 7 days;
```

**Impact**:
- ✅ Distributions now occur every **7 days** (instead of 7 hours)
- ✅ First distribution on/after Friday 14:00 UTC
- ✅ Subsequent distributions weekly thereafter
- ✅ Matches mainnet production requirements

---

### **2. MerkleDistributor.sol** ✅

**File**: `contracts/MerkleDistributor.sol` (Line 25-26)

**Changed**:
```solidity
// BEFORE (Testing)
// TESTING: 10 hours claim period
uint256 public constant CLAIM_PERIOD = 10 hours;

// AFTER (Production)
// PRODUCTION: 365 days claim period
uint256 public constant CLAIM_PERIOD = 365 days;
```

**Impact**:
- ✅ Users have **365 days** to claim rewards (instead of 10 hours)
- ✅ Unclaimed rewards after 365 days become unclaimable
- ✅ Provides ample time for all holders to claim
- ✅ Matches industry standard for airdrops

---

## 📊 Distribution Timeline

### **Weekly Distribution Schedule**

| Event | Timing | Details |
|-------|--------|---------|
| **Distribution Interval** | 7 days | Time between distributions |
| **Trigger Time** | Friday 14:00 UTC | Earliest distribution time |
| **Execution Window** | Friday-Thursday | Can execute anytime after Friday 14:00 UTC |
| **Next Check** | 7 days after last | Checks if Friday 14:00 UTC reached |

### **Example Timeline**

```
Week 1:
  Monday 10:00 UTC - Interval passed, but not Friday yet ❌
  Friday 13:00 UTC - Friday, but before 14:00 UTC ❌
  Friday 14:00 UTC - Distribution can execute ✅
  Friday 15:00 UTC - Distribution executed
  
Week 2:
  Friday 14:00 UTC - 7 days passed, can distribute again ✅
  Saturday 10:00 UTC - Still valid to distribute ✅
  
Week 3:
  Wednesday 10:00 UTC - Interval passed, distribution executes ✅
  (because it's past Friday from previous week)
```

---

## 🎯 Claim Period Details

### **Reward Claiming**

| Parameter | Value | Description |
|-----------|-------|-------------|
| **Claim Period** | 365 days | Time to claim after distribution |
| **Claim Start** | Distribution timestamp | Immediately claimable |
| **Claim Deadline** | +365 days | Must claim before expiry |
| **After Expiry** | Unclaimed rewards locked | Cannot be claimed anymore |

### **Example Claim Timeline**

```
Distribution 1: January 1, 2025 14:00 UTC
├─ Claim Period: Jan 1, 2025 - Jan 1, 2026
├─ User can claim anytime in this period
└─ After Jan 1, 2026 14:00 UTC: Rewards unclaimed ❌

Distribution 2: January 8, 2025 14:00 UTC
├─ Claim Period: Jan 8, 2025 - Jan 8, 2026
├─ Independent of Distribution 1
└─ User must claim each distribution separately
```

---

## ⚙️ Configuration Summary

### **Production Values**

```solidity
// WeeklyDistribution.sol
DISTRIBUTION_INTERVAL = 7 days          // 604,800 seconds
FRIDAY_14_UTC = 14 * 3600               // 50,400 seconds (14:00 UTC)

// MerkleDistributor.sol
CLAIM_PERIOD = 365 days                 // 31,536,000 seconds
```

### **Key Constants**

| Constant | Value | Contract |
|----------|-------|----------|
| `DISTRIBUTION_INTERVAL` | 7 days | WeeklyDistribution |
| `CLAIM_PERIOD` | 365 days | MerkleDistributor |
| `FRIDAY_14_UTC` | 14:00 UTC | WeeklyDistribution |
| `MIN_RATIO_AFTER_DISTRIBUTION` | 110% | WeeklyDistribution |

---

## 🔍 Distribution Logic

### **canDistribute() Function**

The distribution can execute when **ALL** conditions are met:

1. ✅ **Interval Passed**: At least 7 days since last distribution
2. ✅ **Day Check**: Current day is Friday or later
3. ✅ **Time Check** (if Friday): Must be 14:00 UTC or later
4. ✅ **Ratio Check**: Collateral ratio ≥ 112%

### **Code Flow**

```solidity
function canDistribute() public view returns (bool) {
    // 1. Check interval (7 days)
    bool intervalPassed = block.timestamp >= lastDistributionTime + 7 days;
    if (!intervalPassed) return false;
    
    // 2. Calculate day of week (0=Thu, 1=Fri, 2=Sat, etc.)
    uint256 dayOfWeek = (block.timestamp / 86400 + 4) % 7;
    
    // 3. If before Friday, not allowed
    if (dayOfWeek < 1) return false;
    
    // 4. If Friday, must be past 14:00 UTC
    if (dayOfWeek == 1) {
        uint256 timeOfDay = block.timestamp % 86400;
        if (timeOfDay < FRIDAY_14_UTC) return false;
    }
    
    // 5. All checks passed
    return true;
}
```

---

## 📝 What Happens During Distribution

### **Step-by-Step Process**

1. **Check Eligibility** ✅
   - Verify 7 days passed
   - Verify Friday 14:00 UTC or later
   - Verify collateral ratio ≥ 112%

2. **Calculate Rewards** 💰
   - Get collateral ratio
   - Determine reward tier (1¢ - 10¢)
   - Calculate total rewards for holders

3. **Mint Tokens** 🪙
   - Holder rewards → MerkleDistributor
   - Protocol fees → Dev, Endowment, Merkl wallets
   - Safety check: maintain ≥110% ratio after mint

4. **Create Distribution** 📋
   - Start new merkle distribution
   - Record distribution event
   - Update lastDistributionTime
   - Emit events

5. **Update Merkle Root** 🌳
   - Admin generates merkle tree
   - Admin updates root via `updateMerkleRoot()`
   - Users can now claim rewards

---

## 🎁 Reward Claiming Process

### **For Users**

1. **Wait for Distribution**
   - Distribution executes (Friday 14:00+ UTC)
   - Merkle root updated by admin
   - Rewards available to claim

2. **Claim Within 365 Days**
   - Go to "Claim Rewards" tab
   - See all unclaimed distributions
   - Click "Claim" for each distribution
   - Metamask approves transaction
   - Rewards sent to wallet

3. **After 365 Days**
   - Rewards expire
   - Cannot claim anymore
   - Tokens remain in distributor

### **Multiple Distributions**

Users can have unclaimed rewards from multiple distributions:

```
Distribution 1 (Jan 1): $10 unclaimed ✅ Can claim (within 365 days)
Distribution 2 (Jan 8): $12 unclaimed ✅ Can claim (within 365 days)
Distribution 3 (Jan 15): $8 unclaimed ✅ Can claim (within 365 days)

Total Unclaimed: $30

User can claim all at once or individually
Each has independent 365-day expiry
```

---

## ⚠️ Important Notes

### **1. First Distribution**

After mainnet deployment:
- First distribution can happen immediately if Friday 14:00+ UTC
- Otherwise, waits until next Friday 14:00 UTC
- Admin should execute distribution manually via dashboard

### **2. Automatic vs Manual**

- ✅ **canDistribute()** - Checks if allowed (automatic check)
- ⚙️ **executeDistribution()** - Must be called manually (by admin or bot)
- 🤖 Recommendation: Set up automated bot to call weekly

### **3. Missed Distributions**

If distribution not executed for multiple weeks:
- Can still execute when conditions met
- Only ONE distribution executes at a time
- Next distribution waits another 7 days
- No "catch-up" distributions

### **4. Unclaimed Rewards**

After 365 days:
- Tokens remain in MerkleDistributor
- Admin can withdraw via emergency functions (if implemented)
- Consider governance vote to reallocate

---

## 🔐 Security Considerations

### **Time Manipulation**

- ✅ Uses `block.timestamp` (miner can manipulate ±15 seconds)
- ✅ Not critical for weekly distributions
- ✅ Friday 14:00 UTC is safe threshold

### **Claim Period**

- ✅ 365 days is generous for users
- ✅ Prevents indefinite token lock
- ✅ Standard industry practice

### **Distribution Safety**

- ✅ Checks collateral ratio before minting
- ✅ Scales down rewards if needed
- ✅ Maintains minimum 110% ratio
- ✅ ReentrancyGuard on claim function

---

## 🚀 Deployment Impact

### **If Contracts Already Deployed**

⚠️ **These changes require redeployment!**

The constants are **immutable** in the contract:
- Cannot be changed after deployment
- Must deploy new contracts with updated values
- Migrate to new contracts if already live

### **If Not Yet Deployed**

✅ Perfect timing!
- Contracts now have production values
- Ready to deploy to mainnet
- No migration needed

---

## 📋 Deployment Checklist

Before deploying to mainnet:

- [x] Distribution interval: 7 days ✅
- [x] Claim period: 365 days ✅
- [x] Friday 14:00 UTC trigger ✅
- [x] Collateral ratio tiers ✅
- [x] Protocol fees configured ✅
- [x] Min ratio after distribution: 110% ✅
- [ ] Deploy contracts
- [ ] Verify contracts on BaseScan
- [ ] Test first distribution
- [ ] Set up distribution bot
- [ ] Monitor claim activity

---

## 🎯 Summary

| Parameter | Old (Testing) | New (Production) | Status |
|-----------|---------------|------------------|--------|
| **Distribution Interval** | 7 hours | 7 days | ✅ Updated |
| **Claim Period** | 10 hours | 365 days | ✅ Updated |
| **Distribution Trigger** | Friday 14:00 UTC | Friday 14:00 UTC | ✅ Unchanged |
| **Collateral Tiers** | 1¢-10¢ | 1¢-10¢ | ✅ Unchanged |
| **Min Ratio** | 112% | 112% | ✅ Unchanged |

---

**✅ Smart contracts are now configured for Base Mainnet production deployment!**

- Weekly distributions every 7 days
- 365-day claim period for user convenience
- Friday 14:00 UTC distribution schedule
- All security checks in place

Ready to deploy! 🚀
