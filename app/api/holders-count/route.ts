import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { createProviderWithFallback } from '@/lib/rpc-provider';

const BTC1USD_ABI = [
  {
    "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];

// Helper to get holders using Transfer events
const getHoldersFromTransferEvents = async (tokenAddress: string, provider: any): Promise<string[]> => {
  try {
    console.log('Fetching holders from Transfer events...');

    // Get Transfer events using eth_getLogs
    const transferEventSignature = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

    // Get current block number
    const currentBlock = await provider.getBlockNumber();
    console.log(`Current block: ${currentBlock}`);

    // Query in chunks to avoid "query exceeds max block range" error
    // Most RPCs limit to 100k blocks, so we'll use 50k to be safe
    const maxBlockRange = 50000;
    const uniqueAddresses = new Set<string>();
    let totalLogs = 0;

    // Start from 100k blocks ago or from block 0, whichever is more recent
    const startBlock = Math.max(0, currentBlock - 100000);

    for (let fromBlock = startBlock; fromBlock <= currentBlock; fromBlock += maxBlockRange) {
      const toBlock = Math.min(fromBlock + maxBlockRange - 1, currentBlock);

      console.log(`Querying blocks ${fromBlock} to ${toBlock}...`);

      try {
        const logs = await provider.getLogs({
          address: tokenAddress,
          topics: [transferEventSignature],
          fromBlock,
          toBlock
        });

        totalLogs += logs.length;
        console.log(`Found ${logs.length} Transfer events in this range`);

        // Process each transfer event
        logs.forEach((log: any) => {
          if (log.topics && log.topics.length >= 3) {
            // Extract 'from' and 'to' addresses from topics
            // topics[0] is the event signature
            // topics[1] is the 'from' address
            // topics[2] is the 'to' address
            const fromAddress = '0x' + log.topics[1].slice(26);
            const toAddress = '0x' + log.topics[2].slice(26);

            if (fromAddress.toLowerCase() !== '0x0000000000000000000000000000000000000000') {
              uniqueAddresses.add(fromAddress.toLowerCase());
            }
            if (toAddress.toLowerCase() !== '0x0000000000000000000000000000000000000000') {
              uniqueAddresses.add(toAddress.toLowerCase());
            }
          }
        });
      } catch (chunkError) {
        console.warn(`Error querying blocks ${fromBlock}-${toBlock}:`, chunkError);
      }
    }

    const holders = Array.from(uniqueAddresses);
    console.log(`✅ Found ${totalLogs} total Transfer events, ${holders.length} unique addresses`);
    return holders;
  } catch (error) {
    console.warn('Failed to get holders from Transfer events:', error instanceof Error ? error.message : error);
    return [];
  }
};

export async function GET(request: NextRequest) {
  try {
    const btc1usdAddress = process.env.NEXT_PUBLIC_BTC1USD_CONTRACT;

    if (!btc1usdAddress) {
      return NextResponse.json(
        { error: 'Contract address not configured' },
        { status: 500 }
      );
    }

    // Create provider to check balances
    // Use the chain ID from environment variables
    const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "8453");
    const provider = await createProviderWithFallback(chainId, {
      timeout: 15000,
      maxRetries: 3,
      retryDelay: 2000,
      backoffMultiplier: 2
    });

    // Addresses to exclude from holder count (protocol contracts)
    const excludedAddresses = new Set([
      '0x0000000000000000000000000000000000000000', // Zero address
      process.env.NEXT_PUBLIC_VAULT_CONTRACT?.toLowerCase(),
      process.env.NEXT_PUBLIC_WEEKLY_DISTRIBUTION_CONTRACT?.toLowerCase(),
      process.env.NEXT_PUBLIC_MERKLE_DISTRIBUTOR_CONTRACT?.toLowerCase(),
      process.env.NEXT_PUBLIC_DEV_WALLET_CONTRACT?.toLowerCase(),
      process.env.NEXT_PUBLIC_ENDOWMENT_WALLET_CONTRACT?.toLowerCase(),
      process.env.NEXT_PUBLIC_MERKLE_FEE_COLLECTOR_CONTRACT?.toLowerCase(),
    ].filter(Boolean).map(addr => addr?.toLowerCase()));

    // Get all potential holders from Transfer events
    const potentialHolders = await getHoldersFromTransferEvents(btc1usdAddress, provider);

    if (potentialHolders.length === 0) {
      return NextResponse.json(
        {
          count: 0,
          totalUnique: 0,
          activeHolders: 0,
          excludedCount: 0,
        },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
          },
        }
      );
    }

    const btc1usd = new ethers.Contract(
      btc1usdAddress,
      BTC1USD_ABI,
      provider
    );

    // Check balance for each address
    let activeHoldersCount = 0;
    let totalHolders = 0;

    for (const address of potentialHolders) {
      try {
        const balance = await btc1usd.balanceOf(address);
        if (balance > BigInt(0)) {
          totalHolders++;
          // Check if holder is not in excluded addresses
          if (!excludedAddresses.has(address.toLowerCase())) {
            activeHoldersCount++;
          }
        }
      } catch (error) {
        console.warn(`Failed to get balance for ${address}:`, error);
      }
    }

    console.log(`✅ Total holders: ${totalHolders}, Active (non-excluded): ${activeHoldersCount}`);

    return NextResponse.json(
      {
        count: activeHoldersCount,
        totalUnique: potentialHolders.length,
        activeHolders: activeHoldersCount,
        excludedCount: totalHolders - activeHoldersCount,
        totalHoldersWithBalance: totalHolders,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching holder count:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch holder count',
        details: error instanceof Error ? error.message : 'Unknown error',
        count: 0,
      },
      { status: 500 }
    );
  }
}
