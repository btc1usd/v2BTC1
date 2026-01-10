import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { executeWithProviderFallback } from "@/lib/rpc-provider";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ================= CACHE ================= */

const CLAIM_STATUS_CACHE = new Map<
  string,
  { claimed: boolean; timestamp: number }
>();
const CLAIM_STATUS_TTL = 30_000;

/* ================= ABI ================= */

const MERKLE_DISTRIBUTOR_ABI = [
  {
    inputs: [{ name: "distributionId", type: "uint256" }],
    name: "getDistributionInfo",
    outputs: [
      { name: "root", type: "bytes32" },
      { name: "totalTokens", type: "uint256" },
      { name: "totalClaimed", type: "uint256" },
      { name: "timestamp", type: "uint256" },
      { name: "finalized", type: "bool" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { name: "distributionId", type: "uint256" },
      { name: "index", type: "uint256" }
    ],
    name: "isClaimed",
    outputs: [{ type: "bool" }],
    stateMutability: "view",
    type: "function"
  }
];

function getContractAddress(): string {
  const addr = process.env.NEXT_PUBLIC_MERKLE_DISTRIBUTOR_CONTRACT;
  if (!addr) throw new Error("Merkle Distributor not set");
  return addr;
}

/* ================= HELPERS ================= */

function safeJsonParse<T>(value: any, fallback: T): T {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function findUserClaim(
  claims: Record<string, any> | any[],
  userAddress: string
) {
  const addr = userAddress.toLowerCase();

  if (Array.isArray(claims)) {
    return claims.find(c => c?.account?.toLowerCase() === addr);
  }

  for (const v of Object.values(claims || {})) {
    if (v?.account?.toLowerCase() === addr) return v;
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
        return contract.isClaimed(distributionId, index);
      },
      Number(process.env.NEXT_PUBLIC_CHAIN_ID || "8453")
    );

    CLAIM_STATUS_CACHE.set(key, { claimed, timestamp: Date.now() });
    return claimed;
  } catch {
    return false;
  }
}

/* ================= GET ================= */

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }

  if (!supabase || !isSupabaseConfigured()) {
    return NextResponse.json({ count: 0, userDistributions: [] });
  }

  const userAddress = address.toLowerCase();
  const contractAddress = getContractAddress();

  const { data } = await supabase
    .from("merkle_distributions_prod")
    .select("id, merkle_root, claims, total_rewards, metadata")
    .order("id", { ascending: false })
    .limit(10);

  if (!data) {
    return NextResponse.json({ count: 0, userDistributions: [] });
  }

  const parsed = data.map((row) => ({
    ...row,
    claims: safeJsonParse<Record<string, any>>(row.claims, {}),
    metadata: safeJsonParse<Record<string, any>>(row.metadata, {})
  }));

  const verified = await Promise.all(
    parsed.map(async (dist) => {
      try {
        const [root, totalTokens, totalClaimed, timestamp, finalized] =
          await executeWithProviderFallback(
            async (provider) => {
              const c = new ethers.Contract(
                contractAddress,
                MERKLE_DISTRIBUTOR_ABI,
                provider
              );
              return c.getDistributionInfo(BigInt(dist.id));
            },
            Number(process.env.NEXT_PUBLIC_CHAIN_ID || "8453")
          );

        if (root.toLowerCase() !== dist.merkle_root.toLowerCase()) return null;

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

/* ================= POST ================= */

export async function POST(req: NextRequest) {
  const { contractAddress, distributionId, index } = await req.json();
  const key = `${contractAddress}:${distributionId}:${index}`;
  CLAIM_STATUS_CACHE.delete(key);
  return NextResponse.json({ success: true });
}
