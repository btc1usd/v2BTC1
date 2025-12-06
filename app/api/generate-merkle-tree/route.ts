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
  }
];

// Load deployment configuration - updated to use deploymentresult.json
const getContractAddresses = () => {
  try {
    // First try environment variables
    const btc1usd = process.env.NEXT_PUBLIC_BTC1USD_CONTRACT;
    const weeklyDistribution = process.env.NEXT_PUBLIC_WEEKLY_DISTRIBUTION_CONTRACT;
    const merkleDistributor = process.env.NEXT_PUBLIC_MERKLE_DISTRIBUTOR_CONTRACT;

    if (btc1usd && weeklyDistribution && merkleDistributor) {
      return { btc1usd, weeklyDistribution, merkleDistributor };
    }

    // Fallback to deployment file
    const fs = require('fs');
    const path = require('path');

    // Handle both local and serverless (Netlify) environments
    const rootPath = process.env.LAMBDA_TASK_ROOT || process.cwd();
    
    // Try deploymentresult.json first (Base Sepolia), fallback to deployment-local.json
    let deploymentPath = path.join(rootPath, 'deploymentresult.json');
    if (!fs.existsSync(deploymentPath)) {
      deploymentPath = path.join(rootPath, 'deployment-local.json');
    }

    if (!fs.existsSync(deploymentPath)) {
      console.error('Deployment file not found at:', deploymentPath);
      return null;
    }

    const deploymentContent = fs.readFileSync(deploymentPath, 'utf8');
    const deployment = JSON.parse(deploymentContent);

    // Handle both old and new deployment file structures
    return {
      btc1usd: deployment.core?.btc1usd || deployment.contracts?.btc1usd,
      weeklyDistribution: deployment.distribution?.weeklyDistribution || deployment.contracts?.weeklyDistribution,
      merkleDistributor: deployment.distribution?.merkleDistributor || deployment.contracts?.merkleDistributor
    };
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
    const provider = await createProviderWithFallback(84532, {
      timeout: 15000, // Increased timeout
      maxRetries: 3,
      retryDelay: 2000, // Increased initial delay
      backoffMultiplier: 2
    });
    
    console.log(`✅ Successfully connected to Base Sepolia network`);
    return provider;
  } catch (error) {
    console.error('❌ Failed to create provider with fallback:', error);
    throw new Error(`Unable to connect to Base Sepolia network. Please check your RPC configuration. Details: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Helper to get holders using Alchemy API (if available)
const getHoldersFromAlchemy = async (tokenAddress: string): Promise<string[]> => {
  const alchemyApiKey = process.env.ALCHEMY_API_KEY;
  if (!alchemyApiKey) {
    console.log('Alchemy API key not found, skipping Alchemy method');
    return [];
  }

  try {
    console.log('Fetching holders from Alchemy API...');

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
      throw new Error(`Alchemy API error: ${response.status}`);
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
    console.warn('Alchemy API failed:', error instanceof Error ? error.message : error);
  }

  return [];
};

// Helper function to get all holders with balances using robust provider
const getAllHolders = async (btc1usdContract: ethers.Contract): Promise<{ address: string; balance: bigint }[]> => {
  console.log('Fetching all BTC1USD holders...');
  
  // Get token address
  const tokenAddress = await btc1usdContract.getAddress();

  // Try to get holders from Alchemy first
  const alchemyHolders = await getHoldersFromAlchemy(tokenAddress);

  if (alchemyHolders.length > 0) {
    console.log(`✅ Alchemy found ${alchemyHolders.length} unique addresses`);
    
    // Check balance for each address
    const holders: { address: string; balance: bigint }[] = [];
    
    for (const address of alchemyHolders) {
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
    
    if (holders.length > 0) {
      console.log(`✅ Total holders with balance > 0: ${holders.length}`);
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

    // Get all token holders via Alchemy
    const allHolders = await getAllHolders(btc1usd);

    if (allHolders.length === 0) {
      // Provide more helpful error message
      return NextResponse.json(
        {
          error: 'No token holders found. Please ensure there are BTC1USD holders with positive balances.',
          suggestions: [
            'Mint tokens to test accounts using the mint-tokens.js script',
            'Transfer tokens between accounts to create Transfer events',
            'Check that the contract addresses are correct in deploymentresult.json'
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

    console.log(`👥 Found ${allHolders.length} total holders, ${holders.length} eligible (${allHolders.length - holders.length} protocol wallets excluded)`);

    if (holders.length === 0) {
      return NextResponse.json(
        {
          error: 'No eligible holders found after excluding protocol wallets.',
          suggestions: [
            'All current holders are protocol wallets (Dev, Endowment, Merkle Distributor)',
            'Mint tokens to user accounts to create eligible holders',
            'Transfer tokens between user accounts'
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
        totalHolders: allHolders.length,
        excludedAddresses: excludedAddresses,
        excludedCount: excludedAddresses.length,
        note: 'Protocol wallets (Merkle Distributor, Dev Wallet, Endowment Wallet) are excluded from receiving holder rewards'
      } as any
    };

    // Save to Supabase as PRIMARY storage for both local and Netlify
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
          .from('merkle_distributions')
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

    // Save to file system as FALLBACK for local development
    if (!process.env.LAMBDA_TASK_ROOT || !supabaseSuccess) {
      try {
        const fs = require('fs');
        const path = require('path');
        
        const merkleDir = path.join(process.cwd(), 'merkle-distributions');
        if (!fs.existsSync(merkleDir)) {
          fs.mkdirSync(merkleDir, { recursive: true });
        }
        
        const filename = `distribution-${distributionId}.json`;
        const filepath = path.join(merkleDir, filename);
        
        fs.writeFileSync(filepath, JSON.stringify(distributionData, null, 2));
        console.log(`💾 Saved distribution data to file system (fallback): ${filepath}`);
        
        // If Supabase failed but file system succeeded, still consider it a success
        if (!supabaseSuccess) {
          console.log('⚠️  Using file system as primary storage since Supabase failed');
        }
      } catch (error) {
        console.warn('⚠️ Failed to save distribution data to file system:', error);
        
        // If both Supabase and file system failed, this is a critical error
        if (!supabaseSuccess) {
          throw new Error('Failed to save distribution to both Supabase and file system');
        }
      }
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
