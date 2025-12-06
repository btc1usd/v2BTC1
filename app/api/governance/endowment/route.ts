import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES, ABIS } from '@/lib/contracts';
import { createProviderWithFallback } from '@/lib/rpc-provider';
import { cacheDistributions, getCachedDistributions } from '@/lib/distribution-cache';

// Mark this route as dynamic since it uses request.url
export const dynamic = 'force-dynamic';

const ENDOWMENT_MANAGER_ABI = [
  "function getNonProfitDetails(uint256 id) view returns (string name, string description, string website, address wallet, bool active)",
  "function getDistributionDetails(uint256 id) view returns (uint256 nonProfitId, uint256 amount, uint256 timestamp, bool executed)",
  "function nonProfitCount() view returns (uint256)",
  "function distributionCount() view returns (uint256)",
  "function getNextDistributionTime() view returns (uint256)",
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'nonprofits' or 'distributions'
    const action = searchParams.get('action'); // 'proposals', 'stats', 'distributions'
    const id = searchParams.get('id');
    const active = searchParams.get('active'); // For filtering active proposals

    // Handle action-based queries
    if (action === 'stats') {
      // Return overview stats
      try {
        const provider = await createProviderWithFallback(8453, {
          timeout: 15000,
          maxRetries: 3,
          retryDelay: 2000,
          backoffMultiplier: 2
        });

        const endowmentManager = new ethers.Contract(
          process.env.NEXT_PUBLIC_ENDOWMENT_MANAGER_CONTRACT || CONTRACT_ADDRESSES.ENDOWMENT_MANAGER,
          ENDOWMENT_MANAGER_ABI,
          provider
        );

        const [nonProfitCount, distributionCount] = await Promise.all([
          endowmentManager.nonProfitCount(),
          endowmentManager.distributionCount(),
        ]);

        let nextDistributionTime = 0;
        try {
          const nextDistTime = await endowmentManager.getNextDistributionTime();
          nextDistributionTime = Number(nextDistTime);
        } catch (error) {
          console.warn('Failed to fetch next distribution time:', error);
        }

        return NextResponse.json({
          nonProfitCount: Number(nonProfitCount),
          distributionCount: Number(distributionCount),
          nextDistributionTime,
          balance: '0', // TODO: Add actual balance query
        });
      } catch (error: any) {
        console.error('Error fetching endowment stats:', error);
        return NextResponse.json(
          { error: 'Failed to fetch stats', details: error.message },
          { status: 500 }
        );
      }
    }

    if (action === 'proposals') {
      // Return empty proposals array for now
      // TODO: Implement actual proposal fetching when governance integration is ready
      return NextResponse.json({
        proposals: [],
        message: 'Endowment proposals are managed through the main governance system'
      });
    }

    // Use robust provider with fallback
    const provider = await createProviderWithFallback(8453, {
      timeout: 15000, // Increased timeout
      maxRetries: 3,
      retryDelay: 2000, // Increased delay
      backoffMultiplier: 2
    });

    const endowmentManager = new ethers.Contract(
      process.env.NEXT_PUBLIC_ENDOWMENT_MANAGER_CONTRACT || CONTRACT_ADDRESSES.ENDOWMENT_MANAGER,
      ENDOWMENT_MANAGER_ABI,
      provider
    );

    // Get single item by ID
    if (id) {
      if (type === 'nonprofits') {
        const details = await endowmentManager.getNonProfitDetails(id);
        return NextResponse.json({
          id: parseInt(id),
          name: details[0],
          description: details[1],
          website: details[2],
          wallet: details[3],
          active: details[4],
        });
      } else if (type === 'distributions') {
        const details = await endowmentManager.getDistributionDetails(id);
        return NextResponse.json({
          id: parseInt(id),
          nonProfitId: Number(details[0]),
          amount: ethers.formatUnits(details[1], 8),
          timestamp: Number(details[2]),
          executed: details[3],
        });
      } else {
        return NextResponse.json(
          { error: 'Invalid type parameter' },
          { status: 400 }
        );
      }
    }

    // Get all items
    if (type === 'nonprofits') {
      const count = await endowmentManager.nonProfitCount();
      const nonprofits = [];

      for (let i = 1; i <= Number(count); i++) {
        try {
          const details = await endowmentManager.getNonProfitDetails(i);
          nonprofits.push({
            id: i,
            name: details[0],
            description: details[1],
            website: details[2],
            wallet: details[3],
            active: details[4],
          });
        } catch (error) {
          console.warn(`Failed to fetch nonprofit ${i}:`, error);
        }
      }

      return NextResponse.json({ nonprofits });
    } else if (type === 'distributions') {
      try {
        const count = await endowmentManager.distributionCount();
        const distributions = [];

        for (let i = 1; i <= Number(count); i++) {
          try {
            const details = await endowmentManager.getDistributionDetails(i);
            distributions.push({
              id: i,
              nonProfitId: Number(details[0]),
              amount: ethers.formatUnits(details[1], 8),
              timestamp: Number(details[2]),
              executed: details[3],
            });
          } catch (error) {
            console.warn(`Failed to fetch distribution ${i}:`, error);
          }
        }

        // Get next distribution time
        let nextDistributionTime = 0;
        try {
          const nextDistTime = await endowmentManager.getNextDistributionTime();
          nextDistributionTime = Number(nextDistTime);
        } catch (error) {
          console.warn('Failed to fetch next distribution time:', error);
        }

        // Cache the successful result
        cacheDistributions({
          distributions,
          nextDistributionTime,
          timestamp: Date.now()
        });

        return NextResponse.json({
          distributions,
          nextDistributionTime,
          cached: false
        });
      } catch (error) {
        // If blockchain fetch fails, try cache
        console.warn('Blockchain fetch failed, trying cache:', error);
        const cached = getCachedDistributions();
        if (cached) {
          return NextResponse.json({
            distributions: cached.distributions,
            nextDistributionTime: cached.nextDistributionTime || 0,
            cached: true,
            cacheAge: Math.round((Date.now() - cached.timestamp) / 1000 / 60) // minutes
          });
        }
        // If cache also fails, throw the error
        throw error;
      }
    } else {
      // Get overview data
      const [nonProfitCount, distributionCount] = await Promise.all([
        endowmentManager.nonProfitCount(),
        endowmentManager.distributionCount(),
      ]);

      let nextDistributionTime = 0;
      try {
        const nextDistTime = await endowmentManager.getNextDistributionTime();
        nextDistributionTime = Number(nextDistTime);
      } catch (error) {
        console.warn('Failed to fetch next distribution time:', error);
      }

      return NextResponse.json({
        nonProfitCount: Number(nonProfitCount),
        distributionCount: Number(distributionCount),
        nextDistributionTime,
      });
    }
  } catch (error: any) {
    console.error('Error fetching endowment data:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch endowment data', 
        details: error.message,
        suggestions: [
          "Check your network connection",
          "Verify RPC configuration",
          "Try again in a few minutes"
        ]
      },
      { status: 500 }
    );
  }
}