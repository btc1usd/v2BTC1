"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { Alert, AlertDescription } from "./ui/alert";
import { Progress } from "./ui/progress";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits, parseUnits } from "viem";
import {
  CheckCircle,
  Clock,
  AlertCircle,
  Gift,
  Loader2,
  RefreshCw,
} from "lucide-react";

import { CONTRACT_ADDRESSES } from "@/lib/contracts";

const MERKLE_DISTRIBUTOR_ABI = [
  {
    inputs: [
      { internalType: "uint256", name: "distributionId", type: "uint256" },
      { internalType: "uint256", name: "index", type: "uint256" },
      { internalType: "address", name: "account", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "bytes32[]", name: "merkleProof", type: "bytes32[]" },
    ],
    name: "claim",
    outputs: [],
    stateMutability: "nonpayable",
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
  {
    inputs: [],
    name: "getCurrentDistributionStats",
    outputs: [
      { internalType: "uint256", name: "distributionId", type: "uint256" },
      { internalType: "uint256", name: "totalTokens", type: "uint256" },
      { internalType: "uint256", name: "totalClaimed", type: "uint256" },
      { internalType: "uint256", name: "percentageClaimed", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "distributionId", type: "uint256" },
      { internalType: "uint256", name: "index", type: "uint256" },
      { internalType: "address", name: "account", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "bytes32[]", name: "merkleProof", type: "bytes32[]" },
    ],
    name: "canClaim",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "merkleRoot",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
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
  {
    inputs: [
      { internalType: "uint256", name: "distributionId", type: "uint256" },
    ],
    name: "isDistributionComplete",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getAllDistributionIds",
    outputs: [{ internalType: "uint256[]", name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getIncompleteDistributionIds",
    outputs: [{ internalType: "uint256[]", name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
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
];

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
    reclaimed?: boolean;
    reclaimedAt?: string;
    reclaimedAmount?: string;
  };
}

interface DistributionInfo {
  id: number;
  merkleRoot: string;
  totalTokens: string;
  totalClaimed: string;
  timestamp: string;
  finalized: boolean;
  complete: boolean;
}

// New interface for multi-distribution response
interface MultiDistributionData {
  current: DistributionData;
  allDistributions: DistributionInfo[];
  incompleteDistributions: DistributionInfo[];
  userClaims: { [distributionId: string]: MerkleClaim };
}

// Update the interface to match the actual API response
interface UserDistribution {
  id: number;
  merkleRoot: string;
  totalRewards: string;
  metadata: {
    generated: string;
    activeHolders: number;
    reclaimed?: boolean;
    reclaimedAt?: string;
    reclaimedAmount?: string;
  };
  claim: MerkleClaim;
}

// Individual Distribution Claim Item Component (with claim status check)
const ClaimableDistributionItem = ({
  distId,
  claim,
  onClaim,
  isClaimLoading,
  isConfirming,
  isConnected,
  address,
  MERKLE_DISTRIBUTOR_ADDRESS,
  MERKLE_DISTRIBUTOR_ABI,
}: {
  distId: string;
  claim: MerkleClaim;
  onClaim: (distId: string, claim: MerkleClaim) => void;
  isClaimLoading: boolean;
  isConfirming: boolean;
  isConnected: boolean;
  address: string | undefined;
  MERKLE_DISTRIBUTOR_ADDRESS: string;
  MERKLE_DISTRIBUTOR_ABI: any;
}) => {
  // Check if this distribution has been claimed
  const { data: isClaimedData, isLoading: isCheckingClaimed } = useReadContract({
    address: MERKLE_DISTRIBUTOR_ADDRESS as `0x${string}`,
    abi: MERKLE_DISTRIBUTOR_ABI,
    functionName: "isClaimed",
    args: [BigInt(distId), BigInt(claim.index)],
    query: {
      enabled: isConnected && !!address,
    },
  });

  const isClaimed = !!isClaimedData;
  const rewardAmount = formatUnits(BigInt(claim.amount), 8);

  // Don't render if already claimed
  if (isClaimed) {
    return null;
  }

  return (
    <div key={distId} className="p-4 bg-gray-700 rounded-lg">
      <div className="flex justify-between items-center">
        <div>
          <div className="font-semibold text-white">Distribution #{distId}</div>
          <div className="text-sm text-gray-300">
            {rewardAmount} BTC1USD available
          </div>
        </div>
        <Button
          onClick={() => onClaim(distId, claim)}
          className="bg-blue-600 hover:bg-blue-700"
          disabled={isClaimLoading || isConfirming || isCheckingClaimed}
        >
          {isCheckingClaimed ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Checking...
            </>
          ) : (
            "Claim"
          )}
        </Button>
      </div>
      <div className="mt-2 text-xs text-gray-400">
        Distribution #{distId} • {rewardAmount} BTC1USD
      </div>
    </div>
  );
};

// List of Claimable Distributions (filters out claimed ones)
const ClaimableDistributionsList = ({
  userClaims,
  handleClaim,
  isClaimLoading,
  isConfirming,
  isConnected,
  address,
  MERKLE_DISTRIBUTOR_ADDRESS,
  MERKLE_DISTRIBUTOR_ABI,
}: {
  userClaims: { [distributionId: string]: MerkleClaim };
  handleClaim: (distId: string, claim: MerkleClaim) => void;
  isClaimLoading: boolean;
  isConfirming: boolean;
  isConnected: boolean;
  address: string | undefined;
  MERKLE_DISTRIBUTOR_ADDRESS: string;
  MERKLE_DISTRIBUTOR_ABI: any;
}) => {
  const [unclaimedCount, setUnclaimedCount] = useState(Object.keys(userClaims).length);

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Gift className="h-5 w-5" />
          Your Claimable Rewards
        </CardTitle>
        <CardDescription className="text-gray-400">
          Unclaimed rewards from previous distributions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.keys(userClaims).map((distId) => (
          <ClaimableDistributionItem
            key={distId}
            distId={distId}
            claim={userClaims[distId]}
            onClaim={handleClaim}
            isClaimLoading={isClaimLoading}
            isConfirming={isConfirming}
            isConnected={isConnected}
            address={address}
            MERKLE_DISTRIBUTOR_ADDRESS={MERKLE_DISTRIBUTOR_ADDRESS}
            MERKLE_DISTRIBUTOR_ABI={MERKLE_DISTRIBUTOR_ABI}
          />
        ))}
      </CardContent>
    </Card>
  );
};

// Individual Distribution Item Component
const DistributionItem = ({
  distribution,
  userClaimForDist,
  onClaim,
  isClaimLoading,
  isConfirming,
  isConnected,
  address,
  MERKLE_DISTRIBUTOR_ADDRESS,
  MERKLE_DISTRIBUTOR_ABI,
  metadata,
}: {
  distribution: DistributionInfo;
  userClaimForDist: MerkleClaim | undefined;
  onClaim: (distId: string, claim: MerkleClaim) => void;
  isClaimLoading: boolean;
  isConfirming: boolean;
  isConnected: boolean;
  address: string | undefined;
  MERKLE_DISTRIBUTOR_ADDRESS: string;
  MERKLE_DISTRIBUTOR_ABI: any;
  metadata?: {
    generated: string;
    activeHolders: number;
    reclaimed?: boolean;
    reclaimedAt?: string;
    reclaimedAmount?: string;
  };
}) => {
  const distId = distribution.id.toString();
  const hasUserClaimForDist = !!userClaimForDist;
  const isReclaimed = metadata?.reclaimed || false;
  
  // Check if the claim has expired (4 minutes = 240000 milliseconds)
  const isExpired = metadata?.generated 
    ? (Date.now() - new Date(metadata.generated).getTime()) > 240000 
    : false;

  // Only create isClaimed hook if user has a claim for this distribution
  const { data: isClaimedForDist } = useReadContract({
    address: MERKLE_DISTRIBUTOR_ADDRESS as `0x${string}`,
    abi: MERKLE_DISTRIBUTOR_ABI,
    functionName: "isClaimed",
    args:
      hasUserClaimForDist && userClaimForDist
        ? [BigInt(distId), BigInt(userClaimForDist.index)]
        : undefined,
    query: {
      enabled:
        isConnected && !!address && hasUserClaimForDist && !!userClaimForDist,
    },
  });

  const isClaimed = hasUserClaimForDist && !!isClaimedForDist;
  const rewardAmount = userClaimForDist
    ? formatUnits(BigInt(userClaimForDist.amount), 8)
    : "0";

  return (
    <div key={distId} className="p-4 bg-gray-700 rounded-lg">
      <div className="flex justify-between items-center">
        <div>
          <div className="font-semibold text-white">Distribution #{distId}</div>
          <div className="text-sm text-gray-300">
            {hasUserClaimForDist
              ? `${rewardAmount} BTC1USD available`
              : "No rewards for your address"}
          </div>
        </div>
        {hasUserClaimForDist ? (
          isReclaimed ? (
            <Badge variant="secondary" className="bg-red-600">
              <AlertCircle className="h-3 w-3 mr-1" />
              Reclaimed
            </Badge>
          ) : isClaimed ? (
            <Badge variant="secondary" className="bg-green-600">
              <CheckCircle className="h-3 w-3 mr-1" />
              Claimed
            </Badge>
          ) : isExpired ? (
            <Badge variant="secondary" className="bg-yellow-600">
              <Clock className="h-3 w-3 mr-1" />
              Expired
            </Badge>
          ) : (
            <Button
              onClick={() => onClaim(distId, userClaimForDist)}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={isClaimLoading || isConfirming}
            >
              Claim
            </Button>
          )
        ) : (
          <Badge variant="secondary" className="bg-gray-600">
            No Claim
          </Badge>
        )}
      </div>
      <div className="mt-2 text-xs text-gray-400">
        Generated:{" "}
        {new Date(parseInt(distribution.timestamp) * 1000).toLocaleDateString()}
        {distribution.finalized ? " • Finalized" : " • Active"}
        {hasUserClaimForDist && !isClaimed && (
          <span> • {rewardAmount} BTC1USD</span>
        )}
        {isExpired && hasUserClaimForDist && !isClaimed && (
          <span> • Reward Expired Will go Endowment</span>
        )}
      </div>
    </div>
  );
};

// Update the component to show all distributions, not just claimable ones
export default function EnhancedMerkleClaim({ isAdmin = false }: { isAdmin?: boolean }) {
  const { address, isConnected } = useAccount();
  const [distributionData, setDistributionData] =
    useState<DistributionData | null>(null);
  const [allDistributions, setAllDistributions] =
    useState<MultiDistributionData | null>(null);
  const [userClaim, setUserClaim] = useState<MerkleClaim | null>(null);
  const [userClaims, setUserClaims] = useState<{
    [distributionId: string]: MerkleClaim;
  }>({});
  const [allUserDistributions, setAllUserDistributions] = useState<UserDistribution[]>([]); // New state for all user distributions
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Load distribution data - moved to component scope
  const loadDistributionData = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log("=== Loading distribution data ===");
      console.log("Current address:", address);

      // Make API call with user address to get all their claims
      // Normalize address to lowercase for consistent matching
      const normalizedAddress = address?.toLowerCase();
      const apiUrl = normalizedAddress
        ? `/api/merkle-distributions/latest?address=${normalizedAddress}`
        : "/api/merkle-distributions/latest";

      console.log("Making API call to", apiUrl);
      const response = await fetch(apiUrl);
      console.log("API Response status:", response.status);
      console.log("API Response headers:", [...response.headers.entries()]);

      if (!response.ok) {
        const errorText = await response.text();
        console.log("API Error response:", errorText);
        throw new Error(
          `Failed to load distribution data: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data: {
        address: string;
        count: number;
        userDistributions: UserDistribution[];
      } = await response.json();

      console.log("=== API RESPONSE DATA ===");
      console.log("User address:", data.address);
      console.log("Total distributions:", data.count);
      console.log("User distributions:", data.userDistributions);

      // Set all user distributions (including already claimed ones)
      setAllUserDistributions(data.userDistributions);

      // Set user claims from the API response
      const userClaimsMap: { [distributionId: string]: MerkleClaim } = {};
      data.userDistributions.forEach((dist) => {
        userClaimsMap[dist.id.toString()] = dist.claim;
      });
      setUserClaims(userClaimsMap);
      console.log("User claims map:", userClaimsMap);

      // Set the first (latest) distribution as the current one
      if (data.userDistributions.length > 0) {
        const latestDistribution = data.userDistributions[0];
        const distributionData: DistributionData = {
          distributionId: latestDistribution.id.toString(),
          merkleRoot: latestDistribution.merkleRoot,
          totalRewards: latestDistribution.totalRewards,
          claims: {
            [address?.toLowerCase() || ""]: latestDistribution.claim,
          },
          metadata: latestDistribution.metadata,
        };
        setDistributionData(distributionData);
        setUserClaim(latestDistribution.claim);
        console.log("Set current distribution data:", distributionData);
      } else {
        // No distributions found
        setDistributionData({
          distributionId: "0",
          merkleRoot:
            "0x0000000000000000000000000000000000000000000000000000000000000000",
          totalRewards: "0",
          claims: {},
          metadata: {
            generated: new Date().toISOString(),
            activeHolders: 0,
          },
        });
        setUserClaim(null);
      }

      // Set all distributions data to show all user's distributions
      setAllDistributions({
        current: distributionData || {
          distributionId: "0",
          merkleRoot:
            "0x0000000000000000000000000000000000000000000000000000000000000000",
          totalRewards: "0",
          claims: {},
          metadata: {
            generated: new Date().toISOString(),
            activeHolders: 0,
          },
        },
        allDistributions: data.userDistributions.map((dist) => ({
          id: dist.id,
          merkleRoot: dist.merkleRoot,
          totalTokens: dist.totalRewards,
          totalClaimed: "0", // We don't have this data from the API
          timestamp: dist.metadata?.generated
            ? new Date(dist.metadata.generated).getTime().toString()
            : "0",
          finalized: false, // We don't have this data from the API
          complete: false, // We don't have this data from the API
        })),
        incompleteDistributions: [], // We don't have this data from the API
        userClaims: userClaimsMap,
      });
    } catch (err) {
      console.error("❌ Error loading distribution data:", err);
      console.error(
        "Error stack:",
        err instanceof Error ? err.stack : "No stack trace"
      );
      setError(
        err instanceof Error ? err.message : "Failed to load distribution data"
      );
    } finally {
      setLoading(false);
      console.log("=== Finished loading distribution data ===");
    }
  };

  // Contract address - use centralized configuration
  const MERKLE_DISTRIBUTOR_ADDRESS = CONTRACT_ADDRESSES.MERKLE_DISTRIBUTOR;

  // Fetch distribution stats
  const {
    data: distributionStats,
    isLoading: statsLoading,
    isError: statsError,
    error: statsErrorDetails,
    refetch: refetchStats,
  } = useReadContract({
    address: MERKLE_DISTRIBUTOR_ADDRESS as `0x${string}`,
    abi: MERKLE_DISTRIBUTOR_ABI,
    functionName: "getCurrentDistributionStats",
    query: {
      enabled: isConnected,
    },
  });

  // Check if user's claim is already claimed
  const {
    data: isClaimedData,
    isLoading: isCheckingClaimed,
    isError: claimCheckError,
    error: claimCheckErrorDetails,
    refetch: refetchClaimStatus,
  } = useReadContract({
    address: MERKLE_DISTRIBUTOR_ADDRESS as `0x${string}`,
    abi: MERKLE_DISTRIBUTOR_ABI,
    functionName: "isClaimed",
    args:
      userClaim && distributionData
        ? [BigInt(distributionData.distributionId), BigInt(userClaim.index)]
        : undefined,
    query: {
      enabled: !!(userClaim && distributionData),
    },
  });

  // Write contract hook
  const {
    writeContract,
    isPending: isClaimLoading,
    data: claimData,
  } = useWriteContract();

  // Wait for transaction receipt
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: claimData,
    });

  // Track claim success state
  const [claimSuccess, setClaimSuccess] = useState(false);

  // Refresh claim status when transaction is confirmed
  useEffect(() => {
    if (isConfirmed) {
      // Set claim success state
      setClaimSuccess(true);

      // Invalidate the cache and mark claim in distribution file
      const invalidateCacheAndMarkClaim = async () => {
        if (userClaim && distributionData && address) {
          try {
            // Invalidate cache
            await fetch('/api/merkle-distributions/latest', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                contractAddress: MERKLE_DISTRIBUTOR_ADDRESS,
                distributionId: distributionData.distributionId,
                index: userClaim.index,
              }),
            });
            console.log('✅ Cache invalidated for claimed distribution');

            // Mark claim in distribution file
            const markClaimResponse = await fetch('/api/merkle-distributions/mark-claim', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                distributionId: distributionData.distributionId.toString(),
                userAddress: address,
                claimedAmount: userClaim.amount,
                txHash: claimData
              }),
            });

            if (markClaimResponse.ok) {
              const result = await markClaimResponse.json();
              console.log('✅ Claim marked in distribution file:', result);

              if (result.fullyClaimed) {
                console.log('🎉 Distribution is now FULLY CLAIMED!');
              } else {
                console.log(`📊 Progress: ${result.claimedCount}/${result.totalClaims} claims`);
              }
            } else {
              console.warn('Failed to mark claim in file:', await markClaimResponse.text());
            }
          } catch (error) {
            console.warn('Failed to invalidate cache or mark claim:', error);
          }
        }
      };

      // Run cache invalidation and claim marking
      invalidateCacheAndMarkClaim();

      // Small delay to ensure blockchain state has updated
      setTimeout(() => {
        // Reload the page to refresh the distribution data
        window.location.reload();
      }, 3000);
    }
  }, [isConfirmed]);

  // Define variables in correct order
  const hasUserClaim = !!userClaim;
  const isAlreadyClaimed = !!isClaimedData;
  const isReclaimed = distributionData?.metadata?.reclaimed || false;
  
  // Check if the claim has expired (4 minutes = 240000 milliseconds)
  const isExpired = distributionData?.metadata?.generated 
    ? (Date.now() - new Date(distributionData.metadata.generated).getTime()) > 240000 
    : false;
  
  const canUserClaim =
    hasUserClaim &&
    !isAlreadyClaimed &&
    !isCheckingClaimed &&
    !isClaimLoading &&
    !isConfirming &&
    !isReclaimed &&
    !isExpired;

  // Debug logging
  useEffect(() => {
    console.log("=== EnhancedMerkleClaim Debug ===");
    console.log("isConnected:", isConnected);
    console.log("address:", address);
    console.log("address type:", typeof address);
    console.log("address length:", address ? address.length : 0);
    console.log("userClaim:", userClaim);
    console.log("distributionData:", distributionData);
    console.log("loading:", loading);
    console.log("statsLoading:", statsLoading);
    console.log("statsError:", statsError);
    console.log("statsErrorDetails:", statsErrorDetails?.message);
    console.log("error:", error);
    console.log("isClaimedData:", isClaimedData);
    console.log("isCheckingClaimed:", isCheckingClaimed);
    console.log("claimCheckError:", claimCheckError);
    console.log("claimCheckErrorDetails:", claimCheckErrorDetails?.message);
  }, [
    isConnected,
    address,
    userClaim,
    distributionData,
    loading,
    statsLoading,
    statsError,
    statsErrorDetails,
    error,
    isClaimedData,
    isCheckingClaimed,
    claimCheckError,
    claimCheckErrorDetails,
  ]);

  // Refresh data
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDistributionData();
    await refetchStats();
    await refetchClaimStatus();
    setRefreshing(false);
  };

  // Handle claim
  const handleClaim = async (distributionId?: string, claim?: MerkleClaim) => {
    // Use provided claim or fallback to current userClaim
    const claimToUse = claim || userClaim;
    const distributionToUse =
      distributionId || distributionData?.distributionId;

    if (!claimToUse || !distributionToUse) {
      console.error("No user claim or distribution data available");
      setError("No claim data available. Please refresh and try again.");
      return;
    }

    console.log("Attempting to claim reward:", {
      distributionId: distributionToUse,
      index: claimToUse.index,
      account: claimToUse.account,
      amount: claimToUse.amount,
      proofLength: claimToUse.proof.length,
      contract: MERKLE_DISTRIBUTOR_ADDRESS,
    });

    try {
      writeContract({
        address: MERKLE_DISTRIBUTOR_ADDRESS as `0x${string}`,
        abi: MERKLE_DISTRIBUTOR_ABI,
        functionName: "claim",
        args: [
          BigInt(distributionToUse),
          BigInt(claimToUse.index),
          claimToUse.account as `0x${string}`,
          BigInt(claimToUse.amount),
          claimToUse.proof as `0x${string}`[],
        ],
      });
    } catch (error) {
      console.error("Error initiating claim transaction:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to initiate claim transaction"
      );
    }
  };

  // Load data on mount and when address changes
  useEffect(() => {
    console.log("=== useEffect triggered ===");
    console.log("isConnected:", isConnected);
    console.log("address:", address);
    console.log("loading state:", loading);

    if (isConnected && address) {
      console.log(
        "Loading distribution data because isConnected and address are present"
      );
      loadDistributionData();
    } else if (isConnected && !address) {
      console.log("Connected but no address, will wait for address");
      // Don't set loading to false here, wait for address to be available
    } else if (!isConnected) {
      console.log("Not connected, setting loading to false");
      setLoading(false);
    } else {
      console.log("Unexpected state, setting loading to false");
      setLoading(false);
    }
  }, [address, isConnected]);

  // Additional useEffect to handle case where address becomes available after initial render
  useEffect(() => {
    console.log("=== Address change useEffect triggered ===");
    console.log("isConnected:", isConnected);
    console.log("address:", address);
    console.log("loading state:", loading);
    console.log("distributionData:", distributionData);

    // If we're connected, have an address, but haven't loaded data yet
    if (isConnected && address && !distributionData && loading) {
      console.log("Loading distribution data because address became available");
      loadDistributionData();
    }
  }, [address, isConnected, distributionData, loading]);

  if (!isConnected) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Merkle Rewards
          </CardTitle>
          <CardDescription className="text-gray-400">
            Claim your BTC1USD rewards (7-hour distribution cycle)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please connect your wallet to check for available rewards.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (loading || statsLoading) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Merkle Rewards
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && !distributionData) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Merkle Rewards
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="mt-4 flex justify-center">
            <Button onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const stats = distributionStats as
    | [bigint, bigint, bigint, bigint]
    | undefined;
  const totalTokens = stats ? formatUnits(stats[1], 8) : "0";
  const totalClaimed = stats ? formatUnits(stats[2], 8) : "0";
  const percentageClaimed = stats ? Number(stats[3]) / 100 : 0;

  const userRewardAmount = userClaim
    ? formatUnits(userClaim.amount as any, 8)
    : "0";

  return (
    <div className="space-y-6">
      {/* Distribution Overview - Admin Only */}
      {isAdmin && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-white flex items-center gap-2">
                  <Gift className="h-5 w-5" />
                  Current Distribution
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Distribution #{distributionData?.distributionId} •{" "}
                  {distributionData?.metadata?.activeHolders || 0} holders
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="text-gray-300 border-gray-600 hover:bg-gray-700"
              >
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">
                  {totalTokens}
                </div>
                <div className="text-sm text-gray-400">Total BTC1USD</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-500">
                  {totalClaimed}
                </div>
                <div className="text-sm text-gray-400">Claimed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-500">
                  {percentageClaimed.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-400">Progress</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Claim Progress</span>
                <span className="text-white">
                  {percentageClaimed.toFixed(1)}%
                </span>
              </div>
              <Progress
                value={percentageClaimed}
                className="w-full bg-gray-700"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* All User Distributions Section - Show ALL distributions the user has claims for (including already claimed) */}
      {allUserDistributions && allUserDistributions.length > 0 && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Gift className="h-5 w-5" />
              Your Distribution History
            </CardTitle>
            <CardDescription className="text-gray-400">
              All distributions with rewards for your address
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {allUserDistributions.map((dist) => (
              <DistributionItem
                key={dist.id}
                distribution={{
                  id: dist.id,
                  merkleRoot: dist.merkleRoot,
                  totalTokens: dist.totalRewards,
                  totalClaimed: "0",
                  timestamp: dist.metadata?.generated
                    ? new Date(dist.metadata.generated).getTime().toString()
                    : "0",
                  finalized: false,
                  complete: false,
                }}
                userClaimForDist={dist.claim}
                onClaim={handleClaim}
                isClaimLoading={isClaimLoading}
                isConfirming={isConfirming}
                isConnected={isConnected}
                address={address}
                MERKLE_DISTRIBUTOR_ADDRESS={MERKLE_DISTRIBUTOR_ADDRESS}
                MERKLE_DISTRIBUTOR_ABI={MERKLE_DISTRIBUTOR_ABI}
                metadata={dist.metadata}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* User Claim Status (Current Distribution) */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Your Current Reward
          </CardTitle>
          <CardDescription className="text-gray-400">
            {address
              ? `Connected: ${address.slice(0, 6)}...${address.slice(-4)}`
              : "Not connected"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasUserClaim ? (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No rewards available for your address in the current
                  distribution.
                </AlertDescription>
              </Alert>

              {/* Debug Information */}
              <Alert className="bg-gray-900 border-gray-600">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-gray-300">
                  <div className="text-sm space-y-1">
                    <div>
                      <strong>Debug Info:</strong>
                    </div>
                    <div>
                      • Distribution ID:{" "}
                      {distributionData?.distributionId || "None"}
                    </div>
                    <div>
                      • Total Claims:{" "}
                      {distributionData?.claims
                        ? Object.keys(distributionData.claims).length
                        : 0}
                    </div>
                    <div>
                      • Your Address: {address?.slice(0, 10)}...
                      {address?.slice(-4)}
                    </div>
                    <div>• Has Claim Data: {hasUserClaim ? "Yes" : "No"}</div>
                    {distributionData?.claims &&
                      Object.keys(distributionData.claims).length > 0 && (
                        <div>
                          • Available for:{" "}
                          {Object.keys(distributionData.claims)
                            .map(
                              (addr) =>
                                `${addr.slice(0, 6)}...${addr.slice(-4)}`
                            )
                            .join(", ")}
                        </div>
                      )}
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                <div>
                  <div className="text-lg font-semibold text-white">
                    {userRewardAmount} BTC1USD
                  </div>
                  <div className="text-sm text-gray-400">Available reward</div>
                </div>
                <div className="flex items-center gap-2">
                  {isReclaimed ? (
                    <Badge variant="secondary" className="bg-red-600">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Reclaimed
                    </Badge>
                  ) : isAlreadyClaimed ? (
                    <Badge variant="secondary" className="bg-green-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Claimed
                    </Badge>
                  ) : isExpired ? (
                    <Badge variant="secondary" className="bg-yellow-600">
                      <Clock className="h-3 w-3 mr-1" />
                      Expired
                    </Badge>
                  ) : canUserClaim ? (
                    <Badge variant="secondary" className="bg-blue-600">
                      <Clock className="h-3 w-3 mr-1" />
                      Ready
                    </Badge>
                  ) : isClaimLoading || isConfirming ? (
                    <Badge variant="secondary" className="bg-yellow-600">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Processing
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-gray-600">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Pending
                    </Badge>
                  )}
                </div>
              </div>

              <Separator className="bg-gray-600" />

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Claim Index:</span>
                  <span className="text-white">#{userClaim.index}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Status:</span>
                  <span className="text-white">
                    {isReclaimed
                      ? "Reclaimed by admin"
                      : isCheckingClaimed
                      ? "Checking..."
                      : isAlreadyClaimed
                      ? "Already claimed"
                      : isExpired
                      ? "Reward Expired Will go to Endowment"
                      : isClaimLoading
                      ? "Claim in progress..."
                      : isConfirming
                      ? "Confirming transaction..."
                      : isConfirmed
                      ? "Claim confirmed!"
                      : canUserClaim
                      ? "Ready to claim"
                      : "Pending verification"}
                  </span>
                </div>
              </div>

              {!isAlreadyClaimed && !isReclaimed && !isExpired && (
                <Button
                  onClick={() => handleClaim()}
                  disabled={!canUserClaim || isClaimLoading || isConfirming}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {isClaimLoading || isConfirming ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isClaimLoading ? "Processing Claim..." : "Confirming..."}
                    </>
                  ) : (
                    "Claim Reward"
                  )}
                </Button>
              )}

              {isExpired && (
                <Alert className="border-yellow-600 bg-yellow-900/50">
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                  <AlertDescription className="text-yellow-200">
                    Reward Expired Will go  to Endowment
                  </AlertDescription>
                </Alert>
              )}

              {isReclaimed && (
                <Alert className="border-red-600 bg-red-900/50">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <AlertDescription className="text-red-200">
                    This distribution has been reclaimed by the admin. Rewards are no longer available.
                  </AlertDescription>
                </Alert>
              )}

              {(isClaimLoading || isConfirming) && (
                <Alert className="border-yellow-600 bg-yellow-900/50">
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                  <AlertDescription className="text-yellow-200">
                    Please confirm the transaction in your wallet and wait for
                    it to be processed on the blockchain.
                  </AlertDescription>
                </Alert>
              )}

              {claimSuccess && (
                <Alert className="border-green-600 bg-green-900/50">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <AlertDescription className="text-green-200">
                    Reward claimed successfully! Your BTC1USD tokens have been
                    transferred to your wallet. Refreshing distributions...
                  </AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white text-sm">
            How It Works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-400">
          <div>
            • If the vault collateral ratio {'>'} 1.12% then
          </div>
          <div>
            • rewards are distributed every 7 hours based on your BTC1USD balance.
          </div>
          <div>
            • You can claim your rewards within 10 hours.
          </div>
          <div>
            • After 10 hours, unclaimed rewards expire.
          </div>
          <div>• The system is fully decentralized, permissionless and automated.</div>
        </CardContent>
      </Card>
    </div>
  );
}
