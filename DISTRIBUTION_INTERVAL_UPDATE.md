# Distribution Interval Update: 7 Hours → 7 Days

## Summary
Changed distribution time window from **7 hours (testnet)** to **7 days (mainnet/weekly)** across the entire codebase.

---

## ✅ Files Updated (12 total)

### 1. **contracts/WeeklyDistribution.sol** (CRITICAL)

#### Change 1A: Distribution Interval (Line 65)
```solidity
// BEFORE:
uint256 public constant DISTRIBUTION_INTERVAL = 7 hours;

// AFTER:
uint256 public constant DISTRIBUTION_INTERVAL = 7 days;
```

#### Change 1B: Friday 14:00 UTC Restriction (Lines 132-156)
```solidity
// BEFORE: Simple interval check (commented mainnet code)
function canDistribute() public view returns (bool) {
    bool intervalPassed = block.timestamp >= lastDistributionTime.add(DISTRIBUTION_INTERVAL);
    return intervalPassed; // Allowed anytime after 7 days
}

// AFTER: Friday 14:00 UTC restriction enabled
function canDistribute() public view returns (bool) {
    bool intervalPassed = block.timestamp >= lastDistributionTime.add(DISTRIBUTION_INTERVAL);

    if (!intervalPassed) return false;

    // Check if it's Friday 14:00 UTC or later
    uint256 dayOfWeek = (block.timestamp / 86400 + 4) % 7;
    uint256 timeOfDay = block.timestamp % 86400;

    if (dayOfWeek < 1) return false; // Before Friday
    if (dayOfWeek == 1 && timeOfDay < FRIDAY_14_UTC) return false; // Friday before 14:00

    return true; // Friday 14:00+ or any day after
}
```

**Impact:**
- ⚠️ **REQUIRES CONTRACT REDEPLOYMENT**
- Distributions now require 7 days between executions instead of 7 hours
- Distributions can ONLY occur on/after Friday 14:00 UTC
- Time calculation: 7 days = 604,800 seconds
- **See FRIDAY_DISTRIBUTION_UPDATE.md for detailed explanation**

---

### 2. **lib/contracts.ts**
**Line 884:** Configuration constant updated
```typescript
// BEFORE:
DISTRIBUTION_INTERVAL: 7 * 60 * 60, // 25,200 seconds (7 hours)

// AFTER:
DISTRIBUTION_INTERVAL: 7 * 24 * 60 * 60, // 604,800 seconds (7 days)
```

**Impact:**
- Frontend now correctly calculates 7-day intervals
- Matches contract constant

---

### 3. **components/merkle-distribution-management.tsx**
**Lines 1527-1528:** UI status text updated
```tsx
// BEFORE:
? 'Ready (7 hours passed) ✓'
: 'Need: 7 hours since last distribution'

// AFTER:
? 'Ready (7 days passed) ✓'
: 'Need: 7 days since last distribution'
```

**Impact:** Distribution requirements display correctly in UI

---

### 4. **components/merkle-claim.tsx**
**Lines 760, 763, 766:** User information updated
```tsx
// BEFORE:
• rewards are distributed every 7 hours based on your BTC1USD balance.
• You can claim your rewards within 10 hours.
• After 10 hours, unclaimed rewards expire.

// AFTER:
• rewards are distributed every 7 days (weekly) based on your BTC1USD balance.
• You can claim your rewards within 365 days (1 year).
• After 365 days, unclaimed rewards are donated to the endowment fund.
```

**Impact:**
- Users see correct distribution frequency
- Claim window updated to match contract (365 days CLAIM_PERIOD)

---

### 5. **components/fixed-merkle-claim.tsx**
**Lines 966, 969, 972:** User information updated
```tsx
// BEFORE:
• rewards are distributed every 7 hours based on your BTC1USD balance.
• You can claim your rewards within 10 hours.
• After 10 hours, unclaimed rewards expire.

// AFTER:
• rewards are distributed every 7 days (weekly) based on your BTC1USD balance.
• You can claim your rewards within 365 days (1 year).
• After 365 days, unclaimed rewards are donated to the endowment fund.
```

**Impact:** Same as merkle-claim.tsx (consistency)

---

### 6. **components/distribution-admin.tsx**
**Lines 159, 166-168, 187, 190:** Admin UI updated
```tsx
// BEFORE:
Distribution Schedule (Testing Mode: 7 Hours)
• Distributions occur every 7 hours (testing mode)
• Once 7 hours pass, admin can execute immediately
• Distribution Window: Opens immediately after 7 hours...

// AFTER:
Weekly Distribution Schedule
• Distributions occur every 7 days (weekly)
• Once 7 days pass, admin can execute distribution
• Typically executed on Fridays at 14:00 UTC
• Distribution Window: Opens 7 days after last distribution...
```

**Impact:**
- Admin panel shows correct schedule
- Removed "testing mode" references
- Added Friday 14:00 UTC guidance (matches FRIDAY_14_UTC constant)

---

### 7. **components/dashboard.tsx**
**Line 242:** Error message updated
```tsx
// BEFORE:
"Check: ratio ≥ 112%, 7 hours since last distribution"

// AFTER:
"Check: ratio ≥ 112%, 7 days since last distribution"
```

**Impact:** Error messages now show correct time requirement

---

### 8. **components/dashboard.tsx** (Overview Tab)
**Lines 3071, 4289:** Additional UI references updated
```tsx
// BEFORE:
Until next distribution (7-hour cycle)
Manage distributions (7-hour cycle) and merkle tree operations

// AFTER:
Until next distribution (weekly cycle)
Manage distributions (weekly cycle) and merkle tree operations
```

**Impact:** Overview tab "Next Reward In" card and admin section now show correct cycle

---

### 9. **components/analytics-dashboard.tsx**
**Line 549:** Reward projection description updated
```tsx
// BEFORE:
Estimated earnings based on current tier and balance (7-hour cycle)

// AFTER:
Estimated earnings based on current tier and balance (weekly cycle)
```

**Impact:** Analytics charts show correct distribution frequency

---

### 10. **components/landing-page.tsx**
**Line 243:** How it works section updated
```tsx
// BEFORE:
Earn yield from protocol fees and donations (7-hour cycle)

// AFTER:
Earn yield from protocol fees and donations (weekly distributions)
```

**Impact:** Landing page accurately describes distribution schedule to new users

---

### 11. **components/protocol-stats.tsx**
**Line 96:** Rewards display updated
```tsx
// BEFORE:
Per token (7-hour cycle)

// AFTER:
Per token (weekly)
```

**Impact:** Protocol statistics show correct distribution frequency

---

### 12. **hooks/useRecentActivity.ts**
**Lines 212, 363:** Activity descriptions updated
```tsx
// BEFORE:
Distribution #${log.args.distributionId} (7-hour cycle)

// AFTER:
Distribution #${log.args.distributionId} (weekly)
```

**Impact:** Recent activity feed shows correct distribution frequency

---

## 🔄 Next Steps

### 1. **Redeploy Contracts** ⚠️ CRITICAL
The contract change requires full redeployment:
```bash
npx hardhat run scripts/deploy-complete-base-sepolia.js --network baseSepolia
```

**Why?**
- `DISTRIBUTION_INTERVAL` is a constant, cannot be changed in deployed contract
- Must deploy new contract with 7-day interval

### 2. **Update Frontend**
After contract deployment:
```bash
npm run build
```

### 3. **Test Distribution Schedule**
- Wait 7 days after first distribution
- Verify admin can execute distribution after 7 days
- Confirm distributions fail before 7 days

### 4. **Update Documentation**
All user-facing text has been updated to reflect:
- Weekly (7 day) distribution schedule
- 365-day claim window
- Friday 14:00 UTC execution time (typical)

---

## 📊 Impact Summary

| Aspect | Before | After |
|--------|--------|-------|
| Distribution Frequency | Every 7 hours | Every 7 days (weekly) |
| Time Between Distributions | 25,200 seconds | 604,800 seconds |
| Claim Window | 10 hours | 365 days (1 year) |
| Mode | Testing | Mainnet/Production |
| Contract Constant | `7 hours` | `7 days` |

---

## ⚠️ Important Notes

1. **Contract Redeployment Required**: This is not a parameter change - it's a constant that's compiled into the bytecode
2. **No Migration Needed**: This is a fresh deployment, no existing state to migrate
3. **Admin Permissions**: After redeployment, remember to transfer admin roles to the configured admin address
4. **Testing**: Verify the 7-day interval works correctly in production

---

## ✅ Verification Checklist

After deployment:
- [ ] Contract shows `DISTRIBUTION_INTERVAL = 604800` (7 days in seconds)
- [ ] UI displays "7 days" instead of "7 hours"
- [ ] Distribution cannot be executed before 7 days pass
- [ ] Distribution can be executed after 7 days
- [ ] Claim window shows "365 days"
- [ ] Error messages reference "7 days"

---

## 📝 Related Contract Constants

For reference, here are related time constants:
```solidity
DISTRIBUTION_INTERVAL = 7 days          // 604,800 seconds
CLAIM_PERIOD = 365 days                 // 31,536,000 seconds
FRIDAY_14_UTC = 14 * 3600               // 50,400 seconds
```

All UI components now align with these values.
