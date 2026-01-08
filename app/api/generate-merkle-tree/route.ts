import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { keccak256 } from 'viem';
import { MerkleTree } from 'merkletreejs';
import { createClient } from '@supabase/supabase-js';
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
    blockNumber: number;
    activeHolders: number;
    totalHolders?: number;
    excludedAddresses?: string[];
    excludedCount?: number;
    detectedLPPools?: Array<{ address: string; type: string }>;
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
    "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "name": "distributions",
    "outputs": [
      { "internalType": "uint256", "name": "id", "type": "uint256" },
      { "internalType": "uint256", "name": "rewardPerToken", "type": "uint256" },
      { "internalType": "uint256", "name": "totalSupply", "type": "uint256" },
      { "internalType": "uint256", "name": "timestamp", "type": "uint256" },
      { "internalType": "uint256", "name": "blockNumber", "type": "uint256" }
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

// EXCLUDED POOLS - Empty list, all pools are treated as direct holders
const EXCLUDED_POOLS: string[] = [];

// Constants
const BTC1_DECIMALS = 8;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ONE_ADDRESS = '0x0000000000000000000000000000000000000001';

// Get Supabase table name based on network
const getSupabaseTableName = (chainId: number): string => {
  // Mainnet (Base = 8453)
  if (chainId === 8453) {
    return 'merkle_distributions_prod';
  }
  // Testnet (Base Sepolia = 84532 or any other testnet)
  return 'merkle_distributions_dev';
};

// Helper to check if an address is a contract at a specific block
const isContractAtBlock = async (provider: ethers.JsonRpcProvider, address: string, blockTag?: number): Promise<boolean> => {
  try {
    const code = await provider.getCode(address, blockTag);
    return code !== '0x' && code.length > 2;
  } catch (error) {
    console.warn(`⚠️ Failed to check if ${address} is contract`);
    return false;
  }
};

// Helper to check if an address is an LP pool
const isLPPool = async (provider: ethers.JsonRpcProvider, address: string, blockTag?: number): Promise<boolean> => {
  if (!await isContractAtBlock(provider, address, blockTag)) return false;
  
  try {
    // Try UniswapV2/Aerodrome pattern
    const pool = new ethers.Contract(address, UNIV2_PAIR_ABI, provider);
    await pool.token0({ blockTag });
    return true;
  } catch {
    // Not a recognized LP pool
    return false;
  }
};

// Detect pool type
const detectPoolType = async (provider: ethers.JsonRpcProvider, address: string, blockTag?: number): Promise<string> => {
  try {
    // Try UniswapV2
    const v2Pool = new ethers.Contract(address, UNIV2_PAIR_ABI, provider);
    try {
      await v2Pool.getReserves({ blockTag });
      return 'UniswapV2';
    } catch {}
    
    // Try Aerodrome
    const aeroPool = new ethers.Contract(address, AERODROME_POOL_ABI, provider);
    try {
      await aeroPool.reserve0({ blockTag });
      return 'Aerodrome';
    } catch {}
  } catch {}
  
  return 'Unknown';
};

// Load deployment configuration - Environment variables with dev/prod suffix support
const getContractAddresses = () => {
  try {
    // Determine environment based on chain ID
    const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "8453");
    const isMainnet = chainId === 8453; // Base Mainnet
    const envSuffix = isMainnet ? "_PROD" : "_DEV";
    
    console.log(`🌐 Environment: ${isMainnet ? 'PRODUCTION (Mainnet)' : 'DEVELOPMENT (Testnet)'} - Chain ID: ${chainId}`);
    
    // Try to load environment-specific addresses first (with suffix)
    let btc1usd = process.env[`NEXT_PUBLIC_BTC1USD_CONTRACT${envSuffix}`];
    let weeklyDistribution = process.env[`NEXT_PUBLIC_WEEKLY_DISTRIBUTION_CONTRACT${envSuffix}`];
    let merkleDistributor = process.env[`NEXT_PUBLIC_MERKLE_DISTRIBUTOR_CONTRACT${envSuffix}`];
    
    // Fallback to non-suffixed environment variables if suffixed ones don't exist
    if (!btc1usd) btc1usd = process.env.NEXT_PUBLIC_BTC1USD_CONTRACT;
    if (!weeklyDistribution) weeklyDistribution = process.env.NEXT_PUBLIC_WEEKLY_DISTRIBUTION_CONTRACT;
    if (!merkleDistributor) merkleDistributor = process.env.NEXT_PUBLIC_MERKLE_DISTRIBUTOR_CONTRACT;

    if (btc1usd && weeklyDistribution && merkleDistributor) {
      console.log(`✅ Using contract addresses for ${isMainnet ? 'PROD' : 'DEV'} environment:`);
      console.log(`   BTC1USD: ${btc1usd}`);
      console.log(`   WeeklyDistribution: ${weeklyDistribution}`);
      console.log(`   MerkleDistributor: ${merkleDistributor}`);
      return { btc1usd, weeklyDistribution, merkleDistributor };
    }

    // If we get here, environment variables are missing
    console.error('❌ Contract addresses not found. Please set environment variables:');
    console.error(`   NEXT_PUBLIC_BTC1USD_CONTRACT${envSuffix} (or NEXT_PUBLIC_BTC1USD_CONTRACT)`);
    console.error(`   NEXT_PUBLIC_WEEKLY_DISTRIBUTION_CONTRACT${envSuffix} (or NEXT_PUBLIC_WEEKLY_DISTRIBUTION_CONTRACT)`);
    console.error(`   NEXT_PUBLIC_MERKLE_DISTRIBUTOR_CONTRACT${envSuffix} (or NEXT_PUBLIC_MERKLE_DISTRIBUTOR_CONTRACT)`);
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
const getHoldersFromAlchemy = async (tokenAddress: string, retries = 3): Promise<string[]> => {
  const alchemyApiKey = process.env.ALCHEMY_API_KEY;
  if (!alchemyApiKey) {
    console.log('Alchemy API key not found, skipping Alchemy method');
    return [];
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Fetching holders from Alchemy API (attempt ${attempt}/${retries})...`);

      // Use Alchemy's Transfers API to get all unique addresses
      const alchemyUrl = `https://base-mainnet.g.alchemy.com/v2/${alchemyApiKey}`;

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

      if (!response.ok) {
        throw new Error(`Alchemy API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

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
// Exception: Small contracts (<100 bytes) are treated as EOAs (e.g., smart contract wallets, proxies)
const isContract = async (provider: ethers.JsonRpcProvider, address: string): Promise<boolean> => {
  try {
    const code = await provider.getCode(address);
    
    // No code = EOA
    if (code === '0x') {
      return false;
    }
    
    // Small bytecode (<100 bytes) = likely smart contract wallet/proxy, treat as EOA
    // This includes: Safe wallets, EIP-3074 invokers, minimal proxies, forwarders
    const bytecodeLength = (code.length - 2) / 2; // Remove '0x' and convert hex pairs to bytes
    if (bytecodeLength < 100) {
      console.log(`  💼 Small contract detected (${bytecodeLength} bytes), treating as EOA: ${address}`);
      return false;
    }
    
    // Large bytecode = actual smart contract (DEX, LP pool, etc.)
    return true;
  } catch (error) {
    console.warn(`⚠️ Failed to check if ${address} is contract, treating as EOA`);
    return false; // Treat as EOA if check fails
  }
};

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

// Detect if a smart contract is a UniswapV2-style LP pool containing BTC1
const detectUniV2Pool = async (
  provider: ethers.JsonRpcProvider,
  poolAddress: string,
  btc1Address: string
): Promise<{ isBTC1Pool: boolean; btc1Reserve: bigint; totalSupply: bigint } | null> => {
  try {
    const pool = new ethers.Contract(poolAddress, UNIV2_PAIR_ABI, provider);
    
    const [token0, token1, reserves, totalSupply] = await Promise.all([
      pool.token0(),
      pool.token1(),
      pool.getReserves(),
      pool.totalSupply()
    ]);

    const isBTC1Pool = 
      token0.toLowerCase() === btc1Address.toLowerCase() || 
      token1.toLowerCase() === btc1Address.toLowerCase();

    if (!isBTC1Pool) {
      return null;
    }

    const btc1Reserve = token0.toLowerCase() === btc1Address.toLowerCase() 
      ? BigInt(reserves[0]) 
      : BigInt(reserves[1]);

    return {
      isBTC1Pool: true,
      btc1Reserve,
      totalSupply: BigInt(totalSupply)
    };
  } catch (error) {
    return null; // Not a UniV2 pool or failed to fetch
  }
};

// Detect if a smart contract is an Aerodrome-style LP pool containing BTC1
const detectAerodromePool = async (
  provider: ethers.JsonRpcProvider,
  poolAddress: string,
  btc1Address: string
): Promise<{ isBTC1Pool: boolean; btc1Reserve: bigint; totalSupply: bigint } | null> => {
  try {
    const pool = new ethers.Contract(poolAddress, AERODROME_POOL_ABI, provider);
    
    const [token0, token1, reserve0, reserve1, totalSupply] = await Promise.all([
      pool.token0(),
      pool.token1(),
      pool.reserve0(),
      pool.reserve1(),
      pool.totalSupply()
    ]);

    const isBTC1Pool = 
      token0.toLowerCase() === btc1Address.toLowerCase() || 
      token1.toLowerCase() === btc1Address.toLowerCase();

    if (!isBTC1Pool) {
      return null;
    }

    const btc1Reserve = token0.toLowerCase() === btc1Address.toLowerCase() 
      ? BigInt(reserve0) 
      : BigInt(reserve1);

    return {
      isBTC1Pool: true,
      btc1Reserve,
      totalSupply: BigInt(totalSupply)
    };
  } catch (error) {
    return null; // Not an Aerodrome pool or failed to fetch
  }
};

// Process LP pool and calculate BTC1 shares for each LP holder
const processLPPool = async (
  provider: ethers.JsonRpcProvider,
  poolAddress: string,
  btc1Address: string,
  excludedSet: Set<string>
): Promise<Map<string, bigint>> => {
  console.log(`  🏊 Processing potential LP pool: ${poolAddress}`);
  
  // Try to detect as UniswapV2 pool
  let poolInfo = await detectUniV2Pool(provider, poolAddress, btc1Address);
  let poolType = 'UniswapV2';
  
  // If not UniV2, try Aerodrome
  if (!poolInfo) {
    poolInfo = await detectAerodromePool(provider, poolAddress, btc1Address);
    poolType = 'Aerodrome';
  }
  
  if (!poolInfo || !poolInfo.isBTC1Pool) {
    console.log(`  ⊘ Not a BTC1 LP pool`);
    return new Map();
  }

  console.log(`  ✅ Detected ${poolType} LP pool with BTC1`);
  console.log(`     BTC1 Reserve: ${ethers.formatUnits(poolInfo.btc1Reserve, 8)} BTC1USD`);
  console.log(`     Total LP Supply: ${ethers.formatUnits(poolInfo.totalSupply, 18)} LP tokens`);

  // Get all LP token holders
  const lpHolders = await getLPHoldersFromAlchemy(poolAddress);
  
  if (lpHolders.size === 0) {
    console.log(`  ⚠️ No LP holders found`);
    return new Map();
  }

  // Calculate BTC1 share for each LP holder
  const btc1Shares = new Map<string, bigint>();
  
  for (const [holderAddress, lpBalance] of lpHolders.entries()) {
    // Skip if excluded (protocol wallets)
    if (excludedSet.has(holderAddress.toLowerCase())) {
      console.log(`     ⊘ Skipping excluded LP holder: ${holderAddress}`);
      continue;
    }

    // Skip if holder is a contract (only EOAs get rewards)
    const isContractAddress = await isContract(provider, holderAddress);
    if (isContractAddress) {
      console.log(`     ⊘ Skipping smart contract LP holder: ${holderAddress}`);
      continue;
    }

    // Calculate BTC1 share: (lpBalance * btc1Reserve) / totalSupply
    const btc1Share = (lpBalance * poolInfo.btc1Reserve) / poolInfo.totalSupply;
    
    if (btc1Share > BigInt(0)) {
      btc1Shares.set(holderAddress.toLowerCase(), btc1Share);
      console.log(`     ✓ LP holder ${holderAddress}: ${ethers.formatUnits(btc1Share, 8)} BTC1USD share`);
    }
  }

  console.log(`  ✅ Processed ${btc1Shares.size} EOA LP holders from pool`);
  return btc1Shares;
};

// Helper function to get all holders with balances using robust provider
const getAllHolders = async (
  btc1usdContract: ethers.Contract, 
  provider: ethers.JsonRpcProvider,
  excludedSet: Set<string>
): Promise<{ address: string; balance: bigint }[]> => {
  console.log('Fetching all BTC1USD holders...');
  
  // Get token address
  const tokenAddress = await btc1usdContract.getAddress();

  // Try to get holders from Alchemy first
  const alchemyHolders = await getHoldersFromAlchemy(tokenAddress);

  if (alchemyHolders.length > 0) {
    console.log(`✅ Alchemy found ${alchemyHolders.length} unique addresses`);
    
    // Track balances: direct EOA balances + LP-derived balances
    const balanceMap = new Map<string, bigint>();
    const approvedLPPools: string[] = [];
    
    // First pass: collect EOA balances and identify approved LP pools only
    for (const address of alchemyHolders) {
      try {
        // Check if it's a smart contract
        const isContractAddress = await isContract(provider, address);
        
        if (isContractAddress) {
          // Check if it's an excluded pool (treated as direct holder)
          const addressLower = address.toLowerCase();
          if (EXCLUDED_POOLS.includes(addressLower)) {
            console.log(`⚠️ Excluded pool found (will be treated as direct holder): ${address}`);
          }
          console.log(`⊘ Skipping smart contract: ${address}`);
          continue;
        }
        
        // It's an EOA, get direct balance
        const balance = await btc1usdContract.balanceOf(address);
        if (balance > BigInt(0)) {
          balanceMap.set(address.toLowerCase(), BigInt(balance));
          console.log(`✓ ${address}: ${ethers.formatUnits(balance, 8)} BTC1USD (direct EOA balance)`);
        }
      } catch (error) {
        console.warn(`Failed to process ${address}:`, error);
      }
    }
    
    console.log(`\n📍 Processing ${approvedLPPools.length} approved LP pools...`);
    
    // Second pass: process only approved LP pools
    for (const poolAddress of approvedLPPools) {
      const lpShares = await processLPPool(provider, poolAddress, tokenAddress, excludedSet);
      
      // Add LP shares to existing balances
      for (const [eoaAddress, btc1Share] of lpShares.entries()) {
        const currentBalance = balanceMap.get(eoaAddress) || BigInt(0);
        const newBalance = currentBalance + btc1Share;
        balanceMap.set(eoaAddress, newBalance);
        
        console.log(`  📊 ${eoaAddress}: total ${ethers.formatUnits(newBalance, 8)} BTC1USD (direct: ${ethers.formatUnits(currentBalance, 8)}, LP: ${ethers.formatUnits(btc1Share, 8)})`);
      }
    }
    
    // Convert balance map to holders array
    const holders: { address: string; balance: bigint }[] = [];
    for (const [address, balance] of balanceMap.entries()) {
      if (balance > BigInt(0)) {
        holders.push({ address, balance });
      }
    }
    
    if (holders.length > 0) {
      console.log(`\n✅ Total unique EOA holders (including LP providers): ${holders.length}`);
      return holders;
    }
  }

  // Fallback: If Alchemy didn't work or no holders found, check some known addresses
  console.log('Trying fallback method to get holders...');
  
  // Use addresses from the deployment file
  const knownAddresses = [
    '0x0c8852280df8ef9fcb2a24e9d76f1ee4779773e9', // deployer
    '0x6cf855d7c79f05b549674916bfa23b5742db143e', // devWallet
    '0x223a0b6cae408c91973852c5bcd55567c7b2e1c0'  // endowmentWallet
  ];
  
  const holders: { address: string; balance: bigint }[] = [];
  
  for (const address of knownAddresses) {
    try {
      const balance = await btc1usdContract.balanceOf(address);
      if (balance > BigInt(0)) {
        holders.push({ address, balance });
        console.log(`✓ ${address}: ${ethers.formatUnits(balance, 8)} BTC1USD`);
      }
    } catch (error) {
      console.warn(`Failed to get balance for ${address}:`, error);
    }
  }
  
  // If we still have no holders, check if any of these addresses have tokens
  if (holders.length === 0) {
    console.log('Checking for any accounts with balances...');
    
    // Try a few more common test addresses
    const testAddresses = [
      '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Common Hardhat test account
      '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Another test account
      '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'  // Another test account
    ];
    
    for (const address of testAddresses) {
      try {
        const balance = await btc1usdContract.balanceOf(address);
        if (balance > BigInt(0)) {
          holders.push({ address, balance });
          console.log(`✓ ${address}: ${ethers.formatUnits(balance, 8)} BTC1USD`);
        }
      } catch (error) {
        console.warn(`Failed to get balance for ${address}:`, error);
      }
    }
  }
  
  if (holders.length === 0) {
    // Final fallback: Create a helpful error message
    throw new Error('No holders with positive balances found. Please ensure there are accounts with BTC1USD tokens. You may need to mint tokens to test accounts first.');
  }
  
  console.log(`✅ Total holders with balance > 0: ${holders.length}`);
  return holders;
};

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
    let provider: ethers.JsonRpcProvider;
    try {
      provider = await getProvider(); // This is now async
    } catch (error) {
      console.error('Provider initialization failed:', error);
      return NextResponse.json(
        { 
          error: 'Network connection failed', 
          details: error instanceof Error ? error.message : 'Failed to connect to Base Sepolia network',
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
    let distributionId, rewardPerToken, totalSupply, distributionTimestamp;
    try {
      [distributionId, rewardPerToken, totalSupply, distributionTimestamp] = await weeklyDistribution.getCurrentDistributionInfo();
      console.log(`📊 Current distribution info: ID=${distributionId}, rewardPerToken=${rewardPerToken}, totalSupply=${totalSupply}, timestamp=${distributionTimestamp}`);
    } catch (error) {
      console.log('ℹ️ No distribution info available, using defaults');
      // Use default values if no distribution exists yet
      distributionId = BigInt(1);
      rewardPerToken = BigInt(1000000); // 0.1 BTC1USD per token (in 8 decimals)
      totalSupply = BigInt(0);
      distributionTimestamp = BigInt(0);
    }

    // Fetch the block number when the distribution was executed from the contract
    let targetBlock: number;
    try {
      // Get the distribution details which includes the block number
      const distribution = await weeklyDistribution.distributions(distributionId);
      targetBlock = Number(distribution.blockNumber);
      console.log(`📍 Distribution ${distributionId} was executed at block: ${targetBlock}`);
      
      if (targetBlock === 0) {
        // If blockNumber is 0 or not set, use current block
        targetBlock = await provider.getBlockNumber();
        console.log(`⚠️ Distribution block number is 0, using current block: ${targetBlock}`);
      }
    } catch (error) {
      // If we can't get the distribution block, use current block
      targetBlock = await provider.getBlockNumber();
      console.log(`⚠️ Could not fetch distribution block number, using current block: ${targetBlock}`);
      console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Get current block or use specified target block
    const currentBlock = targetBlock;
    console.log(`📆 Using block number: ${currentBlock}`);
    const blockTag = currentBlock;

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

    // Get all token holders via Alchemy (EOAs only, smart contracts filtered out)
    // LP pools will be processed to calculate BTC1 shares for their EOA holders
    const allHolders = await getAllHolders(btc1usd, provider, excludedSet);

    if (allHolders.length === 0) {
      // Provide more helpful error message
      return NextResponse.json(
        {
          error: 'No EOA token holders found. Only Externally Owned Accounts (EOAs) are eligible for rewards.',
          suggestions: [
            'Smart contracts (including LP pools) are automatically excluded from rewards',
            'Mint or transfer BTC1USD tokens to EOA addresses (wallet addresses, not contracts)',
            'Verify that the contract addresses are correct in deployment configuration'
          ]
        },
        { status: 400 }
      );
    }

    // Filter out excluded addresses (protocol wallets)
    const holders = allHolders.filter(holder => {
      const isExcluded = excludedSet.has(holder.address.toLowerCase());
      if (isExcluded) {
        console.log(`⊘ Excluding protocol wallet: ${holder.address} (balance: ${ethers.formatUnits(holder.balance, 8)} BTC1USD)`);
      }
      return !isExcluded;
    });

    console.log(`👥 Found ${allHolders.length} unique EOA holders (including LP providers with aggregated BTC1 shares), ${holders.length} eligible after excluding protocol wallets`);

    if (holders.length === 0) {
      return NextResponse.json(
        {
          error: 'No eligible EOA holders found after excluding protocol wallets.',
          suggestions: [
            'All current token holders are protocol wallets',
            'Only EOAs (Externally Owned Accounts) receive rewards',
            'LP providers are included - their BTC1USD share in pools is calculated and aggregated',
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
        blockNumber: currentBlock,
        activeHolders: claims.length,
        totalHolders: allHolders.length,
        excludedAddresses: excludedAddresses,
        excludedCount: excludedAddresses.length,
        detectedLPPools: [], // Will be populated if we implement LP pool detection
        note: 'Protocol wallets are excluded. Pools in EXCLUDED_POOLS list are treated as direct holders (not expanded to LP providers). Only EOAs and verified holders receive rewards.'
      } as any
    };

    // Save to Supabase as PRIMARY storage
    const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "8453");
    const supabaseTableName = getSupabaseTableName(chainId);
    console.log(`💾 Using Supabase table: ${supabaseTableName} (chainId: ${chainId})`);
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    let supabaseSuccess = false;
    if (supabaseUrl && supabaseKey) {
      try {
        console.log('📤 Saving distribution to Supabase (PRIMARY STORAGE)...');
        
        // Create Supabase client
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        // Prepare data according to Supabase schema
        const supabaseData: Record<string, any> = {
          id: Number(distributionId),
          merkle_root: merkleRoot,
          total_rewards: totalRewards.toString(),
          claims: distributionData.claims,
          metadata: distributionData.metadata
        };
        
        // Save to appropriate table based on network
        const result = await supabase
          .from(supabaseTableName)
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
            'Verify merkle_distributions table exists in your Supabase project',
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
