"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings, 
  Play, 
  Pause, 
  RefreshCw, 
  Download, 
  Upload, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  BarChart3,
  Users,
  Coins,
  Loader2,
  Rocket,
  Terminal,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { DistributionAnalyticsDashboard } from '@/components/distribution-analytics-dashboard';

interface DistributionHistory {
  id: string;
  timestamp: string;
  totalRewards: string;
  totalClaimed: string;
  claimCount: number;
  merkleRoot: string;
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
    "name": "pause",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "unpause",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "paused",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  }
];

import { CONTRACT_ADDRESSES } from '@/lib/contracts';

export default function EnhancedMerkleManagement() {
  const { address, isConnected } = useAccount();
  const [merkleRootInput, setMerkleRootInput] = useState('');
  const [totalTokens, setTotalTokens] = useState('');
  const [distributionHistory, setDistributionHistory] = useState<DistributionHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPrerequisites, setShowPrerequisites] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState('execute');

  // Contract addresses - use centralized configuration
  const WEEKLY_DISTRIBUTION_ADDRESS = CONTRACT_ADDRESSES.WEEKLY_DISTRIBUTION;
  const MERKLE_DISTRIBUTOR_ADDRESS = CONTRACT_ADDRESSES.MERKLE_DISTRIBUTOR;

  // Read contract data with more frequent updates
  const { data: canDistribute, refetch: refetchCanDistribute } = useReadContract({
    address: WEEKLY_DISTRIBUTION_ADDRESS as `0x${string}`,
    abi: WEEKLY_DISTRIBUTION_ABI,
    functionName: 'canDistribute',
    query: {
      enabled: isConnected,
      refetchInterval: 5000, // Refetch every 5 seconds
    }
  });

  const { data: nextDistributionTime, refetch: refetchNextTime } = useReadContract({
    address: WEEKLY_DISTRIBUTION_ADDRESS as `0x${string}`,
    abi: WEEKLY_DISTRIBUTION_ABI,
    functionName: 'getNextDistributionTime',
    query: {
      enabled: isConnected,
      refetchInterval: 5000, // Refetch every 5 seconds
    }
  });

  const { data: currentDistributionInfo } = useReadContract({
    address: WEEKLY_DISTRIBUTION_ADDRESS as `0x${string}`,
    abi: WEEKLY_DISTRIBUTION_ABI,
    functionName: 'getCurrentDistributionInfo',
    query: {
      enabled: isConnected,
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

  const { data: isPaused } = useReadContract({
    address: MERKLE_DISTRIBUTOR_ADDRESS as `0x${string}`,
    abi: MERKLE_DISTRIBUTOR_ABI,
    functionName: 'paused',
    query: {
      enabled: isConnected,
    }
  });

  // Write functions
  const { writeContract, isPending: isExecuting, data: executionHash, error: executionError } = useWriteContract();
  const { writeContract: writeMerkleContract, isPending: isSettingRoot } = useWriteContract();
  const { writeContract: pauseWriteContract, isPending: isPausing } = useWriteContract();
  const { writeContract: unpauseWriteContract, isPending: isUnpausing } = useWriteContract();

  // Wait for transaction confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: executionHash,
  });

  // Add effect to handle transaction success
  useEffect(() => {
    if (isConfirmed) {
      console.log('Distribution executed successfully!');
      
      // Show success message and offer to auto-generate merkle tree
      const shouldAutoGenerate = window.confirm(
        '🎉 Distribution executed successfully!\n\nWould you like to automatically generate the merkle tree and set the merkle root now?\n\nClick OK to continue with the full automated process, or Cancel to do it manually later.'
      );
      
      if (shouldAutoGenerate) {
        // Auto-generate merkle tree and set merkle root
        handleAutomatedProcess();
      } else {
        alert('Distribution completed! Please generate the merkle tree in the "Merkle Tree" tab when ready.');
      }
    }
  }, [isConfirmed]);

  // Add effect to handle transaction errors
  useEffect(() => {
    if (executionError) {
      console.error('Distribution execution failed:', executionError);
      alert(`Distribution execution failed: ${executionError.message}`);
    }
  }, [executionError]);

  // Manual refresh function
  const refreshData = async () => {
    console.log('Manually refreshing contract data...');
    await Promise.all([
      refetchCanDistribute(),
      refetchNextTime()
    ]);
    console.log('Contract data refreshed');
  };
  
  // Contract validation function
  const validateContracts = async () => {
    try {
      console.log('=== CONTRACT VALIDATION ===');
      console.log('Weekly Distribution Address:', WEEKLY_DISTRIBUTION_ADDRESS);
      console.log('Merkle Distributor Address:', MERKLE_DISTRIBUTOR_ADDRESS);
      
      // Check if contracts have code (are deployed)
      const provider = (window as any).ethereum;
      if (provider) {
        try {
          const weeklyCode = await provider.request({
            method: 'eth_getCode',
            params: [WEEKLY_DISTRIBUTION_ADDRESS, 'latest']
          });
          const merkleCode = await provider.request({
            method: 'eth_getCode',
            params: [MERKLE_DISTRIBUTOR_ADDRESS, 'latest']
          });
          
          console.log('Weekly Distribution has code:', weeklyCode !== '0x');
          console.log('Merkle Distributor has code:', merkleCode !== '0x');
          
          alert(`Contract Validation:

📍 Weekly Distribution (${WEEKLY_DISTRIBUTION_ADDRESS}):
${weeklyCode !== '0x' ? '✅ Deployed' : '❌ Not deployed'}

📍 Merkle Distributor (${MERKLE_DISTRIBUTOR_ADDRESS}):
${merkleCode !== '0x' ? '✅ Deployed' : '❌ Not deployed'}

Network: ${provider.chainId}`);
        } catch (error) {
          console.error('Failed to validate contracts:', error);
          alert(`Failed to validate contracts: ${error}`);
        }
      } else {
        alert('No Ethereum provider found. Please connect your wallet.');
      }
    } catch (error) {
      console.error('Contract validation error:', error);
    }
  };

  // Function to check and display distribution prerequisites
  const checkPrerequisites = async () => {
    try {
      console.log('Checking distribution prerequisites...');
      
      // This would need to be implemented to check:
      // 1. Total supply > 0
      // 2. Collateral ratio >= 112%
      // 3. Time interval passed
      // 4. User is admin
      
      const adminAddress = process.env.NEXT_PUBLIC_ADMIN_WALLET || "0x6210FfE7340dC47d5DA4b888e850c036CC6ee835";
      const prerequisiteInfo = `📋 Distribution Prerequisites:

✅ Time Interval: ${canDistribute ? 'Passed' : 'Not yet'}
✅ Admin Access: ${address?.toLowerCase() === adminAddress.toLowerCase() ? 'Authorized' : 'Not admin'}

Note: Additional checks (token supply, collateral ratio) are performed during execution.`;
      
      alert(prerequisiteInfo);
    } catch (error) {
      console.error('Error checking prerequisites:', error);
    }
  };

  // Helper to check if user is admin
  const isAdmin = () => {
    const adminAddress = process.env.NEXT_PUBLIC_ADMIN_WALLET || "0x6210FfE7340dC47d5DA4b888e850c036CC6ee835";
    return address && address.toLowerCase() === adminAddress.toLowerCase();
  };

  const executeDistribution = async () => {
    console.log('=== EXECUTE DISTRIBUTION DEBUG ===');
    console.log('Contract address:', WEEKLY_DISTRIBUTION_ADDRESS);
    console.log('Can distribute:', canDistribute);
    console.log('Final can distribute:', finalCanDistribute);
    console.log('Should be available:', shouldBeAvailable);
    console.log('Is connected:', isConnected);
    console.log('User address:', address);
    
    // Check wallet connection
    if (!isConnected || !address) {
      alert('Please connect your wallet first.');
      return;
    }
    
    // Check network
    const chainId = (window as any).ethereum?.chainId;
    console.log('Current chain ID:', chainId);
    const expectedChainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '8453');
    const chainIdHex = `0x${expectedChainId.toString(16)}`;

    // Accept both decimal and hex format
    if (chainId !== chainIdHex && chainId !== expectedChainId &&
        parseInt(chainId, 16) !== expectedChainId) {
      alert(`Wrong network detected.

Expected: ${process.env.NEXT_PUBLIC_CHAIN_NAME || 'Base Sepolia'} (${expectedChainId})
Current: ${chainId} (${parseInt(chainId, 16)})

Please switch to the correct network in your wallet.`);
      return;
    }
    
    if (!finalCanDistribute) {
      console.warn('Distribution cannot be executed at this time');
      const nextTime = nextDistributionTime ? new Date(Number(nextDistributionTime) * 1000) : null;
      const now = new Date();
      const timeUntilNext = nextTime ? Math.max(0, nextTime.getTime() - now.getTime()) : 0;
      const minutesRemaining = Math.ceil(timeUntilNext / (1000 * 60));
      
      alert(`Distribution cannot be executed at this time.

Next available: ${nextTime ? nextTime.toLocaleString() : 'Unknown'}
Time remaining: ${minutesRemaining > 0 ? `${minutesRemaining} minutes` : 'Available now'}

Contract says canDistribute: ${canDistribute}
Time-based override: ${shouldBeAvailable}

Please wait and try again or check the contract state.`);
      return;
    }
    
    // Check if user is admin (optional - remove if not needed)
    const adminAddress = process.env.NEXT_PUBLIC_ADMIN_WALLET || "0x6210FfE7340dC47d5DA4b888e850c036CC6ee835";
    if (address?.toLowerCase() !== adminAddress.toLowerCase()) {
      alert(`Access Denied: Only admin can execute distributions.\n\nAdmin address: ${adminAddress}\nYour address: ${address}`);
      return;
    }
    
    try {
      console.log('Initiating distribution execution...');
      console.log('Contract address:', WEEKLY_DISTRIBUTION_ADDRESS);
      console.log('User address:', address);
      console.log('Chain ID:', (window as any).ethereum?.chainId);
      
      writeContract({
        address: WEEKLY_DISTRIBUTION_ADDRESS as `0x${string}`,
        abi: WEEKLY_DISTRIBUTION_ABI,
        functionName: 'executeDistribution',
      });
      
      console.log('Distribution execution transaction submitted');
    } catch (error) {
      console.error('Failed to execute distribution:', error);
      console.error('Error details:', {
        contractAddress: WEEKLY_DISTRIBUTION_ADDRESS,
        userAddress: address,
        error: error
      });
      alert(`Failed to execute distribution: ${error instanceof Error ? error.message : 'Unknown error'}

Contract: ${WEEKLY_DISTRIBUTION_ADDRESS}
User: ${address}

Check console for more details.`);
    }
  };

  const writeMerkleRoot = () => {
    if (!merkleRootInput || !totalTokens) {
      alert('Please provide both Merkle Root and Total Tokens values.');
      return;
    }
    
    console.log('=== SET MERKLE ROOT DEBUG ===');
    console.log('Contract address:', WEEKLY_DISTRIBUTION_ADDRESS);
    console.log('Merkle root:', merkleRootInput);
    console.log('Total tokens:', totalTokens);
    console.log('Parsed total tokens:', parseUnits(totalTokens, 8));
    console.log('User address:', address);
    
    try {
      writeMerkleContract({
        address: WEEKLY_DISTRIBUTION_ADDRESS as `0x${string}`,
        abi: WEEKLY_DISTRIBUTION_ABI,
        functionName: 'updateMerkleRoot',
        args: [merkleRootInput as `0x${string}`, parseUnits(totalTokens, 8)],
      });
      
      console.log('Set merkle root transaction submitted');
    } catch (error) {
      console.error('Failed to set merkle root:', error);
      alert(`Failed to set merkle root: ${error instanceof Error ? error.message : 'Unknown error'}

Contract: ${WEEKLY_DISTRIBUTION_ADDRESS}
Merkle Root: ${merkleRootInput}
Total Tokens: ${totalTokens}

Check console for more details.`);
    }
  };

  const pauseContract = () => {
    pauseWriteContract({
      address: MERKLE_DISTRIBUTOR_ADDRESS as `0x${string}`,
      abi: MERKLE_DISTRIBUTOR_ABI,
      functionName: 'pause',
    });
  };

  const unpauseContract = () => {
    unpauseWriteContract({
      address: MERKLE_DISTRIBUTOR_ADDRESS as `0x${string}`,
      abi: MERKLE_DISTRIBUTOR_ABI,
      functionName: 'unpause',
    });
  };

  // Load distribution history
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await fetch('/api/merkle-distributions/history');
        if (response.ok) {
          const history = await response.json();
          setDistributionHistory(history);
        }
      } catch (error) {
        console.error('Failed to load distribution history:', error);
      }
    };

    loadHistory();
  }, []);

  // Update current time every second for live countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  const handleExecuteDistribution = () => {
    executeDistribution();
  };

  const handleSetMerkleRoot = () => {
    if (merkleRootInput && totalTokens) {
      writeMerkleRoot();
    }
  };

  const handleGenerateMerkleTree = async () => {
    setLoading(true);
    try {
      console.log('Generating merkle tree...');
      
      const response = await fetch('/api/generate-merkle-tree', {
        method: 'POST',
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Merkle tree generated successfully:', result);
        
        setMerkleRootInput(result.merkleRoot);
        setTotalTokens(formatUnits(result.totalRewards, 8));
        
        // Show success message with details
        alert(`✅ Merkle tree generated successfully!

🌳 Merkle Root: ${result.merkleRoot.slice(0, 20)}...
💰 Total Rewards: ${formatUnits(result.totalRewards, 8)} BTC1USD
👥 Active Holders: ${result.activeHolders}
📋 Claims: ${result.claims}

The merkle root has been automatically filled. Click "Set Merkle Root" to complete the distribution setup.`);
        
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate merkle tree');
      }
    } catch (error) {
      console.error('Error generating merkle tree:', error);
      alert(`❌ Failed to generate merkle tree:

${error instanceof Error ? error.message : 'Unknown error'}

Please check the console for more details and try again.`);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePause = () => {
    if (isPaused) {
      unpauseContract();
    } else {
      pauseContract();
    }
  };

  // Automated process that executes distribution, generates merkle tree, and sets merkle root
  const handleAutomatedProcess = async () => {
    setLoading(true);
    try {
      console.log('Starting automated process...');
      
      // Step 1: Generate merkle tree
      console.log('Step 1: Generating merkle tree...');
      const response = await fetch('/api/generate-merkle-tree', {
        method: 'POST',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate merkle tree');
      }
      
      const result = await response.json();
      console.log('Merkle tree generated successfully:', result);
      
      // Step 2: Automatically set the merkle root
      console.log('Step 2: Setting merkle root...');
      setMerkleRootInput(result.merkleRoot);
      setTotalTokens(formatUnits(BigInt(result.totalRewards), 8));
      
      // Wait a moment for state to update
      setTimeout(() => {
        if (result.merkleRoot && result.totalRewards) {
          (writeMerkleContract as any)({
            address: WEEKLY_DISTRIBUTION_ADDRESS as `0x${string}`,
            abi: WEEKLY_DISTRIBUTION_ABI,
            functionName: 'updateMerkleRoot',
            args: [result.merkleRoot as `0x${string}`, parseUnits(formatUnits(BigInt(result.totalRewards), 8), 8)],
          });
          
          console.log('Merkle root transaction submitted');
          
          // Show final success message
          setTimeout(() => {
            alert(`✅ Automated distribution process completed successfully!

🎉 Distribution executed
🌳 Merkle tree generated
🔗 Merkle root set

Users can now claim their rewards!

Merkle Root: ${result.merkleRoot.slice(0, 20)}...
Total Rewards: ${formatUnits(BigInt(result.totalRewards), 8)} BTC1USD
Active Holders: ${result.activeHolders}`);
          }, 2000);
        }
      }, 500);
      
    } catch (error) {
      console.error('Error in automated process:', error);
      alert(`❌ Automated process failed:

${error instanceof Error ? error.message : 'Unknown error'}

Please try the manual process or check the console for more details.`);
    } finally {
      setLoading(false);
    }
  };

  // Fully automated process using server-side scripts with private key signing
  const handleFullyAutomatedProcess = async () => {
    setLoading(true);
    try {
      console.log('Starting fully automated process...');
      
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
      
      // Show success message
      alert(`🎉 Fully automated distribution completed successfully!
      
✅ Distribution executed
🌳 Merkle tree generated
🔗 Merkle root set

All transactions were automatically signed using the private key from .env.local.
Users can now claim their rewards.`);
      
    } catch (error) {
      console.error('Error in fully automated process:', error);
      alert(`❌ Fully automated process failed:

${error instanceof Error ? error.message : 'Unknown error'}

Please check the server logs for more details.`);
    } finally {
      setLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Enhanced Distribution Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please connect your wallet to manage distributions.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const stats = distributionStats as [bigint, bigint, bigint, bigint] | undefined;
  const nextTime = nextDistributionTime ? new Date(Number(nextDistributionTime) * 1000) : null;
  const now = currentTime; // Use live updating current time
  const canDistributeNow = !!canDistribute;
  
  // Calculate time remaining more accurately
  let timeUntilNext = 0;
  if (nextTime) {
    timeUntilNext = Math.max(0, nextTime.getTime() - now.getTime());
    
    // If the calculated time seems wrong (more than 24 hours), assume it's available now
    const twentyFourHours = 24 * 60 * 60 * 1000;
    if (timeUntilNext > twentyFourHours) {
      console.warn('Time calculation seems incorrect, setting to 0');
      timeUntilNext = 0;
    }
  }
  
  // Override with canDistribute status if available
  if (canDistributeNow) {
    timeUntilNext = 0;
  }
  
  // Debug logging for time calculation
  console.log('=== TIME CALCULATION DEBUG ===');
  console.log('nextDistributionTime (raw):', nextDistributionTime?.toString());
  console.log('nextTime (Date):', nextTime?.toISOString());
  console.log('now (Date):', now.toISOString());
  console.log('timeUntilNext (ms):', timeUntilNext);
  console.log('timeUntilNext (minutes):', Math.floor(timeUntilNext / (1000 * 60)));
  console.log('canDistributeNow:', canDistributeNow);
  console.log('canDistribute (raw):', canDistribute);
  console.log('=== END DEBUG ===');
  
  // Force canDistributeNow to true if time shows "Available now"
  const shouldBeAvailable = timeUntilNext <= 0;
  const finalCanDistribute = canDistributeNow || shouldBeAvailable;

  return (
    <div className="space-y-6">
      <Tabs defaultValue="execute" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 bg-gray-700">
          <TabsTrigger value="execute" className="data-[state=active]:bg-gray-600">Execute</TabsTrigger>
          <TabsTrigger value="merkle" className="data-[state=active]:bg-gray-600">Merkle Tree</TabsTrigger>
          <TabsTrigger value="control" className="data-[state=active]:bg-gray-600">Control</TabsTrigger>
          <TabsTrigger value="analytics" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">Analytics</TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-gray-600">History</TabsTrigger>
        </TabsList>

        {/* Execute Distribution */}
        <TabsContent value="execute">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Execute Distribution</CardTitle>
              <CardDescription className="text-gray-400">
                Trigger the weekly reward distribution
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Distribution Status */}
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Distribution ID:</span>
                  <span className="text-white">
                    {currentDistributionInfo ? `#${(currentDistributionInfo as any)[0]?.toString() || '0'}` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Next Distribution:</span>
                  <span className="text-white">
                    {nextTime ? nextTime.toLocaleString() : 'Unknown'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Time Remaining:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white">
                      {canDistributeNow ? 
                        'Available now' :
                        timeUntilNext > 0 ? 
                          `${Math.floor(timeUntilNext / (1000 * 60))} min ${Math.floor((timeUntilNext % (1000 * 60)) / 1000)} sec` : 
                          'Available now'
                      }
                    </span>
                    <Button
                      onClick={refreshData}
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Can Execute:</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={finalCanDistribute ? "default" : "secondary"}>
                      {finalCanDistribute ? 'Yes' : 'No'}
                    </Badge>
                    {!canDistributeNow && shouldBeAvailable && (
                      <span className="text-xs text-yellow-400">(Force Override)</span>
                    )}
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Admin Access:</span>
                  <Badge variant={address?.toLowerCase() === (process.env.NEXT_PUBLIC_ADMIN_WALLET || "0x6210FfE7340dC47d5DA4b888e850c036CC6ee835").toLowerCase() ? "default" : "secondary"}>
                    {address?.toLowerCase() === (process.env.NEXT_PUBLIC_ADMIN_WALLET || "0x6210FfE7340dC47d5DA4b888e850c036CC6ee835").toLowerCase() ? 'Authorized' : 'Not Admin'}
                  </Badge>
                </div>
              </div>

              <Separator className="bg-gray-600" />

              {/* Transaction Status */}
              {(isExecuting || isConfirming) && (
                <Alert className="bg-blue-900/20 border-blue-800">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertDescription className="text-blue-400">
                    {isExecuting && 'Submitting transaction...'}
                    {isConfirming && 'Waiting for confirmation...'}
                  </AlertDescription>
                </Alert>
              )}

              {executionError && (
                <Alert variant="destructive" className="bg-red-900/20 border-red-800">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-red-400">
                    Distribution failed: {executionError.message}
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Button
                  onClick={handleExecuteDistribution}
                  disabled={!finalCanDistribute || isExecuting || isConfirming || address?.toLowerCase() !== (process.env.NEXT_PUBLIC_ADMIN_WALLET || "0x6210FfE7340dC47d5DA4b888e850c036CC6ee835").toLowerCase()}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600"
                >
                  {isExecuting || isConfirming ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isExecuting && 'Executing...'}
                      {isConfirming && 'Confirming...'}
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Execute Distribution
                    </>
                  )}
                </Button>

                {/* Automated Process Button */}
                <Button 
                  onClick={handleAutomatedProcess}
                  disabled={!finalCanDistribute || isExecuting || isConfirming || address?.toLowerCase() !== (process.env.NEXT_PUBLIC_ADMIN_WALLET || "0x6210FfE7340dC47d5DA4b888e850c036CC6ee835").toLowerCase() || loading}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:bg-gray-600"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Rocket className="mr-2 h-4 w-4" />
                      Automated Full Process
                    </>
                  )}
                </Button>
              </div>

              {/* Fully Automated Process Button */}
              <Button 
                onClick={handleFullyAutomatedProcess}
                disabled={!finalCanDistribute || isExecuting || isConfirming || address?.toLowerCase() !== (process.env.NEXT_PUBLIC_ADMIN_WALLET || "0x6210FfE7340dC47d5DA4b888e850c036CC6ee835").toLowerCase() || loading}
                className="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 disabled:bg-gray-600"
              >
                {loading ? (
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

              {/* Connection Status */}
              {isConnected && (
                <Alert className="bg-green-900/20 border-green-800">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <AlertDescription className="text-green-400">
                    ✅ Wallet connected: {address?.slice(0, 6)}...{address?.slice(-4)}
                  </AlertDescription>
                </Alert>
              )}
              
              {!isConnected && (
                <Alert variant="destructive" className="bg-red-900/20 border-red-800">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-red-400">
                    ❌ Wallet not connected. Please connect your wallet to interact with contracts.
                  </AlertDescription>
                </Alert>
              )}
              
              {/* Contract Validation Button */}
              <Button 
                onClick={validateContracts}
                variant="outline"
                className="w-full border-purple-600 text-purple-300 hover:bg-purple-900"
              >
                <AlertCircle className="mr-2 h-4 w-4" />
                Validate Contracts
              </Button>
              
              {/* Prerequisites Check Button */}
              <Button 
                onClick={checkPrerequisites}
                variant="outline"
                className="w-full border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                <AlertCircle className="mr-2 h-4 w-4" />
                Check Prerequisites
              </Button>
              
              {/* Force Execute Button for Debug */}
              {!finalCanDistribute && (
                <Button 
                  onClick={() => {
                    if (window.confirm('Force execute distribution? This bypasses the canDistribute check and may fail.')) {
                      writeContract({
                        address: WEEKLY_DISTRIBUTION_ADDRESS as `0x${string}`,
                        abi: WEEKLY_DISTRIBUTION_ABI,
                        functionName: 'executeDistribution',
                      });
                    }
                  }}
                  variant="destructive"
                  className="w-full"
                >
                  <AlertCircle className="mr-2 h-4 w-4" />
                  Force Execute (Debug)
                </Button>
              )}

              <Alert className="bg-gray-700/50 border-gray-600">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-gray-300">
                  This will mint new BTC1USD tokens and prepare them for distribution.
                  {!canDistributeNow && (
                    <><br /><strong>Note:</strong> Distribution is not available yet. Please wait for the time interval to pass.</>
                  )}
                  {address?.toLowerCase() !== (process.env.NEXT_PUBLIC_ADMIN_WALLET || "0x6210FfE7340dC47d5DA4b888e850c036CC6ee835").toLowerCase() && (
                    <><br /><strong>Access:</strong> Only admin can execute distributions.</>
                  )}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Merkle Tree Management */}
        <TabsContent value="merkle">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Merkle Tree Management</CardTitle>
              <CardDescription className="text-gray-400">
                Generate and set merkle roots for distributions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <Button 
                  onClick={handleGenerateMerkleTree}
                  disabled={loading}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Generate Merkle Tree
                    </>
                  )}
                </Button>

                <div className="space-y-2">
                  <Label htmlFor="merkleRoot" className="text-white">Merkle Root</Label>
                  <Input
                    id="merkleRoot"
                    value={merkleRootInput}
                    onChange={(e) => setMerkleRootInput(e.target.value)}
                    placeholder="0x..."
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="totalTokens" className="text-white">Total Tokens (BTC1USD)</Label>
                  <Input
                    id="totalTokens"
                    value={totalTokens}
                    onChange={(e) => setTotalTokens(e.target.value)}
                    placeholder="0.00"
                    type="number"
                    step="0.00000001"
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>

                <Button 
                  onClick={handleSetMerkleRoot}
                  disabled={!merkleRootInput || !totalTokens || isSettingRoot}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  {isSettingRoot ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Setting Root...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Set Merkle Root
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Control Panel */}
        <TabsContent value="control">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Emergency Controls</CardTitle>
              <CardDescription className="text-gray-400">
                Pause/unpause the distribution system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                <div>
                  <div className="text-white font-medium">System Status</div>
                  <div className="text-sm text-gray-400">
                    Distribution system is currently {isPaused ? 'paused' : 'active'}
                  </div>
                </div>
                <Badge variant={isPaused ? "destructive" : "default"}>
                  {isPaused ? 'Paused' : 'Active'}
                </Badge>
              </div>

              <Button 
                onClick={handleTogglePause}
                disabled={isPausing || isUnpausing}
                variant={isPaused ? "default" : "destructive"}
                className="w-full"
              >
                {isPausing || isUnpausing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isPaused ? 'Unpausing...' : 'Pausing...'}
                  </>
                ) : (
                  <>
                    {isPaused ? <Play className="mr-2 h-4 w-4" /> : <Pause className="mr-2 h-4 w-4" />}
                    {isPaused ? 'Unpause System' : 'Pause System'}
                  </>
                )}
              </Button>

              <Alert variant={isPaused ? "destructive" : "default"} className={isPaused ? "bg-red-900/20 border-red-800" : "bg-gray-700/50 border-gray-600"}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className={isPaused ? "text-red-400" : "text-gray-300"}>
                  {isPaused 
                    ? 'The system is paused. Users cannot claim rewards.' 
                    : 'The system is active. Users can claim their rewards.'}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Dashboard */}
        <TabsContent value="analytics">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Distribution Analytics
              </CardTitle>
              <CardDescription className="text-gray-400">
                Insights into reward distributions and system performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DistributionAnalyticsDashboard userAddress={address} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Distribution History */}
        <TabsContent value="history">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Distribution History</CardTitle>
              <CardDescription className="text-gray-400">
                Past distribution events and statistics
              </CardDescription>
            </CardHeader>
            <CardContent>
              {distributionHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  No distribution history available
                </div>
              ) : (
                <div className="space-y-4">
                  {distributionHistory.map((dist) => (
                    <div key={dist.id} className="p-4 bg-gray-700 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="text-white font-medium">Distribution #{dist.id}</div>
                          <div className="text-sm text-gray-400">
                            {new Date(dist.timestamp).toLocaleDateString()}
                          </div>
                        </div>
                        <Badge variant="secondary" className="bg-blue-900/50 text-blue-200">
                          {((parseFloat(dist.totalClaimed) / parseFloat(dist.totalRewards)) * 100).toFixed(1)}% claimed
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">Total Rewards:</span>
                          <span className="text-white ml-2">{dist.totalRewards} BTC1USD</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Claims:</span>
                          <span className="text-white ml-2">{dist.claimCount}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}