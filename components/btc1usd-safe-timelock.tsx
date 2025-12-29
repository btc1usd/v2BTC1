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

interface PendingChange {
  newAddress: string;
  executeAfter: bigint;
}

interface SafeTimelockProps {
  isAdmin: boolean;
}

export default function BTC1USDSafeTimelock({ isAdmin }: SafeTimelockProps) {
  const { address, isConnected } = useAccount();
  
  // Create ethers Interface for encoding calldata
  const btc1usdInterface = new ethers.Interface(ABIS.BTC1USD);
  
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
    switch (functionName) {
      case "initiateVaultChange":
        return btc1usdInterface.encodeFunctionData("initiateVaultChange", [params[0]]);
      
      case "executeVaultChange":
        return btc1usdInterface.encodeFunctionData("executeVaultChange", []);
      
      case "cancelVaultChange":
        return btc1usdInterface.encodeFunctionData("cancelVaultChange", []);
      
      case "initiateWeeklyDistributionChange":
        return btc1usdInterface.encodeFunctionData("initiateWeeklyDistributionChange", [params[0]]);
      
      case "executeWeeklyDistributionChange":
        return btc1usdInterface.encodeFunctionData("executeWeeklyDistributionChange", []);
      
      case "cancelWeeklyDistributionChange":
        return btc1usdInterface.encodeFunctionData("cancelWeeklyDistributionChange", []);
      
      case "lockCriticalParams":
        return btc1usdInterface.encodeFunctionData("lockCriticalParams", []);
      
      default:
        throw new Error(`Unknown function: ${functionName}`);
    }
  };

  const handleInitiateVaultChange = () => {
    if (!ethers.isAddress(newVaultAddress)) {
      setTransactionStatus("Invalid vault address");
      return;
    }

    if (criticalParamsLocked) {
      setTransactionStatus("⚠️ ERROR: Critical parameters are LOCKED. You cannot initiate changes when locked. The initiateVaultChange function has the 'onlyOwnerUnlocked' modifier which blocks this action.");
      return;
    }

    if (pendingVaultChange) {
      setTransactionStatus("A vault change is already pending. Cancel it first.");
      return;
    }
    
    if (newVaultAddress.toLowerCase() === currentVault.toLowerCase()) {
      setTransactionStatus("Error: New vault address is the same as the current vault address.");
      return;
    }

    try {
      const calldata = generateSafeCalldata("initiateVaultChange", [newVaultAddress]);
      
      // Verify the calldata was generated correctly
      console.log('=== INITIATE VAULT CHANGE CALLDATA ===');
      console.log('Function: initiateVaultChange(address)');
      console.log('Parameter:', newVaultAddress);
      console.log('Calldata:', calldata);
      console.log('Calldata length:', calldata.length);
      console.log('Function selector:', calldata.slice(0, 10));
      console.log('======================================');
      
      // Check if Safe is configured
      const safeAddress = process.env.NEXT_PUBLIC_SAFE_ADDRESS;
      
      if (!safeAddress) {
        // No Safe configured - show error with instructions
        setTransactionStatus(
          "⚠️ ERROR: NEXT_PUBLIC_SAFE_ADDRESS not configured in .env file. " +
          "Please add the Safe multisig address to your environment variables. " +
          "The calldata has been logged to console for manual execution."
        );
        console.warn('\n⚠️  SAFE ADDRESS NOT CONFIGURED');
        console.warn('Add this to your .env file:');
        console.warn('NEXT_PUBLIC_SAFE_ADDRESS=<your-safe-address>');
        console.warn('\nTo execute manually, use the calldata above with contract:', CONTRACT_ADDRESSES.BTC1USD_CONTRACT);
        return;
      }
      
      setSafeModalData({
        title: "Initiate Vault Address Change",
        description: `This will start a 2-day timelock to change the Vault address from ${currentVault} to ${newVaultAddress}. After 2 days, you can execute the change.`,
        calldata,
        functionName: "initiateVaultChange"
      });
      setShowSafeModal(true);
    } catch (error: any) {
      console.error('Error generating calldata:', error);
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
      setTransactionStatus("⚠️ ERROR: Critical parameters are LOCKED. You cannot initiate changes when locked. The initiateWeeklyDistributionChange function has the 'onlyOwnerUnlocked' modifier which blocks this action.");
      return;
    }

    if (pendingWeeklyDistChange) {
      setTransactionStatus("A weekly distribution change is already pending. Cancel it first.");
      return;
    }
    
    if (newWeeklyDistAddress.toLowerCase() === currentWeeklyDistribution.toLowerCase()) {
      setTransactionStatus("Error: New weekly distribution address is the same as the current address.");
      return;
    }

    try {
      const calldata = generateSafeCalldata("initiateWeeklyDistributionChange", [newWeeklyDistAddress]);
      
      console.log('=== INITIATE WEEKLY DIST CHANGE CALLDATA ===');
      console.log('Function: initiateWeeklyDistributionChange(address)');
      console.log('Parameter:', newWeeklyDistAddress);
      console.log('Calldata:', calldata);
      console.log('============================================');
      
      setSafeModalData({
        title: "Initiate Weekly Distribution Address Change",
        description: `This will start a 2-day timelock to change the WeeklyDistribution address from ${currentWeeklyDistribution} to ${newWeeklyDistAddress}. After 2 days, you can execute the change.`,
        calldata,
        functionName: "initiateWeeklyDistributionChange"
      });
      setShowSafeModal(true);
    } catch (error: any) {
      console.error('Error generating calldata:', error);
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
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 border-2 border-blue-500/70 shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2 sm:gap-3 mb-2">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/50">
                <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg sm:text-2xl font-bold text-white">
                  {safeModalData?.title}
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm text-blue-200">
                  Safe Multi-Signature Transaction
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 sm:space-y-4 py-2 sm:py-4">
            {/* Contract Address */}
            <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border-2 border-green-500/50 rounded-lg p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                <Label className="text-xs sm:text-sm text-green-300 font-bold uppercase">1️⃣ Contract Address</Label>
                <Button
                  size="sm"
                  className="h-8 px-3 sm:px-4 bg-green-600 hover:bg-green-700 text-white font-semibold text-xs sm:text-sm w-full sm:w-auto"
                  onClick={() => copyToClipboard(CONTRACT_ADDRESSES.BTC1USD_CONTRACT, 'contract')}
                >
                  {copiedField === 'contract' ? (
                    <><CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copied!</>
                  ) : (
                    <><Copy className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copy</>
                  )}
                </Button>
              </div>
              <code className="text-xs sm:text-sm text-green-300 bg-black/60 px-3 sm:px-4 py-2 sm:py-3 rounded font-mono block overflow-x-auto border border-green-500/40 break-all">
                {CONTRACT_ADDRESSES.BTC1USD_CONTRACT}
              </code>
            </div>

            {/* Encoded Calldata */}
            <div className="bg-gradient-to-br from-cyan-900/20 to-blue-900/20 border-2 border-cyan-500/50 rounded-lg p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                <Label className="text-xs sm:text-sm text-cyan-300 font-bold uppercase">2️⃣ Encoded Calldata</Label>
                <Button
                  size="sm"
                  className="h-8 px-3 sm:px-4 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-xs sm:text-sm w-full sm:w-auto"
                  onClick={() => safeModalData?.calldata && copyToClipboard(safeModalData.calldata, 'calldata')}
                >
                  {copiedField === 'calldata' ? (
                    <><CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copied!</>
                  ) : (
                    <><Copy className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copy Calldata</>
                  )}
                </Button>
              </div>
              <code className="text-xs sm:text-sm text-cyan-200 bg-black/60 px-3 sm:px-4 py-2 sm:py-3 rounded font-mono block overflow-x-auto max-h-32 border border-cyan-500/40 break-all">
                {safeModalData?.calldata}
              </code>
            </div>

            {/* Parameters */}
            <div className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 border border-gray-600/50 rounded-lg p-3 sm:p-4">
              <h3 className="text-xs sm:text-sm font-bold text-white mb-2 sm:mb-3">Transaction Parameters</h3>
              <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                  <span className="text-gray-400">Function:</span>
                  <code className="text-blue-300 bg-black/40 px-2 sm:px-3 py-1 rounded font-mono text-xs sm:text-sm">{safeModalData?.functionName}</code>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                  <span className="text-gray-400">Description:</span>
                  <span className="text-xs text-gray-300 bg-black/40 px-2 py-1 rounded max-w-full sm:max-w-[400px] text-right">{safeModalData?.description}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                  <span className="text-gray-400">Value:</span>
                  <code className="text-yellow-300 bg-black/40 px-2 sm:px-3 py-1 rounded font-mono text-xs sm:text-sm">0 ETH</code>
                </div>
                {(safeModalData?.functionName === "initiateVaultChange" || safeModalData?.functionName === "initiateWeeklyDistributionChange") && (
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <div className="flex flex-col gap-2">
                      <span className="text-gray-400 font-semibold">Decoded Parameters:</span>
                      <div className="bg-black/60 p-2 rounded border border-purple-500/30">
                        <code className="text-purple-300 text-xs font-mono break-all">
                          {safeModalData?.functionName === "initiateVaultChange" ? 
                            `newVault: ${newVaultAddress}` : 
                            `newDist: ${newWeeklyDistAddress}`
                          }
                        </code>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Verification Notice */}
            <div className="bg-gradient-to-br from-yellow-900/20 to-orange-900/20 border border-yellow-500/50 rounded-lg p-3">
              <div className="flex gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-yellow-200">
                  <p className="font-semibold mb-1">Verification Checklist:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-yellow-300/90">
                    <li>Contract address matches BTC1USD: {CONTRACT_ADDRESSES.BTC1USD_CONTRACT}</li>
                    <li>Function selector (first 10 chars of calldata): {safeModalData?.calldata.slice(0, 10)}</li>
                    <li>Value is 0 ETH (no native token transfer)</li>
                    <li>Transaction must be executed from Safe multisig owner address</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3 border-t-2 border-blue-700 pt-3 sm:pt-4">
            <Button
              variant="outline"
              onClick={() => setShowSafeModal(false)}
              className="flex-1 border-2 border-gray-600 hover:bg-gray-800 text-gray-200 font-semibold h-10 sm:h-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const safeAddress = process.env.NEXT_PUBLIC_SAFE_ADDRESS;
                if (!safeAddress) {
                  alert('⚠️ NEXT_PUBLIC_SAFE_ADDRESS not configured. Please add it to your .env file.');
                  return;
                }
                const safeUrl = `https://app.safe.global/base-sep:${safeAddress}`;
                window.open(safeUrl, '_blank');
              }}
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg shadow-blue-500/40 border-2 border-blue-400/60 font-semibold h-10 sm:h-auto"
            >
              <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Open Safe UI
              <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
