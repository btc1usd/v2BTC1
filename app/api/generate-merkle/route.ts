// app/api/generate-merkle/route.ts

import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { MerkleTree } from 'merkletreejs';
import { keccak256 } from 'viem';
import pLimit from 'p-limit';
import { createProviderWithFallback } from '@/lib/rpc-provider';

/* =====================================================
   CONFIG
===================================================== */

// Use the chain ID from environment variables
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "8453");
const IS_TESTNET = CHAIN_ID === 84532;
const CONCURRENCY = Number(process.env.CONCURRENCY || 8);
const FROM_BLOCK = '0x0';
const TO_BLOCK = 'latest';
const BTC1_DECIMALS = 8;

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY!;
const ALCHEMY_RPC = IS_TESTNET
  ? `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`
  : `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;

const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY;
const BASESCAN_API_URL = IS_TESTNET
  ? 'https://api-sepolia.basescan.org/api'
  : 'https://api.basescan.org/api';

const BTC1 = ethers.getAddress(
  process.env.NEXT_PUBLIC_BTC1USD_CONTRACT!
).toLowerCase();

const EXCLUDED_ADDRESSES = [
  process.env.NEXT_PUBLIC_DEV_WALLET_CONTRACT,
  process.env.NEXT_PUBLIC_ENDOWMENT_WALLET_CONTRACT,
  process.env.NEXT_PUBLIC_MERKLE_DISTRIBUTOR_CONTRACT,
  process.env.NEXT_PUBLIC_WEEKLY_DISTRIBUTION_CONTRACT
].filter(Boolean).map(a => ethers.getAddress(a!).toLowerCase());

const ZERO = '0x0000000000000000000000000000000000000000';

/* =====================================================
   ABIs
===================================================== */

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)'
];

const UNIV2_PAIR_ABI = [
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function getReserves() view returns (uint112,uint112,uint32)',
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)'
];

const AERODROME_POOL_ABI = [
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function reserve0() view returns (uint256)',
  'function reserve1() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)'
];

const CL_POOL_ABI = [
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint8,bool)'
];

const POSITION_MANAGER = '0x827922686190790b37229fd06084350E74485b72';
const POSITION_MANAGER_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function tokenOfOwnerByIndex(address,uint256) view returns (uint256)',
  'function positions(uint256) view returns (uint96,address,address,address,uint24,int24,int24,uint128,uint256,uint256)',
  'function ownerOf(uint256) view returns (address)',
  'event IncreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
  'event DecreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
];

const WEEKLY_DISTRIBUTION_ABI = [
  'function getCurrentDistributionInfo() view returns (uint256 distributionId, uint256 rewardPerToken, uint256 totalSupply, uint256 timestamp)',
  'function distributionCount() view returns (uint256)',
  'function getExcludedAddresses() view returns (address[])'
];

/* =====================================================
   BASESCAN API - TOKEN HOLDERS
===================================================== */

/**
 * Get token holders from BaseScan API
 * More reliable than Alchemy for getting actual holder balances
 */
async function getHoldersFromBaseScan(tokenAddress: string): Promise<Array<{ address: string; balance: bigint }>> {
  if (!BASESCAN_API_KEY) {
    console.warn('⚠️ BASESCAN_API_KEY not configured, skipping BaseScan method');
    console.warn('💡 Add BASESCAN_API_KEY to your .env.local file');
    console.warn('💡 Get free API key from: https://basescan.org/myapikey');
    return [];
  }

  // Validate API key format
  if (BASESCAN_API_KEY.length < 20 || BASESCAN_API_KEY.includes('your_')) {
    console.warn('⚠️ BASESCAN_API_KEY appears to be invalid or placeholder');
    console.warn('💡 Current value:', BASESCAN_API_KEY.substring(0, 10) + '...');
    return [];
  }

  try {
    console.log('🔍 Fetching token holders from BaseScan API...');
    
    // BaseScan API endpoint for token holder list
    // https://docs.basescan.org/api-endpoints/tokens#get-token-holder-list-by-address
    const url = new URL(BASESCAN_API_URL);
    url.searchParams.append('module', 'token');
    url.searchParams.append('action', 'tokenholderlist');
    url.searchParams.append('contractaddress', tokenAddress);
    url.searchParams.append('page', '1');
    url.searchParams.append('offset', '10000'); // Max 10,000 holders
    url.searchParams.append('apikey', BASESCAN_API_KEY);

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      console.warn(`⚠️ BaseScan API HTTP error: ${response.status}`);
      return [];
    }

    const data = await response.json();

    if (data.status !== '1') {
      // BaseScan returns detailed error messages
      const errorMsg = data.message || data.result || 'Unknown error';
      console.warn(`⚠️ BaseScan API error: ${errorMsg}`);
      
      // Log more details for debugging
      if (errorMsg.includes('Invalid API Key')) {
        console.warn('💡 Hint: Check your BASESCAN_API_KEY in .env.local');
        console.warn('💡 Get API key from: https://basescan.org/myapikey');
      } else if (errorMsg.includes('rate limit')) {
        console.warn('💡 Hint: BaseScan rate limit exceeded, falling back to Alchemy');
      } else {
        console.warn('💡 Full response:', JSON.stringify(data));
      }
      
      return [];
    }

    const holders = (data.result || []).map((holder: any) => ({
      address: holder.TokenHolderAddress.toLowerCase(),
      balance: BigInt(holder.TokenHolderQuantity)
    }));

    console.log(`✅ BaseScan found ${holders.length} token holders`);
    return holders;

  } catch (error) {
    console.warn('⚠️ BaseScan API failed:', error instanceof Error ? error.message : error);
    return [];
  }
}

/* =====================================================
   ALCHEMY API - FALLBACK
===================================================== */

function normalize(addr?: string | null) {
  if (!addr) return null;
  const a = addr.trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(a)) return null;
  return a;
}

async function alchemyTransfers(contract: string): Promise<string[]> {
  try {
    const res = await fetch(ALCHEMY_RPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'alchemy_getAssetTransfers',
        params: [{
          fromBlock: FROM_BLOCK,
          toBlock: TO_BLOCK,
          contractAddresses: [contract],
          category: ['erc20'],
          excludeZeroValue: true,
          maxCount: '0x3e8' // Limit to 1000 transfers
        }]
      })
    });

    if (!res.ok) {
      console.warn(`⚠️ Alchemy API error: ${res.status}`);
      return [];
    }

    const json = await res.json();
    
    if (json.error) {
      console.warn(`⚠️ Alchemy API error: ${json.error.message}`);
      return [];
    }

    const set = new Set<string>();

    for (const t of json?.result?.transfers || []) {
      const f = normalize(t.from);
      const to = normalize(t.to);
      if (f && f !== ZERO) set.add(f);
      if (to && to !== ZERO) set.add(to);
    }

    console.log(`✅ Found ${set.size} unique addresses from transfers`);
    return [...set];
  } catch (error) {
    console.warn(`⚠️ Alchemy transfers failed:`, error instanceof Error ? error.message : error);
    return [];
  }
}

async function isContract(
  provider: ethers.JsonRpcProvider,
  addr: string
) {
  try {
    const code = await provider.getCode(addr);
    return code !== '0x';
  } catch (error) {
    console.warn(`⚠️ Failed to check if ${addr} is contract, treating as EOA`);
    return false; // Treat as EOA if check fails
  }
}

/* ---- SAFE balanceOf (never reverts) ---- */

async function safeBalanceOf(
  token: ethers.Contract,
  provider: ethers.JsonRpcProvider,
  addr: string
): Promise<bigint> {
  try {
    const b = await token.balanceOf(addr);
    return BigInt(b.toString());
  } catch {
    return 0n;
  }
}

/* =====================================================
   POOL TYPE DETECTION
===================================================== */

const POOL_TYPES = {
  UNISWAP_V2: 'UniswapV2',
  AERODROME: 'Aerodrome',
  UNISWAP_V3: 'UniswapV3',
  CURVE: 'Curve',
  BALANCER: 'Balancer',
  UNKNOWN: 'Unknown'
} as const;

type PoolType = typeof POOL_TYPES[keyof typeof POOL_TYPES];

async function detectPoolTypeBySelectors(
  provider: ethers.JsonRpcProvider,
  addr: string
): Promise<PoolType[]> {
  const detectedTypes: PoolType[] = [];
  
  try {
    // UniswapV2: getReserves() selector = 0x0902f1ac
    try {
      const uniV2 = new ethers.Contract(addr, UNIV2_PAIR_ABI, provider);
      const reserves = await uniV2.getReserves();
      if (reserves) detectedTypes.push(POOL_TYPES.UNISWAP_V2);
    } catch {}
    
    // Aerodrome: reserve0() and reserve1() selectors
    try {
      const aero = new ethers.Contract(addr, AERODROME_POOL_ABI, provider);
      const r0 = await aero.reserve0();
      if (r0 !== undefined) detectedTypes.push(POOL_TYPES.AERODROME);
    } catch {}
    
    // UniswapV3/Slipstream: slot0() selector = 0x3850c7bd
    try {
      const uniV3 = new ethers.Contract(addr, CL_POOL_ABI, provider);
      const slot0 = await uniV3.slot0();
      if (slot0) detectedTypes.push(POOL_TYPES.UNISWAP_V3);
    } catch {}
    
    // Curve: coins(uint256) selector = 0xeb8d72b7
    try {
      const curve = new ethers.Contract(addr, ['function coins(uint256) view returns (address)'], provider);
      await curve.coins(0);
      detectedTypes.push(POOL_TYPES.CURVE);
    } catch {}
    
    // Balancer: getPoolId() selector = 0xf94d4668
    try {
      const bal = new ethers.Contract(addr, ['function getPoolId() view returns (bytes32)'], provider);
      await bal.getPoolId();
      detectedTypes.push(POOL_TYPES.BALANCER);
    } catch {}
  } catch {}
  
  return detectedTypes;
}

async function detectPoolType(
  provider: ethers.JsonRpcProvider,
  addr: string
): Promise<PoolType> {
  try {
    const types = await detectPoolTypeBySelectors(provider, addr);
    return types.length > 0 ? types[0] : POOL_TYPES.UNKNOWN;
  } catch {
    return POOL_TYPES.UNKNOWN;
  }
}

async function isLPPool(
  provider: ethers.JsonRpcProvider,
  addr: string
): Promise<boolean> {
  if (!(await isContract(provider, addr))) return false;
  const poolType = await detectPoolType(provider, addr);
  return poolType !== POOL_TYPES.UNKNOWN;
}

/* =====================================================
   LP DETECTION (OLD - KEPT FOR REFERENCE)
===================================================== */

async function detectLPType(
  provider: ethers.JsonRpcProvider,
  addr: string
): Promise<'UNIV2' | 'AERODROME' | 'UNIV3' | null> {

  try {
    const p = new ethers.Contract(addr, UNIV2_PAIR_ABI, provider);
    const [t0, t1, r, ts] = await Promise.all([
      p.token0(),
      p.token1(),
      p.getReserves(),
      p.totalSupply()
    ]);

    if (
      BigInt(ts) > 0n &&
      (t0.toLowerCase() === BTC1 || t1.toLowerCase() === BTC1) &&
      (BigInt(r[0]) > 0n || BigInt(r[1]) > 0n)
    ) return 'UNIV2';
  } catch {}

  try {
    const p = new ethers.Contract(addr, AERODROME_POOL_ABI, provider);
    const [t0, t1, r, ts] = await Promise.all([
      p.token0(),
      p.token1(),
      p.getReserves ? p.getReserves() : Promise.all([p.reserve0(), p.reserve1()]),
      p.totalSupply()
    ]);

    if (
      BigInt(ts) > 0n &&
      (t0.toLowerCase() === BTC1 || t1.toLowerCase() === BTC1) &&
      (BigInt(Array.isArray(r) ? r[0] : r) > 0n)
    ) return 'AERODROME';
  } catch {}

  try {
    const uniV3 = new ethers.Contract(addr, CL_POOL_ABI, provider);
    const [t0, t1, slot0] = await Promise.all([
      uniV3.token0(),
      uniV3.token1(),
      uniV3.slot0()
    ]);

    if (
      slot0 &&
      (t0.toLowerCase() === BTC1 || t1.toLowerCase() === BTC1)
    ) return 'UNIV3';
  } catch {}

  return null;
}

/* =====================================================
   LP PROVIDERS
===================================================== */

async function lpProviders(
  provider: ethers.JsonRpcProvider,
  lpAddr: string,
  type: 'UNIV2' | 'AERODROME' | 'UNIV3'
): Promise<Map<string, bigint>> {

  const holders = await alchemyTransfers(lpAddr);
  const out = new Map<string, bigint>();

  if (type === 'UNIV2') {
    const p = new ethers.Contract(lpAddr, UNIV2_PAIR_ABI, provider);
    const [ts, t0, r] = await Promise.all([
      p.totalSupply(),
      p.token0(),
      p.getReserves()
    ]);

    const btc1Reserve =
      t0.toLowerCase() === BTC1 ? BigInt(r[0]) : BigInt(r[1]);

    for (const h of holders) {
      if (EXCLUDED_ADDRESSES.includes(h)) continue;

      try {
        const lp = BigInt(await p.balanceOf(h));
        if (lp === 0n) continue;

        const share = (lp * btc1Reserve) / BigInt(ts);
        if (share > 0n) out.set(h, share);
      } catch {}
    }
  }

  if (type === 'AERODROME') {
    const p = new ethers.Contract(lpAddr, AERODROME_POOL_ABI, provider);
    const [ts, t0] = await Promise.all([
      p.totalSupply(),
      p.token0()
    ]);
    
    const [r0, r1] = await Promise.all([
      p.reserve0(),
      p.reserve1()
    ]);

    const btc1Reserve =
      t0.toLowerCase() === BTC1 ? BigInt(r0) : BigInt(r1);

    for (const h of holders) {
      if (EXCLUDED_ADDRESSES.includes(h)) continue;

      try {
        const lp = BigInt(await p.balanceOf(h));
        if (lp === 0n) continue;

        const share = (lp * btc1Reserve) / BigInt(ts);
        if (share > 0n) out.set(h, share);
      } catch {}
    }
  }
  
  // UniswapV3 uses NFT positions - skip for now in API route
  // Full implementation would require event scanning like the script
  if (type === 'UNIV3') {
    console.log('⚠️ UniswapV3 pool detected - skipping (NFT positions not yet supported in API)');
  }

  return out;
}

/* =====================================================
   API ROUTE
===================================================== */

export async function POST() {
  try {
    const provider = await createProviderWithFallback(CHAIN_ID);
    const limit = pLimit(CONCURRENCY);

    const btc1 = new ethers.Contract(BTC1, ERC20_ABI, provider);

    // Get Weekly Distribution contract
    const weeklyDistributionAddr = process.env.NEXT_PUBLIC_WEEKLY_DISTRIBUTION_CONTRACT;
    if (!weeklyDistributionAddr) {
      throw new Error('NEXT_PUBLIC_WEEKLY_DISTRIBUTION_CONTRACT not configured');
    }

    const weeklyDistribution = new ethers.Contract(
      weeklyDistributionAddr,
      WEEKLY_DISTRIBUTION_ABI,
      provider
    );

    // Get current distribution info from contract
    let rewardPerToken: bigint;
    let distributionId = 0n;
    try {
      const result = await weeklyDistribution.getCurrentDistributionInfo();
      distributionId = BigInt(result[0].toString());
      rewardPerToken = BigInt(result[1].toString());
      console.log(`📊 Distribution ID: ${distributionId}, rewardPerToken: ${rewardPerToken} (${ethers.formatUnits(rewardPerToken, 8)} BTC1)`);
    } catch (error: any) {
      // If no distributions exist yet, use default reward
      if (error.message?.includes('No distributions yet')) {
        console.log('ℹ️ No distributions executed yet, using default reward (1¢)');
        rewardPerToken = BigInt(1_000_000); // Default: 0.01 BTC1 (1¢) in 8 decimals
      } else {
        console.warn('⚠️ Could not get distribution info:', error.message || error);
        console.log('ℹ️ Using default reward (1¢)');
        rewardPerToken = BigInt(1_000_000);
      }
    }

    /* ---- STEP 1: GET TOKEN HOLDERS ---- */
    // Try BaseScan API first (more reliable and includes balances)
    let holdersWithBalances = await getHoldersFromBaseScan(BTC1);
    const balances = new Map<string, bigint>();

    if (holdersWithBalances.length > 0) {
      console.log(`✅ Using BaseScan data: ${holdersWithBalances.length} holders`);
      
      // Filter out excluded addresses and contracts
      for (const holder of holdersWithBalances) {
        const addr = holder.address.toLowerCase();
        
        // Skip excluded addresses
        if (EXCLUDED_ADDRESSES.includes(addr)) {
          console.log(`  ⊛ Excluding protocol wallet: ${addr}`);
          continue;
        }
        
        // Skip zero balances
        if (holder.balance === 0n) continue;
        
        balances.set(addr, holder.balance);
        console.log(`  ✓ ${addr}: ${ethers.formatUnits(holder.balance, 8)} BTC1`);
      }

      console.log(`💰 ${balances.size} eligible holders (excluded ${holdersWithBalances.length - balances.size} protocol wallets/zero balances)`);

      // Skip LP detection for now since we have actual balances from BaseScan
      // LP shares are already reflected in holder balances on BaseScan
    } else {
      console.log('⚠️ BaseScan unavailable, falling back to Alchemy + RPC method...');
      
      /* ---- FALLBACK: ALCHEMY + RPC ---- */
      const touched = (await alchemyTransfers(BTC1))
        .filter(a => !EXCLUDED_ADDRESSES.includes(a));

      if (touched.length === 0) {
        throw new Error('No token holders found. The token may not have any transfers yet, or both BaseScan and Alchemy APIs are unavailable.');
      }

      console.log(`📊 Found ${touched.length} potential holders (excluding protocol wallets)`);

      /* ---- STEP 2: CLASSIFY HOLDERS (EOAs vs LP Pools) ---- */
      const eoas: string[] = [];
      const detectedPools: Array<{ address: string; type: PoolType }> = [];

      // Add delay between batches to avoid rate limiting
      const batchSize = 10;
      for (let i = 0; i < touched.length; i += batchSize) {
        const batch = touched.slice(i, i + batchSize);
        await Promise.all(
          batch.map(a => limit(async () => {
            const isContractAddr = await isContract(provider, a);
            if (isContractAddr) {
              // Check if it's an LP pool
              const poolType = await detectPoolType(provider, a);
              if (poolType !== POOL_TYPES.UNKNOWN) {
                detectedPools.push({ address: a, type: poolType });
                console.log(`  🏊 LP Pool detected: ${a} (${poolType})`);
              } else {
                // Non-pool contracts are treated as EOAs (smart wallets, etc.)
                eoas.push(a);
              }
            } else {
              eoas.push(a);
            }
          }))
        );
        // Small delay between batches
        if (i + batchSize < touched.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`👥 ${eoas.length} EOAs (including smart wallets), ${detectedPools.length} LP pools detected`);

      /* ---- STEP 3: PROCESS DIRECT BTC1 BALANCES ---- */
      // Process all EOAs (including smart wallets/contracts that aren't LP pools)
      const eoaBatchSize = 20;
      for (let i = 0; i < eoas.length; i += eoaBatchSize) {
        const batch = eoas.slice(i, i + eoaBatchSize);
        await Promise.all(
          batch.map(a => limit(async () => {
            const b = await safeBalanceOf(btc1, provider, a);
            if (b > 0n) {
              balances.set(a, b);
              console.log(`  ✓ ${a}: ${ethers.formatUnits(b, 8)} BTC1`);
            }
          }))
        );
        // Small delay between batches
        if (i + eoaBatchSize < eoas.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      console.log(`💰 ${balances.size} holders with non-zero balances`);

      /* ---- STEP 4: PROCESS LP POOLS ---- */
      for (const { address: sc, type: poolType } of detectedPools) {
        console.log(`🔍 Processing ${poolType} pool: ${sc}`);
        
        // Remove pool's direct balance (we'll expand it to LP holders)
        if (balances.has(sc)) {
          console.log(`  ♻️ Removing direct balance, will expand to LP holders`);
          balances.delete(sc);
        }
        
        const lpType = await detectLPType(provider, sc);
        if (!lpType) continue;

        const lpMap = await lpProviders(provider, sc, lpType);
        for (const [addr, share] of lpMap) {
          balances.set(addr, (balances.get(addr) || 0n) + share);
          console.log(`  └─ LP holder ${addr.slice(0,10)}... = ${ethers.formatUnits(share, 8)} BTC1 (total: ${ethers.formatUnits(balances.get(addr)!, 8)})`);
        }
      }
    }

    /* ---- FINAL EXCLUSION SAFETY ---- */
    for (const ex of EXCLUDED_ADDRESSES) balances.delete(ex);

    /* ---- STEP 5: MERKLE ---- */
    // Calculate rewards using rewardPerToken from contract
    // Formula: (balance * rewardPerToken) / 1e8
    let idx = 0;
    let totalRewards = 0n;
    const claims = [...balances.entries()].map(([addr, bal]) => {
      const rewardAmount = (bal * rewardPerToken) / BigInt(10 ** BTC1_DECIMALS);
      totalRewards += rewardAmount;
      return {
        index: idx++,
        account: addr,
        amount: rewardAmount.toString()
      };
    });

    console.log(`📈 Total rewards: ${ethers.formatUnits(totalRewards, BTC1_DECIMALS)} BTC1 for ${claims.length} holders`);
    console.log(`📈 Avg reward per holder: ${ethers.formatUnits(totalRewards / BigInt(claims.length || 1), BTC1_DECIMALS)} BTC1`);

    if (totalRewards === 0n) {
      console.warn('⚠️ Total rewards is 0, no claims to generate');
      return NextResponse.json({
        success: false,
        error: 'No rewards to distribute. All holders have zero balance or reward rate is 0.',
        holders: balances.size,
        rewardPerToken: rewardPerToken.toString()
      }, { status: 400 });
    }

    const leaves = claims.map(c =>
      ethers.solidityPackedKeccak256(
        ['uint256', 'address', 'uint256'],
        [c.index, c.account, c.amount]
      )
    );

    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const merkleRoot = tree.getHexRoot();
    claims.forEach((c, i) => (c as any).proof = tree.getHexProof(leaves[i]));

    console.log(`✅ Merkle tree generated: root=${merkleRoot}`);

    return NextResponse.json({
      success: true,
      merkleRoot,
      totalRewards: totalRewards.toString(),
      holders: claims.length,
      claims
    });

  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
