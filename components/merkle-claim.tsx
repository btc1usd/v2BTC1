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
import { CheckCircle, Clock, AlertCircle, Gift, Loader2 } from "lucide-react";

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
  };
}

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

import { CONTRACT_ADDRESSES } from "@/lib/contracts";

export default function MerkleClaim() {
  const { address, isConnected } = useAccount();
  const [distributionData, setDistributionData] =
    useState<DistributionData | null>(null);
  const [userClaim, setUserClaim] = useState<MerkleClaim | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Contract address - use centralized configuration
  const MERKLE_DISTRIBUTOR_ADDRESS = CONTRACT_ADDRESSES.MERKLE_DISTRIBUTOR;

  // Fetch distribution stats
  const { data: distributionStats, isLoading: statsLoading } = useReadContract({
    address: MERKLE_DISTRIBUTOR_ADDRESS as `0x${string}`,
    abi: MERKLE_DISTRIBUTOR_ABI,
    functionName: "getCurrentDistributionStats",
    query: {
      enabled: isConnected,
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

      // Invalidate the cache for this specific claim
      const invalidateCache = async () => {
        if (userClaim && distributionData) {
          try {
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
            console.log('Cache invalidated for claimed distribution');
          } catch (error) {
            console.warn('Failed to invalidate cache:', error);
          }
        }
      };

      // Run cache invalidation
      invalidateCache();

      // Small delay to ensure blockchain state has updated
      setTimeout(() => {
        // Reload the page to refresh the distribution data
        window.location.reload();
      }, 3000);
    }
  }, [isConfirmed]);

  // Add refetch function for claim status
  const {
    data: isClaimedData,
    isLoading: isCheckingClaimed,
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

  // Define variables in correct order
  const hasUserClaim = !!userClaim;
  const isAlreadyClaimed = !!isClaimedData;
  const isReclaimed = distributionData?.metadata?.reclaimed || false;
  
  // Check if the claim has expired (10 hours = 36000000 milliseconds)
  const isExpired = distributionData?.metadata?.generated
    ? (Date.now() - new Date(distributionData.metadata.generated).getTime()) > 36000000
    : false;
  
  // Users can only claim if:
  // 1. They have a claim
  // 2. The claim hasn't been claimed already
  // 3. The claim hasn't been reclaimed
  // 4. The claim hasn't expired (10-hour limit)
  const canUserClaim = hasUserClaim && !isAlreadyClaimed && !isCheckingClaimed && !isReclaimed && !isExpired;

  // Refresh claim status when transaction is confirmed
  useEffect(() => {
    if (isConfirmed) {
      // Small delay to ensure blockchain state has updated
      setTimeout(() => {
        refetchClaimStatus();
      }, 2000);
    }
  }, [isConfirmed]);

  // Load distribution data
  useEffect(() => {
    const loadDistributionData = async () => {
      try {
        setLoading(true);
        console.log("Loading distribution data...");

        // Make API call with user address
        const normalizedAddress = address?.toLowerCase();
        const apiUrl = normalizedAddress
          ? `/api/merkle-distributions/latest?address=${normalizedAddress}`
          : "/api/merkle-distributions/latest";

        const response = await fetch(apiUrl);
        
        // Check if response is ok, but still process data even if there are issues
        const data: {
          address: string;
          count: number;
          userDistributions: {
            id: number;
            merkleRoot: string;
            totalRewards: string;
            metadata: {
              generated: string;
              activeHolders: number;
            };
            claim: MerkleClaim;
          }[];
        } = await response.json();

        console.log("Distribution data loaded:", data);

        // Use the first (latest) distribution
        if (data.userDistributions && data.userDistributions.length > 0) {
          const latestDist = data.userDistributions[0];
          const distributionData: DistributionData = {
            distributionId: latestDist.id.toString(),
            merkleRoot: latestDist.merkleRoot,
            totalRewards: latestDist.totalRewards,
            claims: {
              [address?.toLowerCase() || ""]: latestDist.claim,
            },
            metadata: latestDist.metadata,
          };

          console.log("User claim found:", latestDist.claim);
          setDistributionData(distributionData);
          setUserClaim(latestDist.claim);
        } else {
          console.log("No claim found for address:", address);
          setUserClaim(null);

          // Set empty distribution data
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
        }
      } catch (err) {
        console.error("Error loading distribution data:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load distribution data"
        );

        // For demo purposes, create mock data with a claim for the connected user
        if (address) {
          const mockDistributionData: DistributionData = {
            distributionId: "1",
            merkleRoot:
              "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            totalRewards: "1000000000", // 10 BTC1USD
            claims: {
              [address]: {
                index: 0,
                account: address,
                amount: "100000000", // 1 BTC1USD
                proof: [
                  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
                  "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
                ],
              },
            },
            metadata: {
              generated: new Date().toISOString(),
              activeHolders: 1,
            },
          };

          console.log("Created mock distribution data with user claim");
          setDistributionData(mockDistributionData);
          setUserClaim(mockDistributionData.claims[address]);
        } else {
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
        }
      } finally {
        setLoading(false);
      }
    };

    if (isConnected) {
      loadDistributionData();
    }
  }, [address, isConnected]);

  const handleClaim = async () => {
    if (!userClaim || !distributionData) {
      console.error("No user claim or distribution data available");
      return;
    }

    console.log("Attempting to claim reward:", {
      distributionId: distributionData.distributionId,
      index: userClaim.index,
      account: userClaim.account,
      amount: userClaim.amount,
      proofLength: userClaim.proof.length,
      contract: MERKLE_DISTRIBUTOR_ADDRESS,
    });

    try {
      writeContract({
        address: MERKLE_DISTRIBUTOR_ADDRESS as `0x${string}`,
        abi: MERKLE_DISTRIBUTOR_ABI,
        functionName: "claim",
        args: [
          BigInt(distributionData.distributionId),
          BigInt(userClaim.index),
          userClaim.account as `0x${string}`,
          BigInt(userClaim.amount),
          userClaim.proof as `0x${string}`[],
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

  if (!isConnected) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Merkle Rewards
          </CardTitle>
          <CardDescription className="text-gray-400">
            Claim your BTC1USD rewards (7-day distribution cycle)
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
      {/* Distribution Overview */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Current Distribution
          </CardTitle>
          <CardDescription className="text-gray-400">
            Distribution #{distributionData?.distributionId} •{" "}
            {distributionData?.metadata?.activeHolders || 0} holders
          </CardDescription>
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

      {/* User Claim Status */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Your Reward
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

              {/* Note about Netlify */}
              <Alert className="bg-blue-900/50 border-blue-600">
                <AlertCircle className="h-4 w-4 text-blue-400" />
                <AlertDescription className="text-blue-200">
                  <div className="text-sm space-y-1">
                    <div>
                      <strong>On Netlify:</strong> Distribution files must be
                      pre-generated locally and committed to the repository.
                    </div>
                    <div className="mt-2">
                      <strong>For local development:</strong> You can generate
                      test data using the scripts in the project.
                    </div>
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
                      : canUserClaim
                      ? "Ready to claim"
                      : "Ready to claim"}
                  </span>
                </div>
              </div>

              {!isAlreadyClaimed && !isReclaimed && !isExpired && (
                <Button
                  onClick={handleClaim}
                  disabled={!canUserClaim || isClaimLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {isClaimLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Claiming...
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
                    Reward Expired Will go Endowment
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

              {claimSuccess && (
                <Alert className="border-green-600 bg-green-900/50">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <AlertDescription className="text-green-200">
                    Reward claimed successfully! Your BTC1USD tokens have been
                    transferred to your wallet. Refreshing distributions...
                  </AlertDescription>
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
            • rewards are distributed every 7 days (weekly) based on your BTC1USD balance.
          </div>
          <div>
            • You can claim your rewards within 365 days (1 year).
          </div>
          <div>
            • After 365 days, unclaimed rewards are donated to the endowment fund.
          </div>
          <div>• The system is fully decentralized, permissionless and automated.</div>
        </CardContent>
      </Card>
    </div>
  );
}
