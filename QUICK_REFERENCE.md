# Quick Reference: Collateral Management

## 🎯 Quick Start

### For Admins: Add Collateral in 3 Steps
```
1. Dashboard → "Collateral Management" tab
2. Enter token address → Click "Auto-fill"
3. Click "Add Collateral Token" → Approve in wallet
```
**Time**: ~2 minutes

### For Users: Use New Collateral
```
1. Dashboard → "Buy & Sell" tab
2. Select new token from "Collateral" dropdown
3. Enter amount → Click "BUY"
```
**No action needed** - new tokens appear automatically!

---

## 📍 Navigation

### Admin Menu (Left Sidebar)
```
┌─────────────────────────┐
│ 🏠 Overview             │
│ ➕ Buy & Sell           │
│ 🎁 Claim Rewards        │
│ 📊 Analytics            │
│ ━━━━━━━━━━━━━━━━━━━━━  │ Admin Only
│ 👥 Vote                 │
│ ₿  Collateral Mgmt  ← HERE!
│ 🪙 Test Mint Collateral │
│ 📅 Distribution Admin   │
│ 💰 Treasury             │
│ 🛡️  Security             │
└─────────────────────────┘
```

---

## 🔑 Key Addresses

### Testnet (Base Sepolia)
```
Vault:  0xdf4dB078B8458301aA7c507132A53b34D556ca41
Admin:  0x6210FfE7340dC47d5DA4b888e850c036CC6ee835

Known Collaterals:
WBTC:   0x0b7fCdb2Ac3B6f1821e6FEbcAb6B94ec321802C2
cbBTC:  0xC5D5eC386e7D07ca0aF779031e2a43bBA79353A8
tBTC:   0x977422a3E5a5974c7411e704d2d312848A74a896
```

---

## 📝 Common Tasks

### Add New Token
```typescript
Input Required:
├─ Token Address:  0x...
├─ Symbol:        AUTO or manual (e.g., "WBTC")
└─ Name:          AUTO or manual (e.g., "Wrapped Bitcoin")

Validation:
├─ ✓ Valid address format
├─ ✓ ERC20 compliant
├─ ✓ Not duplicate
├─ ✓ Admin authorized
└─ ⚠ Check decimals = 8

Transaction:
├─ Gas: ~100,000
└─ Time: ~30 seconds
```

### Remove Token
```typescript
Requirements:
├─ Vault balance must be 0
├─ Admin authorization
└─ User confirmation

Cannot Remove If:
└─ Vault has any balance of token
```

### View Supported
```typescript
Display Shows:
├─ Token symbol & name
├─ Contract address
├─ Vault balance
└─ Remove button (if balance = 0)
```

---

## ⚠️ Important Notes

### Before Adding Token
- ✅ Verify token is legitimate
- ✅ Check on block explorer
- ✅ Confirm represents real BTC
- ✅ Test on testnet first
- ✅ Check decimals (prefer 8)

### Cannot Do
- ❌ Remove token with vault balance > 0
- ❌ Add duplicate tokens
- ❌ Non-admins cannot access
- ❌ Add non-ERC20 contracts
- ❌ Change existing tokens

### Always Remember
- 🔐 Only admin can manage collateral
- 💾 Changes are permanent (on-chain)
- 🔄 Users see changes immediately
- 📊 Analytics auto-update
- ⛽ Requires gas for transactions

---

## 🐛 Troubleshooting

### Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "Only admin can add" | Not admin wallet | Connect admin wallet |
| "Invalid token address" | Wrong format | Check address is valid |
| "Already supported" | Duplicate | Token already added |
| "Not valid ERC20" | Wrong contract | Verify contract address |
| "Cannot remove" | Balance > 0 | Wait for vault to empty |

### Common Issues

**Auto-fill doesn't work**
- Check wallet is connected
- Verify network is correct
- Ensure address is valid ERC20

**Transaction fails**
- Check admin wallet connected
- Verify sufficient gas
- Confirm not duplicate token

**Token doesn't appear**
- Wait for transaction confirmation
- Refresh the page
- Check transaction on explorer

---

## 📞 Quick Actions

### Emergency
```
Issue: Need to pause protocol
Action: Go to Security tab → Emergency Pause
```

### Verification
```
Issue: Check if token is supported
Action: Collateral Management → View list
```

### Testing
```
Issue: Need test tokens
Action: Test Mint Collateral tab → Mint tokens
```

---

## 📚 Documentation

### Quick Access
```
Feature Docs:       COLLATERAL_MANAGEMENT_FEATURE.md
Admin Guide:        ADMIN_COLLATERAL_GUIDE.md
Update Summary:     COLLATERAL_UPDATE_SUMMARY.md
Implementation:     IMPLEMENTATION_COMPLETE.md
This Reference:     QUICK_REFERENCE.md
```

### Code Locations
```
Component:          components/collateral-management.tsx
Dashboard:          components/dashboard.tsx
Contract ABIs:      lib/contracts.ts
Smart Contract:     contracts/Vault.sol
```

---

## 🎓 Examples

### Example 1: Add LBTC
```
1. Get address: 0x...LBTC
2. Navigate: Collateral Management
3. Paste: 0x...LBTC
4. Auto-fill: → "LBTC" / "Lombard Bitcoin"
5. Add: Click button → Approve
6. Done: ✅ LBTC added
```

### Example 2: Remove Test Token
```
1. Navigate: Collateral Management
2. Find: Token in list
3. Check: Vault Balance = 0.00000000
4. Remove: Click button → Confirm → Approve
5. Done: ✅ Token removed
```

### Example 3: Verify Addition
```
1. Added: New token via management
2. Check: Go to "Buy & Sell" tab
3. Verify: New token in dropdown
4. Test: Try minting small amount
5. Confirm: Transaction succeeds
```

---

## 🔗 Links

### Smart Contract Functions
```solidity
vault.addCollateral(address)      // Add token
vault.removeCollateral(address)   // Remove token
vault.supportedCollateral(address) // Check supported
vault.collateralBalances(address) // Get balance
vault.getSupportedCollateral()    // List all
```

### Events
```solidity
event CollateralAdded(address indexed token)
event CollateralRemoved(address indexed token)
```

---

## 💡 Pro Tips

1. **Test First**: Always test on testnet before mainnet
2. **Verify**: Check token on block explorer before adding
3. **Document**: Keep list of added tokens
4. **Monitor**: Watch vault balances after adding
5. **Announce**: Tell users about new options
6. **Backup**: Save token addresses

---

## 📊 Status Indicators

### In UI
```
✅ Green: Success / Confirmed
🔵 Blue: Processing / Info
⚠️  Yellow: Warning
❌ Red: Error / Failed
```

### Token Status
```
✓ Supported
🗑️ Can Remove (balance = 0)
🔒 Cannot Remove (balance > 0)
```

---

## 🎯 Goals Achieved

✅ Simple admin workflow
✅ 2-minute process
✅ Auto-updates everywhere
✅ No code changes needed
✅ Comprehensive validation
✅ Security maintained
✅ Full documentation

---

**Remember**: This feature makes it easy to add collateral, but always verify token legitimacy first!

**Support**: See full documentation in `ADMIN_COLLATERAL_GUIDE.md`
