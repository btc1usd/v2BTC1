import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { supabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase";
import { executeWithProviderFallback } from "@/lib/rpc-provider";

// Force this route to be dynamic (not cached at build time)
export const dynamic = 'force-dynamic';
export const revalidate = 0; // Disable caching

// ------------------------------
// 🔒 CACHE SETTINGS
// ------------------------------
const CLAIM_STATUS_CACHE = new Map<
  string,
  { claimed: boolean; timestamp: number }
>();
const CLAIM_STATUS_TTL = 30 * 1000; // Reduced to 30 seconds for more responsive updates

// ------------------------------
// 🔍 CONTRACT ABIs
// ------------------------------
const MERKLE_DISTRIBUTOR_ABI = [
  {
    inputs: [
      { internalType: "uint256", name: "distributionId", type: "uint256" },
    ],
    name: "getDistributionInfo",
    outputs: [
      { internalType: "bytes32", name: "root", type: "bytes32" },
      { internalType: "uint256", name: "totalTokens", type: "uint256" },
      { internalType: "uint256", name: "totalClaimed", type: "uint256" },
      { internalType: "uint256", name: "timestamp", type: "uint256" },
      { internalType: "bool", name: "finalized", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "distributionId", type: "uint256" },
      { internalType: "uint256", name: "index", type: "uint256" },
    ],
    name: "isClaimed",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
];

function getContractAddress(): string {
  const md = process.env.NEXT_PUBLIC_MERKLE_DISTRIBUTOR_CONTRACT;
  if (!md) throw new Error("Merkle Distributor contract not set");
  return md;
}

// ------------------------------
// 🚀 MAIN ROUTE
// ------------------------------
export async function GET(request: NextRequest) {
  console.log("⚡ /api/merkle-distributions/latest with reduced claim cache");

  const merkleDistributorAddress = getContractAddress();
  const url = new URL(request.url);
  const userAddress = url.searchParams.get("address")?.toLowerCase();

  if (!userAddress) {
    return NextResponse.json(
      { error: "Missing ?address parameter" },
      { status: 400 }
    );
  }

  try {
    // ☁️ SUPABASE ONLY - No file system fallback
    if (!isSupabaseAdminConfigured() || !supabaseAdmin) {
      return NextResponse.json(
        {
          error: "Supabase not configured",
          message: "Distribution data requires Supabase configuration. Please check your environment variables.",
          count: 0,
          userDistributions: []
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

    console.log("☁️ Loading distributions from Supabase...");
    console.log("Supabase Admin configured:", isSupabaseAdminConfigured());
    console.log("Supabase Admin client:", supabaseAdmin ? "initialized" : "null");

    let data: any[] = [];
    let supabaseError: Error | null = null;

    try {
      console.log("Attempting Supabase query...");
      const { data: supabaseData, error } = await supabaseAdmin
        .from("merkle_distributions_dev")
        .select("id, merkle_root, claims, total_rewards, metadata")
        .order("id", { ascending: false })
        .limit(10);

      console.log("Supabase response:", { 
        hasData: !!supabaseData, 
        dataLength: supabaseData?.length,
        hasError: !!error,
        errorDetails: error 
      });

      if (error) {
        supabaseError = new Error(`Supabase query error: ${error.message}`);
        throw supabaseError;
      }

      if (supabaseData && supabaseData.length > 0) {
        console.log(`✅ Successfully loaded ${supabaseData.length} distributions from Supabase`);
        data = supabaseData.map((dist: any) => ({
          id: dist.id,
          merkle_root: dist.merkle_root,
          claims: dist.claims,
          total_rewards: dist.total_rewards,
          metadata: dist.metadata
        }));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      
      // Check if it's a Cloudflare/HTML error (not JSON)
      if (errorMessage.includes('<html>') || errorMessage.includes('cloudflare')) {
        console.error('❌ Supabase service appears to be down (received HTML instead of JSON)');
        supabaseError = new Error('Supabase service unavailable. The database service may be experiencing issues.');
      } else {
        console.error('Failed to read distribution data from Supabase:', errorMessage);
        supabaseError = err instanceof Error ? err : new Error(errorMessage);
      }

      // Try to load from local files as fallback
      console.log('⚠️ Attempting to load from local distribution files as fallback...');
      try {
        const fs = await import('fs/promises');
        const path = await import('path');
        
        const distributionsDir = path.join(process.cwd(), 'merkle-distributions');
        const files = await fs.readdir(distributionsDir);
        
        const distributionFiles = files
          .filter(f => f.startsWith('distribution-') && f.endsWith('.json'))
          .sort((a, b) => {
            const idA = parseInt(a.match(/distribution-(\d+)\.json/)?.[1] || '0');
            const idB = parseInt(b.match(/distribution-(\d+)\.json/)?.[1] || '0');
            return idB - idA; // Descending order
          })
          .slice(0, 10); // Get latest 10

        for (const file of distributionFiles) {
          const filePath = path.join(distributionsDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const distData = JSON.parse(content);
          
          data.push({
            id: distData.id,
            merkle_root: distData.merkleRoot,
            claims: distData.claims,
            total_rewards: distData.totalRewards,
            metadata: distData.metadata || {
              generated: new Date().toISOString(),
              activeHolders: Object.keys(distData.claims || {}).length
            }
          });
        }

        if (data.length > 0) {
          console.log(`✅ Loaded ${data.length} distributions from local files as fallback`);
        }
      } catch (fileErr) {
        console.error('Failed to load from local files:', fileErr instanceof Error ? fileErr.message : 'Unknown error');
        // Return the Supabase error since fallback also failed
        return NextResponse.json(
          {
            error: "Failed to load distribution data",
            details: `Supabase error: ${supabaseError.message}. Local fallback also failed.`,
            supabaseDown: true,
            count: 0,
            userDistributions: []
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
    }

    if (!data?.length) {
      return NextResponse.json(
        { count: 0, userDistributions: [] },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        }
      );
    }

    // 2️⃣ Verify each on-chain with rate limit handling
    const verified = await Promise.all(
      data.map(async (dist, index) => {
        try {
          // Add a delay between requests to avoid rate limits
          if (index > 0) {
            await new Promise((resolve) => setTimeout(resolve, 200));
          }

          const [root, totalTokens, totalClaimed, timestamp, finalized] =
            await executeWithProviderFallback(async (provider) => {
              const contract = new ethers.Contract(
                merkleDistributorAddress,
                MERKLE_DISTRIBUTOR_ABI,
                provider
              );
              return await contract.getDistributionInfo(BigInt(dist.id));
            }, 8453, { // Base Mainnet chain ID
              timeout: 15000, // Increased timeout
              maxRetries: 3,
              retryDelay: 2000,
              backoffMultiplier: 2
            });

          if (!root || root.toLowerCase() !== dist.merkle_root.toLowerCase()) {
            console.warn(`❌ Root mismatch for ${dist.id}`);
            return null;
          }

          return {
            id: dist.id,
            merkleRoot: root,
            totalRewards: dist.total_rewards,
            totalTokens: totalTokens.toString(),
            totalClaimed: totalClaimed.toString(),
            timestamp: Number(timestamp),
            finalized,
            claims: dist.claims,
            metadata: dist.metadata,
          };
        } catch (err) {
          // Handle rate limit errors specifically
          if (err instanceof Error && err.message.includes("rate limit")) {
            console.warn(
              `⚠️ Rate limit hit for distribution ${dist.id}, skipping...`
            );
            return null;
          }

          console.warn(
            `Verification failed for dist ${dist.id}:`,
            (err as Error).message
          );
          // Return partial data for display even if verification fails
          return {
            id: dist.id,
            merkleRoot: dist.merkle_root,
            totalRewards: dist.total_rewards,
            totalTokens: "0",
            totalClaimed: "0",
            timestamp: Date.now(),
            finalized: false,
            claims: dist.claims,
            metadata: dist.metadata,
          };
        }
      })
    );

    const valid = verified.filter(Boolean) as any[];

    // 3️⃣ Extract ALL user distributions (excluding reclaimed ones)
    const userDistributions = await Promise.all(
      valid.map(async (dist, index) => {
        const claim = dist.claims?.[userAddress];
        if (!claim) return null;

        // ⚠️ Filter out reclaimed distributions
        const isReclaimed = dist.metadata?.reclaimed || false;
        if (isReclaimed) {
          console.log(`⚠️ Skipping reclaimed distribution ${dist.id}`);
          return null;
        }

        // Add a delay between claim status checks to avoid rate limits
        if (index > 0) {
          await new Promise((resolve) => setTimeout(resolve, 150));
        }

        const claimedOnChain = await checkClaimStatusCached(
          merkleDistributorAddress,
          BigInt(dist.id),
          BigInt(claim.index)
        );

        // Include ALL distributions with user claims (both claimed and unclaimed)
        return {
          id: dist.id,
          merkleRoot: dist.merkleRoot,
          totalRewards: dist.totalRewards,
          totalTokens: dist.totalTokens,
          totalClaimed: dist.totalClaimed,
          timestamp: dist.timestamp,
          finalized: dist.finalized,
          metadata: dist.metadata,
          claim,
          claimedOnChain,
        };
      })
    );

    const allUserDistributions = userDistributions
      .filter((dist): dist is NonNullable<typeof dist> => dist !== null)
      .sort((a, b) => b.id - a.id);

    console.log(
      `✅ Returning ${allUserDistributions.length} total distributions for user (including claimed)`
    );

    return NextResponse.json(
      {
        address: userAddress,
        count: allUserDistributions.length,
        userDistributions: allUserDistributions,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (err: any) {
    console.error("Error in optimized claim-check handler:", {
      message: err.message,
      stack: err.stack,
      name: err.name
    });

    // Check if we have any local distribution files as final fallback
    console.log('⚠️ Main error handler - attempting final fallback to local files...');
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const distributionsDir = path.join(process.cwd(), 'merkle-distributions');
      console.log('Checking directory:', distributionsDir);
      
      const files = await fs.readdir(distributionsDir);
      console.log('Found files:', files);
      
      const distributionFiles = files
        .filter(f => f.startsWith('distribution-') && f.endsWith('.json'))
        .sort((a, b) => {
          const idA = parseInt(a.match(/distribution-(\d+)\.json/)?.[1] || '0');
          const idB = parseInt(b.match(/distribution-(\d+)\.json/)?.[1] || '0');
          return idB - idA;
        })
        .slice(0, 10);

      console.log('Distribution files found:', distributionFiles);

      const localData: any[] = [];
      for (const file of distributionFiles) {
        const filePath = path.join(distributionsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const distData = JSON.parse(content);
        
        localData.push({
          id: distData.id,
          merkleRoot: distData.merkleRoot,
          totalRewards: distData.totalRewards,
          claims: distData.claims,
          metadata: distData.metadata || {
            generated: new Date().toISOString(),
            activeHolders: Object.keys(distData.claims || {}).length
          }
        });
      }

      // Filter for user distributions
      const userDists = localData
        .map(dist => {
          const claim = dist.claims?.[userAddress];
          if (!claim) return null;
          
          return {
            id: dist.id,
            merkleRoot: dist.merkleRoot,
            totalRewards: dist.totalRewards,
            metadata: dist.metadata,
            claim,
            claimedOnChain: false // Can't check without RPC
          };
        })
        .filter(Boolean);

      if (userDists.length > 0) {
        console.log(`✅ Final fallback successful: Loaded ${userDists.length} distributions for user`);
        return NextResponse.json(
          {
            address: userAddress,
            count: userDists.length,
            userDistributions: userDists,
            fallbackMode: true,
            message: "Loaded from local files (Supabase unavailable)"
          },
          {
            headers: {
              'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
              'Pragma': 'no-cache',
              'Expires': '0',
            },
          }
        );
      }
    } catch (fallbackErr) {
      console.error('Final fallback also failed:', fallbackErr);
    }

    // Return empty result on error
    return NextResponse.json(
      {
        address: userAddress,
        count: 0,
        userDistributions: [],
        error: "Failed to load distributions. Please try again later.",
        details: err.message
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
}

// ------------------------------
// 🧠 CLAIM STATUS CACHE HELPER
// ------------------------------
async function checkClaimStatusCached(
  contractAddress: string,
  distributionId: bigint,
  index: bigint
): Promise<boolean> {
  const key = `${contractAddress}:${distributionId}:${index}`;

  // 1️⃣ Cache hit and still fresh
  const cached = CLAIM_STATUS_CACHE.get(key);
  if (cached && Date.now() - cached.timestamp < CLAIM_STATUS_TTL) {
    return cached.claimed;
  }

  // 2️⃣ Otherwise query blockchain with error handling
  try {
    const claimed = await executeWithProviderFallback(async (provider) => {
      const contract = new ethers.Contract(
        contractAddress,
        MERKLE_DISTRIBUTOR_ABI,
        provider
      );
      try {
        return await contract.isClaimed(distributionId, index);
      } catch (err) {
        console.warn(
          `isClaimed() failed for distribution ${distributionId}:`,
          (err as Error).message
        );
        // Return false as default if we can't determine claim status
        return false;
      }
    }, 8453, { // Base Mainnet chain ID
      timeout: 15000, // Increased timeout
      maxRetries: 3,
      retryDelay: 2000,
      backoffMultiplier: 2
    });

    // 3️⃣ Cache result
    CLAIM_STATUS_CACHE.set(key, { claimed, timestamp: Date.now() });
    return claimed;
  } catch (error) {
    // Handle rate limit and other errors gracefully
    console.warn(
      `Failed to check claim status for distribution ${distributionId}, index ${index}:`,
      (error as Error).message
    );
    // Return false as default if we can't determine claim status
    return false;
  }
}

// ------------------------------
// 🗑️ CACHE INVALIDATION ENDPOINT
// ------------------------------
// This endpoint allows the frontend to invalidate claim status cache after a successful claim
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contractAddress, distributionId, index } = body;

    if (!contractAddress || distributionId === undefined || index === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: contractAddress, distributionId, index" },
        { status: 400 }
      );
    }

    const key = `${contractAddress}:${distributionId}:${index}`;

    // Clear the specific claim status
    CLAIM_STATUS_CACHE.delete(key);

    // Also clear all cache entries for this distribution to force fresh data
    const keysToDelete: string[] = [];
    CLAIM_STATUS_CACHE.forEach((value, cacheKey) => {
      if (cacheKey.includes(`:${distributionId}:`)) {
        keysToDelete.push(cacheKey);
      }
    });

    keysToDelete.forEach(k => CLAIM_STATUS_CACHE.delete(k));

    console.log(`🗑️ Invalidated claim status cache for ${key} and ${keysToDelete.length - 1} related entries`);

    return NextResponse.json({
      success: true,
      message: "Cache invalidated successfully",
      clearedEntries: keysToDelete.length
    });
  } catch (error) {
    console.error("Error invalidating cache:", error);
    return NextResponse.json(
      { error: "Failed to invalidate cache" },
      { status: 500 }
    );
  }
}