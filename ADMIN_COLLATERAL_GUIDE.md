# Quick Start: Adding New Collateral to BTC1 Protocol

## Admin Guide

### Prerequisites
- You must be the protocol admin (wallet address matches `CONTRACT_ADDRESSES.ADMIN`)
- Connected to the correct network (Base Sepolia or Base Mainnet)
- Target ERC20 token must be deployed on the same network

### Step-by-Step Instructions

#### 1. Access the Dashboard
```
1. Connect your admin wallet
2. Navigate to the BTC1 dashboard
3. Ensure you're on the correct network
```

#### 2. Navigate to Collateral Management
```
1. Look at the left sidebar
2. Click on "Collateral Management" (Bitcoin icon)
3. You'll see two sections:
   - Add New Collateral Token (top)
   - Current Supported Collaterals (bottom)
```

#### 3. Add a New Token

**Option A: Auto-fill (Recommended)**
```
1. Get the token contract address (e.g., from BaseScan)
2. Paste it into "Token Contract Address" field
3. Click "Auto-fill" button
4. System automatically fills Symbol and Name
5. Review the details
6. Click "Add Collateral Token"
7. Approve transaction in wallet
8. Wait for confirmation
```

**Option B: Manual Entry**
```
1. Enter Token Contract Address
2. Manually type Token Symbol (e.g., "WBTC")
3. Manually type Token Name (e.g., "Wrapped Bitcoin")
4. Click "Add Collateral Token"
5. Approve transaction in wallet
6. Wait for confirmation
```

#### 4. Verify Addition
```
1. After successful transaction, the token appears in "Current Supported Collaterals"
2. Users can now immediately use this token for minting BTC1
3. Token will appear in the collateral dropdown in "Buy & Sell" tab
```

### Removing Collateral

**Important**: You can only remove collateral if the vault has ZERO balance of that token.

```
1. Find the token in "Current Supported Collaterals" list
2. Click the "Remove" button (red)
3. Confirm the action in the popup
4. Approve transaction in wallet
5. Wait for confirmation
```

### Example Tokens on Base Sepolia

Common BTC tokens you might want to add:
```javascript
// WBTC (Wrapped Bitcoin)
Address: 0x0b7fCdb2Ac3B6f1821e6FEbcAb6B94ec321802C2
Symbol: WBTC
Name: Wrapped Bitcoin

// cbBTC (Coinbase Wrapped Bitcoin)
Address: 0xC5D5eC386e7D07ca0aF779031e2a43bBA79353A8
Symbol: cbBTC
Name: Coinbase Wrapped Bitcoin

// tBTC (Threshold Bitcoin)
Address: 0x977422a3E5a5974c7411e704d2d312848A74a896
Symbol: tBTC
Name: Threshold Bitcoin
```

### What Happens After Adding?

1. **Smart Contract**: Token is added to the Vault's `supportedCollateral` mapping
2. **Frontend**: Token automatically appears in all collateral selection dropdowns
3. **Users**: Can immediately deposit this token to mint BTC1
4. **Analytics**: Token balances start being tracked in vault

### Safety Checks

The system performs these validations:
- ✅ Is the address a valid ERC20 token?
- ✅ Is the token already supported? (prevents duplicates)
- ✅ Is the caller an admin?
- ✅ Does the token have 8 decimals? (warns if not)

### Troubleshooting

**Error: "Only admin can add collateral tokens"**
- Solution: Make sure you're connected with the admin wallet

**Error: "Invalid token address"**
- Solution: Verify the address is correct and checksummed

**Error: "Token is already supported as collateral"**
- Solution: This token is already added, no action needed

**Error: "Address is not a valid ERC20 token"**
- Solution: The address doesn't implement ERC20 interface

**Warning: "Token has X decimals instead of expected 8"**
- Decision: You can proceed, but be aware this token uses different decimals
- Note: BTC tokens typically use 8 decimals

### Advanced: Direct Contract Interaction

If you prefer to interact with the contract directly:

```javascript
// Using ethers.js
const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);

// Add collateral
await vault.addCollateral(tokenAddress);

// Remove collateral
await vault.removeCollateral(tokenAddress);

// Check if supported
const isSupported = await vault.supportedCollateral(tokenAddress);

// Get vault balance
const balance = await vault.collateralBalances(tokenAddress);
```

### Testing Your Addition

After adding a new collateral:

1. **Test Minting**:
   - Go to "Buy & Sell" tab
   - Select your new token from dropdown
   - Try minting a small amount

2. **Verify in Analytics**:
   - Go to "Analytics" tab
   - Check that your token appears in collateral breakdown

3. **Check Vault Balance**:
   - Return to "Collateral Management"
   - Verify the vault balance increases after mints

### Best Practices

1. **Research First**: Ensure the token is legitimate and represents real BTC
2. **Test on Testnet**: Try on Base Sepolia before mainnet
3. **Start Small**: Add one token at a time
4. **Monitor**: Watch vault balances after addition
5. **Announce**: Inform users about new collateral options
6. **Document**: Keep a record of all added tokens

### Security Notes

⚠️ **Important Security Considerations**:

1. Only add tokens from trusted sources
2. Verify the token contract on block explorer
3. Check the token has appropriate liquidity
4. Ensure the token actually represents BTC collateral
5. Be cautious of scam tokens with similar names
6. Never add tokens with unusual fee mechanisms or rebasing
7. Verify token decimals match BTC standard (8 decimals preferred)

### Emergency: Removing Compromised Collateral

If you need to remove a token urgently:

1. **Check Balance**: Token must have 0 vault balance
2. **If Balance > 0**: Cannot remove directly - need to handle deposits first
3. **Emergency Pause**: Use the pause function if needed
4. **Governance**: Consider governance vote for major decisions

### Questions?

For technical support:
- Check the smart contract code: `contracts/Vault.sol`
- Review the component: `components/collateral-management.tsx`
- Read full documentation: `COLLATERAL_MANAGEMENT_FEATURE.md`

---

**Remember**: Adding collateral is a sensitive operation that affects the entire protocol. Always double-check addresses and test thoroughly!
