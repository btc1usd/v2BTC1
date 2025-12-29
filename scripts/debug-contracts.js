const { ethers } = require("ethers");
require("dotenv").config({ path: ".env.local" });

const TARGET_BLOCK = 39750038;

const ALCHEMY_RPC = `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
const provider = new ethers.JsonRpcProvider(
  ALCHEMY_RPC,
  { name: "base", chainId: 8453 },
  { staticNetwork: true, polling: false, timeout: 60000 }
);

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

const addresses = [
  "0xa1fcf334f8ee86ecad93d4271ed25a50d60aa72b",
  "0x8284b18124b8726f550ef5882544c55c8ebb8cce",
  "0x1111111254eeb25477b68fb85ed929f73a960582"
];

async function checkContract(addr) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Checking: ${addr}`);
  console.log('='.repeat(70));
  
  const code = await provider.getCode(addr, TARGET_BLOCK);
  console.log(`Bytecode length: ${code.length} bytes`);
  
  // Try UniswapV2
  try {
    const uniV2 = new ethers.Contract(addr, UNIV2_ABI, provider);
    const reserves = await uniV2.getReserves({ blockTag: TARGET_BLOCK });
    console.log(`✅ UniswapV2 getReserves() works!`);
    console.log(`   Reserve0: ${reserves[0]}, Reserve1: ${reserves[1]}`);
    
    const [token0, token1] = await Promise.all([
      uniV2.token0({ blockTag: TARGET_BLOCK }),
      uniV2.token1({ blockTag: TARGET_BLOCK })
    ]);
    console.log(`   Token0: ${token0}`);
    console.log(`   Token1: ${token1}`);
    return;
  } catch (e) {
    console.log(`❌ UniswapV2: ${e.message.substring(0, 100)}`);
  }
  
  // Try Aerodrome
  try {
    const aero = new ethers.Contract(addr, AERODROME_ABI, provider);
    const r0 = await aero.reserve0({ blockTag: TARGET_BLOCK });
    console.log(`✅ Aerodrome reserve0() works!`);
    console.log(`   Reserve0: ${r0}`);
    return;
  } catch (e) {
    console.log(`❌ Aerodrome: ${e.message.substring(0, 100)}`);
  }
  
  // Try UniswapV3
  try {
    const uniV3 = new ethers.Contract(addr, CL_POOL_ABI, provider);
    const slot0 = await uniV3.slot0({ blockTag: TARGET_BLOCK });
    console.log(`✅ UniswapV3 slot0() works!`);
    console.log(`   sqrtPriceX96: ${slot0[0]}`);
    return;
  } catch (e) {
    console.log(`❌ UniswapV3: ${e.message.substring(0, 100)}`);
  }
  
  // Try Curve
  try {
    const curve = new ethers.Contract(addr, ["function coins(uint256) view returns (address)"], provider);
    const coin0 = await curve.coins(0, { blockTag: TARGET_BLOCK });
    console.log(`✅ Curve coins(0) works!`);
    console.log(`   Coin0: ${coin0}`);
    return;
  } catch (e) {
    console.log(`❌ Curve: ${e.message.substring(0, 100)}`);
  }
  
  // Try Balancer
  try {
    const bal = new ethers.Contract(addr, ["function getPoolId() view returns (bytes32)"], provider);
    const poolId = await bal.getPoolId({ blockTag: TARGET_BLOCK });
    console.log(`✅ Balancer getPoolId() works!`);
    console.log(`   PoolId: ${poolId}`);
    return;
  } catch (e) {
    console.log(`❌ Balancer: ${e.message.substring(0, 100)}`);
  }
  
  console.log(`\n⚠️  This contract doesn't match any known LP pool interface`);
  console.log(`   It's likely a smart wallet, multisig, or other contract type`);
}

async function main() {
  console.log("🔍 Debugging Contract Types\n");
  
  for (const addr of addresses) {
    await checkContract(addr);
  }
}

main().catch(console.error);
