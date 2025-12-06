export const dynamic = "force-dynamic";
export const revalidate = 0; // Disable ISR

import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { promises as fs } from 'fs';
import { join } from 'path';

// Types for analytics data
interface DistributionAnalytics {
  totalDistributions: number;
  totalRewardsDistributed: string;
  totalClaimed: string;
  overallClaimRate: number;
  activeDistributions: number;
  completedDistributions: number;
  averageClaimRate: number;
  topDistribution: {
    id: string;
    rewards: string;
    claimed: string;
    claimRate: number;
  };
  recentActivity: {
    date: string;
    distributions: number;
    rewards: string;
  }[];
  userParticipation?: {
    totalParticipated: number;
    totalPossible: number;
    participationRate: number;
    unclaimedRewards: string;
  };
}

// RPC endpoints for redundancy
const RPC_ENDPOINTS = process.env.NEXT_PUBLIC_RPC_URL?.split(',') || ['https://mainnet.base.org'];

// Create public client with fallback
function createClientWithFallback() {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(RPC_ENDPOINTS[0], {
      timeout: 10000,
      retryCount: 2,
    }),
  });
}

// Load analytics data from merkle distribution files with on-chain claim verification
async function loadAnalyticsDataFromFiles(): Promise<DistributionAnalytics> {
  try {
    const merkleDir = join(process.cwd(), 'merkle-distributions');
    const files = await fs.readdir(merkleDir);
    const distributionFiles = files.filter(f => f.startsWith('distribution-') && f.endsWith('.json'));

    let totalRewardsDistributed = 0n;
    let totalClaimed = 0n;
    const distributions = [];

    // Create client for on-chain queries
    const client = createClientWithFallback();
    const merkleDistributorAddress = process.env.NEXT_PUBLIC_MERKLE_DISTRIBUTOR_CONTRACT;

    const merkleDistributorAbi = [
      {
        name: 'isClaimed',
        type: 'function',
        stateMutability: 'view',
        inputs: [
          { name: 'distributionId', type: 'uint256' },
          { name: 'index', type: 'uint256' }
        ],
        outputs: [{ type: 'bool' }],
      },
      {
        name: 'getDistributionInfo',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'distributionId', type: 'uint256' }],
        outputs: [
          { name: 'root', type: 'bytes32' },
          { name: 'totalTokens', type: 'uint256' },
          { name: 'totalClaimed', type: 'uint256' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'finalized', type: 'bool' }
        ],
      }
    ];

    // Read all distribution files
    for (const file of distributionFiles) {
      try {
        const filePath = join(merkleDir, file);
        const data = await fs.readFile(filePath, 'utf8');
        const distribution = JSON.parse(data);

        const totalRewards = BigInt(distribution.totalRewards || 0);
        const distributionId = distribution.distributionId || file.replace('distribution-', '').replace('.json', '');

        let claimed = 0n;

        // Try to get on-chain claim data if available
        if (merkleDistributorAddress) {
          try {
            const distInfo = await client.readContract({
              address: merkleDistributorAddress as `0x${string}`,
              abi: merkleDistributorAbi,
              functionName: 'getDistributionInfo',
              args: [BigInt(distributionId)],
            }) as any;

            claimed = distInfo[2]; // totalClaimed from contract
          } catch (err) {
            console.error(`Failed to get on-chain data for distribution ${distributionId}:`, err);
            // Fallback: assume not claimed if we can't read on-chain
            claimed = 0n;
          }
        }

        totalRewardsDistributed += totalRewards;
        totalClaimed += claimed;

        distributions.push({
          id: distributionId.toString(),
          rewards: totalRewards.toString(),
          claimed: claimed.toString(),
          claimRate: totalRewards > 0n ? Number((claimed * 10000n) / totalRewards) / 100 : 0,
          timestamp: distribution.metadata?.generated || new Date().toISOString(),
        });
      } catch (err) {
        console.error(`Failed to read distribution file ${file}:`, err);
      }
    }

    // Sort by ID descending to get most recent
    distributions.sort((a, b) => parseInt(b.id) - parseInt(a.id));

    // Get top distribution
    const topDistribution = distributions.reduce((top, dist) => {
      const topRewards = BigInt(top.rewards);
      const distRewards = BigInt(dist.rewards);
      return distRewards > topRewards ? dist : top;
    }, distributions[0] || { id: "0", rewards: "0", claimed: "0", claimRate: 0 });

    // Calculate recent activity (last 30 days)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const recentActivity = distributions
      .filter(d => new Date(d.timestamp) >= thirtyDaysAgo)
      .map(d => ({
        date: d.timestamp,
        distributions: 1,
        rewards: d.rewards,
      }));

    const overallClaimRate = totalRewardsDistributed > 0n
      ? Number((totalClaimed * 10000n) / totalRewardsDistributed) / 100
      : 0;

    const averageClaimRate = distributions.length > 0
      ? distributions.reduce((sum, d) => sum + d.claimRate, 0) / distributions.length
      : 0;

    return {
      totalDistributions: distributions.length,
      totalRewardsDistributed: totalRewardsDistributed.toString(),
      totalClaimed: totalClaimed.toString(),
      overallClaimRate,
      activeDistributions: distributions.filter(d => d.claimRate < 100).length,
      completedDistributions: distributions.filter(d => d.claimRate >= 100).length,
      averageClaimRate,
      topDistribution: {
        id: topDistribution.id,
        rewards: topDistribution.rewards,
        claimed: topDistribution.claimed,
        claimRate: topDistribution.claimRate,
      },
      recentActivity,
    };
  } catch (error) {
    console.error('Failed to load analytics data from files:', error);
    // Return default empty data structure
    return {
      totalDistributions: 0,
      totalRewardsDistributed: "0",
      totalClaimed: "0",
      overallClaimRate: 0,
      activeDistributions: 0,
      completedDistributions: 0,
      averageClaimRate: 0,
      topDistribution: {
        id: "0",
        rewards: "0",
        claimed: "0",
        claimRate: 0,
      },
      recentActivity: [],
    };
  }
}

// Load user analytics data (check user's claims across all distributions)
async function loadUserAnalyticsData(userAddress: string): Promise<any> {
  try {
    const merkleDir = join(process.cwd(), 'merkle-distributions');
    const files = await fs.readdir(merkleDir);
    const distributionFiles = files.filter(f => f.startsWith('distribution-') && f.endsWith('.json'));

    let totalParticipated = 0;
    let totalPossible = 0;
    let unclaimedRewards = 0n;

    // Create client for on-chain queries
    const client = createClientWithFallback();
    const merkleDistributorAddress = process.env.NEXT_PUBLIC_MERKLE_DISTRIBUTOR_CONTRACT;

    const isClaimedAbi = [{
      name: 'isClaimed',
      type: 'function',
      stateMutability: 'view',
      inputs: [
        { name: 'distributionId', type: 'uint256' },
        { name: 'index', type: 'uint256' }
      ],
      outputs: [{ type: 'bool' }],
    }];

    for (const file of distributionFiles) {
      try {
        const filePath = join(merkleDir, file);
        const data = await fs.readFile(filePath, 'utf8');
        const distribution = JSON.parse(data);

        const distributionId = distribution.distributionId || file.replace('distribution-', '').replace('.json', '');

        if (distribution.claims && distribution.claims[userAddress.toLowerCase()]) {
          const userClaim = distribution.claims[userAddress.toLowerCase()];
          totalPossible++;

          // Check on-chain if user has claimed
          let hasClaimed = false;
          if (merkleDistributorAddress) {
            try {
              hasClaimed = await client.readContract({
                address: merkleDistributorAddress as `0x${string}`,
                abi: isClaimedAbi,
                functionName: 'isClaimed',
                args: [BigInt(distributionId), BigInt(userClaim.index)],
              }) as boolean;
            } catch (err) {
              console.error(`Failed to check claim status for distribution ${distributionId}:`, err);
            }
          }

          if (hasClaimed) {
            totalParticipated++;
          } else {
            unclaimedRewards += BigInt(userClaim.amount || 0);
          }
        }
      } catch (err) {
        console.error(`Failed to read distribution file ${file}:`, err);
      }
    }

    const participationRate = totalPossible > 0
      ? (totalParticipated / totalPossible) * 100
      : 0;

    return {
      totalParticipated,
      totalPossible,
      participationRate,
      unclaimedRewards: unclaimedRewards.toString(),
    };
  } catch (error) {
    console.error('Failed to load user analytics data:', error);
    return {
      totalParticipated: 0,
      totalPossible: 0,
      participationRate: 0,
      unclaimedRewards: "0",
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get user address from query parameters if provided
    const url = new URL(request.url);
    const userAddress = url.searchParams.get('address');

    // Load analytics data from actual distribution files
    const analyticsData = await loadAnalyticsDataFromFiles();

    // If user address is provided, add user-specific data
    if (userAddress) {
      const userData = await loadUserAnalyticsData(userAddress);
      analyticsData.userParticipation = userData;
    }

    return NextResponse.json(analyticsData, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Error calculating distribution analytics:', error);
    return NextResponse.json(
      {
        error: 'Failed to calculate distribution analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}