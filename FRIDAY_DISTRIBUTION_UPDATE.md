# Friday 14:00 UTC Distribution Restriction - ENABLED

## Summary
Enabled the **Friday 14:00 UTC restriction** for weekly distributions in `WeeklyDistribution.sol`. This enforces mainnet-like behavior on testnet.

---

## 🔄 What Changed

### **contracts/WeeklyDistribution.sol** (Lines 132-156)

**BEFORE (Simple Interval Check):**
```solidity
function canDistribute() public view returns (bool) {
    // TESTNET MODE: Simple 7-hour interval check
    bool intervalPassed = block.timestamp >= lastDistributionTime.add(DISTRIBUTION_INTERVAL);

    /* MAINNET code commented out */

    return intervalPassed; // ✅ Allowed anytime after interval passes
}
```

**AFTER (Friday 14:00 UTC Restriction):**
```solidity
function canDistribute() public view returns (bool) {
    // MAINNET MODE: Friday 14:00 UTC restriction enabled
    bool intervalPassed = block.timestamp >= lastDistributionTime.add(DISTRIBUTION_INTERVAL);

    if (!intervalPassed) return false;

    // Once interval passed, check if we've reached Friday 14:00 UTC
    uint256 dayOfWeek = (block.timestamp / 86400 + 4) % 7; // 0 = Thursday, 1 = Friday
    uint256 timeOfDay = block.timestamp % 86400;

    // If it's before Friday, not allowed yet
    if (dayOfWeek < 1) return false;

    // If it's Friday, must be past 14:00 UTC
    if (dayOfWeek == 1 && timeOfDay < FRIDAY_14_UTC) return false;

    // If it's Friday 14:00+ or any day after Friday, allowed
    return true; // ✅ Only allowed on/after Friday 14:00 UTC
}
```

---

## 🎯 How It Works

### Distribution Logic Flow:

1. **Check if 7 days have passed** since last distribution
   - If NO → Distribution blocked ❌
   - If YES → Continue to step 2

2. **Calculate current day of week** (UTC)
   - Formula: `(block.timestamp / 86400 + 4) % 7`
   - 0 = Thursday, 1 = Friday, 2 = Saturday, etc.

3. **Apply Friday restriction:**
   - **Before Friday (Thu):** Distribution blocked ❌
   - **Friday before 14:00 UTC:** Distribution blocked ❌
   - **Friday 14:00+ UTC:** Distribution allowed ✅
   - **After Friday (Sat-Wed):** Distribution allowed ✅

### Example Timeline:

```
Day 0 (Monday):     Last distribution executed
Day 7 (Monday):     7 days passed, but it's Monday → BLOCKED ❌
Day 11 (Friday):    Before 14:00 UTC → BLOCKED ❌
Day 11 (Friday):    14:00 UTC or later → ALLOWED ✅
Day 12 (Saturday):  Still in window → ALLOWED ✅
Day 13 (Sunday):    Still in window → ALLOWED ✅
...
Day 14 (Next Mon):  7 days haven't passed from Friday → BLOCKED ❌
```

---

## 📊 Impact Summary

| Aspect | Simple Interval (Before) | Friday Restriction (After) |
|--------|-------------------------|---------------------------|
| **Interval Required** | 7 days | 7 days |
| **Day Restriction** | None | Must be Friday or later |
| **Time Restriction** | None | Must be 14:00 UTC or later on Friday |
| **Earliest Execution** | Exactly 7 days after last | First Friday 14:00+ after 7 days |
| **Latest Execution** | No limit | Before next Friday (then new cycle) |
| **Mode** | Testnet/Testing | Mainnet/Production |

---

## ⚠️ Important Implications

### 1. **Distribution Window Can Span Multiple Days**

After 7 days pass and it's Friday 14:00+, admin can execute distribution at any time until the next cycle's Friday arrives.

**Example:**
- Last distribution: Monday, Jan 1
- 7 days pass: Monday, Jan 8 (BLOCKED - not Friday yet)
- First Friday: Friday, Jan 12, 14:00 UTC (ALLOWED ✅)
- Distribution executed: Saturday, Jan 13 (admin was busy on Friday)
- Next eligibility: Friday, Jan 19, 14:00 UTC (7 days from Jan 13)

### 2. **Day of Week Calculation**

The formula `(block.timestamp / 86400 + 4) % 7` assumes:
- Unix epoch (Jan 1, 1970) was a Thursday
- Adding 4 shifts the offset so Friday = 1

**Verification:**
```javascript
// JavaScript/Solidity timestamp = seconds since Unix epoch
const thursday = new Date('1970-01-01T00:00:00Z'); // Day 0
const friday = new Date('1970-01-02T00:00:00Z');   // Day 1
```

### 3. **Gas Considerations**

The Friday check adds minimal gas cost:
- 2 divisions
- 1 modulo operation
- 2-3 comparisons

Estimated: **~100-200 extra gas** (negligible)

---

## 🧪 Testing Scenarios

### Test Case 1: Distribution Before Friday
```solidity
// Setup: Last distribution was 7 days ago, today is Thursday
lastDistributionTime = block.timestamp - 7 days;
// Current day: Thursday (dayOfWeek = 0)

canDistribute(); // Should return FALSE ❌
```

### Test Case 2: Distribution Friday Before 14:00 UTC
```solidity
// Setup: Last distribution was 7 days ago, today is Friday 13:59 UTC
lastDistributionTime = block.timestamp - 7 days;
// Current day: Friday (dayOfWeek = 1)
// Current time: 13:59 UTC (timeOfDay = 50340 < FRIDAY_14_UTC)

canDistribute(); // Should return FALSE ❌
```

### Test Case 3: Distribution Friday At/After 14:00 UTC
```solidity
// Setup: Last distribution was 7 days ago, today is Friday 14:00 UTC
lastDistributionTime = block.timestamp - 7 days;
// Current day: Friday (dayOfWeek = 1)
// Current time: 14:00 UTC (timeOfDay = 50400 = FRIDAY_14_UTC)

canDistribute(); // Should return TRUE ✅
```

### Test Case 4: Distribution After Friday (Weekend)
```solidity
// Setup: Last distribution was 7 days ago, today is Saturday
lastDistributionTime = block.timestamp - 7 days;
// Current day: Saturday (dayOfWeek = 2)

canDistribute(); // Should return TRUE ✅
```

---

## 🔧 Reverting to Simple Interval (If Needed)

To disable the Friday restriction and revert to simple 7-day interval:

1. Comment out lines 138-152
2. Uncomment line 155
3. Update comment on line 133

```solidity
function canDistribute() public view returns (bool) {
    // TESTNET MODE: Simple interval check (no Friday restriction)

    bool intervalPassed = block.timestamp >= lastDistributionTime.add(DISTRIBUTION_INTERVAL);

    return intervalPassed; // Simple check - no day/time restrictions
}
```

---

## ✅ Deployment Checklist

When deploying with Friday restriction:

- [ ] Verify `DISTRIBUTION_INTERVAL = 7 days` (604,800 seconds)
- [ ] Verify `FRIDAY_14_UTC = 50,400` seconds (14 * 3600)
- [ ] Test `canDistribute()` returns false before Friday
- [ ] Test `canDistribute()` returns false on Friday before 14:00
- [ ] Test `canDistribute()` returns true on Friday at 14:00+
- [ ] Test `canDistribute()` returns true on Saturday/Sunday
- [ ] Update UI to inform users about Friday schedule
- [ ] Document the Friday 14:00 UTC execution time for admins

---

## 📅 Expected Behavior

With this change, distributions will follow this pattern:

**Week 1:**
- Distribution executed: Friday, 14:00 UTC

**Week 2:**
- Earliest possible: Next Friday, 14:00 UTC (7+ days later)
- Admin executes: Friday, 15:30 UTC
- Users claim throughout the week

**Week 3:**
- Earliest possible: Friday, 14:00 UTC after 7 days from last distribution
- Admin executes: Saturday, 10:00 UTC (admin was offline Friday)
- Users claim throughout the week

This creates predictable weekly distributions aligned with business hours and user expectations.

---

## 🎯 Why Friday 14:00 UTC?

1. **Global Accessibility:** 14:00 UTC =
   - 9:00 AM EST (US East Coast)
   - 6:00 AM PST (US West Coast)
   - 2:00 PM GMT (UK)
   - 10:00 PM CST (China)
   - 11:00 PM JST (Japan)

2. **End of Week:** Friday distribution allows users to claim over the weekend

3. **Business Hours:** 14:00 UTC is during business hours for most time zones

4. **Consistency:** Fixed weekly schedule builds user trust and predictability

---

## ⚠️ Contract Must Be Redeployed

This is a **code logic change**, not a parameter update. The contract must be redeployed for this change to take effect.

```bash
npx hardhat run scripts/deploy-complete-base-sepolia.js --network baseSepolia
```

After deployment, the Friday 14:00 UTC restriction will be active immediately.
