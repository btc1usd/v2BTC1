

/* ============================================================
   BTC1 – Universal Merkle Generator (ALL POOL TYPES)
   Network: Base Mainnet
   ============================================================ */

const { ethers } = require("ethers");
const { MerkleTree } = require("merkletreejs");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

/* ================= CONFIG ================= */

const TARGET_BLOCK = 39769600;
const BTC1_DECIMALS = 8;

const BTC1USD = "0x6dC9C43278AeEa063c01d97505f215ECB6da4a21".toLowerCase();
const WEEKLY = "0x51D622A533C56256c5E318f5aB9844334523dFe0";

const ZERO = "0x0000000000000000000000000000000000000000";
const ONE  = "0x0000000000000000000000000000000000000001";

/* ---------- ERC20 LP POOLS ---------- */
const ERC20_LP_POOLS = [
  "0x269251b69fcd1ceb0500a86408cab39666b2077a",
  "0x18fd0aaaf8c6e28427b26ac75cc4375e21eb74a0b0ce1b66b8672a11a4c47b3d",
  "0xf669d50334177dc11296b61174955a0216adad38",
  "0x9d3a11303486e7d773f0ddfd2f47c4b374533580",
  "0xba420997ee5b98a8037e4395b2f4e9f9715a22a9256be1e880b2ff545ef7a327",
  "0x3968eff088dfde7b7d00e192fa9ef412aac583ebcb07971d516bd7951c1a74b0",
  "0xe80d2ef16abbaf4dd7ba60973fded0bb57295bc03b08446f4d3212a58c9cb085",
  "0xa27368cdd9c4e4f2b2f447c9a614682f14b378dab8715a293503b50d43236901",
  "0x74c754b0a0c1774601c4b92a975c068d4c000432aeffd980be7cbcc3c012ce65"
].map(a => a.toLowerCase());

/* ---------- GAUGES (LP STAKED) ---------- */
const GAUGES = [
  // { gauge: "...", lp: "..." }
];

/* ---------- SLIPSTREAM (NFT LP) ---------- */
const SLIPSTREAM_POOLS = [
  // CL pool addresses


  "0x269251b69fcd1ceb0500a86408cab39666b2077a",
  "0x18fd0aaaf8c6e28427b26ac75cc4375e21eb74a0b0ce1b66b8672a11a4c47b3d",
  "0xf669d50334177dc11296b61174955a0216adad38",
  "0x9d3a11303486e7d773f0ddfd2f47c4b374533580",
  "0xba420997ee5b98a8037e4395b2f4e9f9715a22a9256be1e880b2ff545ef7a327",
  "0x3968eff088dfde7b7d00e192fa9ef412aac583ebcb07971d516bd7951c1a74b0",
  "0xe80d2ef16abbaf4dd7ba60973fded0bb57295bc03b08446f4d3212a58c9cb085",
  "0xa27368cdd9c4e4f2b2f447c9a614682f14b378dab8715a293503b50d43236901",
  "0x74c754b0a0c1774601c4b92a975c068d4c000432aeffd980be7cbcc3c012ce65"
];

/* ---------- INDEXED OWNERS (REQUIRED) ---------- */
// ⚠️ MUST be filled from indexer / subgraph / CSV
const KNOWN_GAUGE_STAKERS = [];
const KNOWN_SLIPSTREAM_OWNERS = [];

/* ================= PROVIDER ================= */

const provider = new ethers.JsonRpcProvider(
  `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
  { name: "base", chainId: 8453 },
  { staticNetwork: true }
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

const POSITION_MANAGER =
  "0x827922686190790b37229fd06084350E74485b72";
const POSITION_MANAGER_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function tokenOfOwnerByIndex(address,uint256) view returns (uint256)",
  "function positions(uint256) view returns (uint96,address,address,address,uint24,int24,int24,uint128,uint256,uint256)"
];

/* ================= HELPERS ================= */

async function isContract(addr) {
  const code = await provider.getCode(addr, TARGET_BLOCK);
  return code !== "0x" && ((code.length - 2) / 2) >= 100;
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

/* ================= ERC20 LP ================= */

async function processERC20LP(pool, balances, excluded) {
  console.log(`🔍 Checking pool: ${pool}`);
  let info;

  try {
    let p = new ethers.Contract(pool, UNIV2_ABI, provider);
    const [t0, t1, ts] = await Promise.all([
      p.token0({ blockTag: TARGET_BLOCK }),
      p.token1({ blockTag: TARGET_BLOCK }),
      p.totalSupply({ blockTag: TARGET_BLOCK })
    ]);
    const r = await p.getReserves({ blockTag: TARGET_BLOCK });

    if (![t0, t1].map(a => a.toLowerCase()).includes(BTC1USD)) {
      console.log(`   ⊘ Not a BTC1 pool (UniswapV2 format)`);
      
      // Try Aerodrome format
      try {
        p = new ethers.Contract(pool, AERODROME_ABI, provider);
        const [t0a, t1a, r0, r1, tsa] = await Promise.all([
          p.token0({ blockTag: TARGET_BLOCK }),
          p.token1({ blockTag: TARGET_BLOCK }),
          p.reserve0({ blockTag: TARGET_BLOCK }),
          p.reserve1({ blockTag: TARGET_BLOCK }),
          p.totalSupply({ blockTag: TARGET_BLOCK })
        ]);
        
        if (![t0a, t1a].map(a => a.toLowerCase()).includes(BTC1USD)) {
          console.log(`   ⊘ Not a BTC1 pool (Aerodrome format)`);
          return;
        }
        
        info = {
          reserve: BigInt(t0a.toLowerCase() === BTC1USD ? r0 : r1),
          totalSupply: BigInt(tsa)
        };
        console.log(`   ✅ Valid Aerodrome BTC1 pool`);
      } catch (aeroError) {
        console.log(`   ❌ Failed to read as Aerodrome: ${aeroError.message}`);
        return;
      }
    } else {
      info = {
        reserve: BigInt(t0.toLowerCase() === BTC1USD ? r[0] : r[1]),
        totalSupply: BigInt(ts)
      };
      console.log(`   ✅ Valid UniswapV2 BTC1 pool`);
    }
  } catch (err) {
    console.log(`   ❌ Failed to read pool: ${err.message}`);
    return;
  }

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
      excluded.has(addr) ||
      await isContract(addr)
    ) continue;

    const share = (bal * info.reserve) / info.totalSupply;
    if (share > 0n) {
      balances.set(addr, (balances.get(addr) || 0n) + share);
      validHolders++;
      console.log(`   └─ LP holder ${addr.slice(0,10)}... = ${ethers.formatUnits(share, BTC1_DECIMALS)} BTC1`);
    }
  }
  
  console.log(`   ✅ Found ${validHolders} valid LP holders\n`);
}

/* ================= GAUGE LP ================= */

async function processGauge(gaugeInfo, balances, excluded) {
  const gauge = new ethers.Contract(gaugeInfo.gauge, GAUGE_ABI, provider);
  const lp = gaugeInfo.lp;

  const lpInfo = await processERC20LP(lp, new Map(), new Set()); // reuse logic
  if (!lpInfo) return;

  console.log(`⛓️ Gauge → ${gaugeInfo.gauge}`);

  for (const user of KNOWN_GAUGE_STAKERS) {
    if (excluded.has(user)) continue;
    const staked = await gauge.balanceOf(user, { blockTag: TARGET_BLOCK });
    if (staked > 0n) {
      const share = (staked * lpInfo.reserve) / lpInfo.totalSupply;
      balances.set(user, (balances.get(user) || 0n) + share);
    }
  }
}

/* ================= SLIPSTREAM ================= */

function liquidityToAmount(liq, sqrtPriceX96) {
  return (BigInt(liq) * BigInt(sqrtPriceX96)) >> 96n;
}

async function processSlipstream(pool, balances, excluded) {
  const cl = new ethers.Contract(pool, CL_POOL_ABI, provider);
  const [t0, t1, slot0] = await Promise.all([
    cl.token0({ blockTag: TARGET_BLOCK }),
    cl.token1({ blockTag: TARGET_BLOCK }),
    cl.slot0({ blockTag: TARGET_BLOCK })
  ]);

  if (![t0, t1].map(a => a.toLowerCase()).includes(BTC1USD)) return;

  console.log(`🧬 Slipstream LP → ${pool}`);

  const manager = new ethers.Contract(POSITION_MANAGER, POSITION_MANAGER_ABI, provider);
  const sqrtPrice = slot0[0];

  for (const owner of KNOWN_SLIPSTREAM_OWNERS) {
    if (excluded.has(owner)) continue;

    const count = await manager.balanceOf(owner, { blockTag: TARGET_BLOCK });
    for (let i = 0; i < count; i++) {
      const tokenId = await manager.tokenOfOwnerByIndex(owner, i, { blockTag: TARGET_BLOCK });
      const pos = await manager.positions(tokenId, { blockTag: TARGET_BLOCK });

      const liq = pos[7];
      if (liq === 0n) continue;

      const amt = liquidityToAmount(liq, sqrtPrice);
      balances.set(owner, (balances.get(owner) || 0n) + amt);
    }
  }
}

/* ================= MAIN ================= */

async function main() {
  console.log(`🌳 Generating Merkle Tree @ block ${TARGET_BLOCK}`);

  const weekly = new ethers.Contract(WEEKLY, WEEKLY_ABI, provider);
  const btc1 = new ethers.Contract(BTC1USD, ERC20_ABI, provider);

  const excluded = new Set(
    (await weekly.getExcludedAddresses({ blockTag: TARGET_BLOCK }))
      .map(a => a.toLowerCase())
  );

  const balances = new Map();

  /* ---------- EOAs ---------- */
  const seen = new Set();
  for (const t of await alchemyTransfers(BTC1USD)) {
    for (const raw of [t.from, t.to]) {
      if (!raw) continue;
      const addr = raw.toLowerCase();
      if (seen.has(addr)) continue;
      seen.add(addr);

      if (
        addr === ZERO ||
        addr === ONE ||
        excluded.has(addr) ||
        await isContract(addr)
      ) continue;

      const bal = await btc1.balanceOf(addr, { blockTag: TARGET_BLOCK });
      if (bal > 0n) {
        balances.set(addr, bal);
        console.log(`👤 EOA → ${addr} = ${ethers.formatUnits(bal, BTC1_DECIMALS)} BTC1`);
      }
    }
  }

  /* ---------- ERC20 LP ---------- */
  console.log(`\n🏊 Processing ${ERC20_LP_POOLS.length} ERC20 LP pools...`);
  for (const pool of ERC20_LP_POOLS) {
    await processERC20LP(pool, balances, excluded);
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  /* ---------- GAUGES ---------- */
  for (const g of GAUGES) {
    await processGauge(g, balances, excluded);
  }

  /* ---------- SLIPSTREAM ---------- */
  for (const pool of SLIPSTREAM_POOLS) {
    await processSlipstream(pool, balances, excluded);
  }

  /* ---------- MERKLE ---------- */
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

  console.log("\n🌱 Merkle Root:", tree.getHexRoot());
  console.log("💰 Total Rewards:", ethers.formatUnits(totalRewards, BTC1_DECIMALS));

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  await supabase.from("merkle_distributions").insert({
    merkle_root: tree.getHexRoot(),
    total_rewards: totalRewards.toString(),
    claims,
    metadata: {
      block: TARGET_BLOCK,
      pools: {
        erc20: ERC20_LP_POOLS,
        gauges: GAUGES,
        slipstream: SLIPSTREAM_POOLS
      }
    }
  });

  console.log("💾 Saved to Supabase");
}

main().catch(console.error);
