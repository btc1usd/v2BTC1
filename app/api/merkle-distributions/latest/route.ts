import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { executeWithProviderFallback } from "@/lib/rpc-provider";

/* Force dynamic execution */
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ============================================================
   CACHE SETTINGS
============================================================ */
const CLAIM_STATUS_CACHE = new Map<
  string,
  { claimed: boolean; timestamp: number }
>();
const CLAIM_STATUS_TTL = 30 * 1000;

/* ============================================================
   CONTRACT ABI
============================================================ */
const MERKLE_DISTRIBUTOR_ABI = [
  {
    inputs: [{ internalType: "uint256", name: "distributionId", type: "uint256" }],
    name: "getDistributionInfo",
    outputs: [
      { internalType: "bytes32", name: "root", type: "bytes32" },
      { internalType: "uint256", name: "totalTokens", type: "uint256" },
      { internalType: "uint256", name: "totalClaimed", type: "uint256" },
      { internalType: "uint256", name: "timestamp", type: "uint256" },
      { internalType: "bool", name: "finalized", type: "bool" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { internalType: "uint256", name: "distributionId", type: "uint256" },
      { internalType: "uint256", name: "index", type: "uint256" }
    ],
    name: "isClaimed",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function"
  }
];

function getContractAddress(): string {
  const addr = process.env.NEXT_PUBLIC_MERKLE_DISTRIBUTOR_CONTRACT;
  if (!addr) throw new Error("Merkle Distributor contract not set");
  return addr;
}

/* ============================================================
   HELPERS
============================================================ */

/* Safe JSON parse for Supabase string columns */
function safeJsonParse<T>(value: any, fallback: T): T {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/* Find user claim regardless of claim key structure */
function findUserClaim(
  claims: Record<string, any>,
  userAddress: string
) {
  const addr = userAddress.toLowerCase();

  for (const value of Object.values(claims || {})) {
    if (value?.account?.toLowerCase() === addr) {
      return value;
    }
  }

  return null;
}

async function checkClaimStatusCached(
  contractAddress: string,
  distributionId: bigint,
  index: bigint
): Promise<boolean> {
  const key = `${contractAddress}:${distributionId}:${index}`;
  const cached = CLAIM_STATUS_CACHE.get(key);

  if (cached && Date.now() - cached.timestamp < CLAIM_STATUS_TTL) {
    return cached.claimed;
  }

  try {
    const claimed = await executeWithProviderFallback(
      async (provider) => {
        const contract = new ethers.Contract(
          contractAddress,
          MERKLE_DISTRIBUTOR_ABI,
          provider
        );
        return await contract.isClaimed(distributionId, index);
      },
      Number(process.env.NEXT_PUBLIC_CHAIN_ID || "8453"),
      { timeout: 15000, maxRetries: 3 }
    );

    CLAIM_STATUS_CACHE.set(key, { claimed, timestamp: Date.now() });
    return claimed;
  } catch {
    return false;
  }
}

/* ============================================================
   GET HANDLER
============================================================ */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const userAddress = url.searchParams.get("address")?.toLowerCase();

  if (!userAddress) {
    return NextResponse.json({ error: "Missing address parameter" }, { status: 400 });
  }

  if (!isSupabaseConfigured() || !supabase) {
    return NextResponse.json(
      { count: 0, userDistributions: [] },
      { status: 500 }
    );
  }

  const contractAddress = getContractAddress();

  const { data } = await supabase
    .from("merkle_distributions_prod")
    .select("id, merkle_root, claims, total_rewards, metadata")
    .order("id", { ascending: false })
    .limit(10);

  if (!data || data.length === 0) {
    return NextResponse.json({ count: 0, userDistributions: [] });
  }

  /* Parse Supabase rows */
  const parsed = data.map((row: any) => ({
    id: row.id,
    merkle_root: row.merkle_root,
    total_rewards: row.total_rewards,
    claims: safeJsonParse<Record<string, any>>(row.claims, {}),
    metadata: safeJsonParse<Record<string, any>>(row.metadata, {})
  }));

  /* Verify on-chain */
  const verified = await Promise.all(
    parsed.map(async (dist) => {
      try {
        const [root, totalTokens, totalClaimed, timestamp, finalized] =
          await executeWithProviderFallback(
            async (provider) => {
              const contract = new ethers.Contract(
                contractAddress,
                MERKLE_DISTRIBUTOR_ABI,
                provider
              );
              return await contract.getDistributionInfo(BigInt(dist.id));
            },
            Number(process.env.NEXT_PUBLIC_CHAIN_ID || "8453")
          );

        if (root.toLowerCase() !== dist.merkle_root.toLowerCase()) {
          return null;
        }

        return {
          ...dist,
          merkleRoot: root,
          totalTokens: totalTokens.toString(),
          totalClaimed: totalClaimed.toString(),
          timestamp: Number(timestamp),
          finalized
        };
      } catch {
        return null;
      }
    })
  );

  /* Extract user distributions */
  const userDistributions = await Promise.all(
    verified.filter(Boolean).map(async (dist: any) => {
      const claim = findUserClaim(dist.claims, userAddress);
      if (!claim) return null;

      if (dist.metadata?.reclaimed === true) return null;

      const claimedOnChain = await checkClaimStatusCached(
        contractAddress,
        BigInt(dist.id),
        BigInt(String(claim.index))
      );

      return {
        id: dist.id,
        merkleRoot: dist.merkleRoot,
        totalRewards: dist.total_rewards,
        totalTokens: dist.totalTokens,
        totalClaimed: dist.totalClaimed,
        timestamp: dist.timestamp,
        finalized: dist.finalized,
        metadata: dist.metadata,
        claim,
        claimedOnChain
      };
    })
  );

  const result = userDistributions.filter(Boolean);

  return NextResponse.json({
    address: userAddress,
    count: result.length,
    userDistributions: result
  });
}

/* ============================================================
   POST: CACHE INVALIDATION
============================================================ */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { contractAddress, distributionId, index } = body;

  if (!contractAddress || distributionId == null || index == null) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const key = `${contractAddress}:${distributionId}:${index}`;
  CLAIM_STATUS_CACHE.delete(key);

  for (const k of CLAIM_STATUS_CACHE.keys()) {
    if (k.includes(`:${distributionId}:`)) {
      CLAIM_STATUS_CACHE.delete(k);
    }
  }

  return NextResponse.json({ success: true });
}
