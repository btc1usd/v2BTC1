import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '../../../../lib/supabase';

// Force this route to be dynamic (not cached at build time)
export const dynamic = 'force-dynamic';
export const revalidate = 0; // Disable caching

// Get Supabase table name based on network
function getSupabaseTableName(chainId: number): string {
  // ALWAYS use merkle_distributions_prod on mainnet (Base = 8453)
  if (chainId === 8453) {
    return 'merkle_distributions_prod';
  }
  // Testnet (Base Sepolia = 84532 or any other testnet)
  return 'merkle_distributions_dev';
}

/**
 * API endpoint to mark a distribution as reclaimed
 * POST /api/merkle-distributions/mark-reclaimed
 *
 * Body: {
 *   distributionId: string,
 *   reclaimedAmount: string,
 *   txHash?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { distributionId, reclaimedAmount, txHash } = body;

    // Validate input
    if (!distributionId) {
      return NextResponse.json(
        { error: 'Missing distributionId' },
        { status: 400 }
      );
    }

    if (!reclaimedAmount) {
      return NextResponse.json(
        { error: 'Missing reclaimedAmount' },
        { status: 400 }
      );
    }

    // ☁️ SUPABASE ONLY - No file system fallback
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        {
          error: "Supabase not configured",
          message: "Distribution data requires Supabase configuration. Please check your environment variables.",
        },
        {
          status: 500,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        }
      );
    }

    try {
      // Determine chain ID and table name
      const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "8453");
      const tableName = getSupabaseTableName(chainId);
      console.log(`📊 Using Supabase table: ${tableName} for chain ${chainId}`);
      
      // Use a more generic approach to avoid typing issues
      const sb: any = supabase;
      
      // First, get the current distribution data from Supabase
      const selectResult = await sb
        .from(tableName)  // ✅ Use correct table based on network
        .select('metadata')
        .eq('id', Number(distributionId))
        .single();

      if (selectResult.error) {
        throw new Error(`Failed to fetch distribution: ${selectResult.error.message}`);
      }

      const supabaseData = selectResult.data;

      // Check if already reclaimed
      if (supabaseData.metadata?.reclaimed) {
        return NextResponse.json(
          {
            error: 'Distribution already marked as reclaimed',
            reclaimedAt: supabaseData.metadata.reclaimedAt
          },
          { status: 400 }
        );
      }

      // Update metadata with reclaim information
      const updatedMetadata = {
        ...supabaseData.metadata,
        reclaimed: true,
        reclaimedAt: new Date().toISOString(),
        reclaimedAmount: reclaimedAmount,
        reclaimTxHash: txHash || null
      };

      // Update Supabase
      const updateResult = await sb
        .from(tableName)  // ✅ Use correct table based on network
        .update({
          metadata: updatedMetadata
        })
        .eq('id', Number(distributionId));

      if (updateResult.error) {
        throw new Error(`Failed to update distribution: ${updateResult.error.message}`);
      }

      console.log(`✅ Distribution #${distributionId} marked as reclaimed`);
      console.log(`   Amount: ${reclaimedAmount}`);
      console.log(`   Timestamp: ${updatedMetadata.reclaimedAt}`);
      if (txHash) {
        console.log(`   TX Hash: ${txHash}`);
      }

      return NextResponse.json(
        {
          success: true,
          distributionId,
          reclaimedAt: updatedMetadata.reclaimedAt,
          reclaimedAmount,
          message: `Distribution #${distributionId} marked as reclaimed`
        },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        }
      );
    } catch (error) {
      console.error('Error marking distribution as reclaimed:', error);
      return NextResponse.json(
        {
          error: 'Failed to mark distribution as reclaimed',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        {
          status: 500,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        }
      );
    }
  } catch (error) {
    console.error('Error parsing request:', error);
    return NextResponse.json(
      { error: 'Invalid request format' },
      {
        status: 400,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  }
}

/**
 * GET endpoint to check if a distribution is reclaimed
 * GET /api/merkle-distributions/mark-reclaimed?distributionId=5
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const distributionId = url.searchParams.get('distributionId');

    if (!distributionId) {
      return NextResponse.json(
        { error: 'Missing distributionId parameter' },
        { status: 400 }
      );
    }

    // ☁️ SUPABASE ONLY - No file system fallback
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        {
          error: "Supabase not configured",
          message: "Distribution data requires Supabase configuration.",
        },
        {
          status: 500,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        }
      );
    }

    try {
      // Determine chain ID and table name
      const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "8453");
      const tableName = getSupabaseTableName(chainId);
      
      // Use a more generic approach to avoid typing issues
      const sb: any = supabase;
      
      const selectResult = await sb
        .from(tableName)  // ✅ Use correct table based on network
        .select('metadata')
        .eq('id', Number(distributionId))
        .single();

      if (selectResult.error) {
        throw new Error(`Failed to fetch distribution: ${selectResult.error.message}`);
      }

      const supabaseData = selectResult.data;

      return NextResponse.json(
        {
          distributionId,
          reclaimed: supabaseData.metadata?.reclaimed || false,
          reclaimedAt: supabaseData.metadata?.reclaimedAt || null,
          reclaimedAmount: supabaseData.metadata?.reclaimedAmount || null,
          reclaimTxHash: supabaseData.metadata?.reclaimTxHash || null
        },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        }
      );
    } catch (error) {
      console.error('Error checking reclaim status:', error);
      return NextResponse.json(
        {
          error: 'Failed to check reclaim status',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        {
          status: 500,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        }
      );
    }
  } catch (error) {
    console.error('Error parsing request:', error);
    return NextResponse.json(
      { error: 'Invalid request format' },
      {
        status: 400,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  }
}