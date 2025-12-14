# Production Error Fix - Serverless Environment Compatibility

## Date
2025-12-14

## Issue
Production deployment failing with error:
```
Failed to generate merkle tree:
Unexpected token '<', "<HTML> <HE"... is not valid JSON
```

## Root Cause
The API route was trying to use Node.js `fs` (file system) module in serverless environments (Netlify/Vercel), which:
1. Causes server crashes when `fs` operations fail
2. Returns HTML error pages instead of JSON
3. Doesn't have access to deployment JSON files in serverless builds

## Solution

### 1. Environment-Aware Contract Loading
**Changed**: `getContractAddresses()` function

**Before**:
- Always tried to load from deployment JSON files
- Required `fs` module in serverless environments
- Would crash if files not found

**After**:
- **First**: Try environment variables (preferred for production)
- **Second**: Only use `fs` if NOT in serverless environment
- **Third**: Return helpful error if both fail

```typescript
// First try environment variables (preferred for production)
if (btc1usd && weeklyDistribution && merkleDistributor) {
  console.log('✅ Using contract addresses from environment variables');
  return { btc1usd, weeklyDistribution, merkleDistributor };
}

// Only try file system in non-serverless environments
if (typeof window === 'undefined' && !process.env.LAMBDA_TASK_ROOT && !process.env.NETLIFY) {
  // Try to load from deployment files
}
```

### 2. Serverless-Safe File Saving
**Changed**: Distribution data saving logic

**Before**:
- Always tried to save to file system
- Would throw errors in serverless environments

**After**:
- **Serverless (Netlify/Vercel)**: Only uses Supabase, skips `fs` completely
- **Local Development**: Falls back to file system if Supabase fails
- **Proper Error Handling**: Returns JSON error instead of crashing

```typescript
// Save to file system as FALLBACK for local development only
if (!process.env.LAMBDA_TASK_ROOT && !process.env.NETLIFY && !supabaseSuccess) {
  // Use file system
} else if (process.env.LAMBDA_TASK_ROOT || process.env.NETLIFY) {
  console.log('💁 Serverless environment detected');
  if (!supabaseSuccess) {
    // Return proper JSON error
  }
}
```

## Required Environment Variables

For production deployment, ensure these are set in your Netlify/Vercel environment:

### Contract Addresses (REQUIRED)
```bash
NEXT_PUBLIC_BTC1USD_CONTRACT=0x6dC9C43278AeEa063c01d97505f215ECB6da4a21
NEXT_PUBLIC_WEEKLY_DISTRIBUTION_CONTRACT=0x...
NEXT_PUBLIC_MERKLE_DISTRIBUTOR_CONTRACT=0x...
```

### Supabase Configuration (REQUIRED)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Other Required Variables
```bash
ALCHEMY_API_KEY=your-alchemy-key
NEXT_PUBLIC_CHAIN_ID=8453
```

## Environment Detection

The code now detects serverless environments using:
- `process.env.LAMBDA_TASK_ROOT` (AWS Lambda/Netlify Functions)
- `process.env.NETLIFY` (Netlify)
- `typeof window === 'undefined'` (Server-side check)

## Error Handling Improvements

### Before
- Crashed with unhandled errors
- Returned HTML error pages
- No helpful error messages

### After
- **Always returns JSON** (never HTML)
- **Helpful error messages** with specific suggestions
- **Proper HTTP status codes** (500 for server errors)

Example error response:
```json
{
  "error": "Failed to save distribution to Supabase",
  "details": "Supabase is required in production/serverless environments",
  "suggestions": [
    "Verify NEXT_PUBLIC_SUPABASE_URL is set correctly",
    "Verify NEXT_PUBLIC_SUPABASE_ANON_KEY is set correctly",
    "Check Supabase service status",
    "Verify merkle_distributions table exists"
  ]
}
```

## Testing

### Local Development
✅ Works with file system fallback if Supabase fails
✅ Can load contracts from deployment JSON files
✅ File system saving works normally

### Production (Netlify/Vercel)
✅ Uses environment variables for contracts
✅ Uses Supabase exclusively for storage
✅ Returns proper JSON errors instead of HTML
✅ No `fs` module usage

## Deployment Checklist

Before deploying to production:

- [ ] Set all contract address environment variables
- [ ] Set Supabase URL and API key
- [ ] Set Alchemy API key
- [ ] Verify Supabase `merkle_distributions` table exists
- [ ] Test API endpoint after deployment
- [ ] Check serverless function logs for any errors

## Verification Steps

After deployment:

1. **Check Environment Variables**:
   ```bash
   # In Netlify/Vercel dashboard
   - Verify all NEXT_PUBLIC_* variables are set
   - Verify ALCHEMY_API_KEY is set
   ```

2. **Test API Endpoint**:
   ```bash
   curl -X POST https://app.btc1usd.com/api/generate-merkle-tree
   ```

3. **Verify Response**:
   - Should return JSON (not HTML)
   - Should have `success: true` if working
   - Should have helpful error message if failing

4. **Check Logs**:
   - Look for "✅ Using contract addresses from environment variables"
   - Look for "💁 Serverless environment detected"
   - Look for "✅ Distribution saved to Supabase successfully"

## Related Files Modified

- `/app/api/generate-merkle-tree/route.ts` - Main API route with fixes

## Prevention

To prevent similar issues in the future:

1. **Always check for serverless environment** before using `fs`
2. **Prefer environment variables** over config files in production
3. **Always return JSON** from API routes (never throw unhandled errors)
4. **Test in serverless environments** before deploying

## Rollback Plan

If issues persist:

1. Check Netlify/Vercel function logs
2. Verify all environment variables are set
3. Test Supabase connection separately
4. Revert to previous deployment if needed

## Success Criteria

✅ API returns JSON (not HTML error pages)
✅ Merkle tree generation completes successfully
✅ Distribution data saved to Supabase
✅ No `fs` module errors in production logs
