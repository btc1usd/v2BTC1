"use client";

import React, { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SafeTransactionModal from './safe-transaction-modal';
import { 
  Shield, Clock, CheckCircle2, XCircle, AlertTriangle, Loader2,
  ArrowRight, Calendar, Lock, Unlock, RefreshCw
} from 'lucide-react';
import { CONTRACT_ADDRESSES } from '@/lib/contracts';
import { ethers } from 'ethers';

const BTC1USD_ABI = [
  "function vault() view returns (address)",
  "function weeklyDistribution() view returns (address)",
  "function pendingVaultChange() view returns (address newAddress, uint256 executeAfter)",
  "function pendingWeeklyDistributionChange() view returns (address newAddress, uint256 executeAfter)",
  "function initiateVaultChange(address newVault)",
  "function executeVaultChange()",
  "function cancelVaultChange()",
  "function initiateWeeklyDistributionChange(address newDist)",
  "function executeWeeklyDistributionChange()",
  "function cancelWeeklyDistributionChange()",
  "function owner() view returns (address)",
  "function TIMELOCK_DELAY() view returns (uint256)",
] as const;

// Type for pending change data
type PendingChange = readonly [string, bigint];

export default function BTC1USDTimelockManager() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<'vault' | 'distribution'>('vault');
  
  // State for Safe Modal
  const [safeModalOpen, setSafeModalOpen] = useState(false);
  const [safeModalData, setSafeModalData] = useState<{
    title: string;
    description: string;
    functionSignature: string;
    calldata: string;
  } | null>(null);

  // Input states
  const [newVaultAddress, setNewVaultAddress] = useState('');
  const [newDistributionAddress, setNewDistributionAddress] = useState('');

  // Read contract data
  const { data: currentVault } = useReadContract({
    address: CONTRACT_ADDRESSES.BTC1USD as `0x${string}`,
    abi: BTC1USD_ABI,
    functionName: 'vault',
  });

  const { data: currentDistribution } = useReadContract({
    address: CONTRACT_ADDRESSES.BTC1USD as `0x${string}`,
    abi: BTC1USD_ABI,
    functionName: 'weeklyDistribution',
  });

  const { data: pendingVault, refetch: refetchPendingVault } = useReadContract({
    address: CONTRACT_ADDRESSES.BTC1USD as `0x${string}`,
    abi: BTC1USD_ABI,
    functionName: 'pendingVaultChange',
  });

  const { data: pendingDistribution, refetch: refetchPendingDistribution } = useReadContract({
    address: CONTRACT_ADDRESSES.BTC1USD as `0x${string}`,
    abi: BTC1USD_ABI,
    functionName: 'pendingWeeklyDistributionChange',
  });

  const { data: owner } = useReadContract({
    address: CONTRACT_ADDRESSES.BTC1USD as `0x${string}`,
    abi: BTC1USD_ABI,
    functionName: 'owner',
  });

  const { data: timelockDelay } = useReadContract({
    address: CONTRACT_ADDRESSES.BTC1USD as `0x${string}`,
    abi: BTC1USD_ABI,
    functionName: 'TIMELOCK_DELAY',
  });

  const isOwner = owner && address && String(owner).toLowerCase() === address.toLowerCase();
  const delayInDays = timelockDelay ? Number(timelockDelay) / 86400 : 2;

  // Cast pending data for type safety
  const pendingVaultData = pendingVault as PendingChange | undefined;
  const pendingDistData = pendingDistribution as PendingChange | undefined;

  // Helper to format time remaining
  const getTimeRemaining = (executeAfter: bigint) => {
    const now = Math.floor(Date.now() / 1000);
    const remaining = Number(executeAfter) - now;
    
    if (remaining <= 0) return 'Ready to execute';
    
    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  };

  // Check if timelock has expired
  const isTimelockExpired = (executeAfter: bigint) => {
    const now = Math.floor(Date.now() / 1000);
    return Number(executeAfter) <= now;
  };

  // Prepare Safe transaction
  const prepareSafeTransaction = (
    functionName: string,
    args: any[],
    title: string,
    description: string
  ) => {
    const iface = new ethers.Interface(BTC1USD_ABI);
    const calldata = iface.encodeFunctionData(functionName as any, args);

    setSafeModalData({
      title,
      description,
      functionSignature: `${functionName}(${args.map((_, i) => `arg${i}`).join(', ')})`,
      calldata,
    });
    setSafeModalOpen(true);
  };

  // Handle initiate vault change
  const handleInitiateVaultChange = () => {
    if (!ethers.isAddress(newVaultAddress)) {
      alert('Please enter a valid Ethereum address');
      return;
    }

    prepareSafeTransaction(
      'initiateVaultChange',
      [newVaultAddress],
      'Initiate Vault Address Change',
      `This will start a ${delayInDays}-day timelock to change the Vault address from ${currentVault} to ${newVaultAddress}. After the timelock expires, you must execute the change.`
    );
  };

  // Handle execute vault change
  const handleExecuteVaultChange = () => {
    prepareSafeTransaction(
      'executeVaultChange',
      [],
      'Execute Vault Address Change',
      `This will finalize the vault address change to ${(pendingVaultData as any)?.[0]}. The timelock has expired and the change is ready to be executed.`
    );
  };

  // Handle cancel vault change
  const handleCancelVaultChange = () => {
    prepareSafeTransaction(
      'cancelVaultChange',
      [],
      'Cancel Vault Address Change',
      `This will cancel the pending vault address change to ${(pendingVaultData as any)?.[0]}. The timelock will be reset.`
    );
  };

  // Handle initiate distribution change
  const handleInitiateDistributionChange = () => {
    if (!ethers.isAddress(newDistributionAddress)) {
      alert('Please enter a valid Ethereum address');
      return;
    }

    prepareSafeTransaction(
      'initiateWeeklyDistributionChange',
      [newDistributionAddress],
      'Initiate Weekly Distribution Address Change',
      `This will start a ${delayInDays}-day timelock to change the Weekly Distribution address from ${currentDistribution} to ${newDistributionAddress}. After the timelock expires, you must execute the change.`
    );
  };

  // Handle execute distribution change
  const handleExecuteDistributionChange = () => {
    prepareSafeTransaction(
      'executeWeeklyDistributionChange',
      [],
      'Execute Weekly Distribution Address Change',
      `This will finalize the weekly distribution address change to ${(pendingDistData as any)?.[0]}. The timelock has expired and the change is ready to be executed.`
    );
  };

  // Handle cancel distribution change
  const handleCancelDistributionChange = () => {
    prepareSafeTransaction(
      'cancelWeeklyDistributionChange',
      [],
      'Cancel Weekly Distribution Address Change',
      `This will cancel the pending weekly distribution address change to ${(pendingDistData as any)?.[0]}. The timelock will be reset.`
    );
  };

  // Auto-refresh pending changes
  useEffect(() => {
    const interval = setInterval(() => {
      refetchPendingVault();
      refetchPendingDistribution();
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, []);

  if (!isConnected) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="pt-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Please connect your wallet to manage BTC1USD timelock settings.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!isOwner) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="pt-6">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription className="space-y-2">
              <div>Only the contract owner can manage timelock settings.</div>
              {owner ? (
                <div>
                  <strong>Current owner:</strong>{' '}
                  <code className="text-xs bg-gray-700 px-2 py-1 rounded">
                    {String(owner)}
                  </code>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Loading owner address...
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                Connect as the owner to generate Safe UI modal transactions for multisig execution.
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-lg">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            BTC1USD Timelock Manager
          </CardTitle>
          <CardDescription className="text-gray-400">
            Manage critical address changes with {delayInDays}-day timelock security via Safe Multisig
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Info Alert */}
          <Alert className="bg-blue-950/30 border-blue-800">
            <Clock className="h-4 w-4 text-blue-400" />
            <AlertDescription className="text-sm text-blue-200">
              All changes require a {delayInDays}-day timelock delay and Safe multisig approval. This provides time for the community to review and ensures security.
            </AlertDescription>
          </Alert>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-gray-700/50">
              <TabsTrigger value="vault">
                <Lock className="w-4 h-4 mr-2" />
                Vault Address
              </TabsTrigger>
              <TabsTrigger value="distribution">
                <Calendar className="w-4 h-4 mr-2" />
                Weekly Distribution
              </TabsTrigger>
            </TabsList>

            {/* Vault Tab */}
            <TabsContent value="vault" className="space-y-4 mt-4">
              {/* Current Address */}
              <div className="p-4 bg-gray-700/30 rounded-lg border border-gray-600">
                <Label className="text-sm text-gray-400 mb-2 block">Current Vault Address</Label>
                <code className="text-sm font-mono text-white break-all">{String(currentVault)}</code>
              </div>

              {/* Pending Change Status */}
              {pendingVaultData && pendingVaultData[0] !== ethers.ZeroAddress ? (
                <div className="p-4 bg-orange-950/30 border border-orange-800 rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-orange-400" />
                    <h3 className="font-semibold text-orange-200">Pending Change</h3>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-400">New Address: </span>
                      <code className="text-orange-200 font-mono text-xs break-all">{pendingVaultData[0]}</code>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">Status: </span>
                      <Badge variant={isTimelockExpired(pendingVaultData[1]) ? "default" : "secondary"}>
                        {getTimeRemaining(pendingVaultData[1])}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-gray-400">Execute After: </span>
                      <span className="text-orange-200">
                        {new Date(Number(pendingVaultData[1]) * 1000).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    {isTimelockExpired(pendingVaultData[1]) && (
                      <Button
                        onClick={handleExecuteVaultChange}
                        className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Execute Change
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      onClick={handleCancelVaultChange}
                      className="flex-1"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Cancel Change
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="newVault" className="text-gray-300">New Vault Address</Label>
                    <Input
                      id="newVault"
                      placeholder="0x..."
                      value={newVaultAddress}
                      onChange={(e) => setNewVaultAddress(e.target.value)}
                      className="mt-1 bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <Button
                    onClick={handleInitiateVaultChange}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    disabled={!newVaultAddress}
                  >
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Initiate Vault Change
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* Weekly Distribution Tab */}
            <TabsContent value="distribution" className="space-y-4 mt-4">
              {/* Current Address */}
              <div className="p-4 bg-gray-700/30 rounded-lg border border-gray-600">
                <Label className="text-sm text-gray-400 mb-2 block">Current Weekly Distribution Address</Label>
                <code className="text-sm font-mono text-white break-all">{String(currentDistribution)}</code>
              </div>

              {/* Pending Change Status */}
              {pendingDistData && pendingDistData[0] !== ethers.ZeroAddress ? (
                <div className="p-4 bg-orange-950/30 border border-orange-800 rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-orange-400" />
                    <h3 className="font-semibold text-orange-200">Pending Change</h3>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-400">New Address: </span>
                      <code className="text-orange-200 font-mono text-xs break-all">{pendingDistData[0]}</code>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">Status: </span>
                      <Badge variant={isTimelockExpired(pendingDistData[1]) ? "default" : "secondary"}>
                        {getTimeRemaining(pendingDistData[1])}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-gray-400">Execute After: </span>
                      <span className="text-orange-200">
                        {new Date(Number(pendingDistData[1]) * 1000).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    {isTimelockExpired(pendingDistData[1]) && (
                      <Button
                        onClick={handleExecuteDistributionChange}
                        className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Execute Change
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      onClick={handleCancelDistributionChange}
                      className="flex-1"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Cancel Change
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="newDistribution" className="text-gray-300">New Weekly Distribution Address</Label>
                    <Input
                      id="newDistribution"
                      placeholder="0x..."
                      value={newDistributionAddress}
                      onChange={(e) => setNewDistributionAddress(e.target.value)}
                      className="mt-1 bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <Button
                    onClick={handleInitiateDistributionChange}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    disabled={!newDistributionAddress}
                  >
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Initiate Distribution Change
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Safe Transaction Modal */}
      {safeModalData && (
        <SafeTransactionModal
          isOpen={safeModalOpen}
          onClose={() => setSafeModalOpen(false)}
          title={safeModalData.title}
          description={safeModalData.description}
          contractAddress={CONTRACT_ADDRESSES.BTC1USD}
          functionSignature={safeModalData.functionSignature}
          calldata={safeModalData.calldata}
          category="security"
        />
      )}
    </>
  );
}
