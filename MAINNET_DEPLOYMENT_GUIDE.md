# Base Mainnet Deployment Guide

## ❌ Error Fixed: "No signers available"

The deployment error has been **resolved**. The issue was a mismatch between environment variable names.

### What Was Wrong
- Hardhat config used `PRIVATE_KEY` for base-mainnet
- Deployment script expected `DEPLOYER_PRIVATE_KEY`
- This caused the script to not find any signers

### What Was Fixed
✅ Updated `hardhat.config.ts` to use `DEPLOYER_PRIVATE_KEY` consistently
✅ Increased timeout to 120 seconds for mainnet
✅ Added auto gas price configuration

---

## 🚀 Quick Start: Deploy to Base Mainnet

### Step 1: Set Up Your Environment

1. **Create `.env` file** (if you don't have one):
```bash
cp .env.mainnet.example .env
```

2. **Edit `.env` and add your private key**:
```bash
DEPLOYER_PRIVATE_KEY=0xYourPrivateKeyHere
```

3. **(Recommended) Add Alchemy API key**:
```bash
ALCHEMY_API_KEY=your_alchemy_api_key_here
```

4. **(Optional) Add Basescan API key for verification**:
```bash
BASESCAN_API_KEY=your_basescan_api_key_here
```

### Step 2: Verify Prerequisites

✅ **Wallet has at least 0.1 ETH** on Base Mainnet
✅ **Private key is valid** (64 hex characters after 0x)
✅ **Admin address is correct** (0x6210FfE7340dC47d5DA4b888e850c036CC6ee835)
✅ **Tested on Base Sepolia** (highly recommended)

### Step 3: Deploy

```bash
npx hardhat run scripts/deploy-complete-base-mainnet.js --network base-mainnet
```

---

## 📋 Detailed Setup Instructions

### Getting Your Private Key

**⚠️ SECURITY WARNING**: Never share your private key with anyone!

#### From MetaMask:
1. Open MetaMask
2. Click the three dots menu
3. Account Details → Export Private Key
4. Enter your password
5. Copy the private key (starts with 0x)

#### From Hardware Wallet:
For production deployments, consider using:
- Ledger
- Trezor
- Safe (multi-sig)

### Getting Alchemy API Key (Recommended)

1. Go to [alchemy.com](https://alchemy.com)
2. Sign up for free account
3. Create a new app
4. Select "Base Mainnet" as network
5. Copy your API key

Benefits:
- Better reliability than public RPC
- Higher rate limits
- Better error handling
- Free tier is sufficient

### Getting Basescan API Key

1. Go to [basescan.org](https://basescan.org)
2. Sign up for free account
3. Go to API Keys section
4. Create a new API key
5. Copy the key

Benefits:
- Automatic contract verification
- Source code published on explorer
- Better transparency

---

## 🔍 Environment Variables Explained

### Required

**`DEPLOYER_PRIVATE_KEY`**
- Your wallet's private key
- Must start with `0x`
- 64 hex characters
- Wallet must have at least 0.1 ETH on Base Mainnet

### Recommended

**`ALCHEMY_API_KEY`**
- Free from alchemy.com
- Improves deployment reliability
- Better than public RPC

**`BASESCAN_API_KEY`**
- Free from basescan.org
- Enables automatic contract verification
- Makes contracts visible on explorer

### Optional

**`EMERGENCY_COUNCIL`**
- Address for emergency controls
- Defaults to deployer address if not set
- Can be changed later through governance

**Collateral Token Addresses** (already configured):
- `WBTC_ADDRESS` - Default: 0x0555E30da8f98308EdB960aa94C0Db47230d2B9c
- `CBBTC_ADDRESS` - Default: 0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf
- `TBTC_ADDRESS` - Default: 0x236aa50979D5f3De3Bd1Eeb40E81137F22ab794b

---

## 📝 Example .env File

```env
# REQUIRED
DEPLOYER_PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef

# RECOMMENDED
ALCHEMY_API_KEY=abc123xyz456
BASESCAN_API_KEY=XYZ789ABC123

# OPTIONAL
EMERGENCY_COUNCIL=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

---

## ✅ Pre-Deployment Checklist

Before running the deployment script:

- [ ] `.env` file created with your private key
- [ ] Wallet has **at least 0.1 ETH** on Base Mainnet
- [ ] Private key is **64 hex characters** (excluding 0x)
- [ ] Alchemy API key added (recommended)
- [ ] Basescan API key added (for verification)
- [ ] **Tested on Base Sepolia first** (highly recommended!)
- [ ] Admin address verified: `0x6210FfE7340dC47d5DA4b888e850c036CC6ee835`
- [ ] Backed up your `.env` file securely
- [ ] Reviewed collateral token addresses
- [ ] Chainlink feed address verified

---

## 🏗️ What Gets Deployed

The deployment script will deploy in this order:

### 1. Wallet Contracts (Smart Contracts)
- **DevWallet** - Receives 1% dev fees
- **EndowmentWallet** - Receives 0.1% endowment fees
- **MerkleFeeCollector** - Collects merkle distribution fees

### 2. Core Contracts
- **BTC1USD Token** - The main stablecoin
- **PriceOracle** - Chainlink BTC/USD price feed wrapper
- **Vault** - Handles minting, redemption, collateral
- **WeeklyDistribution** - Manages weekly profit distributions
- **EndowmentManager** - Manages charitable endowment
- **MerkleDistributor** - Handles merkle-based claims
- **ProtocolGovernance** - Protocol governance and admin controls
- **GovernanceDAO** - Community governance

### 3. Configuration
- Set vault address in BTC1USD
- Initialize governance with all contract addresses
- Add collateral tokens (WBTC, cbBTC, tBTC)
- Save deployment addresses to JSON

---

## 📊 Deployment Cost Estimate

Based on Base Mainnet gas prices:

| Item | Estimated Gas | Cost (at 0.05 gwei) |
|------|---------------|---------------------|
| Wallet Contracts | ~500k gas | ~0.000025 ETH |
| Core Contracts | ~8M gas | ~0.0004 ETH |
| Configuration | ~500k gas | ~0.000025 ETH |
| **Total** | **~9M gas** | **~0.00045 ETH** |

**Recommended**: Have at least **0.1 ETH** to cover gas + buffer

---

## 🔧 Troubleshooting

### Error: "No signers available"

**Solution**: This is now fixed! Make sure you're using the updated `hardhat.config.ts`

Check:
1. ✅ `DEPLOYER_PRIVATE_KEY` is set in `.env`
2. ✅ Private key is valid (0x + 64 hex chars)
3. ✅ No extra spaces or quotes in `.env`

### Error: "Insufficient balance"

**Solution**: Add more ETH to your deployer wallet

You need at least 0.1 ETH on Base Mainnet:
1. Buy ETH on an exchange
2. Bridge to Base Mainnet via [bridge.base.org](https://bridge.base.org)
3. Or buy directly on Base via on-ramp

### Error: "Connection timeout"

**Solution**: Use Alchemy RPC instead of public RPC

1. Get free Alchemy API key
2. Add to `.env`: `ALCHEMY_API_KEY=your_key_here`
3. Retry deployment

### Error: "Nonce too high" or "Nonce too low"

**Solution**: Wait a few minutes and retry

The script has automatic retry logic for nonce issues.

### Error: "Rate limit exceeded"

**Solution**: 
1. Use Alchemy API key (recommended)
2. Wait 60 seconds between retries
3. Script has automatic rate limit handling

---

## 📱 Post-Deployment Steps

After successful deployment:

### 1. Save Deployment Info
```bash
# Deployment addresses saved to:
deployment-base-mainnet.json
```

### 2. Verify Contracts on Basescan
```bash
# If you have BASESCAN_API_KEY, contracts auto-verify
# Otherwise, manually verify on basescan.org
```

### 3. Update Frontend Configuration
```javascript
// Update lib/contracts.ts with mainnet addresses
export const CONTRACT_ADDRESSES = {
  BTC1USD: "0x...", // From deployment-base-mainnet.json
  VAULT: "0x...",
  // ... etc
}
```

### 4. Test Basic Functions
- Connect to mainnet in your dApp
- Try viewing balances
- Test with small amounts first
- Verify collateral tokens work

### 5. Security Checks
- [ ] Admin address is correct
- [ ] Vault has correct collateral tokens
- [ ] Governance is properly initialized
- [ ] Price oracle is working
- [ ] Emergency pause works (test in emergency)

---

## 🔐 Security Best Practices

### Private Key Management
- ✅ Never commit `.env` to git
- ✅ Use `.gitignore` to exclude `.env`
- ✅ Keep backup in secure location
- ✅ Consider using hardware wallet for production
- ✅ Use multi-sig for admin operations

### Deployment Security
- ✅ Test on Base Sepolia first
- ✅ Review all addresses in deployment script
- ✅ Start with small test transactions
- ✅ Monitor deployment in real-time
- ✅ Verify contracts on Basescan

### Post-Deployment
- ✅ Test all functions with small amounts
- ✅ Monitor for unusual activity
- ✅ Set up alerts for large transactions
- ✅ Have emergency pause plan ready
- ✅ Document all admin actions

---

## 📞 Need Help?

### Check Deployment Status
```bash
# View deployment log
cat deployment-base-mainnet.json

# Check contract on Basescan
https://basescan.org/address/<CONTRACT_ADDRESS>
```

### Common Resources
- [Base Documentation](https://docs.base.org)
- [Hardhat Documentation](https://hardhat.org/docs)
- [Basescan Explorer](https://basescan.org)
- [Alchemy Dashboard](https://dashboard.alchemy.com)

### Verify Contract Manually
If auto-verification fails:
1. Go to contract on Basescan
2. Click "Contract" tab
3. Click "Verify and Publish"
4. Select compiler version: 0.8.20
5. Enable optimization: Yes, 200 runs
6. Paste contract source code

---

## 🎯 Quick Commands Reference

```bash
# Deploy to mainnet
npx hardhat run scripts/deploy-complete-base-mainnet.js --network base-mainnet

# Check your balance on Base Mainnet
npx hardhat run scripts/check-balance.js --network base-mainnet

# Verify contracts (if auto-verify failed)
npx hardhat verify --network base-mainnet <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>

# Test connection to Base Mainnet
npx hardhat console --network base-mainnet
```

---

## ✨ Success Indicators

Your deployment was successful if you see:

```
✅ All contracts deployed
✅ All contracts initialized
✅ All collateral tokens added
✅ Deployment info saved to deployment-base-mainnet.json
✅ Admin address: 0x6210FfE7340dC47d5DA4b888e850c036CC6ee835
```

Next: Update your frontend with the new contract addresses and start testing!

---

**Remember**: This is mainnet deployment with real money. Always test on testnet first!
