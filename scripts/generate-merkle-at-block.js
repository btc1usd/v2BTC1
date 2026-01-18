
/* ============================================================
   BTC1 – Universal Merkle Generator (ALL POOL TYPES)
   Network: Base Mainnet
   ============================================================ */

const { ethers } = require("ethers");
const { MerkleTree } = require("merkletreejs");
const { createClient } = require("@supabase/supabase-js");
const fetch = require("node-fetch");
require("dotenv").config({ path: ".env.production" });

/* ================= CONFIG ================= */

let TARGET_BLOCK; // Will be set to latest block at runtime
const BTC1_DECIMALS = 8;

const BTC1USD = "0x9B8fc91C33ecAFE4992A2A8dBA27172328f423a5".toLowerCase();
const WEEKLY = "0x1FEf2533641cA69B9E30fA734944BB219b2152B6";

const ZERO = "0x0000000000000000000000000000000000000000";
const ONE  = "0x0000000000000000000000000000000000000001";

// /* ---------- APPROVED LP POOL TYPES ---------- */
// Instead of hardcoded addresses, we'll auto-detect LP pools
// You can still manually add specific pools here if needed
const MANUALLY_APPROVED_POOLS = [
  // Add specific pool addresses here if auto-detection misses them
].map(a => a.toLowerCase());

// EXCLUDED POOLS (will not receive rewards)
const EXCLUDED_POOLS = [
  
].map(a => a.toLowerCase());

/* ---------- POOL TYPE DETECTION ---------- */
const POOL_TYPES = {
  UNISWAP_V2: 'UniswapV2',
  AERODROME: 'Aerodrome',
  AERODROME_CL: 'AerodromeCL',
  UNISWAP_V3: 'UniswapV3',
  UNISWAP_V4: 'UniswapV4',
  CURVE: 'Curve',
  BALANCER: 'Balancer',
  UNKNOWN: 'Unknown'
};

// Common pool interface signatures
const POOL_SIGNATURES = {
  // UniswapV2/SushiSwap/etc
  UNISWAP_V2: ['0x0dfe1681', '0xd21220a7'], // token0(), token1()
  // Aerodrome
  AERODROME: ['0x5001f3b5', '0x9d63848a'], // reserve0(), reserve1()
  // UniswapV3/Slipstream
  UNISWAP_V3: ['0x3850c7bd'], // slot0()
  // Curve
  CURVE: ['0xeb8d72b7'], // coins(uint256)
  // Balancer
  BALANCER: ['0xf94d4668'], // getPoolId()
};

/* ---------- INDEXED OWNERS (REQUIRED) ---------- */
// No longer needed - we'll discover owners dynamically

/* ---------- SUBGRAPH ENDPOINTS ---------- */
const BASE_SUBGRAPHS = {
  PANCAKESWAP_V3: "https://api.studio.thegraph.com/query/45376/exchange-v3-base/version/latest",
  AERODROME_FULL: "https://gateway-arbitrum.network.thegraph.com/api/[api-key]/subgraphs/id/GENunSHWLBXm59mBSgPzQ8metBEp9YDfdqwFr91Av1UM",
  // Fallback: treat CL pools as direct holders if subgraph fails
};

// NOTE: UniswapV3 position tracking via events requires upgraded Alchemy plan
// Free tier only allows 10-block ranges for eth_getLogs
// For production, either:
//   1. Upgrade Alchemy to PAYG or Growth plan
//   2. Use a different RPC provider (Infura, QuickNode, etc.)
//   3. Use The Graph Protocol subgraph for position queries
//   4. Manually specify known V3 position token IDs in MANUALLY_APPROVED_V3_POSITIONS below

/* ================= PROVIDER ================= */

if (!process.env.ALCHEMY_API_KEY) {
  console.error("❌ ALCHEMY_API_KEY not found in environment variables");
  console.error("   Make sure .env.production file exists with ALCHEMY_API_KEY set");
  process.exit(1);
}

const ALCHEMY_RPC = `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
console.log(`🌐 Using Alchemy RPC: ${ALCHEMY_RPC.replace(process.env.ALCHEMY_API_KEY, '***')}`);

const provider = new ethers.JsonRpcProvider(
  ALCHEMY_RPC,
  { name: "base", chainId: 8453 },
  { staticNetwork: true, polling: false, timeout: 120000 } // Increased to 120 seconds
);

/* ================= ABIs ================= */

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)"
];

const WEEKLY_ABI = [
  "function getExcludedAddresses() view returns (address[])",
  "function getCurrentDistributionInfo() view returns (uint256,uint256,uint256,uint256)"
];

const UNIV2_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112,uint112,uint32)",
  "function totalSupply() view returns (uint256)"
];

const AERODROME_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function reserve0() view returns (uint256)",
  "function reserve1() view returns (uint256)",
  "function totalSupply() view returns (uint256)"
];

const GAUGE_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function stakingToken() view returns (address)"
];

const CL_POOL_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint8,bool)"
];

/* ================= HELPERS ================= */

async function isContract(addr) {
  const code = await provider.getCode(addr, TARGET_BLOCK);
  // Any bytecode means it's a contract
  return code !== "0x" && code.length > 2;
}

async function isEOA(addr) {
  const code = await provider.getCode(addr, TARGET_BLOCK);
  // EOA has no bytecode
  return code === "0x" || code.length <= 2;
}

function isManuallyApprovedPool(addr) {
  return MANUALLY_APPROVED_POOLS.includes(addr.toLowerCase());
}

// Industry-standard pool detection using function selectors
// Used by Uniswap subgraphs, 1inch, CowSwap, etc.
async function detectPoolTypeBySelectors(addr) {
  const detectedTypes = [];
  
  try {
    // Method 1: Try calling pool functions (most reliable)
    // UniswapV2: getReserves() selector = 0x0902f1ac
    try {
      const uniV2 = new ethers.Contract(addr, UNIV2_ABI, provider);
      const reserves = await uniV2.getReserves({ blockTag: TARGET_BLOCK });
      if (reserves) detectedTypes.push(POOL_TYPES.UNISWAP_V2);
    } catch {}
    
    // Aerodrome: reserve0() and reserve1() selectors (V2-style)
    try {
      const aero = new ethers.Contract(addr, AERODROME_ABI, provider);
      const r0 = await aero.reserve0({ blockTag: TARGET_BLOCK });
      if (r0 !== undefined) detectedTypes.push(POOL_TYPES.AERODROME);
    } catch {}
    
    // Aerodrome CL (Slipstream): slot0() selector - same as UniswapV3
    // Check this before UniswapV3 to prioritize Aerodrome CL detection
    try {
      const aeroCL = new ethers.Contract(addr, CL_POOL_ABI, provider);
      const slot0 = await aeroCL.slot0({ blockTag: TARGET_BLOCK });
      if (slot0) {
        // Try to distinguish Aerodrome CL from UniswapV3 by checking for Aerodrome-specific patterns
        // For now, both will be detected - can add more specific checks if needed
        detectedTypes.push(POOL_TYPES.AERODROME_CL);
      }
    } catch {}
    
    // UniswapV3: slot0() selector = 0x3850c7bd
    try {
      const uniV3 = new ethers.Contract(addr, CL_POOL_ABI, provider);
      const slot0 = await uniV3.slot0({ blockTag: TARGET_BLOCK });
      if (slot0 && !detectedTypes.includes(POOL_TYPES.AERODROME_CL)) {
        // Only add UniswapV3 if not already detected as Aerodrome CL
        detectedTypes.push(POOL_TYPES.UNISWAP_V3);
      }
    } catch {}
    
    // UniswapV4: getCurrency0() and getLiquidity() selectors
    try {
      const uniV4 = new ethers.Contract(addr, UNISWAP_V4_ABI, provider);
      const currency0 = await uniV4.getCurrency0({ blockTag: TARGET_BLOCK });
      const liquidity = await uniV4.getLiquidity({ blockTag: TARGET_BLOCK });
      if (currency0 && liquidity !== undefined) detectedTypes.push(POOL_TYPES.UNISWAP_V4);
    } catch {}
    
    // Curve: coins(uint256) selector = 0xeb8d72b7
    try {
      const curve = new ethers.Contract(addr, ["function coins(uint256) view returns (address)"], provider);
      await curve.coins(0, { blockTag: TARGET_BLOCK });
      detectedTypes.push(POOL_TYPES.CURVE);
    } catch {}
    
    // Balancer: getPoolId() selector = 0xf94d4668
    try {
      const bal = new ethers.Contract(addr, ["function getPoolId() view returns (bytes32)"], provider);
      await bal.getPoolId({ blockTag: TARGET_BLOCK });
      detectedTypes.push(POOL_TYPES.BALANCER);
    } catch {}
  } catch {}
  
  return detectedTypes;
}

async function detectPoolType(addr) {
  try {
    const types = await detectPoolTypeBySelectors(addr);
    return types.length > 0 ? types[0] : POOL_TYPES.UNKNOWN;
  } catch {
    return POOL_TYPES.UNKNOWN;
  }
}

// Check if address is an LP pool using Uniswap/Curve standard
// This matches how The Graph indexes pools
async function isLPPool(addr) {
  if (isManuallyApprovedPool(addr)) return true;
  if (!(await isContract(addr))) return false;

  const poolType = await detectPoolType(addr);
  return poolType !== POOL_TYPES.UNKNOWN;
}

// Get pool tokens using standard interface (Uniswap pattern)
async function getPoolTokens(pool, poolType) {
  try {
    if (poolType === POOL_TYPES.UNISWAP_V2 || poolType === POOL_TYPES.AERODROME) {
      const pair = new ethers.Contract(pool, UNIV2_ABI, provider);
      const [token0, token1] = await Promise.all([
        pair.token0({ blockTag: TARGET_BLOCK }),
        pair.token1({ blockTag: TARGET_BLOCK })
      ]);
      return { token0: token0.toLowerCase(), token1: token1.toLowerCase() };
    } else if (poolType === POOL_TYPES.UNISWAP_V3) {
      const pool3 = new ethers.Contract(pool, CL_POOL_ABI, provider);
      const [token0, token1] = await Promise.all([
        pool3.token0({ blockTag: TARGET_BLOCK }),
        pool3.token1({ blockTag: TARGET_BLOCK })
      ]);
      return { token0: token0.toLowerCase(), token1: token1.toLowerCase() };
    }
  } catch {}
  return null;
}

async function alchemyTransfers(token, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(
        `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "alchemy_getAssetTransfers",
            params: [{
              fromBlock: "0x0",
              toBlock: `0x${TARGET_BLOCK.toString(16)}`,
              contractAddresses: [token],
              category: ["erc20"],
              excludeZeroValue: true,
              maxCount: "0x3e8" // 1000 max
            }]
          })
        }
      );
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      return data.result?.transfers || [];
    } catch (error) {
      console.warn(`⚠️  Alchemy attempt ${attempt}/${retries} failed for ${token.slice(0, 10)}...`);
      console.warn(`   Error: ${error.message}`);
      
      if (attempt === retries) {
        console.error(`❌ All ${retries} attempts failed for ${token}`);
        return [];
      }
      
      // Wait before retry (exponential backoff)
      const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      console.log(`   Retrying in ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  return [];
}

/* ================= V3 LP EXPANSION (SUBGRAPH) ================= */

async function expandV3PoolViaSubgraph(pool, btc1, poolType) {
  try {
    // Determine which subgraph to use
    let subgraphUrl;
    if (poolType === POOL_TYPES.AERODROME_CL) {
      // Aerodrome subgraphs are unreliable/deprecated, skip to fallback
      throw new Error('Aerodrome CL subgraph not available, using direct balance');
    } else {
      // Try PancakeSwap for other CL pools
      subgraphUrl = BASE_SUBGRAPHS.PANCAKESWAP_V3;
    }
    
    console.log(`   🌐 Querying subgraph: ${subgraphUrl.split('/').pop()}`);
    
    const query = `
      query ($id: String!) {
        pool(id: $id) {
          id
          token0 { id }
          token1 { id }
          sqrtPrice
          tick
          positions(first: 1000, where: { liquidity_gt: "0" }) {
            owner
            liquidity
            tickLower { tickIdx }
            tickUpper { tickIdx }
          }
        }
      }
    `;
    
    const res = await fetch(subgraphUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        variables: { id: pool.toLowerCase() },
      }),
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const json = await res.json();
    
    if (json.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
    }
    
    const p = json?.data?.pool;
    if (!p) {
      throw new Error('Pool not found in subgraph');
    }
    
    console.log(`   ✅ Found ${p.positions.length} positions with liquidity`);
    
    const isBTC1Token0 = p.token0.id.toLowerCase() === btc1;
    console.log(`   BTC1 is token${isBTC1Token0 ? '0' : '1'}`);
    
    const balances = new Map();
    
    // Use simple proportional calculation based on liquidity
    const totalLiquidity = p.positions.reduce((sum, pos) => sum + BigInt(pos.liquidity), 0n);
    
    if (totalLiquidity === 0n) {
      throw new Error('No liquidity in positions');
    }
    
    console.log(`   📊 Total liquidity: ${totalLiquidity.toString()}`);
    
    // Get pool's total BTC1 balance to distribute
    const btc1Contract = new ethers.Contract(BTC1USD, ERC20_ABI, provider);
    const poolBTC1Balance = await btc1Contract.balanceOf(pool, { blockTag: TARGET_BLOCK });
    
    console.log(`   💰 Pool's BTC1 balance: ${ethers.formatUnits(poolBTC1Balance, BTC1_DECIMALS)}`);
    
    // Distribute proportionally to liquidity
    let distributedCount = 0;
    for (const pos of p.positions) {
      const liquidity = BigInt(pos.liquidity);
      const owner = pos.owner.toLowerCase();
      
      // Calculate share: (position liquidity / total liquidity) * pool BTC1 balance
      const share = (liquidity * poolBTC1Balance) / totalLiquidity;
      
      if (share > 0n) {
        const existing = balances.get(owner) || 0n;
        balances.set(owner, existing + share);
        distributedCount++;
        
        if (distributedCount <= 10) {
          console.log(`   └─ ${owner.slice(0,10)}... = ${ethers.formatUnits(share, BTC1_DECIMALS)} BTC1 (liquidity: ${liquidity.toString()})`);
        }
      }
    }
    
    console.log(`   ✅ Distributed to ${distributedCount} position holders`);
    
    return balances;
    
  } catch (err) {
    console.log(`   ⚠️  Subgraph expansion not available: ${err.message}`);
    throw err;
  }
}

/* ================= ERC20 LP (V2-STYLE POOLS) ================= */

async function warmUpProvider() {
  console.log("🔌 Warming up RPC connection...");
  
  let retries = 3;
  let block;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`   Attempt ${attempt}/${retries}...`);
      block = await provider.getBlockNumber();
      console.log("✅ RPC connected. Latest block:", block);
      break;
    } catch (error) {
      console.warn(`⚠️  Connection attempt ${attempt} failed: ${error.message}`);
      
      if (attempt === retries) {
        console.error("❌ All connection attempts failed");
        throw new Error(`Failed to connect to RPC after ${retries} attempts: ${error.message}`);
      }
      
      const waitTime = 2000 * attempt; // Progressive backoff: 2s, 4s, 6s
      console.log(`   Retrying in ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  // Set TARGET_BLOCK to latest block
  TARGET_BLOCK = block;
  console.log(`📍 Using latest block as TARGET_BLOCK: ${TARGET_BLOCK}`);
}

async function generateMerkleTree() {
  console.log(`🌳 Generating Merkle Tree @ block ${TARGET_BLOCK}`);

  const weekly = new ethers.Contract(WEEKLY, WEEKLY_ABI, provider);
  const btc1 = new ethers.Contract(BTC1USD, ERC20_ABI, provider);

  const excluded = new Set(
    (await weekly.getExcludedAddresses({ blockTag: TARGET_BLOCK }))
      .map(a => a.toLowerCase())
  );

  const balances = new Map();

  /* ---------- STEP 1: Get ALL BTC1USD HOLDERS ---------- */
  console.log('\n📊 STEP 1: Fetching all BTC1USD holders (EOAs + Contracts)...');
  const allHolders = new Set();
  const transfers = await alchemyTransfers(BTC1USD);
  
  for (const t of transfers) {
    if (t.from) allHolders.add(t.from.toLowerCase());
    if (t.to) allHolders.add(t.to.toLowerCase());
  }
  
  console.log(`   Found ${allHolders.size} unique addresses\n`);

  /* ---------- STEP 2: CATEGORIZE HOLDERS ---------- */
  console.log('📊 STEP 2: Categorizing holders (EOAs vs LP Pools)...');
  const eoas = [];
  const detectedPools = [];
  
  for (const addr of allHolders) {
    if (addr === ZERO || addr === ONE || excluded.has(addr) || EXCLUDED_POOLS.includes(addr)) continue;
    
    // Check if it's a contract first
    if (await isContract(addr)) {
      // Check if it's an LP pool
      if (await isLPPool(addr)) {
        const poolType = await detectPoolType(addr);
        detectedPools.push({ address: addr, type: poolType });
        console.log(`   🏊 LP Pool detected: ${addr} (${poolType})`);
        // Add pools to eoas - they get direct balance treatment
        // CL pools (V3-style) are complex to expand, treat as direct holders
        eoas.push(addr);
      } else {
        // Non-pool contracts are treated as EOAs (smart wallets, etc.)
        eoas.push(addr);
      }
    } else {
      eoas.push(addr);
    }
  }
  
  console.log(`   ✅ EOAs (including smart wallets and pools): ${eoas.length}`);
  console.log(`   ✅ LP Pools detected (will get direct balances): ${detectedPools.length}\n`);

  /* ---------- STEP 3: PROCESS DIRECT BTC1 BALANCES ---------- */
  console.log('📊 STEP 3: Processing direct BTC1 balances...');
  
  // Process all EOAs (including smart wallets/contracts that aren't LP pools)
  for (const addr of eoas) {
    const bal = await btc1.balanceOf(addr, { blockTag: TARGET_BLOCK });
    if (bal > 0n) {
      balances.set(addr, bal);
      console.log(`   👤 ${addr} = ${ethers.formatUnits(bal, BTC1_DECIMALS)} BTC1`);
    }
  }
  
  console.log(`   ✅ Processed ${eoas.length} addresses\n`);

  /* ---------- STEP 4: PROCESS DETECTED LP POOLS ---------- */
  console.log('📊 STEP 4: Processing detected LP pools...');
  console.log(`   Found ${detectedPools.length} LP pools\n`);
  
  for (const { address: pool, type: poolType } of detectedPools) {
    console.log(`\n🔍 Processing ${poolType} pool: ${pool}`);
    
    // CL pools (V3-style) - try subgraph-based expansion
    if (poolType === POOL_TYPES.AERODROME_CL || poolType === POOL_TYPES.UNISWAP_V3) {
      console.log(`   🌐 Concentrated Liquidity pool - using subgraph expansion`);
      
      try {
        // Try subgraph-based expansion
        const clBalances = await expandV3PoolViaSubgraph(pool, BTC1USD, poolType);
        
        if (clBalances.size > 0) {
          // Merge CL balances into main balances
          for (const [addr, amount] of clBalances) {
            if (!excluded.has(addr)) {
              const existing = balances.get(addr) || 0n;
              balances.set(addr, existing + amount);
            }
          }
          
          // Remove pool's direct balance (distributed to position holders)
          const poolDirectBalance = balances.get(pool) || 0n;
          if (poolDirectBalance > 0n) {
            console.log(`   ⚠️  Removing pool's direct balance (distributed to position holders): ${ethers.formatUnits(poolDirectBalance, BTC1_DECIMALS)} BTC1`);
            balances.delete(pool);
          }
        } else {
          throw new Error('No positions found in subgraph');
        }
      } catch (err) {
        // If expansion fails, keep pool's direct balance
        console.log(`   ⚠️  Subgraph expansion failed: ${err.message}`);
        if (balances.has(pool)) {
          console.log(`   ℹ️  Fallback: Using pool's direct balance: ${ethers.formatUnits(balances.get(pool), BTC1_DECIMALS)} BTC1`);
        } else {
          console.log(`   ⚠️  Pool has no direct balance to fall back on`);
        }
      }
      continue;
    }
    
    try {
      // V2-style pools (UniswapV2, Aerodrome V2) - expand to LP token holders
      // Get pool info
      const poolContract = new ethers.Contract(pool, UNIV2_ABI, provider);
      const [token0, token1, totalSupply] = await Promise.all([
        poolContract.token0({ blockTag: TARGET_BLOCK }),
        poolContract.token1({ blockTag: TARGET_BLOCK }),
        poolContract.totalSupply({ blockTag: TARGET_BLOCK })
      ]);
      
      const t0 = token0.toLowerCase();
      const t1 = token1.toLowerCase();
      
      // Check if pool contains BTC1USD
      if (![t0, t1].includes(BTC1USD)) {
        console.log(`   ⊘ Not a BTC1 pool`);
        continue;
      }
      
      const isBTC1Token0 = t0 === BTC1USD;
      console.log(`   BTC1 is token${isBTC1Token0 ? '0' : '1'}`);
      
      // Get reserves based on pool type
      let btc1Reserve;
      if (poolType === POOL_TYPES.AERODROME) {
        const aeroContract = new ethers.Contract(pool, AERODROME_ABI, provider);
        const [r0, r1] = await Promise.all([
          aeroContract.reserve0({ blockTag: TARGET_BLOCK }),
          aeroContract.reserve1({ blockTag: TARGET_BLOCK })
        ]);
        btc1Reserve = isBTC1Token0 ? BigInt(r0) : BigInt(r1);
      } else {
        const reserves = await poolContract.getReserves({ blockTag: TARGET_BLOCK });
        btc1Reserve = isBTC1Token0 ? BigInt(reserves[0]) : BigInt(reserves[1]);
      }
      
      console.log(`   BTC1 Reserve: ${ethers.formatUnits(btc1Reserve, BTC1_DECIMALS)}`);
      console.log(`   Total LP Supply: ${ethers.formatUnits(totalSupply, 18)}`);
      console.log(`   Fetching LP holders...`);
      
      // Remove pool's direct balance - we'll distribute to LP holders instead
      const poolDirectBalance = balances.get(pool) || 0n;
      if (poolDirectBalance > 0n) {
        console.log(`   ⚠️  Removing pool's direct balance: ${ethers.formatUnits(poolDirectBalance, BTC1_DECIMALS)} BTC1`);
        balances.delete(pool);
      }
      
      // Get all LP token transfers to find holders
      const lpTransfers = await alchemyTransfers(pool);
      
      if (lpTransfers.length === 0) {
        console.log(`   ⚠️ No LP transfers found`);
        continue;
      }
      
      console.log(`   Processing ${lpTransfers.length} LP transfers...`);
      
      // Calculate LP balances
      const lpBalances = new Map();
      for (const t of lpTransfers) {
        const value = BigInt(t.rawContract?.value || 0);
        if (t.from && t.from !== ZERO) {
          const current = lpBalances.get(t.from.toLowerCase()) || 0n;
          lpBalances.set(t.from.toLowerCase(), current - value);
        }
        if (t.to) {
          const current = lpBalances.get(t.to.toLowerCase()) || 0n;
          lpBalances.set(t.to.toLowerCase(), current + value);
        }
      }
      
      // Distribute BTC1 to LP providers based on their LP share
      let validHolders = 0;
      for (const [addr, lpBal] of lpBalances) {
        if (
          lpBal <= 0n ||
          addr === ZERO ||
          addr === ONE ||
          addr === pool ||
          excluded.has(addr)
        ) continue;
        
        // Calculate BTC1 share: (lpBalance / totalSupply) * btc1Reserve
        const btc1Share = (lpBal * btc1Reserve) / totalSupply;
        
        if (btc1Share > 0n) {
          // Add to existing balance (if holder also has direct BTC1)
          const existingBalance = balances.get(addr) || 0n;
          balances.set(addr, existingBalance + btc1Share);
          validHolders++;
          
          const hasDirectHolding = existingBalance > 0n;
          if (hasDirectHolding) {
            console.log(`   └─ LP holder ${addr.slice(0,10)}... = ${ethers.formatUnits(btc1Share, BTC1_DECIMALS)} BTC1 from pool + ${ethers.formatUnits(existingBalance, BTC1_DECIMALS)} direct = ${ethers.formatUnits(balances.get(addr), BTC1_DECIMALS)} total`);
          } else {
            console.log(`   └─ LP holder ${addr.slice(0,10)}... = ${ethers.formatUnits(btc1Share, BTC1_DECIMALS)} BTC1 from pool`);
          }
        }
      }
      
      console.log(`   ✅ Distributed to ${validHolders} LP providers`);
      
    } catch (err) {
      console.log(`   ❌ Failed to process pool: ${err.message}`);
      // If expansion fails, restore pool's direct balance
      const poolBalance = await btc1.balanceOf(pool, { blockTag: TARGET_BLOCK });
      if (poolBalance > 0n) {
        balances.set(pool, poolBalance);
        console.log(`   ℹ️  Fallback: Using pool's direct balance: ${ethers.formatUnits(poolBalance, BTC1_DECIMALS)} BTC1`);
      }
    }
  }

  /* ---------- MERKLE TREE GENERATION ---------- */
  console.log('\n🌳 STEP 5: Generating Merkle Tree...');
  const [, rewardPerToken] =
    await weekly.getCurrentDistributionInfo({ blockTag: TARGET_BLOCK });

  const claims = [];
  let totalRewards = 0n;

  [...balances.entries()].forEach(([addr, bal], i) => {
    const reward = (bal * rewardPerToken) / 10n ** BigInt(BTC1_DECIMALS);
    if (reward > 0n) {
      claims.push({ index: i, account: addr, amount: reward.toString(), proof: [] });
      totalRewards += reward;
    }
  });

  const leaves = claims.map(c =>
    ethers.solidityPackedKeccak256(
      ["uint256","address","uint256"],
      [c.index, c.account, c.amount]
    )
  );

  const tree = new MerkleTree(leaves, ethers.keccak256, { sortPairs: true });
  claims.forEach((c,i)=> c.proof = tree.getHexProof(leaves[i]));

  console.log("\n✅ Merkle Root:", tree.getHexRoot());
  console.log("💰 Total Rewards:", ethers.formatUnits(totalRewards, BTC1_DECIMALS));
  console.log("📄 Total Claims:", claims.length);

  // Convert claims array to object format for Supabase
  const claimsObj = {};
  claims.forEach(c => {
    claimsObj[c.account] = {
      index: c.index,
      proof: c.proof,
      amount: c.amount,
      account: c.account
    };
  });

  // TODO: Enable Supabase saving after testing
  console.log("\n⚠️  SUPABASE SAVING DISABLED (Testing Mode)");
  console.log("   Output ready for testing - not saved to database");
  console.log("   Enable saving in production by uncommenting Supabase code\n");
  
  /*
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('⚠️ WARNING: Using ANON key instead of SERVICE_ROLE key');
    console.warn('⚠️ This may fail due to Row-Level Security policies');
    console.warn('⚠️ Set SUPABASE_SERVICE_ROLE_KEY in .env.production to fix this');
  }

  // Get the next ID
  const TABLE_NAME = process.env.SUPABASE_TABLE || 'merkle_distributions_prod';
  console.log(`   💾 Using Supabase table: ${TABLE_NAME}`);
  
  const { data: existing, error: fetchError } = await supabase
    .from(TABLE_NAME)
    .select('id')
    .order('id', { ascending: false })
    .limit(1);

  const nextId = existing && existing.length > 0 ? existing[0].id + 1 : 1;
  console.log(`   📝 Next distribution ID: ${nextId}`);

  const { data, error } = await supabase.from(TABLE_NAME).insert({
    id: nextId,
    merkle_root: tree.getHexRoot(),
    total_rewards: totalRewards.toString(),
    claims: claimsObj,
    metadata: {
      note: "Protocol wallets are excluded. All BTC1USD holders receive rewards - includes direct holders and LP providers whose BTC1USD share in pools has been calculated and aggregated to their addresses. Smart wallets and non-pool contracts are treated as regular holders.",
      generated: new Date().toISOString(),
      blockNumber: TARGET_BLOCK,
      totalHolders: claims.length,
      activeHolders: claims.length,
      excludedCount: excluded.size,
      detectedLPPools: detectedPools.map(p => ({ address: p.address, type: p.type })),
      manuallyApprovedPools: MANUALLY_APPROVED_POOLS,
      excludedAddresses: [...excluded]
    }
  });

  if (error) {
    console.error("❌ Failed to save to Supabase:");
    console.error("   Error:", error.message);
    console.error("   Details:", JSON.stringify(error, null, 2));
  } else {
    console.log("💾 Saved to Supabase successfully!\n");
  }
  */
}

warmUpProvider()
  .then(generateMerkleTree)
  .catch(console.error);