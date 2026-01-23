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
  };
}

// New interface for the multi-distribution API response
interface MultiDistributionData {
  current: DistributionData;
  allDistributions: any[];
  incompleteDistributions: any[];
  userClaims: { [distributionId: string]: MerkleClaim };
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
import { useWeb3 } from "@/lib/web3-provider";

export default function FixedMerkleClaim() {
  const { address, isConnected } = useWeb3();
  const [distributionData, setDistributionData] =
    useState<DistributionData | null>(null);
  const [userClaim, setUserClaim] = useState<MerkleClaim | null>(null);
  const [allUserClaims, setAllUserClaims] = useState<{
    [distributionId: string]: MerkleClaim;
  }>({});
  const [selectedDistributionId, setSelectedDistributionId] = useState<
    string | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allDistributions, setAllDistributions] = useState<any[]>([]);
  const [incompleteDistributions, setIncompleteDistributions] = useState<any[]>(
    []
  );

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

  // Check if user's claim is already claimed
  const { data: isClaimedData, isLoading: isCheckingClaimed } = useReadContract(
    {
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
    }
  );

  // Define variables in correct order
  const hasUserClaim = !!userClaim;
  const isAlreadyClaimed = !!isClaimedData;
  
  // Check if the claim has expired (10 hours = 36000000 milliseconds)
  const isExpired = distributionData?.metadata?.generated
    ? (Date.now() - new Date(distributionData.metadata.generated).getTime()) > 36000000
    : false;
  
  // Users can only claim if:
  // 1. They have a claim
  // 2. The claim hasn't been claimed already
  // 3. The claim hasn't expired (10-hour limit)
  const canUserClaim = hasUserClaim && !isAlreadyClaimed && !isCheckingClaimed && !isExpired;

  // Write contract hook
  const { writeContract, isPending: isClaimLoading, isSuccess: isClaimSuccess, data: claimData } = useWriteContract();

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
        if (userClaim && selectedDistributionId) {
          try {
            await fetch('/api/merkle-distributions/latest', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                contractAddress: MERKLE_DISTRIBUTOR_ADDRESS,
                distributionId: selectedDistributionId,
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

  // Load distribution data
  useEffect(() => {
    const loadDistributionData = async () => {
      try {
        setLoading(true);
        console.log("Loading distribution data...");

        // Include the user's address as a query parameter
        const apiUrl = address
          ? `/api/merkle-distributions/latest?address=${address}`
          : "/api/merkle-distributions/latest";

        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(
            `Failed to load distribution data: ${response.status} ${response.statusText}`
          );
        }

        const data: MultiDistributionData = await response.json();
        console.log("Distribution data loaded:", data);
        setDistributionData(data.current);
        setAllDistributions(data.allDistributions);
        setIncompleteDistributions(data.incompleteDistributions);

        // Set all user claims
        if (data.userClaims) {
          setAllUserClaims(data.userClaims);
          console.log("All user claims:", data.userClaims);

          // Set the first available claim as the default selected claim
          const distributionIds = Object.keys(data.userClaims);
          if (distributionIds.length > 0) {
            const firstDistributionId = distributionIds[0];
            setUserClaim(data.userClaims[firstDistributionId]);
            setSelectedDistributionId(firstDistributionId);
            console.log(
              "Selected claim from distribution:",
              firstDistributionId
            );
          } else if (
            address &&
            data.current.claims &&
            data.current.claims[address]
          ) {
            // Fallback to current distribution claim
            console.log(
              "User claim found in current distribution claims:",
              data.current.claims[address]
            );
            setUserClaim(data.current.claims[address]);
            setSelectedDistributionId(data.current.distributionId);
          } else {
            console.log("No claims found for address:", address);
            setUserClaim(null);
            setSelectedDistributionId(null);
          }
        } else {
          // Fallback for older API responses
          if (address && data.current.claims && data.current.claims[address]) {
            console.log(
              "User claim found in current distribution claims:",
              data.current.claims[address]
            );
            setUserClaim(data.current.claims[address]);
            setSelectedDistributionId(data.current.distributionId);
          } else {
            console.log("No claims found for address:", address);
            setUserClaim(null);
            setSelectedDistributionId(null);
          }
          setAllUserClaims({});
        }
      } catch (err) {
        console.error("Error loading distribution data:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load distribution data"
        );

        // Don't automatically generate merkle tree on error - this was causing new distributions on every reload
        // Instead, just show mock data for demo purposes or show error
        console.log("Showing mock data for demo purposes...");

        // Don't automatically generate current distribution data automatically
        // This was causing new distributions on every reload
        /*
        console.log('Attempting to generate current distribution data...');
        try {
          const generateResponse = await fetch('/api/generate-merkle-tree', { 
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          if (generateResponse.ok) {
            console.log('Successfully generated merkle tree, reloading distribution data...');
            // Reload the distribution data after generation
            const retryResponse = await fetch('/api/merkle-distributions/latest');
            if (retryResponse.ok) {
              const retryData: DistributionData = await retryResponse.json();
              console.log('Retry distribution data loaded:', retryData);
              setDistributionData(retryData);
              
              if (address && retryData.claims && retryData.claims[address]) {
                console.log('User claim found in retry:', retryData.claims[address]);
                setUserClaim(retryData.claims[address]);
                setError(null); // Clear error since we found data
              } else {
                console.log('No claim found for address in retry:', address);
                setUserClaim(null);
              }
              return; // Exit early since we found data
            }
          }
        } catch (generateError) {
          console.error('Failed to generate distribution data:', generateError);
        }
        */

        // For demo purposes, create mock data with a claim for the connected user
        if (address) {
          const mockCurrentDistribution: DistributionData = {
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
          setDistributionData(mockCurrentDistribution);
          setUserClaim(mockCurrentDistribution.claims[address]);
          setAllUserClaims({ "1": mockCurrentDistribution.claims[address] });
        } else {
          const mockCurrentDistribution: DistributionData = {
            distributionId: "0",
            merkleRoot:
              "0x0000000000000000000000000000000000000000000000000000000000000000",
            totalRewards: "0",
            claims: {},
            metadata: {
              generated: new Date().toISOString(),
              activeHolders: 0,
            },
          };
          setDistributionData(mockCurrentDistribution);
          setAllUserClaims({});
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
    if (!userClaim || !selectedDistributionId) {
      console.error("No user claim or distribution ID available");
      return;
    }

    console.log("Attempting to claim reward:", {
      distributionId: selectedDistributionId,
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
          BigInt(selectedDistributionId),
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

  // Handle distribution selection change
  const handleDistributionChange = (distributionId: string) => {
    setSelectedDistributionId(distributionId);
    if (allUserClaims[distributionId]) {
      setUserClaim(allUserClaims[distributionId]);
    } else {
      setUserClaim(null);
    }
  };

  // Handle claim for a specific distribution
  const handleClaimForDistribution = async (distributionId: string) => {
    const claim = allUserClaims[distributionId];
    if (!claim) {
      console.error("No user claim available for distribution:", distributionId);
      return;
    }

    console.log("Attempting to claim reward:", {
      distributionId: distributionId,
      index: claim.index,
      account: claim.account,
      amount: claim.amount,
      proofLength: claim.proof.length,
      contract: MERKLE_DISTRIBUTOR_ADDRESS,
    });

    try {
      writeContract({
        address: MERKLE_DISTRIBUTOR_ADDRESS as `0x${string}`,
        abi: MERKLE_DISTRIBUTOR_ABI,
        functionName: "claim",
        args: [
          BigInt(distributionId),
          BigInt(claim.index),
          claim.account as `0x${string}`,
          BigInt(claim.amount),
          claim.proof as `0x${string}`[],
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

  // Helper function to determine if a distribution has a claim for the user
  const hasClaimForDistribution = (distributionId: string): boolean => {
    return allUserClaims.hasOwnProperty(distributionId);
  };

  // Helper function to get claim amount for a distribution
  const getClaimAmountForDistribution = (distributionId: string): string => {
    if (allUserClaims[distributionId]) {
      return formatUnits(BigInt(allUserClaims[distributionId].amount), 8);
    }
    return "0";
  };

  // Helper function to check if a distribution is the current one
  const isCurrentDistribution = (distributionId: string): boolean => {
    return distributionId === distributionData?.distributionId;
  };

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

      {/* All Distributions Overview */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Gift className="h-5 w-5" />
            All Distributions
          </CardTitle>
          <CardDescription className="text-gray-400">
            View all reward distributions and your claim status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {allDistributions.length > 0 ? (
            <div className="space-y-3">
              {allDistributions.map((dist) => (
                <DistributionItem
                  key={dist.id}
                  dist={dist}
                  allUserClaims={allUserClaims}
                  isSelected={dist.id.toString() === selectedDistributionId}
                  isCurrent={isCurrentDistribution(dist.id.toString())}
                  handleDistributionChange={handleDistributionChange}
                  handleClaim={handleClaimForDistribution}
                  formatUnits={formatUnits}
                  isConnected={isConnected}
                  MERKLE_DISTRIBUTOR_ADDRESS={MERKLE_DISTRIBUTOR_ADDRESS}
                  MERKLE_DISTRIBUTOR_ABI={MERKLE_DISTRIBUTOR_ABI}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              No distributions found
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Claim Status */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Selected Reward
          </CardTitle>
          <CardDescription className="text-gray-400">
            {address
              ? `Connected: ${address.slice(0, 6)}...${address.slice(-4)}`
              : "Not connected"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!userClaim ? (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No rewards available for your address in the selected
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
                    <div>• Has Claim Data: {userClaim ? "Yes" : "No"}</div>
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

              {/* Generate Test Data Button - now with clearer purpose */}
              <div className="space-y-2">
                <div className="text-sm text-gray-400">
                  Need to test the claim functionality? Generate a new test
                  distribution:
                </div>
                <Button
                  onClick={async () => {
                    try {
                      console.log("Generating new test merkle tree...");
                      const response = await fetch(
                        "/api/generate-merkle-tree",
                        { method: "POST" }
                      );
                      if (response.ok) {
                        const result = await response.json();
                        console.log("New merkle tree generated:", result);
                        alert(
                          `New distribution created!\nDistribution ID: ${
                            result.distributionId
                          }\nTotal Rewards: ${
                            parseInt(result.totalRewards) / 1e8
                          } BTC1USD\nHolders: ${result.activeHolders}`
                        );
                        // Reload distribution data to show the new distribution
                        window.location.reload();
                      } else {
                        const errorData = await response.json();
                        console.error(
                          "Failed to generate merkle tree:",
                          errorData
                        );
                        alert(
                          `Failed to generate merkle tree: ${
                            errorData.error
                          }\n\n${errorData.details || ""}`
                        );
                      }
                    } catch (error) {
                      console.error("Error generating merkle tree:", error);
                      alert(
                        `Error generating merkle tree: ${
                          error instanceof Error
                            ? error.message
                            : "Unknown error"
                        }`
                      );
                    }
                  }}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  Generate New Test Distribution
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                <div>
                  <div className="text-lg font-semibold text-white">
                    {userRewardAmount} BTC1USD
                  </div>
                  <div className="text-sm text-gray-400">
                    Available reward from Distribution #{selectedDistributionId}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isAlreadyClaimed ? (
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
                    {isCheckingClaimed
                      ? "Checking..."
                      : isAlreadyClaimed
                      ? "Already claimed"
                      : isExpired
                      ? "Reward Expired Will go Endowment"
                      : canUserClaim
                      ? "Ready to claim"
                      : "Ready to claim"}
                  </span>
                </div>
              </div>

              {!isAlreadyClaimed && !isExpired && (
                <Button
                  onClick={handleClaim}
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
                    Reward Expired Will go Endowment
                  </AlertDescription>
                </Alert>
              )}

              {(isClaimLoading || isConfirming) && (
                <Alert className="border-yellow-600 bg-yellow-900/50">
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                  <AlertDescription className="text-yellow-200">
                    {isClaimLoading
                      ? "Please confirm the transaction in your wallet..."
                      : "Waiting for transaction confirmation on the blockchain..."}
                  </AlertDescription>
                </Alert>
              )}

              {isClaimSuccess && (
                <Alert className="border-green-600 bg-green-900/50">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <AlertDescription className="text-green-200">
                    Reward claimed successfully! Your BTC1USD tokens will be transferred to your wallet shortly.
                  </AlertDescription>
                </Alert>
              )}

              {claimSuccess && (
                <Alert className="border-green-600 bg-green-900/50">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <AlertDescription className="text-green-200">
                    Transaction confirmed! Your claim has been processed and tokens transferred to your wallet. Refreshing distributions...
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

// Custom hook to check claim status for multiple distributions
// Note: This hook cannot be used correctly due to React hook rules
// Each DistributionItem component handles its own claim status check

// Individual Distribution Item Component
const DistributionItem = ({
  dist,
  allUserClaims,
  isSelected,
  isCurrent,
  handleDistributionChange,
  handleClaim,
  formatUnits,
  isConnected,
  MERKLE_DISTRIBUTOR_ADDRESS,
  MERKLE_DISTRIBUTOR_ABI,
}: {
  dist: any;
  allUserClaims: any;
  isSelected: boolean;
  isCurrent: boolean;
  handleDistributionChange: (distributionId: string) => void;
  handleClaim: (distributionId: string) => void;
  formatUnits: (value: bigint, decimals: number) => string;
  isConnected: boolean;
  MERKLE_DISTRIBUTOR_ADDRESS: string;
  MERKLE_DISTRIBUTOR_ABI: any;
}) => {
  const hasClaim = !!allUserClaims[dist.id.toString()];
  const claimAmount = hasClaim 
    ? formatUnits(BigInt(allUserClaims[dist.id.toString()].amount), 8)
    : "0";
  const userClaimForDist = allUserClaims[dist.id.toString()];
  
  // Check if this specific distribution's claim is already claimed
  const { data: isClaimedForDist, isLoading: isCheckingClaimedForDist } = useReadContract({
    address: MERKLE_DISTRIBUTOR_ADDRESS as `0x${string}`,
    abi: MERKLE_DISTRIBUTOR_ABI,
    functionName: "isClaimed",
    args:
      hasClaim && userClaimForDist
        ? [BigInt(dist.id), BigInt(userClaimForDist.index)]
        : undefined,
    query: {
      enabled: !!(isConnected && hasClaim && userClaimForDist),
    },
  });

  const isAlreadyClaimedForDist = hasClaim && !!isClaimedForDist;
  
  // Check if the claim has expired (10 hours = 36000000 milliseconds)
  const isExpiredForDist = dist.timestamp
    ? (Date.now() - new Date(parseInt(dist.timestamp) * 1000).getTime()) > 36000000
    : false;
  
  // Users can only claim if:
  // 1. They have a claim
  // 2. The claim hasn't been claimed already
  // 3. The claim hasn't expired (10-hour limit)
  const canUserClaimForDist = hasClaim && !isAlreadyClaimedForDist && !isCheckingClaimedForDist && !isExpiredForDist;

  return (
    <div
      className={`p-4 rounded-lg border transition-all duration-200 ${
        isSelected
          ? "bg-blue-900/30 border-blue-500 shadow-lg"
          : "bg-gray-700/30 border-gray-600 hover:bg-gray-700/50 hover:border-gray-500"
      }`}
      onClick={() => handleDistributionChange(dist.id.toString())}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${
              hasClaim
                ? isAlreadyClaimedForDist
                  ? "bg-green-500"
                  : isExpiredForDist
                  ? "bg-yellow-500"
                  : "bg-yellow-500"
                : "bg-gray-500"
            }`}
          ></div>
          <div>
            <div className="font-medium text-white flex items-center gap-2">
              Distribution #{dist.id}
              {isCurrent && (
                <Badge
                  variant="secondary"
                  className="text-xs bg-green-600/20 text-green-400 border-green-600/30"
                >
                  Current
                </Badge>
              )}
              {isSelected && (
                <Badge
                  variant="secondary"
                  className="text-xs bg-blue-600/20 text-blue-400 border-blue-600/30"
                >
                  Selected
                </Badge>
              )}
            </div>
            <div className="text-sm text-gray-400">
              {new Date(
                parseInt(dist.timestamp) * 1000
              ).toLocaleDateString()}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {hasClaim ? (
            <>
              <div className="text-right">
                <div className="font-medium text-white">
                  {claimAmount} BTC1USD
                </div>
                <div className="text-xs text-gray-400">
                  {isAlreadyClaimedForDist ? "Claimed" : isExpiredForDist ? "Expired" : "Available"}
                </div>
              </div>
              {!isAlreadyClaimedForDist && !isExpiredForDist && (
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 h-8 px-3"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDistributionChange(dist.id.toString());
                    // Auto-trigger claim for this specific distribution
                    setTimeout(() => handleClaim(dist.id.toString()), 100);
                  }}
                >
                  Claim
                </Button>
              )}
              {isExpiredForDist && (
                <Badge variant="secondary" className="bg-yellow-600 text-xs">
                  Expired
                </Badge>
              )}
            </>
          ) : (
            <div className="text-right">
              <div className="text-gray-400">No claim</div>
              <div className="text-xs text-gray-500">
                {formatUnits(BigInt(dist.totalTokens), 8)} total
              </div>
            </div>
          )}
        </div>
      </div>

      {hasClaim && (
        <div className="mt-3 pt-3 border-t border-gray-600/50">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Your status:</span>
            <span
              className={`font-medium ${
                isAlreadyClaimedForDist
                  ? "text-green-400"
                  : isExpiredForDist
                  ? "text-yellow-400"
                  : "text-yellow-400"
              }`}
            >
              {isAlreadyClaimedForDist
                ? "✓ Claimed"
                : isExpiredForDist
                ? "⚠ Reward Expired Will go Endowment"
                : "⏳ Ready to claim"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
