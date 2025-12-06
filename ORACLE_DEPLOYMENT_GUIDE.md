# ChainlinkBTCOracle Standalone Deployment Guide

## Overview

The `ChainlinkBTCOracle` is a **standalone contract** that wraps Chainlink's BTC/USD price feed for use in the BTC1USD protocol. It can be deployed independently of other protocol contracts.

---

## 🎯 Deployment Strategy

### **Two-Step Admin Transfer Process**

1. **Deploy with deployer key** (temporary admin)
2. **Automatically transfer admin** to configured address

This approach ensures:
- ✅ Deployer controls deployment process
- ✅ Admin receives control immediately after deployment
- ✅ No manual admin transfer needed
- ✅ Secure and auditable process

---

## 📋 Prerequisites

### **1. Environment Setup**

Copy `.env.mainnet.example` to `.env`:
```bash
cp .env.mainnet.example .env
```

### **2. Required Configuration**

Edit `.env` and set:
```bash
# REQUIRED: Your deployer private key
DEPLOYER_PRIVATE_KEY=0xYourPrivateKeyHere

# REQUIRED: Final admin address (receives control after deployment)
ADMIN_ADDRESS=0x6210FfE7340dC47d5DA4b888e850c036CC6ee835

# RECOMMENDED: Alchemy API key for reliable RPC
ALCHEMY_API_KEY=your_alchemy_api_key_here
```

### **3. Network Requirements**

- **Network**: Base Mainnet (chainId: 8453)
- **Gas**: ~0.005 ETH (deployer wallet)
- **RPC**: Alchemy or Base RPC endpoint

---

## 🚀 Deployment Steps

### **Option 1: Use Deployment Script** (Recommended)

```bash
npx hardhat run scripts/deploy-oracle-only.js --network base-mainnet
```

**Expected Output:**
```
🔮 DEPLOYING CHAINLINK BTC ORACLE (STANDALONE)

============================================================
📍 Deploying from address: 0xYourDeployerAddress
💰 Deployer balance: 0.05 ETH
👤 Deployer address: 0xYourDeployerAddress
👤 Final admin will be: 0x6210FfE7340dC47d5DA4b888e850c036CC6ee835
✅ Admin will be transferred after deployment

============================================================

📦 Deploying ChainlinkBTCOracle...
   Initial admin: deployer (temporary)
   Final admin: 0x6210FfE7340dC47d5DA4b888e850c036CC6ee835
⏳ Waiting for deployment confirmation...
✅ ChainlinkBTCOracle deployed to: 0xNewOracleAddress

⏳ Waiting for block confirmations...

🔄 Transferring admin control...
   From: 0xYourDeployerAddress
   To: 0x6210FfE7340dC47d5DA4b888e850c036CC6ee835
⏳ Waiting for admin transfer transaction...
✅ Admin transferred successfully!

🔍 Verifying deployment...
✅ Chainlink feed address: 0x64c911996D3c6aC71f9b455B1E8E7266BcbD848F
✅ Feed decimals: 8
✅ Current BTC price: $89,663.82
✅ Last update: 2025-12-06T17:11:53.000Z
✅ Is stale: ✅ NO (price is fresh)
✅ Admin address: 0x6210FfE7340dC47d5DA4b888e850c036CC6ee835
✅ Admin correctly set to: 0x6210FfE7340dC47d5DA4b888e850c036CC6ee835

============================================================
✅ DEPLOYMENT SUCCESSFUL!
============================================================

📋 Contract Addresses:
ChainlinkBTCOracle: 0xNewOracleAddress

📝 Deployment Information:
- Network: Base Mainnet
- Chainlink Feed: 0x64c911996D3c6aC71f9b455B1E8E7266BcbD848F
- Deployer: 0xYourDeployerAddress
- Current Admin: 0x6210FfE7340dC47d5DA4b888e850c036CC6ee835

💡 Next Steps:
1. ✅ Save the oracle address: 0xNewOracleAddress
2. ✅ Use this address when deploying/configuring Vault
3. ✅ Verify contract on BaseScan:
   https://basescan.org/address/0xNewOracleAddress

✅ Admin control successfully configured!

🎯 Oracle is ready to use in your protocol!
============================================================

📄 Deployment Summary:
{
  "network": "base-mainnet",
  "chainlinkBTCOracle": "0xNewOracleAddress",
  "chainlinkFeed": "0x64c911996D3c6aC71f9b455B1E8E7266BcbD848F",
  "admin": "0x6210FfE7340dC47d5DA4b888e850c036CC6ee835",
  "deployer": "0xYourDeployerAddress",
  "timestamp": "2025-12-06T18:30:00.000Z"
}
```

---

### **Option 2: Manual Deployment** (Console)

```bash
npx hardhat console --network base-mainnet
```

In console:
```javascript
const [deployer] = await ethers.getSigners();
const adminAddress = "0x6210FfE7340dC47d5DA4b888e850c036CC6ee835";

// Deploy with deployer as temporary admin
const ChainlinkBTCOracle = await ethers.getContractFactory("ChainlinkBTCOracle");
const oracle = await ChainlinkBTCOracle.deploy(deployer.address);
await oracle.waitForDeployment();
const oracleAddress = await oracle.getAddress();
console.log("Oracle deployed to:", oracleAddress);

// Transfer admin
const tx = await oracle.transferAdmin(adminAddress);
await tx.wait();
console.log("Admin transferred to:", adminAddress);

// Verify
console.log("Current admin:", await oracle.admin());
```

---

## 🔍 Verification

### **Test Live Price Feed**

```bash
npx hardhat run scripts/test-chainlink-feed.js --network base-mainnet
```

### **Verify Contract on BaseScan**

```bash
npx hardhat verify --network base-mainnet <ORACLE_ADDRESS> "0x6210FfE7340dC47d5DA4b888e850c036CC6ee835"
```

---

## 📊 Technical Details

### **Contract Information**

| Property | Value |
|----------|-------|
| **Contract** | ChainlinkBTCOracle |
| **Network** | Base Mainnet (chainId: 8453) |
| **Chainlink Feed** | `0x64c911996D3c6aC71f9b455B1E8E7266BcbD848F` |
| **Feed Type** | BTC/USD Standard Feed |
| **Decimals** | 8 |
| **Update Frequency** | ~20 minutes or 0.1% deviation |
| **Staleness Threshold** | 1 hour |

### **Constructor Parameters**

```solidity
constructor(address _admin)
```

- `_admin`: Initial admin address (will be deployer, then transferred)

### **Deployment Flow**

```
1. Deploy with deployer.address as admin
   ↓
2. Contract deployed successfully
   ↓
3. Wait for confirmations
   ↓
4. Call transferAdmin(ADMIN_ADDRESS)
   ↓
5. Admin control transferred
   ↓
6. Verify admin is correctly set
   ↓
7. Oracle ready to use
```

---

## 🔗 Integration

### **Using in Vault Deployment**

When deploying your Vault contract, use the oracle address:

```javascript
const Vault = await ethers.getContractFactory("Vault");
const vault = await Vault.deploy(
    btc1usdAddress,
    oracleAddress,        // ← ChainlinkBTCOracle address
    adminAddress,
    devWalletAddress,
    endowmentWalletAddress
);
```

### **Required Interface**

The oracle implements `IPriceOracle`:

```solidity
interface IPriceOracle {
    function getBTCPrice() external view returns (uint256);
    function getPrice(address token) external view returns (uint256);
    function getLastUpdate() external view returns (uint256);
    function isStale() external view returns (bool);
    function updatePrice() external;
    function updatePrice(uint256 _newPrice) external;
}
```

---

## 🔐 Security

### **Admin Functions**

Only admin can:
- `transferAdmin(address newAdmin)` - Transfer admin role
- `setCollateralFeed(address token, address feed, uint8 decimals)` - Set custom feeds

### **Safety Features**

- ✅ Staleness check (rejects prices >1 hour old)
- ✅ Price validation (must be >0)
- ✅ Round completion check
- ✅ Decimal normalization to 8 decimals
- ✅ Admin-only sensitive functions

### **Best Practices**

1. **Use multisig for admin** in production
2. **Test on Base Sepolia** first
3. **Monitor price feed** status
4. **Keep admin keys** secure
5. **Verify on BaseScan** after deployment

---

## ⚠️ Troubleshooting

### **Admin Transfer Failed**

If automatic admin transfer fails:

```javascript
// Connect to deployed oracle
const oracle = await ethers.getContractAt(
    "ChainlinkBTCOracle",
    "0xOracleAddress"
);

// Manually transfer admin
const tx = await oracle.transferAdmin("0x6210FfE7340dC47d5DA4b888e850c036CC6ee835");
await tx.wait();

// Verify
console.log("New admin:", await oracle.admin());
```

### **Price Feed Not Working**

Check:
1. Network is Base Mainnet (chainId: 8453)
2. Chainlink feed address is correct
3. RPC endpoint is responding
4. Price is not stale (check timestamp)

### **Deployment Out of Gas**

Increase gas limit in `hardhat.config.ts`:
```javascript
gas: 3000000,
gasPrice: "auto"
```

---

## 📝 Post-Deployment Checklist

- [ ] Oracle deployed successfully
- [ ] Admin transferred to correct address
- [ ] Admin verified on-chain
- [ ] Price feed working (test script passed)
- [ ] Oracle address saved
- [ ] Contract verified on BaseScan
- [ ] Integration tested with Vault
- [ ] Documentation updated with oracle address

---

## 🔗 References

- **Chainlink Feed**: https://data.chain.link/feeds/base/base/btc-usd
- **BaseScan**: https://basescan.org/
- **Base Docs**: https://docs.base.org/
- **Deployment Script**: `scripts/deploy-oracle-only.js`
- **Test Script**: `scripts/test-chainlink-feed.js`

---

## 💡 Key Points

1. ✅ **Standalone Deployment** - No dependencies on other contracts
2. ✅ **Automatic Admin Transfer** - Script handles everything
3. ✅ **Live Price Feed** - Connects to real Chainlink oracle
4. ✅ **Production Ready** - Verified addresses and configuration
5. ✅ **Secure Process** - Deployer → Admin transfer pattern

---

**Questions or Issues?** Check the troubleshooting section or review the deployment logs for details.
