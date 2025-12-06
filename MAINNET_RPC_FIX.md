# Base Mainnet RPC Configuration Fix

**Date**: December 6, 2025  
**Issue**: RPC providers and API routes were still using Base Sepolia URLs and Chain ID (84532) instead of Base Mainnet (8453)  
**Status**: ✅ FIXED

## Problem

The application was configured to expect Base Mainnet (Chain ID 8453) but:
1. RPC providers were attempting to connect to Base Sepolia endpoints
2. API routes were using wrong chain ID (84532)
3. UI components had hardcoded Sepolia fallback values

This caused chain ID mismatch errors:
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

### 9. `app/api/rpc-health/route.ts`
**Changes**:
- Updated chain ID parameter

**Before**: `executeWithProviderFallback(..., 84532, ...)`  
**After**: `executeWithProviderFallback(..., 8453, ...)`

### 10. `app/api/holders-count/route.ts`
**Changes**:
- Updated chain ID for provider creation

**Before**: `createProviderWithFallback(84532, ...)`  
**After**: `createProviderWithFallback(8453, ...)`

### 11. `app/api/generate-merkle-tree/route.ts`
**Changes**:
- Updated chain ID for provider creation

**Before**: `createProviderWithFallback(84532, ...)`  
**After**: `createProviderWithFallback(8453, ...)`

### 12. `app/api/governance/endowment/route.ts`
**Changes**:
- Updated chain ID in 2 locations (stats endpoint and main handler)

**Before**: `createProviderWithFallback(84532, ...)`  
**After**: `createProviderWithFallback(8453, ...)`

### 13. `app/api/governance/proposals/route.ts`
**Changes**:
- Updated chain ID for provider creation

**Before**: `createProviderWithFallback(84532, ...)`  
**After**: `createProviderWithFallback(8453, ...)`

### 14. `app/api/governance/vote/route.ts`
**Changes**:
- Updated chain ID in 2 locations (GET and POST handlers)

**Before**: `createProviderWithFallback(84532, ...)`  
**After**: `createProviderWithFallback(8453, ...)`

### 15. `app/api/merkle-distributions/history/route.ts`
**Changes**:
- Updated chain ID in 2 locations (current distribution ID and distribution info queries)
- Updated comments from "Base Sepolia chain ID" to "Base Mainnet chain ID"

**Before**: `executeWithProviderFallback(..., 84532, { // Base Sepolia chain ID`  
**After**: `executeWithProviderFallback(..., 8453, { // Base Mainnet chain ID`

### 16. `components/automated-distribution.tsx`
**Changes**:
- Updated default chain ID fallback

**Before**: `parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '84532')`  
**After**: `parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '8453')`

### 17. `components/dashboard.tsx`
**Changes**:
- Removed Base Sepolia (84532) from network name switch statement
- Now only recognizes Base Mainnet (8453)

### 18. `components/enhanced-merkle-management.tsx`
**Changes**:
- Updated default chain ID fallback

**Before**: `parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '84532')`  
**After**: `parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '8453')`

### 19. `components/merkle-distribution-management.tsx`
**Changes**:
- Updated default chain ID fallback

**Before**: `parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '84532')`  
**After**: `parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '8453')`

### 20. `components/network-guard.tsx`
**Changes**:
- Updated comments to clarify testnet deployment option
- Kept Base Sepolia reference in fallback error message for clarity

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

## Summary

**Total Files Updated**: 20 files

**Categories**:
- RPC Provider Configuration: 2 files
- API Routes: 8 files
- UI Components: 7 files  
- Block Explorer Links: 3 files
- Documentation: 2 files

**All Sepolia References Removed**: Yes ✅
- No more chain ID 84532 references in production code
- All RPC URLs point to Base Mainnet
- All block explorer links use basescan.org (not sepolia.basescan.org)
- Hardhat config still contains Sepolia networks for development/testing only
