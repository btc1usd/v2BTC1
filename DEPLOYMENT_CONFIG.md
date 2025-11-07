# BTC1USD Protocol Deployment Configuration

This document outlines the configuration differences between TESTNET and MAINNET deployments.

## Current Configuration: TESTNET (Base Sepolia)

The protocol is currently configured for rapid testing with shortened timeframes.

## Configuration Changes Required for MAINNET

### 1. Smart Contracts

#### A. WeeklyDistribution.sol

**Location:** `contracts/WeeklyDistribution.sol`

**Line 66 - Distribution Interval:**
```solidity
// TESTNET (Current)
uint256 public constant DISTRIBUTION_INTERVAL = 7 hours;

// MAINNET (Change to)
uint256 public constant DISTRIBUTION_INTERVAL = 7 days;
```

**Lines 133-157 - Distribution Timing Logic:**
```solidity
// TESTNET (Current): Simple interval check
function canDistribute() public view returns (bool) {
    bool intervalPassed = block.timestamp >= lastDistributionTime.add(DISTRIBUTION_INTERVAL);
    return intervalPassed;
}

// MAINNET: Uncomment the Friday 14:00 UTC check block (lines 139-154)
// This enforces weekly distributions on Friday at 14:00 UTC or later
```

#### B. MerkleDistributor.sol

**Location:** `contracts/MerkleDistributor.sol`

**Line 31 - Claim Period:**
```solidity
// TESTNET (Current)
uint256 public constant CLAIM_PERIOD = 10 hours;

// MAINNET (Change to)
uint256 public constant CLAIM_PERIOD = 365 days;
```

### 2. Frontend Configuration

#### lib/contracts.ts

**Location:** `lib/contracts.ts`

**Line 885 - Distribution Interval Constant:**
```typescript
// TESTNET (Current)
DISTRIBUTION_INTERVAL: 7 * 60 * 60, // 25200 seconds (7 hours)

// MAINNET (Change to)
DISTRIBUTION_INTERVAL: 7 * 24 * 60 * 60, // 604800 seconds (7 days)
```

### 3. UI Components

Update the following files to reflect production timeframes:

#### distribution-admin.tsx
**Location:** `components/distribution-admin.tsx`

- Line 159: Change title from "Distribution Schedule (Testing Mode: 7 Hours)" to "Weekly Distribution Schedule"
- Lines 166-169: Update distribution info to reflect 7 days and Friday 14:00 UTC
- Line 187: Change "Admin Instructions (Testing Mode)" to "Admin Instructions"
- Line 190: Update window description to include Friday 14:00 UTC requirement

#### merkle-claim.tsx
**Location:** `components/merkle-claim.tsx`

- Line 441: Change from "7-hour distribution cycle" to "weekly distribution cycle"
- Line 760: Change from "every 7 hours" to "weekly"
- Line 763: Change from "within 10 hours" to "within 365 days"
- Line 766: Change from "After 10 hours" to "After 365 days, all unclaimed rewards are donated to the endowment fund"

#### enhanced-merkle-claim.tsx
**Location:** `components/enhanced-merkle-claim.tsx`

- Same changes as merkle-claim.tsx above

#### fixed-merkle-claim.tsx
**Location:** `components/fixed-merkle-claim.tsx`

- Same changes as merkle-claim.tsx above

#### dashboard.tsx
**Location:** `components/dashboard.tsx`

- Line 239: Update error message to include Friday 14:00 UTC requirement
- Line 247: Change from "Executing distribution (7-hour interval)..." to "Executing weekly distribution..."

## Summary of Changes

| Component | TESTNET | MAINNET |
|-----------|---------|---------|
| Distribution Interval | 7 hours | 7 days |
| Distribution Schedule | Anytime after interval | Friday 14:00 UTC or later |
| Claim Period | 10 hours | 365 days |
| Unclaimed Rewards | Expire after 10 hours | Donated to endowment after 365 days |

## Deployment Checklist for MAINNET

- [ ] Update `DISTRIBUTION_INTERVAL` in WeeklyDistribution.sol to `7 days`
- [ ] Uncomment Friday 14:00 UTC check in `canDistribute()` function
- [ ] Update `CLAIM_PERIOD` in MerkleDistributor.sol to `365 days`
- [ ] Update `DISTRIBUTION_INTERVAL` in lib/contracts.ts
- [ ] Update all UI text in components to reflect weekly/365-day timeframes
- [ ] Recompile all contracts with `npx hardhat compile`
- [ ] Deploy to mainnet with updated contracts
- [ ] Update .env with mainnet contract addresses
- [ ] Test distribution timing on mainnet
- [ ] Verify claim period enforcement

## Testing Recommendations

Before mainnet deployment:
1. Test the Friday 14:00 UTC logic on testnet by temporarily setting it
2. Verify claim expiry works correctly with short periods
3. Ensure UI properly reflects all timing requirements
4. Test multiple distribution cycles
5. Verify merkle tree generation and claiming process

## Important Notes

- Always backup existing contract addresses before deploying new versions
- Update deployment-base-sepolia.json (or mainnet equivalent) with new addresses
- Keep this configuration document updated with any changes
- Consider using upgradeable proxies for easier parameter updates in the future

## Contact

For questions about deployment configuration, consult the protocol documentation or contact the development team.
