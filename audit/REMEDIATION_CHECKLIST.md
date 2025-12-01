# BTC1USD Protocol - Security Audit Remediation Checklist

**Generated:** November 22, 2025  
**Use this checklist to track fixes for all identified security issues**

## 🔴 CRITICAL PRIORITY (Fix Immediately)

### [ ] CRITICAL-01: Fix Access Control in BTC1USD.sol
- **File:** `contracts/BTC1USD.sol`
- **Line:** 28-32
- **Action:** Reorder require statements in `onlyVaultOrDistribution` modifier
```solidity
modifier onlyVaultOrDistribution() {
    require(weeklyDistribution != address(0), "BTC1USD: weekly distribution not set");
    require(msg.sender == vault || msg.sender == weeklyDistribution, 
        "BTC1USD: caller is not authorized minter");
    _;
}
```
- **Test:** Verify unauthorized addresses cannot mint
- **Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Testing | ⬜ Complete

---

### [ ] CRITICAL-02: Re-enable Collateral Ratio Check in Vault.sol
- **File:** `contracts/Vault.sol`
- **Line:** 204-210
- **Action:** Uncomment and enable the collateral ratio check
```solidity
// --- 7) Enforce post-mint CR >= MIN_CR (except first mint) ---
if (prevTotalSupply > 0) {
    uint256 newTotalUSD    = prevTotalUSD.add(usdValue);
    uint256 newTotalSupply = prevTotalSupply.add(totalToMint);
    uint256 newCR          = newTotalUSD.multiply(DECIMALS).divide(newTotalSupply);
    require(newCR >= MIN_COLLATERAL_RATIO, "Vault: would break minimum collateral ratio");
}
```
- **Test:** Verify minting reverts when CR would drop below MIN_COLLATERAL_RATIO
- **Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Testing | ⬜ Complete

---

### [ ] CRITICAL-03: Fix Batch Transfer Return Value Check
- **File:** `contracts/MerkleDistributor.sol`
- **Line:** 589-602
- **Action:** Use SafeERC20 consistently or improve return value checking
- **Alternative 1:** Replace with SafeERC20.safeTransfer (recommended)
- **Alternative 2:** Improve the low-level call checking logic
- **Test:** Test with various ERC20 token types (standard, non-standard, deflationary)
- **Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Testing | ⬜ Complete

---

## 🟠 HIGH PRIORITY (Fix Before Mainnet)

### [ ] HIGH-01: Implement Multi-Signature Admin Control
- **Files:** All contracts with `admin` role
- **Action:** 
  1. Deploy Gnosis Safe or similar multi-sig wallet
  2. Transfer admin roles to multi-sig
  3. Require 3-of-5 or similar threshold
- **Contracts to update:**
  - [ ] BTC1USD.sol
  - [ ] Vault.sol
  - [ ] MerkleDistributor.sol
  - [ ] EndowmentManager.sol
  - [ ] WeeklyDistribution.sol
  - [ ] GovernanceDAO.sol
- **Test:** Verify multi-sig required for all admin functions
- **Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Testing | ⬜ Complete

---

### [ ] HIGH-02: Add Reentrancy Guard to EndowmentManager
- **File:** `contracts/EndowmentManager.sol`
- **Line:** 191-231
- **Action:**
```solidity
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract EndowmentManager is ReentrancyGuard {
    function executeMonthlyDistribution() 
        external onlyAdminOrDAO nonReentrant {
        // Implementation
    }
}
```
- **Test:** Attempt reentrancy attack
- **Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Testing | ⬜ Complete

---

### [ ] HIGH-03: Fix Signature Replay Attack
- **Files:** `DAO.sol`, `GovernanceDAO.sol`
- **Action:** Add nonce tracking
```solidity
mapping(address => uint256) public nonces;

function castVoteBySig(uint256 proposalId, uint8 support, uint256 nonce, ...) external {
    require(nonce == nonces[signatory], "Invalid nonce");
    nonces[signatory]++;
    // rest of implementation
}
```
- **Test:** Verify signatures cannot be replayed
- **Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Testing | ⬜ Complete

---

### [ ] HIGH-04: Enforce Oracle Staleness Check
- **File:** `contracts/Vault.sol`
- **Lines:** 144, 190, 247
- **Action:** Add staleness check before using price
```solidity
uint256 tokenPrice = priceOracle.getPrice(collateralToken);
require(!priceOracle.isStale(), "Vault: oracle price is stale");
```
- **Test:** Verify operations revert with stale price
- **Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Testing | ⬜ Complete

---

### [ ] HIGH-05: Add Zero Address Validation
- **Files:** Multiple
- **Locations:**
  - [ ] BTC1USD.sol: setVault (line 53)
  - [ ] BTC1USD.sol: setWeeklyDistribution (line 59)
  - [ ] Vault.sol: constructor (line 71-83)
  - [ ] Vault.sol: setDevWallet (line 125)
  - [ ] Vault.sol: setEndowmentWallet (line 130)
  - [ ] WeeklyDistribution.sol: constructor (line 108-131)
- **Action:** Add `require(address != address(0), "...")` checks
- **Test:** Verify setting zero address reverts
- **Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Testing | ⬜ Complete

---

### [ ] HIGH-06: Implement Pagination for Unbounded Loops
- **Files:** `MerkleDistributor.sol`, `EndowmentManager.sol`
- **Functions to update:**
  - [ ] getAllDistributions()
  - [ ] getIncompleteDistributionIds()
  - [ ] getAllNonProfits()
  - [ ] getAllNonProfitsByCategory()
- **Action:** Add offset and limit parameters
```solidity
function getDistributions(uint256 offset, uint256 limit) 
    public view returns (Distribution[] memory) {
    // Paginated implementation
}
```
- **Test:** Test with large datasets
- **Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Testing | ⬜ Complete

---

## 🟡 MEDIUM PRIORITY (Recommended Before Mainnet)

### [ ] MEDIUM-01: Add Event Emissions
- **File:** `BTC1USD.sol`
- **Action:** Add event for setWeeklyDistribution
```solidity
event WeeklyDistributionChanged(
    address indexed oldDistribution, 
    address indexed newDistribution
);
```
- **Status:** ⬜ Not Started | ⬜ Complete

---

### [ ] MEDIUM-02: Document Array Deletion Pattern
- **Files:** Multiple (removeWallet, removeNonProfit, etc.)
- **Action:** Add comprehensive documentation about swap-and-pop pattern
- **Status:** ⬜ Not Started | ⬜ Complete

---

### [ ] MEDIUM-03: Lock Pragma Version
- **Files:** All `.sol` files
- **Action:** Change `pragma solidity ^0.8.19;` to `pragma solidity 0.8.19;`
- **Status:** ⬜ Not Started | ⬜ Complete

---

### [ ] MEDIUM-04: Add Maximum Mint/Redeem Limits
- **File:** `Vault.sol`
- **Action:**
```solidity
uint256 public constant MAX_MINT_AMOUNT = 1000000e8;
uint256 public constant MAX_REDEEM_AMOUNT = 1000000e8;

function mint(...) external {
    require(depositAmount <= MAX_MINT_AMOUNT, "Vault: exceeds max mint");
    // ...
}
```
- **Status:** ⬜ Not Started | ⬜ Complete

---

### [ ] MEDIUM-05: Implement Voting Power Snapshots
- **File:** `DAO.sol`
- **Action:** Use OpenZeppelin's ERC20Votes or implement checkpoint system
- **Status:** ⬜ Not Started | ⬜ Complete

---

### [ ] MEDIUM-06: Make Claim Period Configurable
- **File:** `MerkleDistributor.sol`
- **Action:** Replace constant with storage variable
```solidity
uint256 public claimPeriod;

constructor(...) {
    claimPeriod = _isTestnet ? 10 hours : 365 days;
}
```
- **Status:** ⬜ Not Started | ⬜ Complete

---

### [ ] MEDIUM-07: Add Pause to Approve Function
- **File:** `BTC1USD.sol`
- **Action:** Add `whenNotPaused` modifier to approve
- **Status:** ⬜ Not Started | ⬜ Complete

---

### [ ] MEDIUM-08: Fix Decimal Inconsistency
- **File:** `EndowmentManager.sol`
- **Line:** 33
- **Action:** Change `1000 * 10**18` to `1000 * 10**8`
- **Status:** ⬜ Not Started | ⬜ Complete

---

## 🟢 LOW PRIORITY (Best Practices)

### [ ] LOW-01: Remove SafeMath Library
- **Files:** All contracts
- **Action:** Remove SafeMath import and using statements, use native arithmetic
- **Status:** ⬜ Not Started | ⬜ Complete

---

### [ ] LOW-02: Fix/Remove Unused Parameters
- **File:** `DAO.sol`
- **Line:** 456
- **Action:** Either use category parameter or remove function
- **Status:** ⬜ Not Started | ⬜ Complete

---

### [ ] LOW-03: Replace Magic Numbers with Constants
- **Files:** Multiple
- **Action:** Define named constants for all magic numbers
- **Status:** ⬜ Not Started | ⬜ Complete

---

### [ ] LOW-04: Follow Consistent Function Ordering
- **Files:** All contracts
- **Action:** Reorder functions per Solidity style guide
  1. constructor
  2. external
  3. public
  4. internal
  5. private
- **Status:** ⬜ Not Started | ⬜ Complete

---

### [ ] LOW-05: Add Comprehensive NatSpec
- **Files:** All contracts
- **Action:** Add @notice, @dev, @param, @return tags
- **Status:** ⬜ Not Started | ⬜ Complete

---

### [ ] LOW-06: Use Custom Errors
- **Files:** All contracts
- **Action:** Replace require strings with custom errors
```solidity
error Unauthorized(address caller);
error InsufficientBalance(uint256 required, uint256 available);

if (msg.sender != admin) revert Unauthorized(msg.sender);
```
- **Status:** ⬜ Not Started | ⬜ Complete

---

## 🧪 Testing Requirements

### Unit Tests
- [ ] Test all critical paths with edge cases
- [ ] Test access control mechanisms
- [ ] Test arithmetic operations at boundaries
- [ ] Test with zero values
- [ ] Test with maximum values
- [ ] Test overflow/underflow scenarios

### Integration Tests
- [ ] Test cross-contract interactions
- [ ] Test complete mint/redeem flows
- [ ] Test distribution mechanisms
- [ ] Test governance voting flow
- [ ] Test emergency pause functionality

### Fuzzing Tests
- [ ] Fuzz mint/redeem amounts
- [ ] Fuzz collateral ratios
- [ ] Fuzz distribution calculations
- [ ] Fuzz voting mechanisms

### Gas Tests
- [ ] Profile all major functions
- [ ] Test unbounded loops with large datasets
- [ ] Verify gas optimizations

---

## 📋 Pre-Mainnet Checklist

### Code Quality
- [ ] All CRITICAL fixes implemented and tested
- [ ] All HIGH priority fixes implemented and tested
- [ ] All MEDIUM priority fixes reviewed
- [ ] Code reviewed by multiple developers
- [ ] External audit completed
- [ ] All tests passing

### Security
- [ ] Multi-sig wallet deployed and configured
- [ ] Timelock implemented for critical operations
- [ ] Circuit breakers tested
- [ ] Emergency procedures documented
- [ ] Incident response plan created

### Testing
- [ ] Comprehensive unit test coverage (>90%)
- [ ] Integration tests completed
- [ ] Fuzzing tests passed
- [ ] Testnet deployment (3+ months)
- [ ] Bug bounty program active

### Documentation
- [ ] Technical documentation complete
- [ ] User documentation complete
- [ ] Admin procedures documented
- [ ] Emergency procedures documented
- [ ] Upgrade procedures documented

### Deployment
- [ ] Deployment scripts tested
- [ ] Deployment verification scripts ready
- [ ] Monitoring and alerting configured
- [ ] Team trained on operations
- [ ] Community communication plan ready

---

## 📊 Progress Tracking

**Overall Progress:** 0/23 findings addressed

**By Severity:**
- Critical: 0/3 ⬜⬜⬜
- High: 0/6 ⬜⬜⬜⬜⬜⬜
- Medium: 0/8 ⬜⬜⬜⬜⬜⬜⬜⬜
- Low: 0/6 ⬜⬜⬜⬜⬜⬜

**Mainnet Readiness:** 🔴 NOT READY

---

## 📝 Notes

Add notes about specific challenges, decisions, or additional findings during remediation:

```
[Date] - [Issue ID] - [Note]

Example:
2025-11-22 - CRITICAL-02 - Discussed with team, will implement with 24hr delay
```

---

*Last Updated: November 22, 2025*
*Review this checklist after each fix to track progress*
