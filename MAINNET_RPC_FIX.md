# Base Mainnet RPC Configuration Fix

**Date**: December 6, 2025  
**Issue**: RPC providers were still using Base Sepolia URLs instead of Base Mainnet  
**Status**: ✅ FIXED

## Problem

The application was configured to expect Base Mainnet (Chain ID 8453) but was attempting to connect to Base Sepolia RPC endpoints, causing chain ID mismatch errors:

```
Wrong chain ID: expected 8453 (Base Mainnet), got 84532
```

## Files Updated

### 1. `lib/rpc-provider.ts`
**Changes**:
- Updated Alchemy URL: `base-sepolia` → `base-mainnet`
- Replaced all fallback RPC endpoints with Base Mainnet URLs
- Changed default chain ID from `84532` to `8453`

**Before**:
```typescript
urls.push(`https://base-sepolia.g.alchemy.com/v2/${alchemyKey}`);
urls.push(
  "https://sepolia.base.org",
  "https://base-sepolia.publicnode.com",
  // ...
);
```

**After**:
```typescript
urls.push(`https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`);
urls.push(
  "https://mainnet.base.org",
  "https://base.publicnode.com",
  "https://base.blockpi.network/v1/rpc/public",
  "https://base-pokt.nodies.app",
  "https://base-rpc.publicnode.com"
);
```

### 2. `lib/rpc-health-check.ts`
**Changes**:
- Updated Alchemy endpoint to Base Mainnet
- Replaced fallback endpoints with mainnet URLs

**Before**:
```typescript
endpoints.push(`https://base-sepolia.g.alchemy.com/v2/${alchemyApiKey}`);
endpoints.push(
  'https://base-sepolia.blockpi.network/v1/rpc/public',
  'https://base-sepolia.publicnode.com'
);
```

**After**:
```typescript
endpoints.push(`https://base-mainnet.g.alchemy.com/v2/${alchemyApiKey}`);
endpoints.push(
  'https://mainnet.base.org',
  'https://base.publicnode.com',
  'https://base.blockpi.network/v1/rpc/public',
  'https://base-pokt.nodies.app'
);
```

### 3. `app/api/distribution-analytics/route.ts`
**Changes**:
- Updated default fallback RPC endpoint

**Before**: `['https://sepolia.base.org']`  
**After**: `['https://mainnet.base.org']`

### 4. `app/api/generate-merkle-tree/route.ts`
**Changes**:
- Updated Alchemy URL for holder detection

**Before**: `https://base-sepolia.g.alchemy.com/v2/${alchemyApiKey}`  
**After**: `https://base-mainnet.g.alchemy.com/v2/${alchemyApiKey}`

### 5. `components/dashboard.tsx`
**Changes**:
- Updated Basescan explorer links

**Before**: `https://sepolia.basescan.org/tx/${activity.txHash}`  
**After**: `https://basescan.org/tx/${activity.txHash}`

### 6. `components/distribution-history-viewer.tsx`
**Changes**:
- Updated transaction explorer links

**Before**: `https://sepolia.basescan.org/tx/${event.transactionHash}`  
**After**: `https://basescan.org/tx/${event.transactionHash}`

### 7. `components/wagmi-wallet-connect.tsx`
**Changes**:
- Updated wallet address explorer links
- Updated comment to reflect Base Mainnet

**Before**: `https://sepolia.basescan.org/address/${address}`  
**After**: `https://basescan.org/address/${address}`

### 8. `lib/contracts.ts`
**Changes**:
- Updated comments to reference Base Mainnet deployment

**Before**: `deployment-base-sepolia.json (2025-12-05)`  
**After**: `deployment-base-mainnet.json (2025-12-06)`

## Base Mainnet RPC Endpoints (Priority Order)

1. **Primary**: Environment variables from `.env.production`
   - `https://mainnet.base.org`
   - `https://base.publicnode.com`
   - `https://base.blockpi.network/v1/rpc/public`
   - `https://base-pokt.nodies.app`

2. **Alchemy** (if API key configured):
   - `https://base-mainnet.g.alchemy.com/v2/{API_KEY}`

3. **Fallback Public Endpoints**:
   - `https://base-rpc.publicnode.com`

## Verification

After these changes, the application should:
- ✅ Connect to Base Mainnet (Chain ID 8453)
- ✅ Use correct RPC endpoints
- ✅ Link to correct block explorer (basescan.org)
- ✅ Fetch holder data from mainnet Alchemy API
- ✅ No more chain ID mismatch errors

## Testing

Test RPC connectivity with:
```bash
npm run dev
```

Check browser console for:
```
✅ Successfully created provider using: https://mainnet.base.org
```

## Related Files

- `.env.production` - Contains all mainnet contract addresses and RPC URLs
- `lib/wagmi-provider.tsx` - Configured for Base Mainnet
- `lib/web3.ts` - Uses Chain ID 8453
- `components/network-guard.tsx` - Validates Chain ID 8453

## Notes

- Hardhat configuration (`hardhat.config.ts`) still contains Base Sepolia networks for testing purposes
- These are only used for development and testing, not for production deployment
- All frontend/UI components now exclusively use Base Mainnet
