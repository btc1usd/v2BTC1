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
 * API endpoint to mark an individual user claim in a distribution
 * POST /api/merkle-distributions/mark-claim
 *
 * Body: {
 *   distributionId: string,
 *   userAddress: string,
 *   claimedAmount: string,
 *   txHash?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { distributionId, userAddress, claimedAmount, txHash } = body;

    // Validate input
    if (!distributionId) {
      return NextResponse.json(
        { error: 'Missing distributionId' },
        { status: 400 }
      );
    }

    if (!userAddress) {
      return NextResponse.json(
        { error: 'Missing userAddress' },
        { status: 400 }
      );
    }

    // Normalize address to lowercase for consistent lookups
    const normalizedAddress = userAddress.toLowerCase();

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
        .select('claims, metadata')
        .eq('id', Number(distributionId))
        .single();

      if (selectResult.error) {
        throw new Error(`Failed to fetch distribution: ${selectResult.error.message}`);
      }

      const supabaseData = selectResult.data;

      // Update the claims data
      const updatedClaims = { ...supabaseData.claims };

      // Check if user has a claim in this distribution
      if (!updatedClaims[normalizedAddress]) {
        return NextResponse.json(
          { error: `No claim found for address ${normalizedAddress} in distribution ${distributionId}` },
          { status: 404 }
        );
      }

      // Check if already claimed
      if (updatedClaims[normalizedAddress].claimed) {
        return NextResponse.json(
          {
            error: 'Claim already marked as claimed',
            claimedAt: updatedClaims[normalizedAddress].claimedAt
          },
          { status: 400 }
        );
      }

      // Mark the claim as claimed
      updatedClaims[normalizedAddress] = {
        ...updatedClaims[normalizedAddress],
        claimed: true,
        claimedAt: new Date().toISOString(),
        claimedAmount: claimedAmount,
        claimTxHash: txHash || null
      };

      // Check if all claims are now claimed
      const allClaims = Object.values(updatedClaims);
      const allClaimed = allClaims.every((claim: any) => claim.claimed === true);
      const claimedCount = allClaims.filter((claim: any) => claim.claimed === true).length;
      const totalClaims = allClaims.length;

      // Update metadata
      const updatedMetadata = {
        ...supabaseData.metadata,
        claimedCount,
        totalClaims,
        fullyClaimed: allClaimed,
        lastClaimAt: new Date().toISOString()
      };

      if (allClaimed && !updatedMetadata.fullyClaimedAt) {
        updatedMetadata.fullyClaimedAt = new Date().toISOString();
        console.log(`🎉 Distribution #${distributionId} is now FULLY CLAIMED! All ${totalClaims} users have claimed.`);
      }

      // Update Supabase
      const updateResult = await sb
        .from(tableName)  // ✅ Use correct table based on network
        .update({
          claims: updatedClaims,
          metadata: updatedMetadata
        })
        .eq('id', Number(distributionId));

      if (updateResult.error) {
        throw new Error(`Failed to update distribution: ${updateResult.error.message}`);
      }

      console.log(`✅ Marked claim for ${normalizedAddress} in distribution #${distributionId}`);
      console.log(`   Amount: ${claimedAmount}`);
      console.log(`   Progress: ${claimedCount}/${totalClaims} claims`);
      if (txHash) {
        console.log(`   TX Hash: ${txHash}`);
      }

      return NextResponse.json(
        {
          success: true,
          distributionId,
          userAddress: normalizedAddress,
          claimedAt: updatedClaims[normalizedAddress].claimedAt,
          claimedCount,
          totalClaims,
          fullyClaimed: allClaimed,
          message: allClaimed
            ? `Distribution #${distributionId} is now fully claimed!`
            : `Claim marked successfully (${claimedCount}/${totalClaims})`
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
      console.error('Error marking claim:', error);
      return NextResponse.json(
        {
          error: 'Failed to mark claim',
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
 * GET endpoint to check if a specific claim is marked as claimed
 * GET /api/merkle-distributions/mark-claim?distributionId=5&userAddress=0x...
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const distributionId = url.searchParams.get('distributionId');
    const userAddress = url.searchParams.get('userAddress');

    if (!distributionId) {
      return NextResponse.json(
        { error: 'Missing distributionId parameter' },
        { status: 400 }
      );
    }

    if (!userAddress) {
      return NextResponse.json(
        { error: 'Missing userAddress parameter' },
        { status: 400 }
      );
    }

    const normalizedAddress = userAddress.toLowerCase();

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
        .select('claims')
        .eq('id', Number(distributionId))
        .single();

      if (selectResult.error) {
        throw new Error(`Failed to fetch distribution: ${selectResult.error.message}`);
      }

      const supabaseData = selectResult.data;

      // Check if user has a claim
      if (!supabaseData.claims || !supabaseData.claims[normalizedAddress]) {
        return NextResponse.json(
          { error: `No claim found for address ${normalizedAddress}` },
          { status: 404 }
        );
      }

      const claim = supabaseData.claims[normalizedAddress];

      return NextResponse.json(
        {
          distributionId,
          userAddress: normalizedAddress,
          claimed: claim.claimed || false,
          claimedAt: claim.claimedAt || null,
          claimedAmount: claim.claimedAmount || null,
          claimTxHash: claim.claimTxHash || null,
          amount: claim.amount
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
      console.error('Error checking claim status:', error);
      return NextResponse.json(
        {
          error: 'Failed to check claim status',
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