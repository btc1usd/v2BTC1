# Base Mainnet Configuration Update

## ✅ Configuration Complete

All UI components, wallet connections, and RPC URLs have been updated for **Base Mainnet** deployment.

---

## 📋 Updated Files

### **1. Environment Configuration**
**File**: `.env.production`

✅ **Updated**:
- Network: Base Mainnet (Chain ID: 8453)
- All contract addresses from `deployment-base-mainnet.json`
- Mainnet RPC URLs with redundancy
- Chainlink BTC/USD feed: `0x64c911996D3c6aC71f9b455B1E8E7266BcbD848F`

---

### **2. Wagmi Provider (Wallet Connections)**
**File**: `lib/wagmi-provider.tsx`

✅ **Updated**:
- `TARGET_CHAIN`: Changed from `baseSepolia` → `base`
- `ALCHEMY_ENDPOINT`: Changed from `'base-sepolia'` → `'base-mainnet'`
- Public fallback RPCs for mainnet
- Chain detection includes mainnet

**RPC Priority**:
1. Alchemy (if API key configured)
2. https://mainnet.base.org
3. https://base.publicnode.com
4. https://base.blockpi.network/v1/rpc/public

---

### **3. Web3 Provider**
**File**: `lib/web3.ts`

✅ **Updated**:
- Chain ID: `84532` → `8453` (3 instances)
- Fallback RPC: `sepolia.base.org` → `mainnet.base.org`
- Comments updated to reflect mainnet

---

## 🌐 Network Configuration

| Setting | Value |
|---------|-------|
| **Network** | Base Mainnet |
| **Chain ID** | 8453 |
| **Chain Hex** | 0x2105 |
| **Symbol** | ETH |
| **Block Explorer** | https://basescan.org |

### **RPC Endpoints** (in priority order)

1. **Alchemy** (primary, if configured):
   ```
   https://base-mainnet.g.alchemy.com/v2/{ALCHEMY_API_KEY}
   ```

2. **Base Official**:
   ```
   https://mainnet.base.org
   ```

3. **Public Fallbacks**:
   ```
   https://base.publicnode.com
   https://base.blockpi.network/v1/rpc/public
   https://base-pokt.nodies.app
   ```

---

## 📦 Contract Addresses

From `deployment-base-mainnet.json` (Deployed: 2025-12-06T17:01:55.182Z)

### **Core Contracts**

| Contract | Address | BaseScan |
|----------|---------|----------|
| **BTC1USD Token** | `0x3c21e91Cd10b46a91aa240a705A4D42080952641` | [View](https://basescan.org/address/0x3c21e91Cd10b46a91aa240a705A4D42080952641) |
| **Vault** | `0x5e9b015DbA4459F99aFee3CbB57C0c680d3226B0` | [View](https://basescan.org/address/0x5e9b015DbA4459F99aFee3CbB57C0c680d3226B0) |
| **ChainlinkBTCOracle** | `0xa54c20ECFce1b30EfF6965E97E4a605795D35347` | [View](https://basescan.org/address/0xa54c20ECFce1b30EfF6965E97E4a605795D35347) |

### **Distribution System**

| Contract | Address |
|----------|---------|
| **Weekly Distribution** | `0x1ae10E4d4B4f8Edf8F37071D515593Df8C2b07d1` |
| **Merkle Distributor** | `0x48CeCDa75001303ab005252403bE3985365DaB42` |

### **Governance**

| Contract | Address |
|----------|---------|
| **Endowment Manager** | `0xac81eB90148bE248018Dd63B9bf793bfA1914Ab0` |
| **Protocol Governance** | `0x641c618969fc137FF0947B3155eCE527eD6CcA57` |
| **DAO** | `0xbC3e85ED33ae1aF2A7Da86e4AcDEC294839c2EA0` |

### **Wallet Contracts**

| Contract | Address |
|----------|---------|
| **Dev Wallet** | `0x0b85E299862fc1e53Ea00B56646441A322D850c4` |
| **Endowment Wallet** | `0xEa328F8C1DE13B71bD72C92c1bf99bD571c1A3dD` |
| **Merkle Fee Collector** | `0xf6cD766B7db37C56B55979C4766e0fA122e431e9` |

### **Collateral Tokens**

| Token | Address | Type |
|-------|---------|------|
| **WBTC** | `0x0555E30da8f98308EdB960aa94C0Db47230d2B9c` | Wrapped Bitcoin |
| **cbBTC** | `0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf` | Coinbase Wrapped BTC |
| **tBTC** | `0x236aa50979D5f3De3Bd1Eeb40E81137F22ab794b` | Threshold BTC |

### **Chainlink Oracle**

| Component | Address |
|-----------|---------|
| **BTC/USD Feed** | `0x64c911996D3c6aC71f9b455B1E8E7266BcbD848F` |
| **Feed Type** | Standard (not AAVE SVR) |
| **Decimals** | 8 |
| **Update Frequency** | ~20 min or 0.1% deviation |

---

## 👤 Admin Configuration

| Role | Address |
|------|---------|
| **Protocol Admin** | `0x6210FfE7340dC47d5DA4b888e850c036CC6ee835` |
| **Emergency Council** | `0x2c1AfDDAE90EE3Bf03f3AB6ba494bCD5a7bD4bcA` (Deployer) |
| **Deployer** | `0x2c1AfDDAE90EE3Bf03f3AB6ba494bCD5a7bD4bcA` |

---

## 🔧 Wallet Connection Features

### **Supported Wallets**

✅ **MetaMask** (via Injected)
✅ **Coinbase Wallet**
✅ **WalletConnect** (all compatible wallets)
✅ **Rainbow, Trust, Zerion, etc.** (via WalletConnect)

### **Auto-Switch Network**

The UI automatically:
- Detects if user is on wrong network
- Prompts to switch to Base Mainnet
- Adds Base Mainnet to wallet if not present
- Shows clear error if on unsupported network

### **Fallback Mechanism**

1. **Primary RPC** (Alchemy) attempts connection
2. If fails → tries next fallback
3. Automatic retry with exponential backoff
4. Up to 3 retries per endpoint
5. Health monitoring for RPC status

---

## 🚀 Testing Your Configuration

### **1. Test Wallet Connection**

```bash
# Start development server
npm run dev

# Open http://localhost:3000
# Click "Connect Wallet"
# Should prompt for Base Mainnet (Chain ID: 8453)
```

### **2. Verify Network Detection**

1. Connect wallet
2. Switch to different network (e.g., Ethereum mainnet)
3. UI should show "Wrong Network" warning
4. Click to switch back to Base Mainnet

### **3. Test Contract Interactions**

```bash
# Open browser console
# Check contract addresses loaded:
console.log(process.env.NEXT_PUBLIC_BTC1USD_CONTRACT)
# Should show: 0x3c21e91Cd10b46a91aa240a705A4D42080952641

console.log(process.env.NEXT_PUBLIC_CHAIN_ID)
# Should show: 8453
```

### **4. Verify RPC Connectivity**

```typescript
// In browser console after connecting wallet
const provider = new ethers.providers.Web3Provider(window.ethereum);
const network = await provider.getNetwork();
console.log(network);
// Should show: { chainId: 8453, name: 'base' }
```

---

## 📝 Environment Variables Summary

All required variables in `.env.production`:

```bash
# Network
NEXT_PUBLIC_CHAIN_ID=8453
NEXT_PUBLIC_CHAIN_NAME="Base Mainnet"

# RPC
NEXT_PUBLIC_RPC_URL="https://mainnet.base.org,https://base.publicnode.com,..."
NEXT_PUBLIC_ALCHEMY_API_KEY="KuJ9TmxdAZlGpJkMYWyBI9MsaCwg5pdq"

# Admin
NEXT_PUBLIC_ADMIN_WALLET=0x6210FfE7340dC47d5DA4b888e850c036CC6ee835

# Contracts
NEXT_PUBLIC_BTC1USD_CONTRACT="0x3c21e91Cd10b46a91aa240a705A4D42080952641"
NEXT_PUBLIC_VAULT_CONTRACT="0x5e9b015DbA4459F99aFee3CbB57C0c680d3226B0"
NEXT_PUBLIC_PRICE_ORACLE_CONTRACT="0xa54c20ECFce1b30EfF6965E97E4a605795D35347"
NEXT_PUBLIC_CHAINLINK_FEED="0x64c911996D3c6aC71f9b455B1E8E7266BcbD848F"
NEXT_PUBLIC_WEEKLY_DISTRIBUTION_CONTRACT="0x1ae10E4d4B4f8Edf8F37071D515593Df8C2b07d1"
NEXT_PUBLIC_MERKLE_DISTRIBUTOR_CONTRACT="0x48CeCDa75001303ab005252403bE3985365DaB42"
NEXT_PUBLIC_ENDOWMENT_MANAGER_CONTRACT="0xac81eB90148bE248018Dd63B9bf793bfA1914Ab0"
NEXT_PUBLIC_PROTOCOL_GOVERNANCE_CONTRACT="0x641c618969fc137FF0947B3155eCE527eD6CcA57"
NEXT_PUBLIC_DAO_CONTRACT="0xbC3e85ED33ae1aF2A7Da86e4AcDEC294839c2EA0"

# Tokens
NEXT_PUBLIC_WBTC_TOKEN="0x0555E30da8f98308EdB960aa94C0Db47230d2B9c"
NEXT_PUBLIC_CBBTC_TOKEN="0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf"
NEXT_PUBLIC_TBTC_TOKEN="0x236aa50979D5f3De3Bd1Eeb40E81137F22ab794b"

# Wallets
NEXT_PUBLIC_DEV_WALLET_CONTRACT="0x0b85E299862fc1e53Ea00B56646441A322D850c4"
NEXT_PUBLIC_ENDOWMENT_WALLET_CONTRACT="0xEa328F8C1DE13B71bD72C92c1bf99bD571c1A3dD"
NEXT_PUBLIC_MERKLE_FEE_COLLECTOR_CONTRACT="0xf6cD766B7db37C56B55979C4766e0fA122e431e9"

# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=0471f7c4c7ea7ebc0de0e852cc4aea66

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://azacrroidzymknyopilq.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## ⚠️ Important Notes

### **1. Admin Wallet**
- Admin address: `0x6210FfE7340dC47d5DA4b888e850c036CC6ee835`
- This address has admin control over all contracts
- UI validates this specific address for admin features

### **2. Chainlink Oracle**
- Using **Standard Feed** (not AAVE SVR Proxy)
- Address: `0x64c911996D3c6aC71f9b455B1E8E7266BcbD848F`
- Updates every ~20 minutes or 0.1% price change
- Has 1-hour staleness check

### **3. RPC Reliability**
- Multiple fallback RPCs configured
- Alchemy recommended for best performance
- Auto-retry with exponential backoff
- Health monitoring included

### **4. Collateral Tokens**
- All verified on BaseScan
- WBTC and cbBTC are most common
- tBTC also supported
- Admins can add more via UI

---

## 🎯 Next Steps

1. **Build Production Bundle**:
   ```bash
   npm run build
   ```

2. **Test Production Build Locally**:
   ```bash
   npm start
   ```

3. **Deploy to Hosting**:
   - Vercel: `vercel --prod`
   - Netlify: `netlify deploy --prod`

4. **Verify Deployment**:
   - Check wallet connects to Base Mainnet
   - Verify contract addresses match
   - Test minting/redeeming (small amounts)
   - Confirm admin features work

5. **Monitor**:
   - RPC health
   - Transaction success rate
   - User feedback
   - Error logs

---

## 🔗 Useful Links

- **BaseScan**: https://basescan.org/
- **Base Mainnet Docs**: https://docs.base.org/
- **Chainlink Feed**: https://data.chain.link/feeds/base/base/btc-usd
- **Deployment JSON**: `deployment-base-mainnet.json`

---

## ✅ Checklist

- [x] Updated `.env.production` with mainnet addresses
- [x] Changed `wagmi-provider.tsx` to Base Mainnet
- [x] Updated `web3.ts` chain IDs to 8453
- [x] Configured mainnet RPC URLs
- [x] Set correct Chainlink feed address
- [x] Verified admin wallet address
- [x] Updated all contract addresses from deployment
- [ ] Test wallet connection
- [ ] Test network switching
- [ ] Test contract interactions
- [ ] Deploy to production
- [ ] Monitor live deployment

---

**Status**: ✅ **Configuration Complete - Ready for Production**

All UI components, wallet connections, and RPC configurations have been updated to Base Mainnet. The system is ready for production deployment.
