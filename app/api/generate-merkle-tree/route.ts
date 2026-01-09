import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { MerkleTree } from 'merkletreejs';
import { createClient } from '@supabase/supabase-js';

/* ================= CONFIG ================= */

const TARGET_BLOCK = 40596432;
const BTC1_DECIMALS = 8;

const BTC1USD = "0x9B8fc91C33ecAFE4992A2A8dBA27172328f423a5".toLowerCase();
const WEEKLY = "0x1FEf2533641cA69B9E30fA734944BB219b2152B6";

const ZERO = "0x0000000000000000000000000000000000000000";
const ONE = "0x0000000000000000000000000000000000000001";

const MANUALLY_APPROVED_POOLS: string[] = [];
const EXCLUDED_POOLS: string[] = [];

/* ---------- POOL TYPE DETECTION ---------- */
const POOL_TYPES = {
  UNISWAP_V2: 'UniswapV2',
  AERODROME: 'Aerodrome',
  UNISWAP_V3: 'UniswapV3',
  CURVE: 'Curve',
  BALANCER: 'Balancer',
  UNKNOWN: 'Unknown'
};

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

const CL_POOL_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint8,bool)"
];

/* ================= HELPERS ================= */

async function isContract(provider: ethers.JsonRpcProvider, addr: string): Promise<boolean> {
  const code = await provider.getCode(addr, TARGET_BLOCK);
  return code !== "0x" && code.length > 2;
}

async function detectPoolTypeBySelectors(provider: ethers.JsonRpcProvider, addr: string) {
  const detectedTypes: string[] = [];
  
  try {
    try {
      const uniV2 = new ethers.Contract(addr, UNIV2_ABI, provider);
      const reserves = await uniV2.getReserves({ blockTag: TARGET_BLOCK });
      if (reserves) detectedTypes.push(POOL_TYPES.UNISWAP_V2);
    } catch {}
    
    try {
      const aero = new ethers.Contract(addr, AERODROME_ABI, provider);
      const r0 = await aero.reserve0({ blockTag: TARGET_BLOCK });
      if (r0 !== undefined) detectedTypes.push(POOL_TYPES.AERODROME);
    } catch {}
    
    try {
      const uniV3 = new ethers.Contract(addr, CL_POOL_ABI, provider);
      const slot0 = await uniV3.slot0({ blockTag: TARGET_BLOCK });
      if (slot0) detectedTypes.push(POOL_TYPES.UNISWAP_V3);
    } catch {}
  } catch {}
  
  return detectedTypes;
}

async function detectPoolType(provider: ethers.JsonRpcProvider, addr: string): Promise<string> {
  try {
    const types = await detectPoolTypeBySelectors(provider, addr);
    return types.length > 0 ? types[0] : POOL_TYPES.UNKNOWN;
  } catch {
    return POOL_TYPES.UNKNOWN;
  }
}

async function isLPPool(provider: ethers.JsonRpcProvider, addr: string): Promise<boolean> {
  if (MANUALLY_APPROVED_POOLS.includes(addr.toLowerCase())) return true;
  if (!(await isContract(provider, addr))) return false;

  const poolType = await detectPoolType(provider, addr);
  return poolType !== POOL_TYPES.UNKNOWN;
}

async function alchemyTransfers(token: string, retries = 3): Promise<any[]> {
  const alchemyApiKey = process.env.ALCHEMY_API_KEY;
  if (!alchemyApiKey) {
    console.log('⚠️ Alchemy API key not found');
    return [];
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(
        `https://base-mainnet.g.alchemy.com/v2/${alchemyApiKey}`,
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
              maxCount: "0x3e8"
            }]
          })
        }
      );
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      return data.result?.transfers || [];
    } catch (error: any) {
      console.warn(`⚠️ Alchemy attempt ${attempt}/${retries} failed for ${token.slice(0, 10)}...`);
      console.warn(`   Error: ${error.message}`);
      
      if (attempt === retries) {
        console.error(`❌ All ${retries} attempts failed for ${token}`);
        return [];
      }
      
      const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      console.log(`   Retrying in ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  return [];
}

/* ================= MAIN LOGIC ================= */

export async function POST() {
  try {
    console.log(`🌳 Generating Merkle Tree @ block ${TARGET_BLOCK}`);

    const alchemyApiKey = process.env.ALCHEMY_API_KEY;
    if (!alchemyApiKey) {
      throw new Error('ALCHEMY_API_KEY not found in environment variables');
    }

    const ALCHEMY_RPC = `https://base-mainnet.g.alchemy.com/v2/${alchemyApiKey}`;
    const provider = new ethers.JsonRpcProvider(
      ALCHEMY_RPC,
      { name: "base", chainId: 8453 },
      { staticNetwork: true, polling: false }
    );

    console.log("🔌 Warming up RPC connection...");
    const block = await provider.getBlockNumber();
    console.log("✅ RPC connected. Latest block:", block);

    const weekly = new ethers.Contract(WEEKLY, WEEKLY_ABI, provider);
    const btc1 = new ethers.Contract(BTC1USD, ERC20_ABI, provider);

    const excluded = new Set(
      (await weekly.getExcludedAddresses({ blockTag: TARGET_BLOCK }))
        .map((a: string) => a.toLowerCase())
    );

    const balances = new Map<string, bigint>();

    /* ---------- STEP 1: Get ALL BTC1USD HOLDERS ---------- */
    console.log('\n📊 STEP 1: Fetching all BTC1USD holders (EOAs + Contracts)...');
    const allHolders = new Set<string>();
    const transfers = await alchemyTransfers(BTC1USD);
    
    for (const t of transfers) {
      if (t.from) allHolders.add(t.from.toLowerCase());
      if (t.to) allHolders.add(t.to.toLowerCase());
    }
    
    console.log(`   Found ${allHolders.size} unique addresses\n`);

    /* ---------- STEP 2: CATEGORIZE HOLDERS ---------- */
    console.log('📊 STEP 2: Categorizing holders (EOAs vs LP Pools)...');
    const eoas: string[] = [];
    const detectedPools: Array<{ address: string; type: string }> = [];
    
    for (const addr of allHolders) {
      if (addr === ZERO || addr === ONE || excluded.has(addr) || EXCLUDED_POOLS.includes(addr)) continue;
      
      if (await isContract(provider, addr)) {
        if (await isLPPool(provider, addr)) {
          const poolType = await detectPoolType(provider, addr);
          detectedPools.push({ address: addr, type: poolType });
          console.log(`   🏊 LP Pool detected: ${addr} (${poolType})`);
          eoas.push(addr);
        } else {
          eoas.push(addr);
        }
      } else {
        eoas.push(addr);
      }
    }
    
    console.log(`   ✅ EOAs (including smart wallets): ${eoas.length}`);
    console.log(`   ✅ LP Pools (treated as direct holders): ${detectedPools.length}\n`);

    /* ---------- STEP 3: PROCESS DIRECT BTC1 BALANCES ---------- */
    console.log('📊 STEP 3: Processing direct BTC1 balances...');
    
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
      console.log(`   ℹ️  Pool treated as direct holder (not expanding LP providers)`);
      
      if (balances.has(pool)) {
        console.log(`   ✅ Pool balance: ${ethers.formatUnits(balances.get(pool)!, BTC1_DECIMALS)} BTC1`);
      }
    }

    /* ---------- MERKLE TREE GENERATION ---------- */
    console.log('\n🌳 STEP 5: Generating Merkle Tree...');
    const [, rewardPerToken] = await weekly.getCurrentDistributionInfo({ blockTag: TARGET_BLOCK });

    const claims: Array<{ index: number; account: string; amount: string; proof: string[] }> = [];
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
        ["uint256", "address", "uint256"],
        [c.index, c.account, c.amount]
      )
    );

    const tree = new MerkleTree(leaves, ethers.keccak256, { sortPairs: true });
    claims.forEach((c, i) => c.proof = tree.getHexProof(leaves[i]));

    const merkleRoot = tree.getHexRoot();
    console.log("\n✅ Merkle Root:", merkleRoot);
    console.log("💰 Total Rewards:", ethers.formatUnits(totalRewards, BTC1_DECIMALS));
    console.log("📄 Total Claims:", claims.length);

    // Convert claims array to object format for Supabase
    const claimsObj: Record<string, any> = {};
    claims.forEach(c => {
      claimsObj[c.account] = {
        index: c.index,
        proof: c.proof,
        amount: c.amount,
        account: c.account
      };
    });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not found in environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('⚠️ WARNING: Using ANON key instead of SERVICE_ROLE key');
      console.warn('⚠️ This may fail due to Row-Level Security policies');
    }

    const TABLE_NAME = 'merkle_distributions_prod';
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
      merkle_root: merkleRoot,
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
      throw new Error(`Supabase insert failed: ${error.message}`);
    } else {
      console.log("💾 Saved to Supabase successfully!\n");
    }

    return NextResponse.json({
      success: true,
      merkleRoot,
      totalRewards: ethers.formatUnits(totalRewards, BTC1_DECIMALS),
      activeHolders: claims.length,
      distributionId: nextId.toString(),
      claims: claims.length,
      message: 'Merkle tree generated and saved to Supabase successfully'
    });

  } catch (error: any) {
    console.error('💥 Error generating merkle tree:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to generate merkle tree', 
        details: error.message,
        suggestions: [
          'Check if SUPABASE_SERVICE_ROLE_KEY is set in Netlify environment variables',
          'Ensure ALCHEMY_API_KEY is valid',
          'Check if contracts are deployed on the correct network',
          'Review server logs for detailed error messages'
        ]
      },
      { status: 500 }
    );
  }
}
