"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, Coins, Info, Check, X } from "lucide-react";
import { useAccount, useChainId } from "wagmi";
import { parseUnits, type Address } from "viem";
import { usePermitTransactions } from "@/hooks/use-permit-transactions";
import { CONTRACT_ADDRESSES } from "@/lib/contracts";

interface PermitMintRedeemProps {
  protocolState: any;
  userBalances: {
    wbtc: string;
    cbbtc: string;
    tbtc: string;
    btc1usd: string;
  };
  onSuccess?: () => void;
}

export default function PermitMintRedeem({ protocolState, userBalances, onSuccess }: PermitMintRedeemProps) {
  const { address } = useAccount();
  const chainId = useChainId();
  
  const {
    mintWithPermit2,
    redeemWithPermit,
    checkPermit2Approval,
    approvePermit2,
    status,
    isProcessing,
  } = usePermitTransactions();

  const [mintAmount, setMintAmount] = useState("");
  const [redeemAmount, setRedeemAmount] = useState("");
  const [selectedCollateral, setSelectedCollateral] = useState("WBTC");
  const [permit2Approved, setPermit2Approved] = useState<boolean | null>(null);

  // Check Permit2 approval status when component mounts or collateral changes
  const handleCheckPermit2 = async () => {
    if (!address) return;
    
    const collateralAddress = 
      selectedCollateral === "WBTC" ? CONTRACT_ADDRESSES.WBTC :
      selectedCollateral === "cbBTC" ? CONTRACT_ADDRESSES.CBBTC :
      CONTRACT_ADDRESSES.TBTC;

    const approved = await checkPermit2Approval(
      collateralAddress as Address,
      address as Address
    );
    setPermit2Approved(approved);
  };

  const handleApprovePermit2 = async () => {
    const collateralAddress = 
      selectedCollateral === "WBTC" ? CONTRACT_ADDRESSES.WBTC :
      selectedCollateral === "cbBTC" ? CONTRACT_ADDRESSES.CBBTC :
      CONTRACT_ADDRESSES.TBTC;

    await approvePermit2(
      collateralAddress as Address,
      () => {
        setPermit2Approved(true);
      },
      (error) => {
        console.error("Permit2 approval failed:", error);
      }
    );
  };

  const handleMintWithPermit2 = async () => {
    if (!address || !chainId || !mintAmount) return;

    const collateralAddress = 
      selectedCollateral === "WBTC" ? CONTRACT_ADDRESSES.WBTC :
      selectedCollateral === "cbBTC" ? CONTRACT_ADDRESSES.CBBTC :
      CONTRACT_ADDRESSES.TBTC;

    const amount = parseUnits(mintAmount, 8);

    await mintWithPermit2(
      CONTRACT_ADDRESSES.VAULT as Address,
      collateralAddress as Address,
      amount,
      chainId,
      (hash) => {
        console.log("Mint successful:", hash);
        setMintAmount("");
        onSuccess?.();
      },
      (error) => {
        console.error("Mint failed:", error);
      }
    );
  };

  const handleRedeemWithPermit = async () => {
    if (!address || !chainId || !redeemAmount) return;

    const collateralAddress = 
      selectedCollateral === "WBTC" ? CONTRACT_ADDRESSES.WBTC :
      selectedCollateral === "cbBTC" ? CONTRACT_ADDRESSES.CBBTC :
      CONTRACT_ADDRESSES.TBTC;

    const amount = parseUnits(redeemAmount, 8);

    await redeemWithPermit(
      CONTRACT_ADDRESSES.VAULT as Address,
      CONTRACT_ADDRESSES.BTC1USD as Address,
      collateralAddress as Address,
      amount,
      chainId,
      (hash) => {
        console.log("Redeem successful:", hash);
        setRedeemAmount("");
        onSuccess?.();
      },
      (error) => {
        console.error("Redeem failed:", error);
      }
    );
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="mint" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="mint">
            <Coins className="h-4 w-4 mr-2" />
            Gasless Mint
          </TabsTrigger>
          <TabsTrigger value="redeem">
            <Zap className="h-4 w-4 mr-2" />
            Gasless Redeem
          </TabsTrigger>
        </TabsList>

        {/* MINT TAB */}
        <TabsContent value="mint">
          <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="text-2xl text-white flex items-center gap-2">
                <Zap className="h-6 w-6 text-yellow-400" />
                Gasless Mint with Permit2
              </CardTitle>
              <CardDescription className="text-gray-400">
                Mint BTC1USD without paying gas for approval using Permit2 signatures
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Info Banner */}
              <Alert className="bg-blue-900/20 border-blue-500/30">
                <Info className="h-4 w-4 text-blue-400" />
                <AlertDescription className="text-blue-200 text-sm">
                  <strong>How it works:</strong> Sign a Permit2 message to authorize the transfer.
                  No separate approval transaction needed! Works with any ERC20 token.
                </AlertDescription>
              </Alert>

              {/* Permit2 Setup Check */}
              {permit2Approved === false && (
                <Alert className="bg-orange-900/20 border-orange-500/30">
                  <Info className="h-4 w-4 text-orange-400" />
                  <AlertDescription className="text-orange-200">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">One-time Setup Required</p>
                      <p className="text-xs">Approve Permit2 to enable gasless transactions for this token.</p>
                      <Button
                        size="sm"
                        onClick={handleApprovePermit2}
                        disabled={isProcessing}
                        className="mt-2"
                      >
                        {isProcessing ? "Approving..." : "Approve Permit2"}
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {permit2Approved === true && (
                <div className="flex items-center gap-2 text-green-400 text-sm">
                  <Check className="h-4 w-4" />
                  <span>Permit2 is approved for {selectedCollateral}</span>
                </div>
              )}

              {/* Collateral Selection */}
              <div className="space-y-2">
                <Label className="text-gray-300">Select Collateral</Label>
                <Select value={selectedCollateral} onValueChange={(val) => {
                  setSelectedCollateral(val);
                  setPermit2Approved(null);
                }}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="WBTC" className="text-white">
                      WBTC - Wrapped Bitcoin
                    </SelectItem>
                    <SelectItem value="cbBTC" className="text-white">
                      cbBTC - Coinbase Wrapped BTC
                    </SelectItem>
                    <SelectItem value="tBTC" className="text-white">
                      tBTC - Threshold BTC
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-400">
                  Your balance: {userBalances[selectedCollateral.toLowerCase() as keyof typeof userBalances] || "0.00000000"} {selectedCollateral}
                </p>
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <Label className="text-gray-300">Amount ({selectedCollateral})</Label>
                <Input
                  type="number"
                  placeholder="0.00000000"
                  value={mintAmount}
                  onChange={(e) => setMintAmount(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white"
                  step="0.00000001"
                />
              </div>

              {/* Check Permit2 Button */}
              <Button
                variant="outline"
                onClick={handleCheckPermit2}
                className="w-full"
                disabled={!address}
              >
                Check Permit2 Status
              </Button>

              {/* Mint Button */}
              <Button
                onClick={handleMintWithPermit2}
                disabled={!mintAmount || !address || isProcessing || permit2Approved === false}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {isProcessing ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processing...</span>
                  </div>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Mint with Permit2 (Gasless)
                  </>
                )}
              </Button>

              {/* Status */}
              {status && (
                <Alert className={status.includes("✅") ? "bg-green-900/20 border-green-500/30" : "bg-gray-800 border-gray-700"}>
                  <AlertDescription className="text-gray-200">
                    {status}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* REDEEM TAB */}
        <TabsContent value="redeem">
          <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="text-2xl text-white flex items-center gap-2">
                <Zap className="h-6 w-6 text-orange-400" />
                Gasless Redeem with EIP-2612 Permit
              </CardTitle>
              <CardDescription className="text-gray-400">
                Redeem BTC1USD for collateral without paying gas for approval
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Info Banner */}
              <Alert className="bg-blue-900/20 border-blue-500/30">
                <Info className="h-4 w-4 text-blue-400" />
                <AlertDescription className="text-blue-200 text-sm">
                  <strong>How it works:</strong> Sign an EIP-2612 permit message to authorize BTC1USD spending.
                  Everything happens in one transaction!
                </AlertDescription>
              </Alert>

              {/* Collateral Selection */}
              <div className="space-y-2">
                <Label className="text-gray-300">Receive Collateral</Label>
                <Select value={selectedCollateral} onValueChange={setSelectedCollateral}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="WBTC" className="text-white">
                      WBTC - Wrapped Bitcoin
                    </SelectItem>
                    <SelectItem value="cbBTC" className="text-white">
                      cbBTC - Coinbase Wrapped BTC
                    </SelectItem>
                    <SelectItem value="tBTC" className="text-white">
                      tBTC - Threshold BTC
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <Label className="text-gray-300">BTC1USD Amount</Label>
                <Input
                  type="number"
                  placeholder="0.00000000"
                  value={redeemAmount}
                  onChange={(e) => setRedeemAmount(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white"
                  step="0.00000001"
                />
                <p className="text-xs text-gray-400">
                  Your balance: {userBalances.btc1usd || "0.00000000"} BTC1USD
                </p>
              </div>

              {/* Redeem Button */}
              <Button
                onClick={handleRedeemWithPermit}
                disabled={!redeemAmount || !address || isProcessing}
                className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
              >
                {isProcessing ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processing...</span>
                  </div>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Redeem with Permit (Gasless)
                  </>
                )}
              </Button>

              {/* Status */}
              {status && (
                <Alert className={status.includes("✅") ? "bg-green-900/20 border-green-500/30" : "bg-gray-800 border-gray-700"}>
                  <AlertDescription className="text-gray-200">
                    {status}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Feature Comparison */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-lg text-white">Why Use Gasless Transactions?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium text-green-400 flex items-center gap-2">
                <Check className="h-4 w-4" />
                With Permit (Gasless)
              </h4>
              <ul className="space-y-1 text-gray-300 text-xs">
                <li>✓ One transaction only</li>
                <li>✓ Sign a message (no gas)</li>
                <li>✓ Faster user experience</li>
                <li>✓ Lower total gas cost</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-orange-400 flex items-center gap-2">
                <X className="h-4 w-4" />
                Traditional Method
              </h4>
              <ul className="space-y-1 text-gray-300 text-xs">
                <li>• Two transactions required</li>
                <li>• Approve (costs gas)</li>
                <li>• Then mint/redeem (costs gas)</li>
                <li>• Higher total gas cost</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
