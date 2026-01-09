import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { executeWithProviderFallback } from "@/lib/rpc-provider";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

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

interface DistributionHistory {
  distributionId: string;
  merkleRoot: string;
  totalRewards: string;
  totalClaimed: string;
  percentageClaimed: number;
  timestamp: string;
  activeHolders: number;
  status: "active" | "completed" | "expired" | "reclaimed";
}

// Contract ABIs
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
    inputs: [],
    name: "currentDistributionId",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

// Load deployment configuration
const getContractAddresses = () => {
  try {
    // First try environment variables
    const merkleDistributor =
      process.env.NEXT_PUBLIC_MERKLE_DISTRIBUTOR_CONTRACT;
    if (merkleDistributor) {
      return { merkleDistributor };
    }

    // Fallback to deployment file
    const fs = require("fs");
    const path = require("path");
    const deploymentPath = path.join(process.cwd(), "deployment-local.json");

    if (!fs.existsSync(deploymentPath)) {
      console.error("Deployment file not found at:", deploymentPath);
      return null;
    }

    const deploymentContent = fs.readFileSync(deploymentPath, "utf8");
    const deployment = JSON.parse(deploymentContent);

    // Handle both old and new deployment file structures
    return {
      merkleDistributor:
        deployment.distribution?.merkleDistributor ||
        deployment.contracts?.merkleDistributor,
    };
  } catch (error) {
    console.error("Failed to load deployment config:", error);
    return null;
  }
};

function getContractAddress(): string {
  const md = process.env.NEXT_PUBLIC_MERKLE_DISTRIBUTOR_CONTRACT;
  if (!md) throw new Error("Merkle Distributor contract not set");
  return md;
}

export async function GET(request: NextRequest) {
  try {
    const addresses = getContractAddresses();
    if (!addresses) {
      return NextResponse.json(
        {
          error:
            "Contract addresses not found. Please ensure contracts are deployed.",
        },
        { status: 500 }
      );
    }

    const merkleDistributorAddress = getContractAddress();

    // Connect to contracts using fallback provider
    let currentDistributionIdResult;
    try {
      currentDistributionIdResult = await executeWithProviderFallback(async (provider) => {
        const merkleDistributor = new ethers.Contract(
          merkleDistributorAddress,
          MERKLE_DISTRIBUTOR_ABI,
          provider
        );

        // Get current distribution ID
        return await merkleDistributor.currentDistributionId();
      }, Number(process.env.NEXT_PUBLIC_CHAIN_ID || "8453"), { // Use chain ID from environment
        timeout: 15000, // Increased timeout
        maxRetries: 3,
        retryDelay: 2000,
        backoffMultiplier: 2
      });
    } catch (error) {
      console.log("No distributions found, returning empty history");
      return NextResponse.json([], {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
    }

    const currentDistributionId = BigInt(currentDistributionIdResult);

    // If no distributions exist, return empty array
    if (currentDistributionId === BigInt(0)) {
      return NextResponse.json([], {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
    }

    const maxDistributions = Number(currentDistributionId);

    const history: DistributionHistory[] = [];

    // Fetch history for only the latest 4 distributions to avoid rate limits
    const startDistributionId = Math.max(1, maxDistributions - 3); // Latest 4 distributions
    const endDistributionId = maxDistributions;

    console.log(
      `Fetching distributions ${startDistributionId} to ${endDistributionId} (latest 4)`
    );

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

    let supabaseData: any[] = [];

    // Determine chain ID and table name
    const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "8453");
    const tableName = getSupabaseTableName(chainId);
    
    // FORCE production to use merkle_distributions_prod
    // Only force if we're actually on production domain (not preview)
    const isProductionDeploy = process.env.CONTEXT === 'production' || process.env.URL?.includes('app.btc1usd.com');
    const finalTableName = isProductionDeploy
      ? 'merkle_distributions_prod'
      : tableName;
    
    console.log(`📊 Using Supabase table: ${finalTableName} for chain ${chainId} (context: ${process.env.CONTEXT})`);

    try {
      const { data, error } = await supabase
        .from(finalTableName)  // ✅ Use forced production table
        .select("id, merkle_root, claims, total_rewards, metadata")
        .gte("id", startDistributionId)
        .lte("id", endDistributionId)
        .order("id", { ascending: false });

      if (error) {
        throw new Error(`Supabase query error: ${error.message}`);
      }

      if (data && data.length > 0) {
        supabaseData = data.map((dist: any) => ({
          id: dist.id,
          merkleRoot: dist.merkle_root,
          totalRewards: dist.total_rewards,
          claims: dist.claims,
          metadata: dist.metadata
        }));
        console.log(`☁️ Loaded ${supabaseData.length} distributions from Supabase`);
      }
    } catch (supabaseError) {
      console.error("⚠️ Supabase loading failed:", supabaseError);
      return NextResponse.json(
        {
          error: "Failed to load distribution data from Supabase",
          details: supabaseError instanceof Error ? supabaseError.message : "Unknown error",
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

    // If no data found, return empty array
    if (!supabaseData || supabaseData.length === 0) {
      console.log("No distributions found in Supabase");
      return NextResponse.json([], {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
    }

    // Fetch distributions with a delay between each to avoid rate limits
    for (let i = endDistributionId; i >= startDistributionId; i--) {
      try {
        console.log(`Fetching distribution ${i}...`);
        
        const [root, totalTokens, totalClaimed, timestamp, finalized] =
          await executeWithProviderFallback(async (provider) => {
            const merkleDistributor = new ethers.Contract(
              merkleDistributorAddress,
              MERKLE_DISTRIBUTOR_ABI,
              provider
            );
            
            return await merkleDistributor.getDistributionInfo(i);
          }, Number(process.env.NEXT_PUBLIC_CHAIN_ID || "8453"), { // Use chain ID from environment
            timeout: 15000, // Increased timeout
            maxRetries: 3,
            retryDelay: 2000,
            backoffMultiplier: 2
          });

        const percentageClaimed =
          totalTokens > 0
            ? (Number(totalClaimed) * 100) / Number(totalTokens)
            : 0;

        // Try to load metadata from supabase/file-based data
        let activeHolders = 0;
        let isReclaimed = false;
        let distributionData = supabaseData.find((dist: any) => dist.id === i);
        
        if (distributionData) {
          activeHolders =
            distributionData.metadata?.activeHolders ||
            Object.keys(distributionData.claims || {}).length;
          // Check if this distribution has been reclaimed
          isReclaimed = distributionData.metadata?.reclaimed || false;
        }

        // Determine status
        let status: "active" | "completed" | "expired" | "reclaimed" = "active";
        if (isReclaimed) {
          status = "reclaimed";
        } else if (finalized) {
          status = "completed";
        } else if (i < maxDistributions) {
          status = "expired";
        }

        const distributionHistory: DistributionHistory = {
          distributionId: i.toString(),
          merkleRoot: root,
          totalRewards: totalTokens.toString(),
          totalClaimed: totalClaimed.toString(),
          percentageClaimed: Number(percentageClaimed.toFixed(2)),
          timestamp: new Date(Number(timestamp) * 1000).toISOString(),
          activeHolders,
          status,
        };

        history.push(distributionHistory);

        // Add a small delay to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.warn(`Failed to fetch distribution ${i}:`, error);
        // Fallback: Try to load from supabase/file-based data with zero claimed
        let distributionData = supabaseData.find((dist: any) => dist.id === i);
        
        if (distributionData) {
          const activeHolders = distributionData.metadata?.activeHolders || Object.keys(distributionData.claims || {}).length;

          const distributionHistory: DistributionHistory = {
            distributionId: i.toString(),
            merkleRoot: distributionData.merkleRoot,
            totalRewards: distributionData.totalRewards,
            totalClaimed: "0", // Cannot determine from file, assume 0
            percentageClaimed: 0,
            timestamp: distributionData.metadata?.generated || new Date().toISOString(),
            activeHolders,
            status: i < maxDistributions ? "expired" : "active",
          };

          history.push(distributionHistory);
          console.warn(`⚠️ Loaded distribution ${i} from supabase/file-based data (no on-chain data)`);
        }
        // Continue with next distribution instead of breaking
      }
    }

    // Sort by distribution ID (newest first)
    history.sort((a, b) => Number(b.distributionId) - Number(a.distributionId));

    console.log(`Successfully fetched ${history.length} distributions`);

    // Return with no-cache headers to ensure fresh data
    return NextResponse.json(history, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error("Error fetching distribution history:", error);

    // Fallback: Try to load all distributions from Supabase only
    if (isSupabaseConfigured() && supabase) {
      try {
        // Use same chain ID and table name as main query
        const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "8453");
        const tableName = getSupabaseTableName(chainId);
        
        // FORCE production to use merkle_distributions_prod
        const isProductionDeploy = process.env.CONTEXT === 'production' || process.env.URL?.includes('app.btc1usd.com');
        const finalTableName = isProductionDeploy
          ? 'merkle_distributions_prod'
          : tableName;
        
        console.log(`⚠️ Fallback: Using Supabase table ${finalTableName}`);
        
        const { data, error: supabaseError } = await supabase
          .from(finalTableName)  // ✅ Use forced production table
          .select("id, merkle_root, claims, total_rewards, metadata")
          .order("id", { ascending: false });

        if (!supabaseError && data && data.length > 0) {
          const fallbackData = data.map((dist: any) => ({
            id: dist.id,
            merkleRoot: dist.merkle_root,
            totalRewards: dist.total_rewards,
            claims: dist.claims,
            metadata: dist.metadata
          }));

          const fallbackHistory: DistributionHistory[] = fallbackData.map((dist: any) => {
            const activeHolders = dist.metadata?.activeHolders || Object.keys(dist.claims || {}).length;

            return {
              distributionId: dist.id.toString(),
              merkleRoot: dist.merkleRoot,
              totalRewards: dist.totalRewards,
              totalClaimed: "0", // Cannot determine from RPC failure
              percentageClaimed: 0,
              timestamp: dist.metadata?.generated || new Date().toISOString(),
              activeHolders,
              status: "active",
            };
          });

          fallbackHistory.sort((a, b) => Number(b.distributionId) - Number(a.distributionId));
          console.warn(`⚠️ Returning ${fallbackHistory.length} distributions from Supabase (RPC failed)`);
          return NextResponse.json(fallbackHistory, {
            headers: {
              'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
              'Pragma': 'no-cache',
              'Expires': '0',
            },
          });
        }
      } catch (supabaseError) {
        console.error("⚠️ Supabase fallback also failed:", supabaseError);
      }
    }

    return NextResponse.json(
      {
        error: "Failed to fetch distribution history",
        details: error instanceof Error ? error.message : "Unknown error",
        suggestions: [
          "Check your network connection",
          "Verify RPC configuration",
          "Try again in a few minutes"
        ]
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