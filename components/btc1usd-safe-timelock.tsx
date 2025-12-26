"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { ethers } from "ethers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertCircle, Lock, Clock, CheckCircle, XCircle, Copy, ExternalLink, Shield, ArrowRight } from "lucide-react";
import { CONTRACT_ADDRESSES, ABIS } from "@/lib/contracts";
import { encodeFunctionData } from "viem";

interface PendingChange {
  newAddress: string;
  executeAfter: bigint;
}

interface SafeTimelockProps {
  isAdmin: boolean;
}

export default function BTC1USDSafeTimelock({ isAdmin }: SafeTimelockProps) {
  const { address, isConnected } = useAccount();
  
  // State for current addresses
  const [currentVault, setCurrentVault] = useState<string>("");
  const [currentWeeklyDistribution, setCurrentWeeklyDistribution] = useState<string>("");
  const [criticalParamsLocked, setCriticalParamsLocked] = useState<boolean>(false);
  
  // State for pending changes
  const [pendingVaultChange, setPendingVaultChange] = useState<PendingChange | null>(null);
  const [pendingWeeklyDistChange, setPendingWeeklyDistChange] = useState<PendingChange | null>(null);
  
  // State for new addresses
  const [newVaultAddress, setNewVaultAddress] = useState("");
  const [newWeeklyDistAddress, setNewWeeklyDistAddress] = useState("");
  
  // UI states
  const [isLoading, setIsLoading] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState("");
  const [showSafeModal, setShowSafeModal] = useState(false);
  const [safeModalData, setSafeModalData] = useState<{
    title: string;
    description: string;
    calldata: string;
    functionName: string;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Load current state
  useEffect(() => {
    loadCurrentState();
  }, [isConnected]);

  const loadCurrentState = async () => {
    if (!isConnected || typeof window === "undefined" || !window.ethereum) return;

    try {
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const btc1usdContract = new ethers.Contract(
        CONTRACT_ADDRESSES.BTC1USD_CONTRACT,
        ABIS.BTC1USD,
        provider
      );

      const [vault, weeklyDist, locked, pendingVault, pendingWeeklyDist] = await Promise.all([
        btc1usdContract.vault(),
        btc1usdContract.weeklyDistribution(),
        btc1usdContract.criticalParamsLocked(),
        btc1usdContract.pendingVaultChange(),
        btc1usdContract.pendingWeeklyDistributionChange()
      ]);

      setCurrentVault(vault);
      setCurrentWeeklyDistribution(weeklyDist);
      setCriticalParamsLocked(locked);
      
      // Check if there are pending changes
      if (pendingVault.newAddress !== ethers.ZeroAddress) {
        setPendingVaultChange({
          newAddress: pendingVault.newAddress,
          executeAfter: pendingVault.executeAfter
        });
      } else {
        setPendingVaultChange(null);
      }
      
      if (pendingWeeklyDist.newAddress !== ethers.ZeroAddress) {
        setPendingWeeklyDistChange({
          newAddress: pendingWeeklyDist.newAddress,
          executeAfter: pendingWeeklyDist.executeAfter
        });
      } else {
        setPendingWeeklyDistChange(null);
      }
    } catch (error) {
      console.error("Error loading BTC1USD state:", error);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const generateSafeCalldata = (functionName: string, params: any[]) => {
    let calldata: string;
    
    switch (functionName) {
      case "initiateVaultChange":
        calldata = encodeFunctionData({
          abi: ABIS.BTC1USD,
          functionName: "initiateVaultChange",
          args: [params[0]]
        });
        break;
      case "executeVaultChange":
        calldata = encodeFunctionData({
          abi: ABIS.BTC1USD,
          functionName: "executeVaultChange",
          args: []
        });
        break;
      case "cancelVaultChange":
        calldata = encodeFunctionData({
          abi: ABIS.BTC1USD,
          functionName: "cancelVaultChange",
          args: []
        });
        break;
      case "initiateWeeklyDistributionChange":
        calldata = encodeFunctionData({
          abi: ABIS.BTC1USD,
          functionName: "initiateWeeklyDistributionChange",
          args: [params[0]]
        });
        break;
      case "executeWeeklyDistributionChange":
        calldata = encodeFunctionData({
          abi: ABIS.BTC1USD,
          functionName: "executeWeeklyDistributionChange",
          args: []
        });
        break;
      case "cancelWeeklyDistributionChange":
        calldata = encodeFunctionData({
          abi: ABIS.BTC1USD,
          functionName: "cancelWeeklyDistributionChange",
          args: []
        });
        break;
      case "lockCriticalParams":
        calldata = encodeFunctionData({
          abi: ABIS.BTC1USD,
          functionName: "lockCriticalParams",
          args: []
        });
        break;
      default:
        throw new Error(`Unknown function: ${functionName}`);
    }
    
    return calldata;
  };

  const handleInitiateVaultChange = () => {
    if (!ethers.isAddress(newVaultAddress)) {
      setTransactionStatus("Invalid vault address");
      return;
    }

    if (criticalParamsLocked) {
      setTransactionStatus("Critical parameters are locked");
      return;
    }

    if (pendingVaultChange) {
      setTransactionStatus("A vault change is already pending. Cancel it first.");
      return;
    }

    try {
      const calldata = generateSafeCalldata("initiateVaultChange", [newVaultAddress]);
      
      setSafeModalData({
        title: "Initiate Vault Address Change",
        description: `This will start a 2-day timelock to change the Vault address to ${newVaultAddress}. After 2 days, you can execute the change.`,
        calldata,
        functionName: "initiateVaultChange"
      });
      setShowSafeModal(true);
    } catch (error: any) {
      setTransactionStatus(`Error: ${error.message}`);
    }
  };

  const handleExecuteVaultChange = () => {
    if (!pendingVaultChange) {
      setTransactionStatus("No pending vault change to execute");
      return;
    }

    const now = BigInt(Math.floor(Date.now() / 1000));
    if (now < pendingVaultChange.executeAfter) {
      const remainingTime = Number(pendingVaultChange.executeAfter - now);
      const hours = Math.floor(remainingTime / 3600);
      const minutes = Math.floor((remainingTime % 3600) / 60);
      setTransactionStatus(`Timelock not expired yet. ${hours}h ${minutes}m remaining`);
      return;
    }

    try {
      const calldata = generateSafeCalldata("executeVaultChange", []);
      
      setSafeModalData({
        title: "Execute Vault Address Change",
        description: `This will execute the pending vault address change to ${pendingVaultChange.newAddress}.`,
        calldata,
        functionName: "executeVaultChange"
      });
      setShowSafeModal(true);
    } catch (error: any) {
      setTransactionStatus(`Error: ${error.message}`);
    }
  };

  const handleCancelVaultChange = () => {
    if (!pendingVaultChange) {
      setTransactionStatus("No pending vault change to cancel");
      return;
    }

    try {
      const calldata = generateSafeCalldata("cancelVaultChange", []);
      
      setSafeModalData({
        title: "Cancel Vault Address Change",
        description: "This will cancel the pending vault address change.",
        calldata,
        functionName: "cancelVaultChange"
      });
      setShowSafeModal(true);
    } catch (error: any) {
      setTransactionStatus(`Error: ${error.message}`);
    }
  };

  const handleInitiateWeeklyDistChange = () => {
    if (!ethers.isAddress(newWeeklyDistAddress)) {
      setTransactionStatus("Invalid weekly distribution address");
      return;
    }

    if (criticalParamsLocked) {
      setTransactionStatus("Critical parameters are locked");
      return;
    }

    if (pendingWeeklyDistChange) {
      setTransactionStatus("A weekly distribution change is already pending. Cancel it first.");
      return;
    }

    try {
      const calldata = generateSafeCalldata("initiateWeeklyDistributionChange", [newWeeklyDistAddress]);
      
      setSafeModalData({
        title: "Initiate Weekly Distribution Address Change",
        description: `This will start a 2-day timelock to change the WeeklyDistribution address to ${newWeeklyDistAddress}. After 2 days, you can execute the change.`,
        calldata,
        functionName: "initiateWeeklyDistributionChange"
      });
      setShowSafeModal(true);
    } catch (error: any) {
      setTransactionStatus(`Error: ${error.message}`);
    }
  };

  const handleExecuteWeeklyDistChange = () => {
    if (!pendingWeeklyDistChange) {
      setTransactionStatus("No pending weekly distribution change to execute");
      return;
    }

    const now = BigInt(Math.floor(Date.now() / 1000));
    if (now < pendingWeeklyDistChange.executeAfter) {
      const remainingTime = Number(pendingWeeklyDistChange.executeAfter - now);
      const hours = Math.floor(remainingTime / 3600);
      const minutes = Math.floor((remainingTime % 3600) / 60);
      setTransactionStatus(`Timelock not expired yet. ${hours}h ${minutes}m remaining`);
      return;
    }

    try {
      const calldata = generateSafeCalldata("executeWeeklyDistributionChange", []);
      
      setSafeModalData({
        title: "Execute Weekly Distribution Address Change",
        description: `This will execute the pending weekly distribution address change to ${pendingWeeklyDistChange.newAddress}.`,
        calldata,
        functionName: "executeWeeklyDistributionChange"
      });
      setShowSafeModal(true);
    } catch (error: any) {
      setTransactionStatus(`Error: ${error.message}`);
    }
  };

  const handleCancelWeeklyDistChange = () => {
    if (!pendingWeeklyDistChange) {
      setTransactionStatus("No pending weekly distribution change to cancel");
      return;
    }

    try {
      const calldata = generateSafeCalldata("cancelWeeklyDistributionChange", []);
      
      setSafeModalData({
        title: "Cancel Weekly Distribution Address Change",
        description: "This will cancel the pending weekly distribution address change.",
        calldata,
        functionName: "cancelWeeklyDistributionChange"
      });
      setShowSafeModal(true);
    } catch (error: any) {
      setTransactionStatus(`Error: ${error.message}`);
    }
  };

  const handleLockCriticalParams = () => {
    if (criticalParamsLocked) {
      setTransactionStatus("Critical parameters are already locked");
      return;
    }

    if (!currentVault || currentVault === ethers.ZeroAddress) {
      setTransactionStatus("Vault address must be set before locking");
      return;
    }

    if (!currentWeeklyDistribution || currentWeeklyDistribution === ethers.ZeroAddress) {
      setTransactionStatus("Weekly distribution address must be set before locking");
      return;
    }

    try {
      const calldata = generateSafeCalldata("lockCriticalParams", []);
      
      setSafeModalData({
        title: "Lock Critical Parameters",
        description: "⚠️ WARNING: This is irreversible! Once locked, you cannot change vault or weekly distribution addresses via normal setters. Future changes will require the 2-day timelock process.",
        calldata,
        functionName: "lockCriticalParams"
      });
      setShowSafeModal(true);
    } catch (error: any) {
      setTransactionStatus(`Error: ${error.message}`);
    }
  };

  const formatTimeRemaining = (executeAfter: bigint) => {
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (now >= executeAfter) {
      return "Ready to execute";
    }
    
    const remaining = Number(executeAfter - now);
    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    
    return `${days}d ${hours}h ${minutes}m remaining`;
  };

  return (
    <div className="space-y-6">
      {/* Current State */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Current BTC1USD Configuration
          </CardTitle>
          <CardDescription>
            View current critical addresses and lock status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Vault Address</Label>
                <p className="text-sm text-muted-foreground font-mono break-all">
                  {currentVault || "Not set"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(currentVault, "vault")}
              >
                {copiedField === "vault" ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Weekly Distribution Address</Label>
                <p className="text-sm text-muted-foreground font-mono break-all">
                  {currentWeeklyDistribution || "Not set"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(currentWeeklyDistribution, "weeklyDist")}
              >
                {copiedField === "weeklyDist" ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Critical Parameters Status</Label>
                <Badge variant={criticalParamsLocked ? "destructive" : "secondary"}>
                  {criticalParamsLocked ? <Lock className="h-3 w-3 mr-1" /> : null}
                  {criticalParamsLocked ? "Locked (Timelock Required)" : "Unlocked"}
                </Badge>
              </div>
              {!criticalParamsLocked && isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLockCriticalParams}
                >
                  Lock Parameters
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending Changes */}
      {(pendingVaultChange || pendingWeeklyDistChange) && (
        <Card className="border-orange-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <Clock className="h-5 w-5" />
              Pending Changes
            </CardTitle>
            <CardDescription>
              Timelock changes waiting for execution
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingVaultChange && (
              <div className="p-4 border border-orange-200 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Pending Vault Change</Label>
                  <Badge variant="outline">
                    {formatTimeRemaining(pendingVaultChange.executeAfter)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground font-mono break-all">
                  New Address: {pendingVaultChange.newAddress}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleExecuteVaultChange}
                    disabled={BigInt(Math.floor(Date.now() / 1000)) < pendingVaultChange.executeAfter}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Execute
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelVaultChange}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {pendingWeeklyDistChange && (
              <div className="p-4 border border-orange-200 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Pending Weekly Distribution Change</Label>
                  <Badge variant="outline">
                    {formatTimeRemaining(pendingWeeklyDistChange.executeAfter)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground font-mono break-all">
                  New Address: {pendingWeeklyDistChange.newAddress}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleExecuteWeeklyDistChange}
                    disabled={BigInt(Math.floor(Date.now() / 1000)) < pendingWeeklyDistChange.executeAfter}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Execute
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelWeeklyDistChange}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Initiate Changes */}
      {isAdmin && !criticalParamsLocked && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Initiate New Changes (2-Day Timelock)
            </CardTitle>
            <CardDescription>
              Start a timelock change for Vault or Weekly Distribution addresses
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Vault Change */}
            <div className="space-y-3">
              <Label htmlFor="newVault">New Vault Address</Label>
              <div className="flex gap-2">
                <Input
                  id="newVault"
                  placeholder="0x..."
                  value={newVaultAddress}
                  onChange={(e) => setNewVaultAddress(e.target.value)}
                  disabled={!!pendingVaultChange}
                />
                <Button
                  onClick={handleInitiateVaultChange}
                  disabled={!!pendingVaultChange || !newVaultAddress}
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Initiate
                </Button>
              </div>
              {pendingVaultChange && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    A vault change is already pending. Cancel it before initiating a new one.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Weekly Distribution Change */}
            <div className="space-y-3">
              <Label htmlFor="newWeeklyDist">New Weekly Distribution Address</Label>
              <div className="flex gap-2">
                <Input
                  id="newWeeklyDist"
                  placeholder="0x..."
                  value={newWeeklyDistAddress}
                  onChange={(e) => setNewWeeklyDistAddress(e.target.value)}
                  disabled={!!pendingWeeklyDistChange}
                />
                <Button
                  onClick={handleInitiateWeeklyDistChange}
                  disabled={!!pendingWeeklyDistChange || !newWeeklyDistAddress}
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Initiate
                </Button>
              </div>
              {pendingWeeklyDistChange && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    A weekly distribution change is already pending. Cancel it before initiating a new one.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Messages */}
      {transactionStatus && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{transactionStatus}</AlertDescription>
        </Alert>
      )}

      {/* Safe Transaction Modal */}
      <Dialog open={showSafeModal} onOpenChange={setShowSafeModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{safeModalData?.title}</DialogTitle>
            <DialogDescription>{safeModalData?.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Contract Address (BTC1USD)</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-muted rounded text-sm font-mono break-all">
                  {CONTRACT_ADDRESSES.BTC1USD_CONTRACT}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(CONTRACT_ADDRESSES.BTC1USD_CONTRACT, "contractAddress")}
                >
                  {copiedField === "contractAddress" ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Function Name</Label>
              <code className="block p-2 bg-muted rounded text-sm font-mono">
                {safeModalData?.functionName}
              </code>
            </div>

            <div className="space-y-2">
              <Label>Calldata (for Safe Transaction Builder)</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-muted rounded text-sm font-mono break-all max-h-32 overflow-y-auto">
                  {safeModalData?.calldata}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => safeModalData?.calldata && copyToClipboard(safeModalData.calldata, "calldata")}
                >
                  {copiedField === "calldata" ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Instructions:</strong>
                <ol className="list-decimal ml-4 mt-2 space-y-1 text-sm">
                  <li>Copy the contract address and calldata above</li>
                  <li>Go to your Safe wallet UI</li>
                  <li>Navigate to "New Transaction" → "Transaction Builder"</li>
                  <li>Paste the contract address and calldata</li>
                  <li>Review and submit for multisig approval</li>
                </ol>
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSafeModal(false)}>
              Close
            </Button>
            <Button asChild>
              <a
                href="https://app.safe.global"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Safe UI
                <ExternalLink className="h-4 w-4 ml-2" />
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
