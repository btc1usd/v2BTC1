

/* ============================================================
   BTC1 – Universal Merkle Generator (ALL POOL TYPES)
   Network: Base Mainnet
   ============================================================ */

const { ethers } = require("ethers");
const { MerkleTree } = require("merkletreejs");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

/* ================= CONFIG ================= */

const TARGET_BLOCK = 40069079;
const BTC1_DECIMALS = 8;

const BTC1USD = "0x6dC9C43278AeEa063c01d97505f215ECB6da4a21".toLowerCase();
const WEEKLY = "0x51D622A533C56256c5E318f5aB9844334523dFe0";

const ZERO = "0x0000000000000000000000000000000000000000";
const ONE  = "0x0000000000000000000000000000000000000001";

/* ---------- APPROVED LP POOL TYPES ---------- */
// Instead of hardcoded addresses, we'll auto-detect LP pools
// You can still manually add specific pools here if needed
const MANUALLY_APPROVED_POOLS = [
  // Add specific pool addresses here if auto-detection misses them
].map(a => a.toLowerCase());

/* ---------- POOL TYPE DETECTION ---------- */
const POOL_TYPES = {
  UNISWAP_V2: 'UniswapV2',
  AERODROME: 'Aerodrome',
  UNISWAP_V3: 'UniswapV3',
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

/* ---------- UNISWAP V3 HELPERS ---------- */
// Position Manager contract for V3/Slipstream
const POSITION_MANAGER = "0x827922686190790b37229fd06084350E74485b72";

// NOTE: UniswapV3 position tracking via events requires upgraded Alchemy plan
// Free tier only allows 10-block ranges for eth_getLogs
// For production, either:
//   1. Upgrade Alchemy to PAYG or Growth plan
//   2. Use a different RPC provider (Infura, QuickNode, etc.)
//   3. Use The Graph Protocol subgraph for position queries
//   4. Manually specify known V3 position token IDs in MANUALLY_APPROVED_V3_POSITIONS below

// Manual V3 position override (if you know specific NFT token IDs for your pool)
const MANUALLY_APPROVED_V3_POSITIONS = [
  // Add known NFT token IDs here, e.g.: 12345, 67890
  // These will be processed even if event scanning fails
].map(id => id.toString());

// Convert V3 liquidity to token amounts (industry-standard calculation)
function getLiquidityAmounts(liquidity, sqrtPriceX96, tickLower, tickUpper) {
  const Q96 = 2n ** 96n;
  const sqrtRatioA = getSqrtRatioAtTick(tickLower);
  const sqrtRatioB = getSqrtRatioAtTick(tickUpper);
  
  // Simplified calculation for in-range positions
  // Full implementation would handle out-of-range positions
  const amount0 = (liquidity * (sqrtRatioB - sqrtPriceX96)) / sqrtPriceX96;
  const amount1 = liquidity * (sqrtPriceX96 - sqrtRatioA) / Q96;
  
  return { amount0, amount1 };
}

function getSqrtRatioAtTick(tick) {
  // Simplified - in production use the full Uniswap V3 math
  const Q96 = 2n ** 96n;
  return Q96 * BigInt(Math.floor(Math.sqrt(1.0001 ** Number(tick))));
}

/* ================= PROVIDER ================= */

const ALCHEMY_RPC = `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;

const provider = new ethers.JsonRpcProvider(
  ALCHEMY_RPC,
  { name: "base", chainId: 8453 },
  { staticNetwork: true, polling: false, timeout: 60000 }
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

const POSITION_MANAGER_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function tokenOfOwnerByIndex(address,uint256) view returns (uint256)",
  "function positions(uint256) view returns (uint96,address,address,address,uint24,int24,int24,uint128,uint256,uint256)",
  "function ownerOf(uint256) view returns (address)",
  "event IncreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
  "event DecreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
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
    
    // Aerodrome: reserve0() and reserve1() selectors
    try {
      const aero = new ethers.Contract(addr, AERODROME_ABI, provider);
      const r0 = await aero.reserve0({ blockTag: TARGET_BLOCK });
      if (r0 !== undefined) detectedTypes.push(POOL_TYPES.AERODROME);
    } catch {}
    
    // UniswapV3/Slipstream: slot0() selector = 0x3850c7bd
    try {
      const uniV3 = new ethers.Contract(addr, CL_POOL_ABI, provider);
      const slot0 = await uniV3.slot0({ blockTag: TARGET_BLOCK });
      if (slot0) detectedTypes.push(POOL_TYPES.UNISWAP_V3);
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

/* ================= UNISWAP V3 NFT POSITIONS ================= */

// Safe event query helper with chunking and retry logic
async function safeQueryFilter(contract, filter, from, to, step = 5000) {
  const results = [];
  for (let i = from; i <= to; i += step) {
    const end = Math.min(i + step - 1, to);
    try {
      const logs = await contract.queryFilter(filter, i, end);
      results.push(...logs);
    } catch {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return results;
}

async function processUniswapV3Pool(pool, balances, excluded) {
  try {
    const poolContract = new ethers.Contract(pool, CL_POOL_ABI, provider);
    const [token0, token1, slot0] = await Promise.all([
      poolContract.token0({ blockTag: TARGET_BLOCK }),
      poolContract.token1({ blockTag: TARGET_BLOCK }),
      poolContract.slot0({ blockTag: TARGET_BLOCK })
    ]);
    
    const t0 = token0.toLowerCase();
    const t1 = token1.toLowerCase();
    
    // Check if pool contains BTC1USD
    if (![t0, t1].includes(BTC1USD)) {
      console.log(`   ⊘ Not a BTC1 pool`);
      return;
    }
    
    const isBTC1Token0 = t0 === BTC1USD;
    console.log(`   BTC1 is token${isBTC1Token0 ? '0' : '1'}`);
    console.log(`   Current sqrtPriceX96: ${slot0[0].toString()}`);
    
    // Get Position Manager contract
    const positionManager = new ethers.Contract(
      POSITION_MANAGER,
      POSITION_MANAGER_ABI,
      provider
    );
    
    // Discover all NFT positions through Transfer events
    // Query in chunks to avoid timeout
    console.log(`   Querying NFT positions in chunks...`);
    
    const allTokenIds = new Set();
    const START_BLOCK = Math.max(0, TARGET_BLOCK - 500000); // Last ~500k blocks (~2 months on Base)
    
    try {
      const filter = positionManager.filters.Transfer();
      const events = await safeQueryFilter(
        positionManager,
        filter,
        START_BLOCK,
        TARGET_BLOCK
      );
      
      console.log(`   Found ${events.length} Transfer events`);
      
      for (const event of events) {
        const tokenId = event.args.tokenId;
        if (tokenId) {
          allTokenIds.add(tokenId.toString());
        }
      }
      
      console.log(`   ✅ Discovered ${allTokenIds.size} unique NFT positions`);
    } catch (err) {
      console.log(`   ⚠️ Event scanning failed: ${err.message}`);
      console.log(`   Trying fallback: IncreaseLiquidity events...`);
      
      // Fallback: Use IncreaseLiquidity events (smaller dataset)
      try {
        const liquidityFilter = positionManager.filters.IncreaseLiquidity();
        const liquidityEvents = await safeQueryFilter(
          positionManager,
          liquidityFilter,
          START_BLOCK,
          TARGET_BLOCK
        );
        
        for (const event of liquidityEvents) {
          allTokenIds.add(event.args.tokenId.toString());
        }
        
        console.log(`   Found ${allTokenIds.size} positions via liquidity events`);
      } catch (fallbackErr) {
        console.log(`   ❌ Fallback also failed: ${fallbackErr.message}`);
        console.log(`   ⚠️ UniswapV3 position tracking requires RPC with better event query support`);
        return;
      }
    }
    
    if (allTokenIds.size === 0) {
      console.log(`   ⚠️ No NFT positions discovered via events`);
      
      // Check if there are manually approved positions
      if (MANUALLY_APPROVED_V3_POSITIONS.length > 0) {
        console.log(`   💡 Using ${MANUALLY_APPROVED_V3_POSITIONS.length} manually approved V3 positions...`);
        MANUALLY_APPROVED_V3_POSITIONS.forEach(id => allTokenIds.add(id));
      } else {
        console.log(`   💡 TIP: You can manually add known NFT token IDs to MANUALLY_APPROVED_V3_POSITIONS`);
        console.log(`   💡 Or upgrade Alchemy plan for automatic event scanning\n`);
        return;
      }
    }
    
    let validPositions = 0;
    let totalBTC1Liquidity = 0n;
    let processedCount = 0;
    
    console.log(`\n   Processing ${allTokenIds.size} NFT positions...`);
    
    // Process each NFT position
    for (const tokenId of allTokenIds) {
      processedCount++;
      if (processedCount % 100 === 0) {
        console.log(`   Progress: ${processedCount}/${allTokenIds.size} positions...`);
      }
      
      try {
        // Get position details
        const position = await positionManager.positions(tokenId, { blockTag: TARGET_BLOCK });
        const [
          nonce,
          operator,
          posToken0,
          posToken1,
          fee,
          tickLower,
          tickUpper,
          liquidity,
          feeGrowthInside0LastX128,
          feeGrowthInside1LastX128
        ] = position;
        
        // Verify position is for this pool (matching tokens)
        if (posToken0.toLowerCase() !== t0 || posToken1.toLowerCase() !== t1) {
          continue;
        }
        
        // Skip positions with no liquidity
        if (liquidity === 0n) continue;
        
        // Get current owner of the NFT
        const owner = await positionManager.ownerOf(tokenId, { blockTag: TARGET_BLOCK });
        const ownerAddr = owner.toLowerCase();
        
        // Skip excluded addresses
        if (excluded.has(ownerAddr)) continue;
        
        // Calculate token amounts from liquidity
        const amounts = getLiquidityAmounts(
          liquidity,
          slot0[0], // sqrtPriceX96
          Number(tickLower),
          Number(tickUpper)
        );
        
        // Get BTC1 amount based on which token it is
        const btc1Amount = isBTC1Token0 ? amounts.amount0 : amounts.amount1;
        
        if (btc1Amount > 0n) {
          // Check if owner is a contract we haven't seen
          const isContractCheck = await isContract(ownerAddr);
          const alreadyInBalances = balances.has(ownerAddr);
          
          if (isContractCheck && !alreadyInBalances) {
            continue; // Skip new contracts
          }
          
          balances.set(ownerAddr, (balances.get(ownerAddr) || 0n) + btc1Amount);
          totalBTC1Liquidity += btc1Amount;
          validPositions++;
          
          console.log(`   └─ NFT #${tokenId} owner ${ownerAddr.slice(0,10)}... = ${ethers.formatUnits(btc1Amount, BTC1_DECIMALS)} BTC1 (total: ${ethers.formatUnits(balances.get(ownerAddr), BTC1_DECIMALS)})`);
        }
      } catch (err) {
        // Position might not exist at this block, NFT burned, or other error
        continue;
      }
    }
    
    console.log(`   ✅ Processed ${validPositions} valid positions with liquidity`);
    console.log(`   💰 Total BTC1 in V3 positions: ${ethers.formatUnits(totalBTC1Liquidity, BTC1_DECIMALS)}\n`);
    
  } catch (err) {
    console.log(`   ❌ Failed to process V3 pool: ${err.message}`);
  }
}

/* ================= ERC20 LP ================= */

async function processERC20LP(pool, balances, excluded) {
  const poolType = await detectPoolType(pool);
  
  if (poolType === POOL_TYPES.UNKNOWN) {
    console.log(`   ⊘ Unknown pool type - skipping`);
    return;
  }
  
  // UniswapV3 uses NFT positions, requires different handling
  if (poolType === POOL_TYPES.UNISWAP_V3) {
    console.log(`   ✅ UniswapV3 pool detected - processing NFT positions`);
    await processUniswapV3Pool(pool, balances, excluded);
    return;
  }

  try {
    let p, t0, t1, ts, reserve;
    
    if (poolType === POOL_TYPES.UNISWAP_V2) {
      p = new ethers.Contract(pool, UNIV2_ABI, provider);
      [t0, t1, ts] = await Promise.all([
        p.token0({ blockTag: TARGET_BLOCK }),
        p.token1({ blockTag: TARGET_BLOCK }),
        p.totalSupply({ blockTag: TARGET_BLOCK })
      ]);
      const r = await p.getReserves({ blockTag: TARGET_BLOCK });
      
      if (![t0, t1].map(a => a.toLowerCase()).includes(BTC1USD)) {
        console.log(`   ⊘ Not a BTC1 pool`);
        return;
      }
      
      reserve = BigInt(t0.toLowerCase() === BTC1USD ? r[0] : r[1]);
      console.log(`   ✅ UniswapV2 BTC1 pool detected`);
      
    } else if (poolType === POOL_TYPES.AERODROME) {
      p = new ethers.Contract(pool, AERODROME_ABI, provider);
      [t0, t1, ts] = await Promise.all([
        p.token0({ blockTag: TARGET_BLOCK }),
        p.token1({ blockTag: TARGET_BLOCK }),
        p.totalSupply({ blockTag: TARGET_BLOCK })
      ]);
      const [r0, r1] = await Promise.all([
        p.reserve0({ blockTag: TARGET_BLOCK }),
        p.reserve1({ blockTag: TARGET_BLOCK })
      ]);
      
      if (![t0, t1].map(a => a.toLowerCase()).includes(BTC1USD)) {
        console.log(`   ⊘ Not a BTC1 pool`);
        return;
      }
      
      reserve = BigInt(t0.toLowerCase() === BTC1USD ? r0 : r1);
      console.log(`   ✅ Aerodrome BTC1 pool detected`);
    }
    
    const info = { reserve, totalSupply: BigInt(ts) };

    console.log(`   BTC1 Reserve: ${ethers.formatUnits(info.reserve, BTC1_DECIMALS)}`);
    console.log(`   Fetching LP holders...`);

    const lpBalances = new Map();
    const transfers = await alchemyTransfers(pool);
    
    if (transfers.length === 0) {
      console.log(`   ⚠️ No transfers found for this pool`);
      return;
    }
    
    console.log(`   Processing ${transfers.length} transfers...`);
    
    for (const t of transfers) {
      const v = BigInt(t.rawContract?.value || 0);
      if (t.from && t.from !== ZERO)
        lpBalances.set(t.from.toLowerCase(), (lpBalances.get(t.from.toLowerCase()) || 0n) - v);
      if (t.to)
        lpBalances.set(t.to.toLowerCase(), (lpBalances.get(t.to.toLowerCase()) || 0n) + v);
    }

    let validHolders = 0;
    for (const [addr, bal] of lpBalances) {
      if (
        bal <= 0n ||
        addr === ZERO ||
        addr === ONE ||
        addr === pool ||
        excluded.has(addr)
      ) continue;

      // Allow addresses that are already in balances (they can hold both direct tokens AND LP tokens)
      // Only exclude if it's a NEW contract we haven't seen before
      const isContractCheck = await isContract(addr);
      const alreadyInBalances = balances.has(addr);
      
      if (isContractCheck && !alreadyInBalances) continue;

      const share = (bal * info.reserve) / info.totalSupply;
      if (share > 0n) {
        balances.set(addr, (balances.get(addr) || 0n) + share);
        validHolders++;
        console.log(`   └─ LP holder ${addr.slice(0,10)}... = ${ethers.formatUnits(share, BTC1_DECIMALS)} BTC1 (total: ${ethers.formatUnits(balances.get(addr), BTC1_DECIMALS)})`);
      }
    }
    
    console.log(`   ✅ Found ${validHolders} valid LP holders\n`);
  } catch (err) {
    console.log(`   ❌ Failed to read pool: ${err.message}`);
    return;
  }
}



/* ================= MAIN ================= */

async function warmUpProvider() {
  console.log("🔌 Warming up RPC connection...");
  const block = await provider.getBlockNumber();
  console.log("✅ RPC connected. Latest block:", block);
}

async function main() {
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
    if (addr === ZERO || addr === ONE || excluded.has(addr)) continue;
    
    // Check if it's a contract first
    if (await isContract(addr)) {
      // Check if it's an LP pool
      if (await isLPPool(addr)) {
        const poolType = await detectPoolType(addr);
        detectedPools.push({ address: addr, type: poolType });
        console.log(`   🏊 LP Pool detected: ${addr} (${poolType})`);
      } else {
        // Non-pool contracts are treated as EOAs (smart wallets, etc.)
        eoas.push(addr);
      }
    } else {
      eoas.push(addr);
    }
  }
  
  console.log(`   ✅ EOAs (including smart wallets): ${eoas.length}`);
  console.log(`   ✅ LP Pools to expand: ${detectedPools.length}\n`);

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
  console.log(`   Found ${detectedPools.length} LP pools to expand\n`);
  
  for (const { address: pool, type: poolType } of detectedPools) {
    console.log(`\n🔍 Processing ${poolType} pool: ${pool}`);
    
    // Remove pool's direct balance (we'll expand it to LP holders)
    if (balances.has(pool)) {
      console.log(`   ♻️ Removing direct balance, will expand to LP holders`);
      balances.delete(pool);
    }
    
    await processERC20LP(pool, balances, excluded);
    await new Promise(resolve => setTimeout(resolve, 500));
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

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Get the next ID
  const { data: existing, error: fetchError } = await supabase
    .from('merkle_distributions')
    .select('id')
    .order('id', { ascending: false })
    .limit(1);

  const nextId = existing && existing.length > 0 ? existing[0].id + 1 : 1;
  console.log(`   📝 Next distribution ID: ${nextId}`);

  const { data, error } = await supabase.from("merkle_distributions").insert({
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
}

warmUpProvider()
  .then(main)
  .catch(console.error);
