import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { keccak256 } from 'viem';
import { MerkleTree } from 'merkletreejs';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { createProviderWithFallback } from '@/lib/rpc-provider';

interface MerkleClaim {
  index: number;
  account: string;
  amount: string;
  proof: string[];
}

interface DistributionData {
  distributionId: string;
  merkleRoot: string;
  totalRewards: string;
  claims: { [address: string]: MerkleClaim };
  metadata: {
    generated: string;
    activeHolders: number;
    totalHolders?: number;
    excludedAddresses?: string[];
    excludedCount?: number;
    note?: string;
  };
}

// Contract ABIs
const BTC1USD_ABI = [
  {
    "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "from", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "to", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" }
    ],
    "name": "Transfer",
    "type": "event"
  }
];

const WEEKLY_DISTRIBUTION_ABI = [
  {
    "inputs": [],
    "name": "getCurrentDistributionInfo",
    "outputs": [
      { "internalType": "uint256", "name": "distributionId", "type": "uint256" },
      { "internalType": "uint256", "name": "rewardPerToken", "type": "uint256" },
      { "internalType": "uint256", "name": "totalSupply", "type": "uint256" },
      { "internalType": "uint256", "name": "timestamp", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "distributionCount",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getExcludedAddresses",
    "outputs": [{ "internalType": "address[]", "name": "", "type": "address[]" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "lastDistributionTime",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "lastDistributionBlock",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "distributionId", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "totalRewards", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "blockNumber", "type": "uint256" }
    ],
    "name": "DistributionExecuted",
    "type": "event"
  }
];

// LP Pool ABIs for detecting and processing liquidity pools
const UNIV2_PAIR_ABI = [
  {
    "inputs": [],
    "name": "token0",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "token1",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getReserves",
    "outputs": [
      { "internalType": "uint112", "name": "reserve0", "type": "uint112" },
      { "internalType": "uint112", "name": "reserve1", "type": "uint112" },
      { "internalType": "uint32", "name": "blockTimestampLast", "type": "uint32" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];

const AERODROME_POOL_ABI = [
  {
    "inputs": [],
    "name": "token0",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "token1",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "reserve0",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "reserve1",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];

const CL_POOL_ABI = [
  {
    "inputs": [],
    "name": "token0",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "token1",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "slot0",
    "outputs": [
      { "internalType": "uint160", "name": "sqrtPriceX96", "type": "uint160" },
      { "internalType": "int24", "name": "tick", "type": "int24" },
      { "internalType": "uint16", "name": "observationIndex", "type": "uint16" },
      { "internalType": "uint16", "name": "observationCardinality", "type": "uint16" },
      { "internalType": "uint16", "name": "observationCardinalityNext", "type": "uint16" },
      { "internalType": "uint8", "name": "feeProtocol", "type": "uint8" },
      { "internalType": "bool", "name": "unlocked", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

const POSITION_MANAGER_ABI = [
  {
    "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "owner", "type": "address" },
      { "internalType": "uint256", "name": "index", "type": "uint256" }
    ],
    "name": "tokenOfOwnerByIndex",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
    "name": "positions",
    "outputs": [
      { "internalType": "uint96", "name": "nonce", "type": "uint96" },
      { "internalType": "address", "name": "operator", "type": "address" },
      { "internalType": "address", "name": "token0", "type": "address" },
      { "internalType": "address", "name": "token1", "type": "address" },
      { "internalType": "uint24", "name": "fee", "type": "uint24" },
      { "internalType": "int24", "name": "tickLower", "type": "int24" },
      { "internalType": "int24", "name": "tickUpper", "type": "int24" },
      { "internalType": "uint128", "name": "liquidity", "type": "uint128" },
      { "internalType": "uint256", "name": "feeGrowthInside0LastX128", "type": "uint256" },
      { "internalType": "uint256", "name": "feeGrowthInside1LastX128", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
    "name": "ownerOf",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" },
      { "indexed": false, "internalType": "uint128", "name": "liquidity", "type": "uint128" },
      { "indexed": false, "internalType": "uint256", "name": "amount0", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "amount1", "type": "uint256" }
    ],
    "name": "IncreaseLiquidity",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" },
      { "indexed": false, "internalType": "uint128", "name": "liquidity", "type": "uint128" },
      { "indexed": false, "internalType": "uint256", "name": "amount0", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "amount1", "type": "uint256" }
    ],
    "name": "DecreaseLiquidity",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "from", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "to", "type": "address" },
      { "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" }
    ],
    "name": "Transfer",
    "type": "event"
  }
];

// Constants
const BTC1_DECIMALS = 8;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ONE_ADDRESS = '0x0000000000000000000000000000000000000001';

// Pool type detection constants
const POOL_TYPES = {
  UNISWAP_V2: 'UniswapV2',
  AERODROME: 'Aerodrome',
  UNISWAP_V3: 'UniswapV3',
  UNISWAP_V4: 'UniswapV4',
  CURVE: 'Curve',
  BALANCER: 'Balancer',
  UNKNOWN: 'Unknown'
};

// Excluded pools (will not receive rewards as direct holders)
const EXCLUDED_POOLS = [
  "0x269251b69fcd1ceb0500a86408cab39666b2077a", // UniswapV2 BTC1/WETH
  "0xf669d50334177dc11296b61174955a0216adad38", // UniswapV3 BTC1/USDC
].map(a => a.toLowerCase());

// Manually approved pools (optional override)
const MANUALLY_APPROVED_POOLS: string[] = [
  // Add specific pool addresses here if auto-detection misses them
];

// UniswapV3 Position Manager contract for NFT position tracking
const POSITION_MANAGER = "0x827922686190790b37229fd06084350E74485b72";

// Manual V3 position override (if you know specific NFT token IDs)
const MANUALLY_APPROVED_V3_POSITIONS: string[] = [
  // Add known NFT token IDs here, e.g.: "12345", "67890"
];

// Get Supabase table name based on network
const getSupabaseTableName = (chainId: number): string => {
  // ALWAYS use merkle_distributions_prod on mainnet (Base = 8453)
  if (chainId === 8453) {
    return 'merkle_distributions_prod';
  }
  // Testnet (Base Sepolia = 84532 or any other testnet)
  return 'merkle_distributions_dev';
};

// Helper to get holders from BaseScan API
const getHoldersFromBaseScan = async (tokenAddress: string, chainId: number, retries = 3): Promise<string[]> => {
  const baseScanApiKey = process.env.BASESCAN_API_KEY;
  if (!baseScanApiKey) {
    console.log('⚠️ BaseScan API key not found');
    return [];
  }

  // Determine the correct API endpoint based on network
  const apiBaseUrl = chainId === 8453 
    ? 'https://api.basescan.org/api' 
    : 'https://api-sepolia.basescan.org/api';

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔍 Fetching holders from BaseScan (attempt ${attempt}/${retries})...`);
      
      // Use BaseScan's token holder list API
      const url = `${apiBaseUrl}?module=token&action=tokenholderlist&contractaddress=${tokenAddress}&apikey=${baseScanApiKey}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();

      if (data.status === '1' && data.result) {
        const holders = data.result.map((holder: any) => holder.TokenHolderAddress);
        console.log(`✅ BaseScan found ${holders.length} token holders`);
        return holders;
      } else if (data.message === 'No holders found') {
        console.log('ℹ️ BaseScan: No token holders found yet');
        return [];
      } else {
        console.log('🔍 BaseScan tokenholderlist failed, trying tokentxns instead...');
        
        // Alternative: Get holders from token transactions
        const txUrl = `${apiBaseUrl}?module=account&action=tokentxns&contractaddress=${tokenAddress}&apikey=${baseScanApiKey}`;
        const txResponse = await fetch(txUrl);
        
        if (!txResponse.ok) {
          throw new Error(`HTTP error! status: ${txResponse.status}`);
        }
        
        const txData = await txResponse.json();
        
        if (txData.status === '1' && txData.result) {
          const uniqueAddresses = new Set<string>();
          
          txData.result.forEach((tx: any) => {
            if (tx.from && tx.from !== '0x0000000000000000000000000000000000000000') {
              uniqueAddresses.add(tx.from.toLowerCase());
            }
            if (tx.to) {
              uniqueAddresses.add(tx.to.toLowerCase());
            }
          });
          
          const holders = Array.from(uniqueAddresses);
          console.log(`✅ BaseScan found ${holders.length} unique addresses from token transactions`);
          return holders;
        }
        
        throw new Error(`BaseScan API error: ${data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.warn(`⚠️ BaseScan attempt ${attempt}/${retries} failed:`, error instanceof Error ? error.message : error);
      
      if (attempt === retries) {
        console.error(`❌ All ${retries} attempts failed for BaseScan API`);
        return [];
      }
      
      // Exponential backoff
      const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      console.log(`   Retrying in ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  return [];
};

// Load deployment configuration - Environment variables ONLY for production
const getContractAddresses = () => {
  try {
    // Use environment variables (REQUIRED for production)
    const btc1usd = process.env.NEXT_PUBLIC_BTC1USD_CONTRACT;
    const weeklyDistribution = process.env.NEXT_PUBLIC_WEEKLY_DISTRIBUTION_CONTRACT;
    const merkleDistributor = process.env.NEXT_PUBLIC_MERKLE_DISTRIBUTOR_CONTRACT;

    if (btc1usd && weeklyDistribution && merkleDistributor) {
      console.log('✅ Using contract addresses from environment variables');
      return { btc1usd, weeklyDistribution, merkleDistributor };
    }

    // If we get here, environment variables are missing
    console.error('❌ Contract addresses not found. Please set environment variables:');
    console.error('   NEXT_PUBLIC_BTC1USD_CONTRACT');
    console.error('   NEXT_PUBLIC_WEEKLY_DISTRIBUTION_CONTRACT');
    console.error('   NEXT_PUBLIC_MERKLE_DISTRIBUTOR_CONTRACT');
    return null;
  } catch (error) {
    console.error('Failed to load deployment config:', error);
    return null;
  }
};

// Setup provider - updated to use robust provider with fallback
const getProvider = async () => {
  try {
    console.log('🔄 Initializing RPC provider with fallback mechanism...');
    
    // Use robust provider with fallback mechanism
    const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "8453");
    const provider = await createProviderWithFallback(chainId, {
      timeout: 15000, // Increased timeout
      maxRetries: 3,
      retryDelay: 2000, // Increased initial delay
      backoffMultiplier: 2
    });
    
    console.log(`✅ Successfully connected to Base Mainnet network`);
    return provider;
  } catch (error) {
    console.error('❌ Failed to create provider with fallback:', error);
    throw new Error(`Unable to connect to Base Mainnet network. Please check your RPC configuration. Details: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Helper to get holders using Alchemy API with retry logic (if available)
const getHoldersFromAlchemy = async (tokenAddress: string, chainId: number, retries = 3): Promise<string[]> => {
  const alchemyApiKey = process.env.ALCHEMY_API_KEY;
  if (!alchemyApiKey) {
    console.log('⚠️ Alchemy API key not found, skipping Alchemy method');
    return [];
  }

  // Determine the correct Alchemy endpoint based on network
  const alchemyNetwork = chainId === 8453 ? 'base-mainnet' : 'base-sepolia';
  const alchemyUrl = `https://${alchemyNetwork}.g.alchemy.com/v2/${alchemyApiKey}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔍 Fetching holders from Alchemy API (attempt ${attempt}/${retries})...`);

      // Get asset transfers for the token
      const response = await fetch(alchemyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'alchemy_getAssetTransfers',
          params: [{
            fromBlock: '0x0',
            toBlock: 'latest',
            contractAddresses: [tokenAddress],
            category: ['erc20'],
            withMetadata: false,
            excludeZeroValue: true,
            maxCount: '0x3e8' // 1000 transfers max
          }],
          id: 1
        })
      });

      // Read body only once - either as JSON or text
      let data: any;
      try {
        data = await response.json();
      } catch (jsonError) {
        // If JSON parsing fails, response was likely an error
        throw new Error(`Alchemy API error: ${response.status} - Failed to parse response`);
      }

      // Check if response was successful based on data
      if (!response.ok || (data.error)) {
        const errorMsg = data.error?.message || data.message || `HTTP ${response.status}`;
        throw new Error(`Alchemy API error: ${errorMsg}`);
      }

      if (data.result?.transfers) {
        const uniqueAddresses = new Set<string>();

        data.result.transfers.forEach((transfer: any) => {
          if (transfer.from && transfer.from !== '0x0000000000000000000000000000000000000000') {
            uniqueAddresses.add(transfer.from);
          }
          if (transfer.to) {
            uniqueAddresses.add(transfer.to);
          }
        });

        const holders = Array.from(uniqueAddresses);
        console.log(`✅ Alchemy found ${holders.length} unique addresses from transfers`);
        return holders;
      } else {
        console.log('ℹ️ Alchemy returned no transfers');
        return [];
      }
    } catch (error) {
      console.warn(`⚠️ Alchemy attempt ${attempt}/${retries} failed:`, error instanceof Error ? error.message : error);
      
      if (attempt === retries) {
        console.error(`❌ All ${retries} attempts failed for Alchemy API`);
        return [];
      }
      
      // Exponential backoff
      const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      console.log(`   Retrying in ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  return [];
};

// Helper function to check if an address is a smart contract
// Updated to match script logic: Small contracts (<100 bytes) are treated as EOAs
async function isContract(provider: ethers.JsonRpcProvider, address: string, blockTag?: number | string): Promise<boolean> {
  try {
    const code = await provider.getCode(address, blockTag);
    
    // No code = EOA
    if (code === '0x' || code.length <= 2) {
      return false;
    }
    
    // Any bytecode means it's a contract (we handle it separately for reward eligibility)
    return true;
  } catch (error) {
    console.warn(`⚠️ Failed to check if ${address} is contract, treating as EOA`);
    return false; // Treat as EOA if check fails
  }
}

// Check if address is an EOA
async function isEOA(provider: ethers.JsonRpcProvider, address: string, blockTag?: number | string): Promise<boolean> {
  return !(await isContract(provider, address, blockTag));
}

// Check if address is manually approved pool
function isManuallyApprovedPool(addr: string): boolean {
  return MANUALLY_APPROVED_POOLS.includes(addr.toLowerCase());
}

// Industry-standard pool detection using function selectors
async function detectPoolTypeBySelectors(provider: ethers.JsonRpcProvider, addr: string, blockTag?: number | string): Promise<string[]> {
  const detectedTypes: string[] = [];
  
  try {
    // UniswapV2: Try calling getReserves()
    try {
      const uniV2 = new ethers.Contract(addr, UNIV2_PAIR_ABI, provider);
      const reserves = await uniV2.getReserves({ blockTag });
      if (reserves) detectedTypes.push(POOL_TYPES.UNISWAP_V2);
    } catch {}
    
    // Aerodrome: Try calling reserve0() and reserve1()
    try {
      const aero = new ethers.Contract(addr, AERODROME_POOL_ABI, provider);
      const r0 = await aero.reserve0({ blockTag });
      if (r0 !== undefined) detectedTypes.push(POOL_TYPES.AERODROME);
    } catch {}
    
    // UniswapV3/V4: Try calling slot0()
    try {
      const uniV3 = new ethers.Contract(addr, CL_POOL_ABI, provider);
      const slot0 = await uniV3.slot0({ blockTag });
      if (slot0) detectedTypes.push(POOL_TYPES.UNISWAP_V3);
    } catch {}
    
    // Curve: Try calling coins(0)
    try {
      const curve = new ethers.Contract(addr, ["function coins(uint256) view returns (address)"], provider);
      await curve.coins(0, { blockTag });
      detectedTypes.push(POOL_TYPES.CURVE);
    } catch {}
    
    // Balancer: Try calling getPoolId()
    try {
      const bal = new ethers.Contract(addr, ["function getPoolId() view returns (bytes32)"], provider);
      await bal.getPoolId({ blockTag });
      detectedTypes.push(POOL_TYPES.BALANCER);
    } catch {}
  } catch {}
  
  return detectedTypes;
}

// Detect pool type
async function detectPoolType(provider: ethers.JsonRpcProvider, addr: string, blockTag?: number | string): Promise<string> {
  try {
    const types = await detectPoolTypeBySelectors(provider, addr, blockTag);
    return types.length > 0 ? types[0] : POOL_TYPES.UNKNOWN;
  } catch {
    return POOL_TYPES.UNKNOWN;
  }
}

// Check if address is an LP pool
async function isLPPool(provider: ethers.JsonRpcProvider, addr: string, blockTag?: number | string): Promise<boolean> {
  if (isManuallyApprovedPool(addr)) return true;
  if (!(await isContract(provider, addr, blockTag))) return false;

  const poolType = await detectPoolType(provider, addr, blockTag);
  return poolType !== POOL_TYPES.UNKNOWN;
}

// Get pool tokens using standard interface
async function getPoolTokens(provider: ethers.JsonRpcProvider, pool: string, poolType: string, blockTag?: number | string): Promise<{ token0: string; token1: string } | null> {
  try {
    if (poolType === POOL_TYPES.UNISWAP_V2 || poolType === POOL_TYPES.AERODROME) {
      const pair = new ethers.Contract(pool, UNIV2_PAIR_ABI, provider);
      const [token0, token1] = await Promise.all([
        pair.token0({ blockTag }),
        pair.token1({ blockTag })
      ]);
      return { token0: token0.toLowerCase(), token1: token1.toLowerCase() };
    } else if (poolType === POOL_TYPES.UNISWAP_V3) {
      const pool3 = new ethers.Contract(pool, CL_POOL_ABI, provider);
      const [token0, token1] = await Promise.all([
        pool3.token0({ blockTag }),
        pool3.token1({ blockTag })
      ]);
      return { token0: token0.toLowerCase(), token1: token1.toLowerCase() };
    }
  } catch {}
  return null;
}

// Helper to get transfers using Alchemy API with retry logic
async function alchemyTransfers(token: string, chainId: number, toBlock?: number, retries = 3): Promise<any[]> {
  const alchemyApiKey = process.env.ALCHEMY_API_KEY;
  if (!alchemyApiKey) {
    console.log('⚠️ Alchemy API key not found');
    return [];
  }

  const alchemyNetwork = chainId === 8453 ? 'base-mainnet' : 'base-sepolia';
  const alchemyUrl = `https://${alchemyNetwork}.g.alchemy.com/v2/${alchemyApiKey}`;
  const toBlockHex = toBlock ? `0x${toBlock.toString(16)}` : 'latest';

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(alchemyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "alchemy_getAssetTransfers",
          params: [{
            fromBlock: "0x0",
            toBlock: toBlockHex,
            contractAddresses: [token],
            category: ["erc20"],
            excludeZeroValue: true,
            maxCount: "0x3e8" // 1000 max
          }]
        })
      });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      return data.result?.transfers || [];
    } catch (error) {
      console.warn(`⚠️  Alchemy attempt ${attempt}/${retries} failed for ${token.slice(0, 10)}...`);
      console.warn(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      if (attempt === retries) {
        console.error(`❌ All ${retries} attempts failed for ${token}`);
        return [];
      }
      
      // Exponential backoff
      const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      console.log(`   Retrying in ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  return [];
}

// Helper to get LP token holders using Alchemy API with pagination and retry logic
const getLPHoldersFromAlchemy = async (lpTokenAddress: string, retries = 3): Promise<Map<string, bigint>> => {
  const alchemyApiKey = process.env.ALCHEMY_API_KEY;
  if (!alchemyApiKey) {
    console.log('⚠️ Alchemy API key not found for LP holders');
    return new Map();
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`  🔍 Fetching LP token holders for ${lpTokenAddress} (attempt ${attempt}/${retries})...`);
      const alchemyUrl = `https://base-mainnet.g.alchemy.com/v2/${alchemyApiKey}`;
      const balances = new Map<string, bigint>();
      let pageKey: string | undefined = undefined;

      do {
        const response: Response = await fetch(alchemyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'alchemy_getAssetTransfers',
            params: [{
              fromBlock: '0x0',
              toBlock: 'latest',
              contractAddresses: [lpTokenAddress],
              category: ['erc20'],
              withMetadata: false,
              excludeZeroValue: true,
              maxCount: '0x3e8', // 1000 transfers per page
              pageKey
            }],
            id: 1
          })
        });

        if (!response.ok) {
          throw new Error(`Alchemy API error: ${response.status}`);
        }

        const data: any = await response.json();
        if (!data.result) {
          throw new Error('Invalid Alchemy response');
        }

        // Process transfers to calculate balances
        for (const transfer of data.result.transfers || []) {
          const from = transfer.from?.toLowerCase();
          const to = transfer.to?.toLowerCase();
          const value = BigInt(transfer.rawContract?.value || 0);

          if (from && from !== '0x0000000000000000000000000000000000000000') {
            balances.set(from, (balances.get(from) || BigInt(0)) - value);
          }
          if (to && to !== '0x0000000000000000000000000000000000000000') {
            balances.set(to, (balances.get(to) || BigInt(0)) + value);
          }
        }

        pageKey = data.result.pageKey;
      } while (pageKey);

      // Filter to only positive balances
      const holders = new Map<string, bigint>();
      for (const [address, balance] of balances.entries()) {
        if (balance > BigInt(0)) {
          holders.set(address, balance);
        }
      }

      console.log(`  ✅ Found ${holders.size} LP token holders`);
      return holders;
    } catch (error) {
      console.warn(`  ⚠️ LP holders fetch attempt ${attempt}/${retries} failed:`, error instanceof Error ? error.message : error);
      
      if (attempt === retries) {
        console.error(`  ❌ All ${retries} attempts failed for LP holders`);
        return new Map();
      }
      
      // Exponential backoff
      const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      console.log(`     Retrying in ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  return new Map();
};

// UniswapV3 liquidity math helpers
function getLiquidityAmounts(liquidity: bigint, sqrtPriceX96: bigint, tickLower: number, tickUpper: number): { amount0: bigint; amount1: bigint } {
  const Q96 = BigInt(2) ** BigInt(96);
  const sqrtRatioA = getSqrtRatioAtTick(tickLower);
  const sqrtRatioB = getSqrtRatioAtTick(tickUpper);
  
  // Simplified calculation for in-range positions
  const amount0 = (liquidity * (sqrtRatioB - sqrtPriceX96)) / sqrtPriceX96;
  const amount1 = (liquidity * (sqrtPriceX96 - sqrtRatioA)) / Q96;
  
  return { amount0, amount1 };
}

function getSqrtRatioAtTick(tick: number): bigint {
  const Q96 = BigInt(2) ** BigInt(96);
  return Q96 * BigInt(Math.floor(Math.sqrt(1.0001 ** Number(tick))));
}

// Safe event query helper with chunking and retry logic
async function safeQueryFilter(
  contract: ethers.Contract,
  filter: ethers.DeferredTopicFilter,
  from: number,
  to: number,
  step: number = 5000
): Promise<(ethers.EventLog | ethers.Log)[]> {
  const results: (ethers.EventLog | ethers.Log)[] = [];
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

// Process UniswapV3 pool NFT positions
async function processUniswapV3Pool(
  provider: ethers.JsonRpcProvider,
  pool: string,
  btc1Address: string,
  balances: Map<string, bigint>,
  excluded: Set<string>,
  blockTag: number
): Promise<void> {
  try {
    console.log(`  ✅ UniswapV3 pool detected - processing NFT positions`);
    
    const poolContract = new ethers.Contract(pool, CL_POOL_ABI, provider);
    const [token0, token1, slot0] = await Promise.all([
      poolContract.token0({ blockTag }),
      poolContract.token1({ blockTag }),
      poolContract.slot0({ blockTag })
    ]);
    
    const t0 = token0.toLowerCase();
    const t1 = token1.toLowerCase();
    
    // Check if pool contains BTC1USD
    if (![t0, t1].includes(btc1Address.toLowerCase())) {
      console.log(`   ⊘ Not a BTC1 pool`);
      return;
    }
    
    const isBTC1Token0 = t0 === btc1Address.toLowerCase();
    console.log(`   BTC1 is token${isBTC1Token0 ? '0' : '1'}`);
    console.log(`   Current sqrtPriceX96: ${slot0[0].toString()}`);
    
    // Get Position Manager contract
    const positionManager = new ethers.Contract(
      POSITION_MANAGER,
      POSITION_MANAGER_ABI,
      provider
    );
    
    // Discover all NFT positions through Transfer events
    console.log(`   Querying NFT positions in chunks...`);
    
    const allTokenIds = new Set<string>();
    const START_BLOCK = Math.max(0, blockTag - 500000); // Last ~500k blocks
    
    try {
      const filter = positionManager.filters.Transfer();
      const events = await safeQueryFilter(
        positionManager,
        filter,
        START_BLOCK,
        blockTag
      );
      
      console.log(`   Found ${events.length} Transfer events`);
      
      for (const event of events) {
        if ('args' in event && event.args && event.args.tokenId) {
          allTokenIds.add(event.args.tokenId.toString());
        }
      }
      
      console.log(`   ✅ Discovered ${allTokenIds.size} unique NFT positions`);
    } catch (err) {
      console.log(`   ⚠️ Event scanning failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      console.log(`   Trying fallback: IncreaseLiquidity events...`);
      
      // Fallback: Use IncreaseLiquidity events
      try {
        const liquidityFilter = positionManager.filters.IncreaseLiquidity();
        const liquidityEvents = await safeQueryFilter(
          positionManager,
          liquidityFilter,
          START_BLOCK,
          blockTag
        );
        
        for (const event of liquidityEvents) {
          if ('args' in event && event.args) {
            allTokenIds.add(event.args.tokenId.toString());
          }
        }
        
        console.log(`   Found ${allTokenIds.size} positions via liquidity events`);
      } catch (fallbackErr) {
        console.log(`   ❌ Fallback also failed: ${fallbackErr instanceof Error ? fallbackErr.message : 'Unknown error'}`);
        console.log(`   ⚠️ UniswapV3 position tracking requires RPC with better event query support`);
        return;
      }
    }
    
    if (allTokenIds.size === 0) {
      console.log(`   ⚠️ No NFT positions discovered via events`);
      
      if (MANUALLY_APPROVED_V3_POSITIONS.length > 0) {
        console.log(`   💡 Using ${MANUALLY_APPROVED_V3_POSITIONS.length} manually approved V3 positions...`);
        MANUALLY_APPROVED_V3_POSITIONS.forEach(id => allTokenIds.add(id));
      } else {
        console.log(`   💡 TIP: You can manually add known NFT token IDs to MANUALLY_APPROVED_V3_POSITIONS`);
        return;
      }
    }
    
    let validPositions = 0;
    let totalBTC1Liquidity = BigInt(0);
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
        const position = await positionManager.positions(tokenId, { blockTag });
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
        
        // Verify position is for this pool
        if (posToken0.toLowerCase() !== t0 || posToken1.toLowerCase() !== t1) {
          continue;
        }
        
        // Skip positions with no liquidity
        if (liquidity === BigInt(0)) continue;
        
        // Get current owner of the NFT
        const owner = await positionManager.ownerOf(tokenId, { blockTag });
        const ownerAddr = owner.toLowerCase();
        
        // Skip excluded addresses
        if (excluded.has(ownerAddr)) continue;
        
        // Calculate token amounts from liquidity
        const amounts = getLiquidityAmounts(
          BigInt(liquidity),
          BigInt(slot0[0]),
          Number(tickLower),
          Number(tickUpper)
        );
        
        // Get BTC1 amount based on which token it is
        const btc1Amount = isBTC1Token0 ? amounts.amount0 : amounts.amount1;
        
        if (btc1Amount > BigInt(0)) {
          // Check if owner is a contract we haven't seen
          const isContractCheck = await isContract(provider, ownerAddr, blockTag);
          const alreadyInBalances = balances.has(ownerAddr);
          
          if (isContractCheck && !alreadyInBalances) {
            continue; // Skip new contracts
          }
          
          balances.set(ownerAddr, (balances.get(ownerAddr) || BigInt(0)) + btc1Amount);
          totalBTC1Liquidity += btc1Amount;
          validPositions++;
          
          console.log(`   └─ NFT #${tokenId} owner ${ownerAddr.slice(0,10)}... = ${ethers.formatUnits(btc1Amount, BTC1_DECIMALS)} BTC1 (total: ${ethers.formatUnits(balances.get(ownerAddr)!, BTC1_DECIMALS)})`);
        }
      } catch (err) {
        // Position might not exist at this block
        continue;
      }
    }
    
    console.log(`   ✅ Processed ${validPositions} valid positions with liquidity`);
    console.log(`   💰 Total BTC1 in V3 positions: ${ethers.formatUnits(totalBTC1Liquidity, BTC1_DECIMALS)}\n`);
    
  } catch (err) {
    console.log(`   ❌ Failed to process V3 pool: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

// Process ERC20 LP pools (UniswapV2, Aerodrome)
async function processERC20LP(
  provider: ethers.JsonRpcProvider,
  pool: string,
  btc1Address: string,
  balances: Map<string, bigint>,
  excluded: Set<string>,
  chainId: number,
  blockTag: number
): Promise<void> {
  const poolType = await detectPoolType(provider, pool, blockTag);
  
  if (poolType === POOL_TYPES.UNKNOWN) {
    console.log(`   ⊘ Unknown pool type - skipping`);
    return;
  }
  
  // UniswapV3 uses NFT positions, requires different handling
  if (poolType === POOL_TYPES.UNISWAP_V3) {
    await processUniswapV3Pool(provider, pool, btc1Address, balances, excluded, blockTag);
    return;
  }

  try {
    let p: ethers.Contract;
    let t0: string, t1: string, ts: bigint, reserve: bigint;
    
    if (poolType === POOL_TYPES.UNISWAP_V2) {
      p = new ethers.Contract(pool, UNIV2_PAIR_ABI, provider);
      [t0, t1, ts] = await Promise.all([
        p.token0({ blockTag }),
        p.token1({ blockTag }),
        p.totalSupply({ blockTag })
      ]);
      const r = await p.getReserves({ blockTag });
      
      if (![t0, t1].map(a => a.toLowerCase()).includes(btc1Address.toLowerCase())) {
        console.log(`   ⊘ Not a BTC1 pool`);
        return;
      }
      
      reserve = BigInt(t0.toLowerCase() === btc1Address.toLowerCase() ? r[0] : r[1]);
      console.log(`   ✅ UniswapV2 BTC1 pool detected`);
      
    } else if (poolType === POOL_TYPES.AERODROME) {
      p = new ethers.Contract(pool, AERODROME_POOL_ABI, provider);
      [t0, t1, ts] = await Promise.all([
        p.token0({ blockTag }),
        p.token1({ blockTag }),
        p.totalSupply({ blockTag })
      ]);
      const [r0, r1] = await Promise.all([
        p.reserve0({ blockTag }),
        p.reserve1({ blockTag })
      ]);
      
      if (![t0, t1].map(a => a.toLowerCase()).includes(btc1Address.toLowerCase())) {
        console.log(`   ⊘ Not a BTC1 pool`);
        return;
      }
      
      reserve = BigInt(t0.toLowerCase() === btc1Address.toLowerCase() ? r0 : r1);
      console.log(`   ✅ Aerodrome BTC1 pool detected`);
    } else {
      return;
    }
    
    const info = { reserve, totalSupply: ts };

    console.log(`   BTC1 Reserve: ${ethers.formatUnits(info.reserve, BTC1_DECIMALS)}`);
    console.log(`   Fetching LP holders...`);

    const lpBalances = new Map<string, bigint>();
    const transfers = await alchemyTransfers(pool, chainId, blockTag);
    
    if (transfers.length === 0) {
      console.log(`   ⚠️ No transfers found for this pool`);
      return;
    }
    
    console.log(`   Processing ${transfers.length} transfers...`);
    
    for (const t of transfers) {
      const v = BigInt(t.rawContract?.value || 0);
      if (t.from && t.from !== ZERO_ADDRESS)
        lpBalances.set(t.from.toLowerCase(), (lpBalances.get(t.from.toLowerCase()) || BigInt(0)) - v);
      if (t.to)
        lpBalances.set(t.to.toLowerCase(), (lpBalances.get(t.to.toLowerCase()) || BigInt(0)) + v);
    }

    let validHolders = 0;
    for (const [addr, bal] of lpBalances) {
      if (
        bal <= BigInt(0) ||
        addr === ZERO_ADDRESS ||
        addr === ONE_ADDRESS ||
        addr === pool ||
        excluded.has(addr)
      ) continue;

      // Allow addresses that are already in balances
      const isContractCheck = await isContract(provider, addr, blockTag);
      const alreadyInBalances = balances.has(addr);
      
      if (isContractCheck && !alreadyInBalances) continue;

      const share = (bal * info.reserve) / info.totalSupply;
      if (share > BigInt(0)) {
        balances.set(addr, (balances.get(addr) || BigInt(0)) + share);
        validHolders++;
        console.log(`   └─ LP holder ${addr.slice(0,10)}... = ${ethers.formatUnits(share, BTC1_DECIMALS)} BTC1 (total: ${ethers.formatUnits(balances.get(addr)!, BTC1_DECIMALS)})`);
      }
    }
    
    console.log(`   ✅ Found ${validHolders} valid LP holders\n`);
  } catch (err) {
    console.log(`   ❌ Failed to read pool: ${err instanceof Error ? err.message : 'Unknown error'}`);
    return;
  }
}

// Helper function to get all holders with balances - REWRITTEN to match script logic
// This function now implements the EXACT same logic as generate-merkle-at-block.js
async function getAllHolders(
  btc1usdContract: ethers.Contract, 
  provider: ethers.JsonRpcProvider,
  excludedSet: Set<string>,
  chainId: number,
  blockTag: number
): Promise<Map<string, bigint>> {
  console.log(`\n📊 STEP 1: Fetching all BTC1USD holders (EOAs + Contracts) at block ${blockTag}...`);
  
  const btc1Address = (await btc1usdContract.getAddress()).toLowerCase();
  const allHolders = new Set<string>();
  const transfers = await alchemyTransfers(btc1Address, chainId, blockTag);
  
  for (const t of transfers) {
    if (t.from) allHolders.add(t.from.toLowerCase());
    if (t.to) allHolders.add(t.to.toLowerCase());
  }
  
  console.log(`   Found ${allHolders.size} unique addresses\n`);

  /* ---------- STEP 2: CATEGORIZE HOLDERS ---------- */
  console.log('📊 STEP 2: Categorizing holders (EOAs vs LP Pools)...');
  const eoas: string[] = [];
  const detectedPools: Array<{ address: string; type: string }> = [];
  
  // TEMPORARY OPTIMIZATION: Skip pool detection, treat all as direct holders
  console.log('   ⚡ FAST MODE: Treating all addresses as direct holders (skipping pool detection)');
  for (const addr of allHolders) {
    if (addr === ZERO_ADDRESS || addr === ONE_ADDRESS || excludedSet.has(addr) || EXCLUDED_POOLS.includes(addr)) continue;
    eoas.push(addr);
  }
  
  console.log(`   ✅ Processing ${eoas.length} addresses as direct holders\n`);
  
  /* ORIGINAL POOL DETECTION - Commented out for speed
  for (const addr of allHolders) {
    if (addr === ZERO_ADDRESS || addr === ONE_ADDRESS || excludedSet.has(addr) || EXCLUDED_POOLS.includes(addr)) continue;
    
    // Check if it's a contract first
    if (await isContract(provider, addr, blockTag)) {
      // Check if it's an LP pool
      if (await isLPPool(provider, addr, blockTag)) {
        const poolType = await detectPoolType(provider, addr, blockTag);
        detectedPools.push({ address: addr, type: poolType });
        console.log(`   🏊 LP Pool detected: ${addr} (${poolType})`);
        // IMPORTANT: Also add pools to EOAs list so they get balances in Step 3
        eoas.push(addr);
      } else {
        // Non-pool contracts are treated as EOAs (smart wallets, etc.)
        eoas.push(addr);
      }
    } else {
      eoas.push(addr);
    }
  }
  
  console.log(`   ✅ EOAs (including smart wallets): ${eoas.length}`);
  console.log(`   ✅ LP Pools (treated as direct holders): ${detectedPools.length}\n`);
  */

  /* ---------- STEP 3: PROCESS DIRECT BTC1 BALANCES ---------- */
  console.log('📊 STEP 3: Processing direct BTC1 balances...');
  
  const balances = new Map<string, bigint>();
  
  // OPTIMIZED: Use Multicall3 to batch all balanceOf calls
  // Base Mainnet Multicall3: 0xcA11bde05977b3631167028862bE2a173976CA11
  const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';
  const MULTICALL3_ABI = [
    {
      "inputs": [{"components": [{"internalType": "address", "name": "target", "type": "address"}, {"internalType": "bytes", "name": "callData", "type": "bytes"}], "internalType": "struct Multicall3.Call[]", "name": "calls", "type": "tuple[]"}],
      "name": "aggregate",
      "outputs": [{"internalType": "uint256", "name": "blockNumber", "type": "uint256"}, {"internalType": "bytes[]", "name": "returnData", "type": "bytes[]"}],
      "stateMutability": "payable",
      "type": "function"
    }
  ];
  
  const multicall = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, provider);
  const btc1Interface = new ethers.Interface(['function balanceOf(address) view returns (uint256)']);
  
  // Batch size of 100 to avoid RPC limits
  const BATCH_SIZE = 100;
  console.log(`   📦 Processing ${eoas.length} addresses in batches of ${BATCH_SIZE}...`);
  
  for (let i = 0; i < eoas.length; i += BATCH_SIZE) {
    const batch = eoas.slice(i, Math.min(i + BATCH_SIZE, eoas.length));
    console.log(`   📦 Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(eoas.length / BATCH_SIZE)}: Processing ${batch.length} addresses...`);
    
    // Prepare multicall
    const calls = batch.map(addr => ({
      target: btc1Address,
      callData: btc1Interface.encodeFunctionData('balanceOf', [addr])
    }));
    
    try {
      const [, returnData] = await multicall.aggregate(calls, { blockTag });
      
      // Decode results
      batch.forEach((addr, idx) => {
        try {
          const bal = btc1Interface.decodeFunctionResult('balanceOf', returnData[idx])[0];
          if (bal > BigInt(0)) {
            balances.set(addr, BigInt(bal));
            console.log(`   👤 ${addr} = ${ethers.formatUnits(bal, BTC1_DECIMALS)} BTC1`);
          }
        } catch (decodeError) {
          console.warn(`   ⚠️ Failed to decode balance for ${addr}`);
        }
      });
    } catch (batchError) {
      console.warn(`   ⚠️ Batch failed, falling back to individual calls for this batch:`, batchError instanceof Error ? batchError.message : 'Unknown error');
      // Fallback to individual calls for this batch only
      for (const addr of batch) {
        try {
          const bal = await btc1usdContract.balanceOf(addr, { blockTag });
          if (bal > BigInt(0)) {
            balances.set(addr, BigInt(bal));
            console.log(`   👤 ${addr} = ${ethers.formatUnits(bal, BTC1_DECIMALS)} BTC1`);
          }
        } catch (err) {
          console.warn(`   ⚠️ Failed to get balance for ${addr}`);
        }
      }
    }
  }
  
  console.log(`   ✅ Processed ${eoas.length} addresses (${balances.size} with non-zero balances)\n`);

  /* ---------- STEP 4: PROCESS DETECTED LP POOLS ---------- */
  console.log('📊 STEP 4: Processing detected LP pools...');
  console.log(`   Found ${detectedPools.length} LP pools to expand\n`);
  
  for (const { address: pool, type: poolType } of detectedPools) {
    console.log(`\n🔍 Processing ${poolType} pool: ${pool}`);
    
    // DON'T remove pool's direct balance - keep pools as direct holders
    console.log(`   ℹ️  Pool treated as direct holder (not expanding LP providers)`);
    
    // If pool already has balance from Step 3, keep it
    if (balances.has(pool)) {
      console.log(`   ✅ Pool balance: ${ethers.formatUnits(balances.get(pool)!, BTC1_DECIMALS)} BTC1`);
    }
  }

  console.log(`\n✅ Total unique holders: ${balances.size}`);
  return balances;
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting merkle tree generation process...');
    
    const addresses = getContractAddresses();
    if (!addresses) {
      return NextResponse.json(
        { error: 'Contract addresses not found. Please ensure contracts are deployed.' },
        { status: 500 }
      );
    }

    // Initialize provider with better error handling
    // Determine chain ID early for use throughout the function
    const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "8453");
    console.log(`🌐 Network: ${chainId === 8453 ? 'Base Mainnet (8453)' : 'Base Sepolia (84532)'} - Chain ID: ${chainId}`);
    
    let provider: ethers.JsonRpcProvider;
    try {
      // Use robust provider with fallback mechanism and chain ID
      provider = await createProviderWithFallback(chainId, {
        timeout: 15000, // Increased timeout
        maxRetries: 3,
        retryDelay: 2000, // Increased initial delay
        backoffMultiplier: 2
      });
    } catch (error) {
      console.error('Provider initialization failed:', error);
      return NextResponse.json(
        { 
          error: 'Network connection failed', 
          details: error instanceof Error ? error.message : 'Failed to connect to Base network',
          suggestions: [
            'Check your internet connection',
            'Verify RPC configuration in environment variables',
            'Try again in a few minutes'
          ]
        },
        { status: 503 } // Service unavailable
      );
    }
    
    // Connect to contracts
    const btc1usd = new ethers.Contract(
      addresses.btc1usd,
      BTC1USD_ABI,
      provider
    );

    const weeklyDistribution = new ethers.Contract(
      addresses.weeklyDistribution,
      WEEKLY_DISTRIBUTION_ABI,
      provider
    );

    // Get current distribution info
    let distributionId, rewardPerToken, totalSupply;
    try {
      [distributionId, rewardPerToken, totalSupply] = await weeklyDistribution.getCurrentDistributionInfo();
      console.log(`📊 Weekly distribution info: ID=${distributionId}, rewardPerToken=${rewardPerToken}, totalSupply=${totalSupply}`);
    } catch (error) {
      console.log('ℹ️ No distribution info available, using defaults');
      // Use default values if no distribution exists yet
      distributionId = BigInt(1);
      rewardPerToken = BigInt(1000000); // 0.1 BTC1USD per token (in 8 decimals)
      totalSupply = BigInt(0);
    }

    // Also check current merkle distributor state
    const merkleDistributor = new ethers.Contract(
      addresses.merkleDistributor,
      [
        {
          "inputs": [],
          "name": "currentDistributionId",
          "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "merkleRoot",
          "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
          "stateMutability": "view",
          "type": "function"
        }
      ],
      provider
    );
    
    try {
      const currentMerkleId = await merkleDistributor.currentDistributionId();
      const currentMerkleRoot = await merkleDistributor.merkleRoot();
      console.log(`📦 Merkle distributor state: ID=${currentMerkleId}, root=${currentMerkleRoot}`);
      
      // Use the merkle distributor's distribution ID if it exists
      if (currentMerkleId > BigInt(0)) {
        distributionId = currentMerkleId;
      }
    } catch (error) {
      console.log('ℹ️ Could not get merkle distributor state:', error instanceof Error ? error.message : 'Unknown error');
    }

    // Get excluded addresses (protocol wallets) from WeeklyDistribution contract
    let excludedAddresses: string[] = [];
    try {
      excludedAddresses = await weeklyDistribution.getExcludedAddresses();
      console.log(`🚫 Excluded addresses (protocol wallets): ${excludedAddresses.length}`);
      excludedAddresses.forEach(addr => console.log(`   ⊘ ${addr}`));
    } catch (error) {
      console.warn('⚠️ Could not get excluded addresses:', error instanceof Error ? error.message : 'Unknown error');
      // If we can't get excluded addresses, default to excluding known protocol wallets
      excludedAddresses = [
        addresses.merkleDistributor,
        process.env.NEXT_PUBLIC_DEV_WALLET_CONTRACT || '',
        process.env.NEXT_PUBLIC_ENDOWMENT_WALLET_CONTRACT || ''
      ].filter(Boolean);
      console.log(`   Using default exclusions: ${excludedAddresses.join(', ')}`);
    }

    // Create a Set for faster lookups (case-insensitive)
    const excludedSet = new Set(excludedAddresses.map(addr => addr.toLowerCase()));

    // Get the target block for snapshot - use the last distribution execution block
    let targetBlock: number;
    
    // TEMPORARY: Use hardcoded block for testing
    const HARDCODED_BLOCK = 40596432;
    console.log(`\n📅 Using hardcoded block number: ${HARDCODED_BLOCK}`);
    targetBlock = HARDCODED_BLOCK;
    
    /* ORIGINAL LOGIC - Commented out for now
    try {
      console.log('\n📅 Determining snapshot block...');
      
      // Try to get lastDistributionBlock from contract
      try {
        const lastDistBlock = await weeklyDistribution.lastDistributionBlock();
        if (lastDistBlock && Number(lastDistBlock) > 0) {
          targetBlock = Number(lastDistBlock);
          console.log(`   ✅ Using lastDistributionBlock from contract: ${targetBlock}`);
        } else {
          throw new Error('lastDistributionBlock is 0 or not set');
        }
      } catch (contractError) {
        console.log('   ⚠️ lastDistributionBlock not available, using lastDistributionTime to find exact block...');
        
        // Fallback: Use lastDistributionTime to find the exact block with that timestamp
        try {
          const lastDistTime = await weeklyDistribution.lastDistributionTime();
          
          console.log(`   📅 Last distribution timestamp: ${lastDistTime} (${new Date(Number(lastDistTime) * 1000).toISOString()})`);
          
          // Try BaseScan API first to get exact block by timestamp (fastest method)
          const baseScanApiKey = process.env.BASESCAN_API_KEY;
          if (baseScanApiKey) {
            try {
              const apiBaseUrl = chainId === 8453 
                ? 'https://api.basescan.org/api' 
                : 'https://api-sepolia.basescan.org/api';
              
              const url = `${apiBaseUrl}?module=block&action=getblocknobytime&timestamp=${lastDistTime}&closest=before&apikey=${baseScanApiKey}`;
              
              console.log(`   🔍 Querying BaseScan for exact block at timestamp ${lastDistTime}...`);
              const response = await fetch(url);
              const data = await response.json();
              
              if (data.status === '1' && data.result) {
                targetBlock = Number(data.result);
                console.log(`   ✅ BaseScan found exact block: ${targetBlock}`);
                
                // Verify the block timestamp
                const block = await provider.getBlock(targetBlock);
                if (block) {
                  console.log(`   ✅ Verified block ${targetBlock} timestamp: ${block.timestamp} (${new Date(block.timestamp * 1000).toISOString()})`);
                } else {
                  throw new Error('Could not verify block');
                }
              } else {
                throw new Error(`BaseScan API error: ${data.message || 'Unknown error'}`);
              }
            } catch (baseScanError) {
              console.log(`   ⚠️ BaseScan API failed: ${baseScanError instanceof Error ? baseScanError.message : 'Unknown error'}`);
              console.log(`   🔄 Falling back to binary search...`);
              
              // Fallback to binary search if BaseScan fails
              const currentBlock = await provider.getBlockNumber();
              const currentTime = Math.floor(Date.now() / 1000);
              const timeElapsed = currentTime - Number(lastDistTime);
              const BASE_BLOCK_TIME = 2;
              const blocksElapsed = Math.floor(timeElapsed / BASE_BLOCK_TIME);
              const approximateBlock = currentBlock - blocksElapsed;
              
              console.log(`   ⏱️  Time elapsed: ${timeElapsed}s (~${blocksElapsed} blocks)`);
              console.log(`   📍 Approximate distribution block: ${approximateBlock}`);
              console.log(`   🔍 Binary searching for exact block with timestamp ${lastDistTime}...`);
              
              // Binary search to find the exact block with this timestamp
              let left = Math.max(0, approximateBlock - 5000);
              let right = Math.min(currentBlock, approximateBlock + 5000);
              let exactBlock = approximateBlock;
              
              while (left <= right) {
                const mid = Math.floor((left + right) / 2);
                const block = await provider.getBlock(mid);
                
                if (!block) break;
                
                const blockTime = block.timestamp;
                
                if (blockTime === Number(lastDistTime)) {
                  exactBlock = mid;
                  console.log(`   ✅ Found EXACT block ${exactBlock} with timestamp ${blockTime}`);
                  break;
                } else if (blockTime < Number(lastDistTime)) {
                  left = mid + 1;
                  exactBlock = mid;
                } else {
                  right = mid - 1;
                }
              }
              
              targetBlock = exactBlock;
              console.log(`   📸 Using block ${targetBlock} for snapshot`);
            }
          } else {
            console.log(`   ⚠️ BaseScan API key not found, using binary search...`);
            
            // No BaseScan key, use binary search
            const currentBlock = await provider.getBlockNumber();
            const currentTime = Math.floor(Date.now() / 1000);
            const timeElapsed = currentTime - Number(lastDistTime);
            const BASE_BLOCK_TIME = 2;
            const blocksElapsed = Math.floor(timeElapsed / BASE_BLOCK_TIME);
            const approximateBlock = currentBlock - blocksElapsed;
            
            console.log(`   ⏱️  Time elapsed: ${timeElapsed}s (~${blocksElapsed} blocks)`);
            console.log(`   📍 Approximate distribution block: ${approximateBlock}`);
            console.log(`   🔍 Binary searching for exact block with timestamp ${lastDistTime}...`);
            
            let left = Math.max(0, approximateBlock - 5000);
            let right = Math.min(currentBlock, approximateBlock + 5000);
            let exactBlock = approximateBlock;
            
            while (left <= right) {
              const mid = Math.floor((left + right) / 2);
              const block = await provider.getBlock(mid);
              
              if (!block) break;
              
              const blockTime = block.timestamp;
              
              if (blockTime === Number(lastDistTime)) {
                exactBlock = mid;
                console.log(`   ✅ Found EXACT block ${exactBlock} with timestamp ${blockTime}`);
                break;
              } else if (blockTime < Number(lastDistTime)) {
                left = mid + 1;
                exactBlock = mid;
              } else {
                right = mid - 1;
              }
            }
            
            targetBlock = exactBlock;
            console.log(`   📸 Using block ${targetBlock} for snapshot`);
          }
          
        } catch (timeError) {
          console.log(`   ⚠️ Could not use lastDistributionTime: ${timeError instanceof Error ? timeError.message : 'Unknown error'}`);
          console.log('   Using current block as fallback...');
          targetBlock = await provider.getBlockNumber();
          console.log(`   📆 Using current block: ${targetBlock}`);
        }
      }
    } catch (error) {
      console.warn('   ❌ Block determination failed, using current block');
      targetBlock = await provider.getBlockNumber();
      console.log(`   📆 Fallback to current block: ${targetBlock}`);
    }
    */
    
    console.log(`\n📸 Snapshot will be taken at block ${targetBlock}\n`);

    // Get all token holders with their balances (returns Map<address, balance>)
    // This now follows the EXACT same logic as generate-merkle-at-block.js
    const balances = await getAllHolders(btc1usd, provider, excludedSet, chainId, targetBlock);

    if (balances.size === 0) {
      // Provide more helpful error message
      return NextResponse.json(
        {
          error: 'No token holders found with positive balances.',
          suggestions: [
            'Ensure there are accounts with BTC1USD tokens',
            'Mint or transfer BTC1USD tokens to test accounts',
            'Verify that the contract addresses are correct in deployment configuration'
          ]
        },
        { status: 400 }
      );
    }

    // Filter out excluded addresses (protocol wallets) - already done in getAllHolders but double-check
    const holders: Array<{ address: string; balance: bigint }> = [];
    for (const [address, balance] of balances.entries()) {
      if (!excludedSet.has(address.toLowerCase()) && balance > BigInt(0)) {
        holders.push({ address, balance });
      } else if (excludedSet.has(address.toLowerCase())) {
        console.log(`⊘ Excluding protocol wallet: ${address} (balance: ${ethers.formatUnits(balance, 8)} BTC1USD)`);
      }
    }

    console.log(`👥 Found ${balances.size} total holders, ${holders.length} eligible after excluding protocol wallets`);

    if (holders.length === 0) {
      return NextResponse.json(
        {
          error: 'No eligible holders found after excluding protocol wallets.',
          suggestions: [
            'All current token holders are protocol wallets',
            'Mint or transfer tokens to EOA addresses to create eligible holders'
          ]
        },
        { status: 400 }
      );
    }

    // Calculate rewards for each eligible holder using the rewardPerToken from the contract
    // rewardPerToken is in 8 decimals (e.g., 0.01e8 = 1000000 = 1¢ per token)
    const claims: MerkleClaim[] = [];
    let totalRewards = BigInt(0);

    holders.forEach((holder, index) => {
      // Calculate reward: (balance * rewardPerToken) / 1e8
      // Both balance and rewardPerToken are in 8 decimals
      const rewardAmount = (holder.balance * rewardPerToken) / BigInt(1e8);

      if (rewardAmount > BigInt(0)) {
        claims.push({
          index,
          account: holder.address,
          amount: rewardAmount.toString(),
          proof: [] // Will be filled after merkle tree generation
        });

        totalRewards += rewardAmount;
        console.log(`💰 Reward for ${holder.address}: ${ethers.formatUnits(rewardAmount, 8)} BTC1USD (balance: ${ethers.formatUnits(holder.balance, 8)}, rate: ${ethers.formatUnits(rewardPerToken, 8)})`);
      }
    });

    if (claims.length === 0) {
      return NextResponse.json(
        { error: 'No eligible claims found.' },
        { status: 400 }
      );
    }

    console.log(`📈 Generated ${claims.length} claims with total rewards: ${ethers.formatUnits(totalRewards, 8)} BTC1USD`);

    // Generate merkle tree
    const elements = claims.map((claim) => {
      const packed = ethers.solidityPackedKeccak256(
        ["uint256", "address", "uint256"],
        [claim.index, claim.account, claim.amount]
      );
      return packed;
    });

    const merkleTree = new MerkleTree(elements, keccak256, { sortPairs: true });
    const merkleRoot = merkleTree.getHexRoot();

    // Generate proofs for each claim
    claims.forEach((claim, index) => {
      const proof = merkleTree.getHexProof(elements[index]);
      claim.proof = proof;
    });

    // Create distribution data
    const distributionData: DistributionData = {
      distributionId: distributionId.toString(),
      merkleRoot,
      totalRewards: totalRewards.toString(),
      claims: claims.reduce((acc, claim) => {
        acc[claim.account] = claim;
        return acc;
      }, {} as { [address: string]: MerkleClaim }),
      metadata: {
        generated: new Date().toISOString(),
        activeHolders: claims.length,
        totalHolders: balances.size,
        excludedAddresses: excludedAddresses,
        excludedCount: excludedAddresses.length,
        blockNumber: targetBlock,
        note: 'Protocol wallets are excluded. Pools are treated as direct holders (not expanded to LP providers). Distribution snapshot taken at block ' + targetBlock + '.'
      } as any
    };

    // Save to Supabase as PRIMARY storage for both local and Netlify
    const supabaseTableName = getSupabaseTableName(chainId);
    console.log('💾 Using Supabase table:', supabaseTableName, '(chainId:', chainId, ')');
    console.log('💾 Supabase configured?', isSupabaseConfigured());
    console.log('💾 Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    let supabaseSuccess = false;
    if (isSupabaseConfigured() && supabase) {
      try {
        console.log('📤 Saving distribution to Supabase (PRIMARY STORAGE)...');
        // Prepare data according to Supabase schema
        const supabaseData: Record<string, any> = {
          id: Number(distributionId),
          merkle_root: merkleRoot,
          total_rewards: totalRewards.toString(),
          claims: distributionData.claims,
          metadata: distributionData.metadata
        };
        
        // Use a more generic approach to avoid typing issues
        const sb: any = supabase;
        const result = await sb
          .from(supabaseTableName)  // Use the correct table based on network
          .upsert(supabaseData, {
            onConflict: 'id'
          });

        if (result.error) {
          console.error('❌ Supabase save failed:', {
            message: result.error.message || 'Unknown error',
            details: result.error.details || 'No details',
            hint: result.error.hint || 'No hint',
            code: result.error.code || 'No code'
          });
        } else {
          console.log('✅ Distribution saved to Supabase successfully (PRIMARY STORAGE)');
          supabaseSuccess = true;
        }
      } catch (err) {
        console.error('❌ Supabase connection error:', {
          message: err instanceof Error ? err.message : 'Unknown error',
          details: err instanceof Error ? err.stack?.split('\n').slice(0, 3).join('\n') : '',
          hint: 'Check network connectivity and Supabase configuration'
        });
      }
    } else {
      console.log('ℹ️  Supabase not configured');
    }

    // Check if save was successful
    if (!supabaseSuccess) {
      return NextResponse.json(
        { 
          error: 'Failed to save distribution to Supabase',
          details: 'Distribution generated successfully but could not be saved to database',
          suggestions: [
            'Verify NEXT_PUBLIC_SUPABASE_URL is set correctly',
            'Verify NEXT_PUBLIC_SUPABASE_ANON_KEY is set correctly',
            'Check Supabase service status at https://status.supabase.com',
            `Verify ${supabaseTableName} table exists in your Supabase project`,
            'Check Supabase project logs for more details'
          ]
        },
        { status: 500 }
      );
    }

    console.log('🎉 Merkle tree generation completed successfully');
    return NextResponse.json({
      success: true,
      merkleRoot,
      totalRewards: totalRewards.toString(),
      activeHolders: claims.length,
      distributionId: distributionId.toString(),
      claims: claims.length,
      // Include full distribution data for client-side use
      distributionData
    });

  } catch (error) {
    console.error('💥 Error generating merkle tree:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate merkle tree', 
        details: error instanceof Error ? error.message : 'Unknown error',
        suggestions: [
          'Check your network connection',
          'Verify RPC configuration',
          'Ensure contracts are deployed correctly',
          'Try again in a few minutes'
        ]
      },
      { status: 500 }
    );
  }
}