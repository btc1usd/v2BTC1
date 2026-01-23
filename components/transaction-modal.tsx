"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Coins, 
  Zap, 
  Gift, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  ArrowRight,
  Wallet,
  Info,
  TrendingUp,
  TrendingDown,
  Shield
} from "lucide-react";
import { useWeb3 } from "@/lib/web3-provider";
import { useActiveAccount } from "thirdweb/react";
import { formatUnits } from "viem";

export type TransactionType = "mint" | "redeem" | "claim";

export interface TransactionDetails {
  type: TransactionType;
  // Mint details
  collateralAmount?: string;
  collateralSymbol?: string;
  btc1Amount?: string;
  mintPrice?: number;
  devFee?: string;
  endowmentFee?: string;
  // Redeem details
  btc1AmountToRedeem?: string;
  collateralToReceive?: string;
  redeemCollateralSymbol?: string;
  redeemPrice?: number;
  stressMode?: boolean;
  // Claim details
  claimAmount?: string;
  distributionCount?: number;
  // Common
  newCollateralRatio?: number;
  currentCollateralRatio?: number;
  gasCost?: string;
  isGasless?: boolean;
}

export interface TransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  details: TransactionDetails;
  onConfirm: () => Promise<void>;
  isProcessing?: boolean;
  status?: string;
  error?: string;
}

export function TransactionModal({
  open,
  onOpenChange,
  details,
  onConfirm,
  isProcessing = false,
  status = "",
  error = "",
}: TransactionModalProps) {
  console.log("🐛 TransactionModal render:", { open, details, isProcessing, status, error });
  
  const { address, isConnected } = useWeb3();
  const activeAccount = useActiveAccount();
  const [step, setStep] = useState<"review" | "signing" | "success" | "error">("review");
  const isThirdwebWallet = !!activeAccount;

  // Reset step when modal opens
  useEffect(() => {
    if (open) {
      setStep("review");
    }
  }, [open]);

  // Update step based on processing state
  useEffect(() => {
    if (isProcessing) {
      setStep("signing");
    } else if (error) {
      setStep("error");
    } else if (status.includes("✅") || status.includes("successful")) {
      setStep("success");
    }
  }, [isProcessing, error, status]);

  const handleConfirm = async () => {
    try {
      setStep("signing");
      await onConfirm();
    } catch (err) {
      setStep("error");
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      onOpenChange(false);
      // Reset after animation
      setTimeout(() => setStep("review"), 300);
    }
  };

  const getIcon = () => {
    switch (details.type) {
      case "mint":
        return <Coins className="h-12 w-12 text-blue-500" />;
      case "redeem":
        return <Zap className="h-12 w-12 text-orange-500" />;
      case "claim":
        return <Gift className="h-12 w-12 text-green-500" />;
    }
  };

  const getTitle = () => {
    switch (details.type) {
      case "mint":
        return "Mint BTC1USD";
      case "redeem":
        return "Redeem BTC1USD";
      case "claim":
        return "Claim Rewards";
    }
  };

  const getDescription = () => {
    switch (details.type) {
      case "mint":
        return "Review your mint transaction details below";
      case "redeem":
        return "Review your redemption details below";
      case "claim":
        return "Review your reward claim details below";
    }
  };

  const renderReviewContent = () => {
    switch (details.type) {
      case "mint":
        return (
          <div className="space-y-4">
            {/* Transaction Overview */}
            <div className="rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">You Deposit</span>
                <span className="text-2xl font-bold text-foreground">
                  {details.collateralAmount} {details.collateralSymbol}
                </span>
              </div>
              <div className="flex items-center justify-center py-2">
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-sm text-muted-foreground">You Receive</span>
                <span className="text-2xl font-bold text-green-500">
                  {details.btc1Amount} BTC1USD
                </span>
              </div>
            </div>

            {/* Transaction Details */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Mint Price</span>
                <span className="font-medium">${details.mintPrice?.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Dev Fee (1%)</span>
                <span className="font-medium">{details.devFee} BTC1USD</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Endowment Fee (1%)</span>
                <span className="font-medium">{details.endowmentFee} BTC1USD</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Current Collateral Ratio</span>
                <span className="font-medium">{details.currentCollateralRatio?.toFixed(2)}x</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  New Collateral Ratio
                  {details.newCollateralRatio && details.currentCollateralRatio && 
                   details.newCollateralRatio > details.currentCollateralRatio && (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  )}
                </span>
                <span className="font-medium text-green-500">{details.newCollateralRatio?.toFixed(2)}x</span>
              </div>
            </div>

            {/* Gas Info */}
            {details.isGasless && (
              <Alert className="bg-green-900/20 border-green-500/30">
                <Zap className="h-4 w-4 text-green-400" />
                <AlertDescription className="text-green-200 text-sm">
                  <strong>Gasless Transaction!</strong> You only need to sign a message. No gas fees required.
                </AlertDescription>
              </Alert>
            )}
          </div>
        );

      case "redeem":
        return (
          <div className="space-y-4">
            {/* Transaction Overview */}
            <div className="rounded-lg bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">You Burn</span>
                <span className="text-2xl font-bold text-foreground">
                  {details.btc1AmountToRedeem} BTC1USD
                </span>
              </div>
              <div className="flex items-center justify-center py-2">
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-sm text-muted-foreground">You Receive</span>
                <span className="text-2xl font-bold text-orange-500">
                  {details.collateralToReceive} {details.redeemCollateralSymbol}
                </span>
              </div>
            </div>

            {/* Stress Mode Warning */}
            {details.stressMode && (
              <Alert className="bg-red-900/20 border-red-500/30">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <AlertDescription className="text-red-200 text-sm">
                  <strong>Stress Mode Active!</strong> Redemption price is reduced due to low collateral ratio.
                </AlertDescription>
              </Alert>
            )}

            {/* Transaction Details */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Redeem Price</span>
                <span className="font-medium">${details.redeemPrice?.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Dev Fee (0.1%)</span>
                <span className="font-medium">~{((parseFloat(details.btc1AmountToRedeem || "0") * 0.001) / 100000000).toFixed(8)} {details.redeemCollateralSymbol}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Current Collateral Ratio</span>
                <span className="font-medium">{details.currentCollateralRatio?.toFixed(2)}x</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  New Collateral Ratio
                  {details.newCollateralRatio && details.currentCollateralRatio && 
                   details.newCollateralRatio < details.currentCollateralRatio && (
                    <TrendingDown className="h-3 w-3 text-orange-500" />
                  )}
                </span>
                <span className="font-medium text-orange-500">{details.newCollateralRatio?.toFixed(2)}x</span>
              </div>
            </div>

            {/* Gas Info */}
            {details.isGasless && (
              <Alert className="bg-green-900/20 border-green-500/30">
                <Zap className="h-4 w-4 text-green-400" />
                <AlertDescription className="text-green-200 text-sm">
                  <strong>Gasless Transaction!</strong> You only need to sign a message. No gas fees required.
                </AlertDescription>
              </Alert>
            )}
          </div>
        );

      case "claim":
        return (
          <div className="space-y-4">
            {/* Transaction Overview */}
            <div className="rounded-lg bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">Total Claimable</span>
                <span className="text-3xl font-bold text-green-500">
                  {details.claimAmount} BTC1USD
                </span>
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-sm text-muted-foreground">From Distributions</span>
                <Badge variant="outline" className="border-green-500/50 text-green-500">
                  {details.distributionCount} {details.distributionCount === 1 ? "Distribution" : "Distributions"}
                </Badge>
              </div>
            </div>

            {/* Info */}
            <Alert className="bg-blue-900/20 border-blue-500/30">
              <Info className="h-4 w-4 text-blue-400" />
              <AlertDescription className="text-blue-200 text-sm">
                You're claiming rewards from {details.distributionCount} distribution{details.distributionCount !== 1 ? "s" : ""}. Each claim is verified against the Merkle tree.
              </AlertDescription>
            </Alert>

            {/* Transaction Details */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Gas Estimate</span>
                <span className="font-medium">{details.gasCost || "~$0.10"}</span>
              </div>
            </div>
          </div>
        );
    }
  };

  const renderSigningContent = () => {
    return (
      <div className="space-y-6 py-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="relative">
            <div className="absolute inset-0 animate-ping">
              <Wallet className="h-16 w-16 text-primary opacity-20" />
            </div>
            <Wallet className="h-16 w-16 text-primary relative z-10" />
          </div>
          
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold">
              {isThirdwebWallet ? "Sign in your In-App Wallet" : "Confirm in MetaMask"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              {isThirdwebWallet 
                ? "Please sign the transaction message in your in-app wallet. This is secure and gasless."
                : "Please check your MetaMask extension to approve the transaction."}
            </p>
          </div>

          {/* Status Message */}
          {status && (
            <Alert className="w-full max-w-md">
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription className="text-sm">
                {status}
              </AlertDescription>
            </Alert>
          )}

          {/* Wallet Type Badge */}
          <Badge variant="outline" className="mt-4">
            <Shield className="h-3 w-3 mr-1" />
            {isThirdwebWallet ? "In-App Wallet (Secure)" : "External Wallet (MetaMask)"}
          </Badge>
        </div>
      </div>
    );
  };

  const renderSuccessContent = () => {
    // Extract transaction hash from status if available
    const txHashMatch = status.match(/0x[a-fA-F0-9]{64}/);
    const txHash = txHashMatch ? txHashMatch[0] : null;
    const explorerUrl = txHash 
      ? `https://basescan.org/tx/${txHash}`
      : null;

    return (
      <div className="space-y-6 py-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          {/* Animated Success Icon */}
          <div className="relative">
            <div className="absolute inset-0 animate-ping">
              <div className="rounded-full bg-green-500/30 w-32 h-32" />
            </div>
            <div className="rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 p-8 relative z-10 border-2 border-green-500/50">
              <CheckCircle2 className="h-16 w-16 text-green-500 animate-in zoom-in duration-500" />
            </div>
          </div>
          
          <div className="text-center space-y-2">
            <h3 className="text-2xl font-bold text-green-500">Transaction Successful!</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Your {details.type} transaction has been confirmed on the blockchain.
            </p>
          </div>

          {/* Transaction Summary */}
          <div className="w-full max-w-md space-y-3 pt-4">
            <div className="rounded-lg bg-card/50 border border-green-500/20 p-4 space-y-3">
              {details.type === "mint" && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Minted</span>
                    <span className="font-bold text-green-500">{details.btc1Amount} BTC1USD</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Using</span>
                    <span className="font-medium">{details.collateralAmount} {details.collateralSymbol}</span>
                  </div>
                  <Separator className="bg-green-500/20" />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">New Collateral Ratio</span>
                    <Badge variant="outline" className="border-green-500/50 text-green-500">
                      {details.newCollateralRatio?.toFixed(2)}x
                    </Badge>
                  </div>
                </>
              )}
              
              {details.type === "redeem" && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Redeemed</span>
                    <span className="font-bold text-orange-500">{details.btc1AmountToRedeem} BTC1USD</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Received</span>
                    <span className="font-medium text-green-500">{details.collateralToReceive} {details.redeemCollateralSymbol}</span>
                  </div>
                  <Separator className="bg-green-500/20" />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">New Collateral Ratio</span>
                    <Badge variant="outline" className="border-orange-500/50 text-orange-500">
                      {details.newCollateralRatio?.toFixed(2)}x
                    </Badge>
                  </div>
                </>
              )}
              
              {details.type === "claim" && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Claimed</span>
                    <span className="font-bold text-green-500">{details.claimAmount} BTC1USD</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">From</span>
                    <span className="font-medium">{details.distributionCount} {details.distributionCount === 1 ? "Distribution" : "Distributions"}</span>
                  </div>
                </>
              )}
            </div>

            {/* Transaction Hash Link */}
            {explorerUrl && (
              <Alert className="bg-blue-900/20 border-blue-500/30">
                <Info className="h-4 w-4 text-blue-400" />
                <AlertDescription className="text-blue-200 text-sm">
                  <a 
                    href={explorerUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:underline flex items-center gap-1"
                  >
                    View on BaseScan
                    <ArrowRight className="h-3 w-3" />
                  </a>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        <Button onClick={handleClose} className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Done
        </Button>
      </div>
    );
  };

  const renderErrorContent = () => {
    // Parse common error types for better messaging
    const getErrorDetails = () => {
      const errorLower = error?.toLowerCase() || "";
      
      if (errorLower.includes("user rejected") || errorLower.includes("user denied")) {
        return {
          title: "Transaction Cancelled",
          message: "You cancelled the transaction in your wallet.",
          icon: "cancel",
        };
      }
      
      if (errorLower.includes("insufficient")) {
        return {
          title: "Insufficient Balance",
          message: "You don't have enough funds to complete this transaction.",
          icon: "balance",
        };
      }
      
      if (errorLower.includes("network") || errorLower.includes("timeout")) {
        return {
          title: "Network Error",
          message: "Network connection issue. Please check your connection and try again.",
          icon: "network",
        };
      }
      
      return {
        title: "Transaction Failed",
        message: error || "Something went wrong. Please try again.",
        icon: "error",
      };
    };

    const errorDetails = getErrorDetails();

    return (
      <div className="space-y-6 py-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          {/* Animated Error Icon */}
          <div className="relative">
            <div className="absolute inset-0 animate-pulse">
              <div className="rounded-full bg-red-500/20 w-32 h-32" />
            </div>
            <div className="rounded-full bg-gradient-to-br from-red-500/20 to-orange-500/20 p-8 relative z-10 border-2 border-red-500/50">
              <AlertCircle className="h-16 w-16 text-red-500" />
            </div>
          </div>
          
          <div className="text-center space-y-2">
            <h3 className="text-2xl font-bold text-red-500">{errorDetails.title}</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              {errorDetails.message}
            </p>
          </div>

          {/* Error Details Card */}
          <div className="w-full max-w-md space-y-3 pt-4">
            <Alert className="bg-red-900/20 border-red-500/30">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-200 text-sm">
                <div className="space-y-2">
                  <p className="font-medium">What happened?</p>
                  <p className="text-xs opacity-80">{error}</p>
                </div>
              </AlertDescription>
            </Alert>

            {/* Helpful Tips */}
            {errorDetails.icon === "balance" && (
              <Alert className="bg-blue-900/20 border-blue-500/30">
                <Info className="h-4 w-4 text-blue-400" />
                <AlertDescription className="text-blue-200 text-sm">
                  <p className="text-xs">💡 Make sure you have enough {details.type === "mint" ? details.collateralSymbol : "BTC1USD"} in your wallet.</p>
                </AlertDescription>
              </Alert>
            )}
            
            {errorDetails.icon === "network" && (
              <Alert className="bg-blue-900/20 border-blue-500/30">
                <Info className="h-4 w-4 text-blue-400" />
                <AlertDescription className="text-blue-200 text-sm">
                  <p className="text-xs">💡 Try refreshing the page or switching to a different RPC endpoint.</p>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleClose} variant="outline" className="flex-1 border-red-500/30 hover:bg-red-500/10">
            Close
          </Button>
          <Button 
            onClick={() => {
              setStep("review");
              // Pass the reset action back to parent component
              onOpenChange(true); // Keep modal open but reset to review
            }} 
            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent 
        className="max-w-md max-h-[90vh] overflow-y-auto bg-card border-border"
        onPointerDownOutside={(e) => isProcessing && e.preventDefault()}
        onEscapeKeyDown={(e) => isProcessing && e.preventDefault()}
      >
        {step === "review" && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                {getIcon()}
                <div>
                  <DialogTitle className="text-xl">{getTitle()}</DialogTitle>
                  <DialogDescription>{getDescription()}</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="py-4">
              {renderReviewContent()}
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleClose} 
                variant="outline" 
                className="flex-1"
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleConfirm} 
                className="flex-1"
                disabled={isProcessing || !isConnected}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Confirm Transaction
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </>
        )}

        {step === "signing" && renderSigningContent()}
        {step === "success" && renderSuccessContent()}
        {step === "error" && renderErrorContent()}
      </DialogContent>
    </Dialog>
  );
}
