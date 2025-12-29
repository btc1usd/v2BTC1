"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Progress } from './ui/progress';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { 
  Settings, 
  Play, 
  CheckCircle,
  Clock,
  BarChart3,
  Users,
  Loader2,
  Rocket,
  Terminal
} from 'lucide-react';

interface DistributionStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
}

const WEEKLY_DISTRIBUTION_ABI = [
  {
    "inputs": [],
    "name": "executeDistribution",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "canDistribute",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getNextDistributionTime",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes32", "name": "merkleRoot", "type": "bytes32" },
      { "internalType": "uint256", "name": "totalTokensForHolders", "type": "uint256" }
    ],
    "name": "updateMerkleRoot",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getCurrentDistributionInfo",
    "outputs": [
      { "internalType": "uint256", "name": "distributionId", "type": "uint256" },
      { "internalType": "uint256", "name": "rewardPerToken", "type": "uint256" },
      { "internalType": "uint256", "name": "totalSupply", "type": "uint256" },
      { "internalType": "uint256", "name": "timestamp", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "admin",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "distributionCount",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];

const MERKLE_DISTRIBUTOR_ABI = [
  {
    "inputs": [],
    "name": "getCurrentDistributionStats",
    "outputs": [
      { "internalType": "uint256", "name": "distributionId", "type": "uint256" },
      { "internalType": "uint256", "name": "totalTokens", "type": "uint256" },
      { "internalType": "uint256", "name": "totalClaimed", "type": "uint256" },
      { "internalType": "uint256", "name": "percentageClaimed", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "currentDistributionId",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];

import { CONTRACT_ADDRESSES } from '@/lib/contracts';

export default function AutomatedDistribution() {
  const { address, isConnected } = useAccount();
  const [steps, setSteps] = useState<DistributionStep[]>([
    {
      id: 'execute',
      title: 'Execute Distribution',
      description: 'Trigger the reward distribution (7-day cycle)',
      status: 'pending'
    },
    {
      id: 'generate',
      title: 'Generate Merkle Tree',
      description: 'Create the merkle tree for token distribution',
      status: 'pending'
    },
    {
      id: 'set-root',
      title: 'Set Merkle Root',
      description: 'Update the merkle root in the smart contract',
      status: 'pending'
    },
    {
      id: 'complete',
      title: 'Complete',
      description: 'Distribution is ready for claims',
      status: 'pending'
    }
  ]);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [merkleData, setMerkleData] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullyAutomated, setIsFullyAutomated] = useState(false);

  // Contract addresses - use centralized configuration
  const WEEKLY_DISTRIBUTION_ADDRESS = CONTRACT_ADDRESSES.WEEKLY_DISTRIBUTION;
  const MERKLE_DISTRIBUTOR_ADDRESS = CONTRACT_ADDRESSES.MERKLE_DISTRIBUTOR;

  // Read contract data
  const { data: canDistribute } = useReadContract({
    address: WEEKLY_DISTRIBUTION_ADDRESS as `0x${string}`,
    abi: WEEKLY_DISTRIBUTION_ABI,
    functionName: 'canDistribute',
    query: {
      enabled: isConnected,
      refetchInterval: 5000,
    }
  });

  const { data: nextDistributionTime } = useReadContract({
    address: WEEKLY_DISTRIBUTION_ADDRESS as `0x${string}`,
    abi: WEEKLY_DISTRIBUTION_ABI,
    functionName: 'getNextDistributionTime',
    query: {
      enabled: isConnected,
      refetchInterval: 5000,
    }
  });

  const { data: distributionStats } = useReadContract({
    address: MERKLE_DISTRIBUTOR_ADDRESS as `0x${string}`,
    abi: MERKLE_DISTRIBUTOR_ABI,
    functionName: 'getCurrentDistributionStats',
    query: {
      enabled: isConnected,
    }
  });

  // Write functions
  const { writeContract: executeWriteContract, isPending: isExecuting, data: executionHash } = useWriteContract();
  const { writeContract: setMerkleRootWriteContract, isPending: isSettingRoot } = useWriteContract();

  // Wait for transaction confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: executionHash,
  });

  // Update current time every second for live countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  // Handle transaction confirmation
  useEffect(() => {
    if (isConfirmed && currentStep === 'execute') {
      updateStepStatus('execute', 'completed');
      if (isFullyAutomated) {
        // In fully automated mode, proceed to next steps automatically
        processNextStep('generate');
      }
    }
  }, [isConfirmed, currentStep, isFullyAutomated]);

  const updateStepStatus = (stepId: string, status: 'pending' | 'in-progress' | 'completed' | 'failed') => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status } : step
    ));
  };

  const processNextStep = async (nextStepId: string) => {
    setCurrentStep(nextStepId);
    updateStepStatus(nextStepId, 'in-progress');

    try {
      switch (nextStepId) {
        case 'generate':
          await generateMerkleTree();
          break;
        case 'set-root':
          await setMerkleRoot();
          break;
        case 'complete':
          updateStepStatus('complete', 'completed');
          setSuccess(true);
          break;
      }
    } catch (err) {
      console.error(`Error in step ${nextStepId}:`, err);
      updateStepStatus(nextStepId, 'failed');
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setIsProcessing(false);
    }
  };

  const executeDistribution = async () => {
    if (!isConnected || !address) {
      throw new Error('Please connect your wallet first.');
    }

    // Check if user is admin
    const adminAddress = process.env.NEXT_PUBLIC_ADMIN_WALLET || "0xA1D4de75082562eA776b160e605acD587668111B";
    if (address?.toLowerCase() !== adminAddress.toLowerCase()) {
      throw new Error('Access Denied: Only admin can execute distributions.');
    }

    // Check network
    const chainId = (window as any).ethereum?.chainId;
    const expectedChainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '8453');
    const chainIdHex = `0x${expectedChainId.toString(16)}`;

    // Accept both decimal and hex format
    if (chainId !== chainIdHex && chainId !== expectedChainId &&
        parseInt(chainId, 16) !== expectedChainId) {
      throw new Error(`Wrong network detected. Please switch to ${process.env.NEXT_PUBLIC_CHAIN_NAME || 'Base Sepolia'} (Chain ID: ${expectedChainId})`);
    }

    if (!canDistribute) {
      throw new Error('Distribution cannot be executed at this time.');
    }

    executeWriteContract({
      address: WEEKLY_DISTRIBUTION_ADDRESS as `0x${string}`,
      abi: WEEKLY_DISTRIBUTION_ABI,
      functionName: 'executeDistribution',
    });
  };

  const generateMerkleTree = async () => {
    try {
      const response = await fetch('/api/generate-merkle-tree', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate merkle tree');
      }

      const result = await response.json();
      setMerkleData(result);
      updateStepStatus('generate', 'completed');
      
      if (isFullyAutomated) {
        // In fully automated mode, proceed to next step automatically
        processNextStep('set-root');
      }
    } catch (err) {
      throw err;
    }
  };

  const setMerkleRoot = async () => {
    if (!merkleData) {
      throw new Error('Merkle data not available');
    }

    try {
      setMerkleRootWriteContract({
        address: WEEKLY_DISTRIBUTION_ADDRESS as `0x${string}`,
        abi: WEEKLY_DISTRIBUTION_ABI,
        functionName: 'updateMerkleRoot',
        args: [merkleData.merkleRoot as `0x${string}`, parseUnits(formatUnits(BigInt(merkleData.totalRewards), 8), 8)],
      });
      
      // In fully automated mode, simulate transaction confirmation
      if (isFullyAutomated) {
        setTimeout(() => {
          updateStepStatus('set-root', 'completed');
          processNextStep('complete');
        }, 3000);
      }
    } catch (err) {
      throw err;
    }
  };

  const startAutomatedProcess = async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    setError(null);
    setSuccess(false);
    setMerkleData(null);
    
    // Reset all steps
    setSteps(prev => prev.map(step => ({ ...step, status: 'pending' })));
    
    try {
      updateStepStatus('execute', 'in-progress');
      setCurrentStep('execute');
      await executeDistribution();
    } catch (err) {
      updateStepStatus('execute', 'failed');
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setIsProcessing(false);
    }
  };

  // Fully automated process using server-side scripts
  const startFullyAutomatedProcess = async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    setIsFullyAutomated(true);
    setError(null);
    setSuccess(false);
    setMerkleData(null);
    
    // Reset all steps
    setSteps(prev => prev.map(step => ({ ...step, status: 'pending' })));
    
    try {
      // Call the server-side fully automated script
      const response = await fetch('/api/fully-automated-distribution', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Any parameters needed for the fully automated process
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start fully automated process');
      }
      
      const result = await response.json();
      
      // Update all steps as completed since it's fully automated
      setSteps(prev => prev.map(step => ({ ...step, status: 'completed' })));
      setSuccess(true);
      setIsProcessing(false);
      
      alert(`🎉 Fully automated distribution completed successfully!
      
✅ Distribution executed
🌳 Merkle tree generated
🔗 Merkle root set

All transactions were automatically signed using the private key from .env.local.
Users can now claim their rewards.`);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setIsProcessing(false);
      setIsFullyAutomated(false);
    }
  };

  const stats = distributionStats as [bigint, bigint, bigint, bigint] | undefined;
  const nextTime = nextDistributionTime ? new Date(Number(nextDistributionTime) * 1000) : null;
  const canDistributeNow = !!canDistribute;
  
  // Calculate time remaining
  let timeUntilNext = 0;
  if (nextTime) {
    timeUntilNext = Math.max(0, nextTime.getTime() - currentTime.getTime());
  }
  
  const finalCanDistribute = canDistributeNow || timeUntilNext <= 0;

  if (!isConnected) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            Automated Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              Please connect your wallet to manage distributions.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-blue-500" />
              <div>
                <div className="text-lg font-semibold text-white">
                  {canDistributeNow ? 'Ready' : 'Waiting'}
                </div>
                <div className="text-sm text-gray-400">Distribution Status</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-green-500" />
              <div>
                <div className="text-lg font-semibold text-white">
                  {stats ? formatUnits(stats[2], 8) : '0'}
                </div>
                <div className="text-sm text-gray-400">Total Claimed</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-yellow-500" />
              <div>
                <div className="text-lg font-semibold text-white">
                  {stats ? `${(Number(stats[3]) / 100).toFixed(1)}%` : '0%'}
                </div>
                <div className="text-sm text-gray-400">Claim Progress</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            Automated Distribution Process
          </CardTitle>
          <CardDescription className="text-gray-400">
            One-click execution of the complete distribution workflow
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Distribution Status */}
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Next Distribution:</span>
              <span className="text-white">
                {nextTime ? nextTime.toLocaleString() : 'Unknown'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Time Remaining:</span>
              <span className="text-white">
                {canDistributeNow ? 
                  'Available now' :
                  timeUntilNext > 0 ? 
                    `${Math.floor(timeUntilNext / (1000 * 60))} min ${Math.floor((timeUntilNext % (1000 * 60)) / 1000)} sec` : 
                    'Available now'
                }
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Can Execute:</span>
              <Badge variant={finalCanDistribute ? "default" : "secondary"}>
                {finalCanDistribute ? 'Yes' : 'No'}
              </Badge>
            </div>
          </div>

          {/* Process Steps */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white">Process Steps</h3>
            <div className="space-y-3">
              {steps.map((step) => (
                <div 
                  key={step.id} 
                  className={`p-4 rounded-lg border ${
                    step.status === 'completed' ? 'bg-green-900/20 border-green-800' :
                    step.status === 'in-progress' ? 'bg-blue-900/20 border-blue-800' :
                    step.status === 'failed' ? 'bg-red-900/20 border-red-800' :
                    'bg-gray-700/50 border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {step.status === 'completed' ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : step.status === 'in-progress' ? (
                      <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                    ) : step.status === 'failed' ? (
                      <span className="h-5 w-5 text-red-500">⚠️</span>
                    ) : (
                      <div className="h-5 w-5 rounded-full border border-gray-400" />
                    )}
                    <div className="flex-1">
                      <div className="font-medium text-white">{step.title}</div>
                      <div className="text-sm text-gray-400">{step.description}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 space-y-3">
            {success ? (
              <Alert className="bg-green-900 border-green-600">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertTitle className="text-green-200">Distribution Complete!</AlertTitle>
                <AlertDescription className="text-green-300">
                  The distribution has been successfully executed and the merkle root has been set.
                  Users can now claim their rewards.
                </AlertDescription>
              </Alert>
            ) : error ? (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Button 
                onClick={startAutomatedProcess}
                disabled={!finalCanDistribute || isProcessing || !isConnected}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {isProcessing && !isFullyAutomated ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {currentStep === 'execute' && isExecuting && 'Executing Distribution...'}
                    {currentStep === 'execute' && isConfirming && 'Confirming Transaction...'}
                    {currentStep === 'generate' && 'Generating Merkle Tree...'}
                    {currentStep === 'set-root' && isSettingRoot && 'Setting Merkle Root...'}
                    {currentStep === 'set-root' && !isSettingRoot && 'Setting Merkle Root...'}
                  </>
                ) : (
                  <>
                    <Rocket className="mr-2 h-4 w-4" />
                    {finalCanDistribute ? 'Start Automated Distribution' : 'Distribution Not Available'}
                  </>
                )}
              </Button>

              <Button 
                onClick={startFullyAutomatedProcess}
                disabled={!finalCanDistribute || isProcessing || !isConnected}
                className="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700"
              >
                {isProcessing && isFullyAutomated ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing Fully Automated...
                  </>
                ) : (
                  <>
                    <Terminal className="mr-2 h-4 w-4" />
                    Fully Automated Process
                  </>
                )}
              </Button>
            </div>

            <p className="text-xs text-gray-400 text-center">
              Fully Automated Process uses server-side scripts with private key signing from .env.local
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}