"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Progress } from './ui/progress';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, parseUnits, encodeFunctionData } from 'viem';
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
  Terminal,
  Shield,
  History,
  Calendar,
  ListOrdered,
  Sliders,
  Wallet,
  Sparkles,
  Copy,
  ExternalLink,
  ArrowRight
} from 'lucide-react';

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

const BTC1USD_ABI = [
  {
    "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
    "name": "balanceOf",
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
    "inputs": [{ "internalType": "uint256", "name": "distributionId", "type": "uint256" }],
    "name": "getDistributionInfo",
    "outputs": [
      { "internalType": "bytes32", "name": "root", "type": "bytes32" },
      { "internalType": "uint256", "name": "totalTokens", "type": "uint256" },
      { "internalType": "uint256", "name": "totalClaimed", "type": "uint256" },
      { "internalType": "uint256", "name": "timestamp", "type": "uint256" },
      { "internalType": "bool", "name": "finalized", "type": "bool" }
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
  },
  {
    "inputs": [
      { "internalType": "address", "name": "tokenToWithdraw", "type": "address" },
      { "internalType": "address", "name": "to", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "withdrawToken",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// Add Vault ABI for collateral ratio check
const VAULT_ABI = [
  {
    "inputs": [],
    "name": "getCurrentCollateralRatio",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];

import { CONTRACT_ADDRESSES } from '@/lib/contracts';
import { fixPrecisionIssues } from '@/lib/distribution-reconciliation';

// Add a helper function to safely convert decimal strings to bigint
const safeDecimalToBigInt = (value: string): bigint => {
  try {
    // Handle decimal strings by removing the decimal point and adjusting precision
    if (value.includes('.')) {
      const [integerPart, fractionalPart = ''] = value.split('.');
      // BTC1USD has 8 decimal places, so we need to pad the fractional part to 8 digits
      const paddedFractional = fractionalPart.padEnd(8, '0').slice(0, 8);
      return BigInt(integerPart + paddedFractional);
    }
    // For integer strings, just add 8 zeros for the decimal places
    return BigInt(value + '00000000');
  } catch (error) {
    console.warn('Failed to convert decimal string to bigint:', value, error);
    return 0n;
  }
};

// Add a helper function to safely convert the balance to bigint
  const safeToBigInt = (value: unknown): bigint | null => {
    if (value === null || value === undefined) return null;
    try {
      if (typeof value === 'bigint') return value;
      if (typeof value === 'string') return BigInt(value);
      if (typeof value === 'number') return BigInt(Math.floor(value));
      if (typeof value === 'object' && value !== null && 'toString' in value) {
        return BigInt(value.toString());
      }
      return null;
    } catch (error) {
      console.warn('Failed to convert to bigint:', value, error);
      return null;
    }
  };

  // Add a helper function to safely format units
  const safeFormatUnits = (value: unknown, decimals: number): string => {
    const bigintValue = safeToBigInt(value);
    if (bigintValue === null) return '0';
    try {
      return formatUnits(bigintValue, decimals);
    } catch (error) {
      console.warn('Failed to format units:', value, error);
      return '0';
    }
  };

  interface MerkleDistributionManagementProps {
    onSetMerkleRoot?: (epoch: number, merkleRoot: string) => void;
    onExecuteDistribution?: () => void;
  }
  
  export default function MerkleDistributionManagement({
    onSetMerkleRoot,
    onExecuteDistribution
  }: MerkleDistributionManagementProps = {}) {
  const { address, isConnected } = useAccount();


  const [merkleRootInput, setMerkleRootInput] = useState('');
  const [totalTokens, setTotalTokens] = useState('');
  const [distributionHistory, setDistributionHistory] = useState<DistributionHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPrerequisites, setShowPrerequisites] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Safe Transaction Modal state
  const [showSafeModal, setShowSafeModal] = useState(false);
  const [showMerkleRootModal, setShowMerkleRootModal] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  
  // Helper function for copying to clipboard
  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Reclaim tab state
  const [transactionStatus, setTransactionStatus] = useState("");
  const [transactionType, setTransactionType] = useState<string | null>(null);
  const [unclaimedDistributions, setUnclaimedDistributions] = useState<any[]>([]);
  const [pendingDistributions, setPendingDistributions] = useState<any[]>([]);
  const [loadingUnclaimed, setLoadingUnclaimed] = useState(false);
  const [currentDistId, setCurrentDistId] = useState<number>(0);
  const [lastReclaimedDistId, setLastReclaimedDistId] = useState<string | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);

  // Contract addresses - use centralized configuration
  const WEEKLY_DISTRIBUTION_ADDRESS = CONTRACT_ADDRESSES.WEEKLY_DISTRIBUTION;
  const MERKLE_DISTRIBUTOR_ADDRESS = CONTRACT_ADDRESSES.MERKLE_DISTRIBUTOR;
  const VAULT_ADDRESS = CONTRACT_ADDRESSES.VAULT;

  // Read actual MerkleDistributor BTC1USD balance
  const { data: merkleDistributorBalance, refetch: refetchMerkleBalance } = useReadContract({
    address: CONTRACT_ADDRESSES.BTC1USD as `0x${string}`,
    abi: BTC1USD_ABI,
    functionName: 'balanceOf',
    args: [MERKLE_DISTRIBUTOR_ADDRESS as `0x${string}`],
    query: {
      enabled: isConnected,
    }
  });

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

  // Add collateral ratio data fetching with enhanced error handling
  // Using correct function name: getCurrentCollateralRatio
  const { 
    data: collateralRatioData, 
    isError: isCollateralRatioError, 
    isLoading: isCollateralRatioLoading,
    error: collateralRatioError,
    refetch: refetchCollateralRatio
  } = useReadContract({
    address: VAULT_ADDRESS as `0x${string}`,
    abi: VAULT_ABI,
    functionName: 'getCurrentCollateralRatio',
    query: {
      enabled: isConnected && !!VAULT_ADDRESS,
      refetchInterval: 10000, // Refetch every 10 seconds
      retry: 3,
      retryDelay: 1000,
    }
  });

  // FALLBACK: Get total collateral value and BTC1USD supply separately
  const { data: totalCollateralValue } = useReadContract({
    address: VAULT_ADDRESS as `0x${string}`,
    abi: [{
      "inputs": [],
      "name": "getTotalCollateralValue",
      "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
      "stateMutability": "view",
      "type": "function"
    }],
    functionName: 'getTotalCollateralValue',
    query: {
      enabled: isConnected && !!VAULT_ADDRESS && isCollateralRatioError,
      refetchInterval: 10000,
    }
  });

  const { data: btc1usdTotalSupply } = useReadContract({
    address: CONTRACT_ADDRESSES.BTC1USD as `0x${string}`,
    abi: [{
      "inputs": [],
      "name": "totalSupply",
      "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
      "stateMutability": "view",
      "type": "function"
    }],
    functionName: 'totalSupply',
    query: {
      enabled: isConnected && isCollateralRatioError,
      refetchInterval: 10000,
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
  const { writeContract: reclaimWriteContract, isPending: isReclaiming, data: reclaimHash, error: reclaimError } = useWriteContract();

  // Wait for transaction confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: executionHash,
  });

  const { isLoading: isConfirmingReclaim, isSuccess: isReclaimConfirmed } = useWaitForTransactionReceipt({
    hash: reclaimHash,
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

  // Handle reclaim transaction success
  useEffect(() => {
    if (isReclaimConfirmed) {
      const successMessage = transactionType === 'reclaimAllRewards'
        ? "✅ All unclaimed rewards transferred to Endowment Wallet successfully!"
        : "✅ Unclaimed rewards transferred to Endowment Wallet successfully!";

      setTransactionStatus(successMessage);

      // Mark distributions as reclaimed in localStorage
      if (transactionType === 'reclaimAllRewards') {
        // Mark all current distributions as reclaimed
        const allDistIds = unclaimedDistributions.map(d => d.distributionId);
        markAllDistributionsAsReclaimed(allDistIds);
        // Clear all distributions
        setUnclaimedDistributions([]);
      } else if (transactionType === 'reclaimRewards' && lastReclaimedDistId) {
        // Mark specific distribution as reclaimed
        markDistributionAsReclaimed(lastReclaimedDistId);
        // Remove specific distribution
        setUnclaimedDistributions(prev =>
          prev.filter(dist => dist.distributionId !== lastReclaimedDistId)
        );
      }

      // Mark distributions as reclaimed in the distribution files
      const markDistributionsAsReclaimedInFiles = async () => {
        try {
          if (transactionType === 'reclaimAllRewards') {
            // Mark all distributions as reclaimed
            const actualBalance = merkleDistributorBalance ? BigInt(merkleDistributorBalance.toString()) : 0n;

            for (const dist of unclaimedDistributions) {
              try {
                const response = await fetch('/api/merkle-distributions/mark-reclaimed', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    distributionId: dist.distributionId,
                    reclaimedAmount: safeDecimalToBigInt(dist.unclaimed).toString(),
                    txHash: reclaimHash
                  })
                });

                if (response.ok) {
                  console.log(`✅ Marked distribution #${dist.distributionId} as reclaimed in file`);
                } else {
                  const errorData = await response.json();
                  console.warn(`⚠️ Failed to mark distribution #${dist.distributionId} as reclaimed in file:`, errorData.error);
                  // Fallback to localStorage if API fails
                  markDistributionAsReclaimed(dist.distributionId);
                }
              } catch (error) {
                console.warn(`⚠️ Network error marking distribution #${dist.distributionId} as reclaimed, using localStorage fallback:`, error);
                // Fallback to localStorage if API fails
                markDistributionAsReclaimed(dist.distributionId);
              }
            }
          } else if (transactionType === 'reclaimRewards' && lastReclaimedDistId) {
            // Mark specific distribution as reclaimed
            const dist = unclaimedDistributions.find(d => d.distributionId === lastReclaimedDistId);
            if (dist) {
              try {
                const response = await fetch('/api/merkle-distributions/mark-reclaimed', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    distributionId: lastReclaimedDistId,
                    reclaimedAmount: safeDecimalToBigInt(dist.unclaimed).toString(),
                    txHash: reclaimHash
                  })
                });
                
                if (response.ok) {
                  console.log(`✅ Marked distribution #${lastReclaimedDistId} as reclaimed in file`);
                } else {
                  const errorData = await response.json();
                  console.warn(`⚠️ Failed to mark distribution #${lastReclaimedDistId} as reclaimed in file:`, errorData.error);
                  // Fallback to localStorage if API fails
                  markDistributionAsReclaimed(lastReclaimedDistId);
                }
              } catch (error) {
                console.warn(`⚠️ Network error marking distribution #${lastReclaimedDistId} as reclaimed, using localStorage fallback:`, error);
                // Fallback to localStorage if API fails
                markDistributionAsReclaimed(lastReclaimedDistId);
              }
            }
          }
        } catch (error) {
          console.error('Error marking distributions as reclaimed in files, using localStorage fallback:', error);
          // Fallback to localStorage for all distributions if API fails
          if (transactionType === 'reclaimAllRewards') {
            const allDistIds = unclaimedDistributions.map(d => d.distributionId);
            markAllDistributionsAsReclaimed(allDistIds);
          } else if (transactionType === 'reclaimRewards' && lastReclaimedDistId) {
            markDistributionAsReclaimed(lastReclaimedDistId);
          }
        }
      };

      // Instead of calling refreshData() immediately, show a message to the user
      // and let them manually refresh when ready
      if (typeof setTransactionStatus === 'function') {
        setTransactionStatus("✅ Transaction confirmed! Click 'Refresh Data' to update the interface.");
      }
      
      // Note: We're not calling refreshData() automatically to prevent interface hanging
      // The user can manually click the refresh button when they're ready
    }
  }, [isReclaimConfirmed, transactionType, lastReclaimedDistId, unclaimedDistributions, reclaimHash, merkleDistributorBalance, refetchMerkleBalance]);

  // Handle reclaim transaction error
  useEffect(() => {
    if (reclaimError) {
      const errorString = reclaimError?.message || reclaimError?.toString() || "";
      let errorMessage = "Transaction failed - please try again";

      if (errorString.includes("User rejected")) {
        errorMessage = "Transaction cancelled by user";
      } else if (errorString.includes("insufficient funds")) {
        errorMessage = "Insufficient funds for transaction";
      } else if (errorString.includes("not authorized")) {
        errorMessage = "Not authorized - admin only";
      }

      setTransactionStatus(`❌ ${errorMessage}`);
      setTimeout(() => setTransactionStatus(""), 5000);
    }
  }, [reclaimError]);

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
    console.log('Is connected:', isConnected);
    console.log('User address:', address);
    console.log('Collateral ratio:', collateralRatio);
    console.log('Is collateral ratio sufficient:', isCollateralRatioSufficient);
    
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
    
    // Check if distribution can be executed based on time constraints
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

Please wait and try again or check the contract state.`);
      return;
    }
    
    // Check if collateral ratio is sufficient
    if (!isCollateralRatioSufficient) {
      alert(`Collateral ratio is below the required threshold of 112%.
      
Current ratio: ${collateralRatio ? `${(collateralRatio * 100).toFixed(2)}%` : 'N/A'}
Required ratio: 112%

Please add more collateral to the vault before executing distribution.`);
      return;
    }
    
    // Safe Integration: Check if user has UI access
    const uiControllerAddress = process.env.NEXT_PUBLIC_UI_CONTROLLER || 
      process.env.NEXT_PUBLIC_ADMIN_WALLET || 
      "0x6210FfE7340dC47d5DA4b888e850c036CC6ee835";
    const safeAddress = process.env.NEXT_PUBLIC_SAFE_ADDRESS || uiControllerAddress;
    
    const hasUIAccess = address?.toLowerCase() === uiControllerAddress.toLowerCase();
    const isSafeConnected = address?.toLowerCase() === safeAddress.toLowerCase();
    
    if (!hasUIAccess && !isSafeConnected) {
      alert(`Access Denied: Only authorized addresses can execute distributions.

UI Controller: ${uiControllerAddress}
Safe Address: ${safeAddress}
Your address: ${address}

Please connect with an authorized wallet.`);
      return;
    }
    
    // If UI Controller is connected but not Safe, show beautiful Safe modal
    if (hasUIAccess && !isSafeConnected && safeAddress !== uiControllerAddress) {
      setShowSafeModal(true);
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

  const writeMerkleRoot = async () => {
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
    
    // Safe Integration: Check if user has UI access
    const uiControllerAddress = process.env.NEXT_PUBLIC_UI_CONTROLLER || 
      process.env.NEXT_PUBLIC_ADMIN_WALLET || 
      "0x6210FfE7340dC47d5DA4b888e850c036CC6ee835";
    const safeAddress = process.env.NEXT_PUBLIC_SAFE_ADDRESS || uiControllerAddress;
    
    const hasUIAccess = address?.toLowerCase() === uiControllerAddress.toLowerCase();
    const isSafeConnected = address?.toLowerCase() === safeAddress.toLowerCase();
    
    if (!hasUIAccess && !isSafeConnected) {
      alert(`Access Denied: Only authorized addresses can set merkle root.

UI Controller: ${uiControllerAddress}
Safe Address: ${safeAddress}
Your address: ${address}

Please connect with an authorized wallet.`);
      return;
    }
    
    // If UI Controller is connected but not Safe, show modal with transaction data
    if (hasUIAccess && !isSafeConnected && safeAddress !== uiControllerAddress) {
      console.log('=== MERKLE ROOT TRANSACTION DATA ===');
      console.log('Contract Address:', WEEKLY_DISTRIBUTION_ADDRESS);
      console.log('Function: updateMerkleRoot(bytes32,uint256)');
      console.log('Merkle Root:', merkleRootInput);
      console.log('Total Tokens:', totalTokens, 'BTC1USD');
      console.log('Total Tokens (wei):', parseUnits(totalTokens, 8).toString());
      
      setShowMerkleRootModal(true);
      return;
    }
    
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
    if (merkleRootInput && totalTokens && currentDistId !== null) {
      writeMerkleRoot();
    }
  };

  const handleGenerateMerkleTree = async () => {
    setLoading(true);
    try {
      console.log('🌳 Generating merkle tree...');
      console.log('API endpoint: /api/generate-merkle-tree');
      
      const response = await fetch('/api/generate-merkle-tree', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Merkle tree generated successfully:', result);
        
        setMerkleRootInput(result.merkleRoot);
        setTotalTokens(formatUnits(result.totalRewards, 8));
        
        // Show success message with details
        alert(`✅ Merkle tree generated successfully!

🌳 Merkle Root: ${result.merkleRoot.slice(0, 20)}...
💰 Total Rewards: ${formatUnits(result.totalRewards, 8)} BTC1
👥 Active Holders: ${result.activeHolders}
📋 Claims: ${result.claims}

The merkle root has been automatically filled. Click "Set Merkle Root" to complete the distribution setup.`);
        
      } else {
        // Try to get error details
        let errorData;
        const contentType = response.headers.get('content-type');
        console.log('Error response content-type:', contentType);
        
        try {
          errorData = await response.json();
          console.error('❌ Server error response:', errorData);
        } catch (parseError) {
          // If response is not JSON, get text
          const errorText = await response.text();
          console.error('❌ Server error (non-JSON):', errorText.substring(0, 500));
          errorData = { 
            error: `Server returned ${response.status}`, 
            details: errorText.substring(0, 200)
          };
        }
        
        // Build detailed error message
        let errorMsg = errorData.error || `HTTP ${response.status} error`;
        if (errorData.details) {
          errorMsg += `\n\nDetails: ${errorData.details}`;
        }
        if (errorData.suggestions && Array.isArray(errorData.suggestions)) {
          errorMsg += '\n\nSuggestions:\n' + errorData.suggestions.map((s: string) => `• ${s}`).join('\n');
        }
        
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('💥 Error generating merkle tree:', error);
      
      let errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Check for common network errors
      if (errorMessage.includes('fetch')) {
        errorMessage += '\n\nPossible causes:\n• Network connection issue\n• API server not responding\n• CORS configuration problem';
      }
      
      alert(`❌ Failed to generate merkle tree:

${errorMessage}

Please check the browser console (F12) for detailed logs.`);
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
    // First check if collateral ratio is sufficient
    if (!isCollateralRatioSufficient) {
      alert(`Collateral ratio is below the required threshold of 112%.
      
Current ratio: ${collateralRatio ? `${(collateralRatio * 100).toFixed(2)}%` : 'N/A'}
Required ratio: 112%

Please add more collateral to the vault before executing the automated distribution process.`);
      return;
    }
    
    // Check if user is admin
    if (!isAdmin()) {
      alert(`Access Denied: Only admin can execute the automated distribution process.
      
Please connect with an admin wallet to proceed.`);
      return;
    }
    
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
Total Rewards: ${formatUnits(BigInt(result.totalRewards), 8)} BTC1
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

  // Helper function to format relative time
  const getRelativeTime = (date: Date | null): string => {
    if (!date) return 'Never';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);

    if (diffSeconds < 60) {
      return `${diffSeconds} second${diffSeconds !== 1 ? 's' : ''} ago`;
    }

    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  };

  // Helper function to format time until eligible for reclaim
  const formatTimeUntilEligible = (milliseconds: number): string => {
    if (milliseconds <= 0) return 'Now';

    const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));
    const hours = Math.floor((milliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days}d ${hours}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  // Fetch unclaimed distributions
  const fetchUnclaimedDistributions = async () => {
    setLoadingUnclaimed(true);
    try {
      // Fetch merkle distribution history from on-chain data
      const response = await fetch('/api/merkle-distributions/history');

      if (response.ok) {
        const distributions = await response.json();

        // Filter distributions with unclaimed rewards (not error responses)
        if (Array.isArray(distributions)) {
          // Find the highest distribution ID (latest)
          const maxDistId = distributions.length > 0
            ? Math.max(...distributions.map(d => parseInt(d.distributionId)))
            : 0;

          setCurrentDistId(maxDistId);

          const now = Date.now();
          const TEN_HOURS_MS = 10 * 60 * 60 * 1000; // 10 hours expiration period (matching testnet CLAIM_PERIOD)
          const reclaimedDistIds = getReclaimedDistributions();

          // Debug logging
          console.log('📊 Reclaimed distributions from localStorage:', Array.from(reclaimedDistIds));
          console.log('📊 All distributions from API:', distributions.map(d => d.distributionId));

          // Split distributions into eligible (expired) and pending (not yet expired)
          const eligibleDists: any[] = [];
          const pendingDists: any[] = [];

          distributions.forEach((dist: any) => {
            const distId = parseInt(dist.distributionId);
            const totalRewards = BigInt(dist.totalRewards || 0);
            const totalClaimed = BigInt(dist.totalClaimed || 0);
            const distTime = new Date(dist.timestamp).getTime();
            const ageMs = now - distTime;

            // Check if distribution has unclaimed rewards
            const hasUnclaimedRewards = totalRewards > totalClaimed && totalRewards > 0n;

            // Check if distribution is NOT finalized (finalized means all tokens have been withdrawn)
            const isNotFinalized = dist.status !== 'completed';

            // Check if distribution has NOT been reclaimed (tracked in file metadata)
            const isNotReclaimedInFile = dist.status !== 'reclaimed';

            // Check if distribution has NOT been reclaimed already (tracked in localStorage - legacy)
            const isNotReclaimed = !reclaimedDistIds.has(dist.distributionId);

            // Check if distribution is eligible based on expiration period
            const isExpired = ageMs > TEN_HOURS_MS;

            // Base criteria for all distributions
            const baseCheck = hasUnclaimedRewards && isNotFinalized && isNotReclaimedInFile && isNotReclaimed;

            if (!baseCheck) return; // Skip if doesn't meet base criteria

            const unclaimed = totalRewards - totalClaimed;
            const distData = {
              distributionId: dist.distributionId,
              rewards: dist.totalRewards,
              claimed: dist.totalClaimed || '0',
              date: dist.timestamp || new Date().toISOString(),
              unclaimed: fixPrecisionIssues(unclaimed.toString()),
              activeHolders: dist.activeHolders || 0,
              percentageClaimed: dist.percentageClaimed || 0,
              ageMs: ageMs,
              timeUntilEligible: Math.max(0, TEN_HOURS_MS - ageMs),
            };

            // Only include if has actual unclaimed rewards
            if (safeDecimalToBigInt(distData.unclaimed) > 0n) {
              if (isExpired) {
                eligibleDists.push(distData);
              } else {
                pendingDists.push(distData);
              }
            }
          });

          console.log('📊 Eligible (expired) distributions:', eligibleDists.length, eligibleDists.map(d => d.distributionId));
          console.log('📊 Pending (not yet expired) distributions:', pendingDists.length, pendingDists.map(d => d.distributionId));

          setUnclaimedDistributions(eligibleDists);
          setPendingDistributions(pendingDists);
          setLastRefreshTime(new Date()); // Update last refresh time after successful fetch
        } else {
          console.error('Invalid response format:', distributions);
          setTransactionStatus("⚠️ Failed to load unclaimed distributions");
          setTimeout(() => setTransactionStatus(""), 3000);
        }
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch distributions:', errorText);
        // Fallback to showing a user-friendly message
        setTransactionStatus("⚠️ Failed to load unclaimed distributions - server error");
        setTimeout(() => setTransactionStatus(""), 5000);
      }
    } catch (error) {
      console.error('Failed to fetch unclaimed distributions:', error);
      // More specific error handling for network issues
      if (error instanceof TypeError && error.message.includes('fetch')) {
        setTransactionStatus("⚠️ Network error - check your connection or try again later");
      } else {
        setTransactionStatus("⚠️ Failed to load unclaimed distributions - " + (error instanceof Error ? error.message : 'Unknown error'));
      }
      setTimeout(() => setTransactionStatus(""), 5000);
    } finally {
      setLoadingUnclaimed(false);
    }
  };

  // Reclaim unclaimed rewards for a distribution
  const handleReclaimRewards = (distributionId: string, unclaimedAmount: bigint) => {
    // Validation: Check wallet connection
    if (!isConnected || !address) {
      setTransactionStatus("⚠️ Please connect your wallet first");
      setTimeout(() => setTransactionStatus(""), 3000);
      return;
    }

    // Validation: Check if user is admin
    if (!isAdmin()) {
      setTransactionStatus("⚠️ Not authorized - admin only");
      setTimeout(() => setTransactionStatus(""), 3000);
      return;
    }

    // Use ACTUAL MerkleDistributor balance instead of calculated unclaimed amount
    const actualBalance = merkleDistributorBalance ? BigInt(merkleDistributorBalance.toString()) : 0n;

    // Validation: Check if there are unclaimed rewards
    if (actualBalance <= 0n) {
      setTransactionStatus("⚠️ No unclaimed rewards to reclaim");
      setTimeout(() => setTransactionStatus(""), 3000);
      return;
    }

    try {
      setTransactionType('reclaimRewards');
      setLastReclaimedDistId(distributionId); // Store the distribution ID
      setTransactionStatus("🔄 Transferring unclaimed rewards to Endowment Wallet...");

      // For all distributions, use withdrawToken to transfer the actual available balance
      // Withdraw the actual available balance
      reclaimWriteContract({
        address: MERKLE_DISTRIBUTOR_ADDRESS as `0x${string}`,
        abi: MERKLE_DISTRIBUTOR_ABI,
        functionName: 'withdrawToken',
        args: [
          CONTRACT_ADDRESSES.BTC1USD as `0x${string}`,
          process.env.NEXT_PUBLIC_ENDOWMENT_WALLET_CONTRACT as `0x${string}` || '0xC31b7bE0f369d8558007DB032D4725fD18D4B251',
          actualBalance
        ],
      });
    } catch (error) {
      console.error('Failed to reclaim rewards:', error);
      setTransactionStatus(`❌ Failed to reclaim rewards: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setTimeout(() => setTransactionStatus(""), 5000);
    }
  };

  // Reclaim ALL unclaimed rewards at once
  const handleReclaimAllRewards = () => {
    // Validation: Check wallet connection
    if (!isConnected || !address) {
      setTransactionStatus("⚠️ Please connect your wallet first");
      setTimeout(() => setTransactionStatus(""), 3000);
      return;
    }

    // Validation: Check if user is admin
    if (!isAdmin()) {
      setTransactionStatus("⚠️ Not authorized - admin only");
      setTimeout(() => setTransactionStatus(""), 3000);
      return;
    }

    // Use ACTUAL MerkleDistributor balance instead of calculated unclaimed amount
    const actualBalance = merkleDistributorBalance ? BigInt(merkleDistributorBalance.toString()) : 0n;

    // Validation: Check if there are unclaimed rewards
    if (actualBalance <= 0n) {
      setTransactionStatus("⚠️ No unclaimed rewards to reclaim");
      setTimeout(() => setTransactionStatus(""), 3000);
      return;
    }

    // Confirm with user - show ACTUAL balance
    const confirmMessage = `You are about to transfer ${formatUnits(actualBalance, 8)} BTC1 from the MerkleDistributor to the Endowment Wallet.

This action cannot be undone. Continue?`;

    if (!window.confirm(confirmMessage)) {
      setTransactionStatus("⚠️ Transfer cancelled by user");
      setTimeout(() => setTransactionStatus(""), 3000);
      return;
    }

    try {
      setTransactionType('reclaimAllRewards');
      setTransactionStatus("🔄 Transferring unclaimed rewards to Endowment Wallet...");

      reclaimWriteContract({
        address: MERKLE_DISTRIBUTOR_ADDRESS as `0x${string}`,
        abi: MERKLE_DISTRIBUTOR_ABI,
        functionName: 'withdrawToken',
        args: [
          CONTRACT_ADDRESSES.BTC1USD as `0x${string}`,
          process.env.NEXT_PUBLIC_ENDOWMENT_WALLET_CONTRACT as `0x${string}` || '0xC31b7bE0f369d8558007DB032D4725fD18D4B251',
          actualBalance
        ],
      });
    } catch (error) {
      console.error('Failed to transfer rewards:', error);
      setTransactionStatus(`❌ Failed to transfer rewards: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setTimeout(() => setTransactionStatus(""), 5000);
    }
  };

  // Track reclaimed distributions in localStorage
  const getReclaimedDistributions = (): Set<string> => {
    try {
      const stored = localStorage.getItem('reclaimedDistributions');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  };

  const markDistributionAsReclaimed = (distributionId: string) => {
    const reclaimed = getReclaimedDistributions();
    reclaimed.add(distributionId);
    localStorage.setItem('reclaimedDistributions', JSON.stringify(Array.from(reclaimed)));
  };

  const markAllDistributionsAsReclaimed = (distributionIds: string[]) => {
    const reclaimed = getReclaimedDistributions();
    distributionIds.forEach(id => reclaimed.add(id));
    localStorage.setItem('reclaimedDistributions', JSON.stringify(Array.from(reclaimed)));
  };

  // Manually mark Distribution 3 as reclaimed on mount (one-time fix)
  useEffect(() => {
    const reclaimedDists = getReclaimedDistributions();
    if (!reclaimedDists.has('3')) {
      console.log('🔧 Auto-marking Distribution #3 as reclaimed');
      markDistributionAsReclaimed('3');
      // Trigger a refresh if already connected
      if (isConnected) {
        setTimeout(() => fetchUnclaimedDistributions(), 500);
      }
    }
  }, [isConnected]);

  // Load unclaimed distributions on component mount
  useEffect(() => {
    if (isConnected) {
      fetchUnclaimedDistributions();
    }
  }, [isConnected]);

  // Auto-refresh unclaimed distributions every 30 seconds to detect new claims
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing unclaimed distributions...');
      fetchUnclaimedDistributions();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [isConnected]);

  // Update the relative time display every second for live updating
  useEffect(() => {
    const interval = setInterval(() => {
      // Force re-render to update the relative time display
      // This will cause getRelativeTime to be recalculated
      if (lastRefreshTime) {
        setLastRefreshTime(new Date(lastRefreshTime)); // Trigger re-render without changing the actual time
      }
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, [lastRefreshTime]);

  // Update pending distributions countdown timers every second
  useEffect(() => {
    if (!isConnected || pendingDistributions.length === 0) return;

    const interval = setInterval(() => {
      // Recalculate time until eligible for each pending distribution
      const now = Date.now();
      const TEN_HOURS_MS = 10 * 60 * 60 * 1000; // 10 hours expiration period (matching testnet CLAIM_PERIOD)

      const updatedPending = pendingDistributions.map(dist => {
        const distTime = new Date(dist.date).getTime();
        const ageMs = now - distTime;
        const timeUntilEligible = Math.max(0, TEN_HOURS_MS - ageMs);

        return {
          ...dist,
          ageMs,
          timeUntilEligible,
        };
      });

      // Check if any distributions have become eligible
      const nowEligible = updatedPending.filter(d => d.timeUntilEligible === 0);
      if (nowEligible.length > 0) {
        // Refresh data to move newly eligible distributions to the eligible list
        console.log('🔄 Distributions became eligible, refreshing...');
        fetchUnclaimedDistributions();
      } else {
        // Just update the countdown timers
        setPendingDistributions(updatedPending);
      }
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, [isConnected, pendingDistributions.length]);


  if (!isConnected) {
    return (
      <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-xl">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Distribution Management
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
  
  // STRICT CHECK: Only use smart contract's canDistribute (no local overrides)
  // Smart contract checks: Friday 14:00-15:00 UTC AND 7+ days passed
  const finalCanDistribute = !!canDistributeNow;

  // Calculate collateral ratio as a decimal number (e.g., 1.12 for 112%)
  // Use fallback calculation if direct call fails
  let collateralRatio = 0;
  let isManualCalculation = false;
  
  if (collateralRatioData) {
    collateralRatio = parseFloat(formatUnits(collateralRatioData as bigint, 8));
  } else if (isCollateralRatioError && totalCollateralValue && btc1usdTotalSupply) {
    // FALLBACK: Manual calculation when contract function fails
    // Formula: (totalCollateralValue * 1e8) / totalSupply
    const collateralValueNum = parseFloat(formatUnits(totalCollateralValue as bigint, 8));
    const totalSupplyNum = parseFloat(formatUnits(btc1usdTotalSupply as bigint, 8));
    
    if (totalSupplyNum > 0) {
      collateralRatio = collateralValueNum / totalSupplyNum;
      isManualCalculation = true;
    }
  }

  // Check if collateral ratio is sufficient for distribution (minimum 112%)
  const isCollateralRatioSufficient = collateralRatio >= 1.12;

  // Helper to display collateral ratio
  const getCollateralRatioDisplay = () => {
    if (isCollateralRatioLoading) return 'Loading...';
    if (isCollateralRatioError && !isManualCalculation) {
      const errorMsg = (collateralRatioError as any)?.message || '';
      if (errorMsg.includes('network')) return 'Network error';
      if (errorMsg.includes('revert')) return 'Calculating...';
      return 'Error fetching';
    }
    if (!isConnected) return 'Connect wallet';
    if (collateralRatio === 0) return '0% (no collateral)';
    const display = `${(collateralRatio * 100).toFixed(1)}%`;
    return isManualCalculation ? `${display} (calc)` : display;
  };

  // Helper to get collateral ratio status color
  const getCollateralRatioStatusColor = () => {
    if (isCollateralRatioError) return 'text-red-400';
    if (isCollateralRatioLoading) return 'text-yellow-400';
    if (!isConnected) return 'text-gray-400';
    return isCollateralRatioSufficient ? 'text-green-400' : 'text-red-400';
  };

  // Debug collateral ratio data
  useEffect(() => {
    console.log('=== COLLATERAL RATIO DEBUG ===');
    console.log('Vault Address:', VAULT_ADDRESS);
    console.log('Is Connected:', isConnected);
    console.log('Is Loading:', isCollateralRatioLoading);
    console.log('Is Error:', isCollateralRatioError);
    if (isCollateralRatioError && collateralRatioError) {
      console.error('Error Details:', collateralRatioError);
      console.error('Error Message:', (collateralRatioError as any).message || 'Unknown error');
      console.error('Error Cause:', (collateralRatioError as any).cause);
    }
    console.log('Raw Data:', collateralRatioData);
    if (collateralRatioData) {
      console.log('Parsed Ratio:', parseFloat(formatUnits(collateralRatioData as bigint, 8)));
      console.log('Percentage:', (parseFloat(formatUnits(collateralRatioData as bigint, 8)) * 100).toFixed(2) + '%');
    }
    
    // Fallback calculation logging
    if (isManualCalculation) {
      console.log('\n** USING FALLBACK CALCULATION **');
      console.log('Total Collateral Value:', totalCollateralValue ? formatUnits(totalCollateralValue as bigint, 8) : 'N/A');
      console.log('Total Supply:', btc1usdTotalSupply ? formatUnits(btc1usdTotalSupply as bigint, 8) : 'N/A');
      console.log('Calculated Ratio:', collateralRatio);
      console.log('Percentage:', (collateralRatio * 100).toFixed(2) + '%');
    }
    console.log('=== END DEBUG ===');
  }, [collateralRatioData, isConnected, isCollateralRatioLoading, isCollateralRatioError, collateralRatioError, VAULT_ADDRESS, isManualCalculation, totalCollateralValue, btc1usdTotalSupply, collateralRatio]);

  // EXECUTION REQUIREMENTS (ALL must be true):
  // 1. Smart contract canDistribute() = true (7 days passed + Friday 14:00+ UTC)
  // 2. Collateral ratio >= 1.12 (112%)
  // 3. Admin access
  const canExecuteDistribution = finalCanDistribute && isCollateralRatioSufficient && isAdmin();

  return (
    <div className="space-y-6">
      {/* Hero Section with Status */}
      <Card className="gradient-card border-border/50">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-xl sm:text-2xl flex items-center gap-2">
                <Coins className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                Distribution Management
              </CardTitle>
              <CardDescription className="mt-2 text-sm">
                Automated weekly rewards for BTC1 holders
              </CardDescription>
            </div>
            <Badge
              variant={finalCanDistribute ? "default" : "secondary"}
              className={`${finalCanDistribute ? "bg-green-500 text-white" : ""} shrink-0`}
            >
              {finalCanDistribute ? '✓ Ready' : '⏰ Waiting'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Time Remaining */}
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-blue-400" />
                <span className="text-sm text-muted-foreground">Next Distribution</span>
              </div>
              <div className="text-lg font-bold text-blue-400">
                {canDistributeNow ?
                  'Now' :
                  timeUntilNext > 0 ?
                    `${Math.floor(timeUntilNext / (1000 * 60))}m` :
                    'Now'
                }
              </div>
            </div>

            {/* Distribution ID */}
            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-purple-400" />
                <span className="text-sm text-muted-foreground">Current ID</span>
              </div>
              <div className="text-lg font-bold text-purple-400">
                #{currentDistributionInfo ? (currentDistributionInfo as any)[0]?.toString() || '0' : '0'}
              </div>
            </div>

            {/* Total Claimed */}
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-green-400" />
                <span className="text-sm text-muted-foreground">Claimed</span>
              </div>
              <div className="text-lg font-bold text-green-400">
                {stats ? formatUnits(stats[2], 8) : '0'}
              </div>
            </div>

            {/* Claim Progress */}
            <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-yellow-400" />
                <span className="text-sm text-muted-foreground">Progress</span>
              </div>
              <div className="text-lg font-bold text-yellow-400">
                {stats ? `${(Number(stats[3]) / 100).toFixed(1)}%` : '0%'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Options */}
      <Tabs defaultValue="manual" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 gap-2 p-2 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border-2 border-gray-700/30 rounded-2xl shadow-2xl backdrop-blur-md">
          <TabsTrigger
            value="manual"
            className="group relative overflow-hidden rounded-xl py-4 px-4 font-semibold text-sm
              bg-gradient-to-br from-gray-800/50 to-gray-900/50 text-gray-400 border border-gray-700/50
              hover:text-white hover:border-blue-500/50 hover:shadow-md hover:shadow-blue-500/20
              data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-500 data-[state=active]:to-blue-600
              data-[state=active]:text-white data-[state=active]:border-blue-400/50
              data-[state=active]:shadow-xl data-[state=active]:shadow-blue-500/50
              transition-all duration-300 ease-in-out
              flex items-center justify-center gap-2.5"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            <ListOrdered className="h-5 w-5 group-data-[state=active]:drop-shadow-lg relative z-10" />
            <span className="hidden sm:inline relative z-10 font-bold tracking-wide">Manual Steps</span>
            <span className="sm:hidden relative z-10 font-bold">Manual</span>
          </TabsTrigger>
          <TabsTrigger
            value="control"
            className="group relative overflow-hidden rounded-xl py-4 px-4 font-semibold text-sm
              bg-gradient-to-br from-gray-800/50 to-gray-900/50 text-gray-400 border border-gray-700/50
              hover:text-white hover:border-purple-500/50 hover:shadow-md hover:shadow-purple-500/20
              data-[state=active]:bg-gradient-to-br data-[state=active]:from-purple-500 data-[state=active]:to-purple-600
              data-[state=active]:text-white data-[state=active]:border-purple-400/50
              data-[state=active]:shadow-xl data-[state=active]:shadow-purple-500/50
              transition-all duration-300 ease-in-out
              flex items-center justify-center gap-2.5"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            <Sliders className="h-5 w-5 group-data-[state=active]:drop-shadow-lg relative z-10" />
            <span className="relative z-10 font-bold tracking-wide">Control</span>
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="group relative overflow-hidden rounded-xl py-4 px-4 font-semibold text-sm
              bg-gradient-to-br from-gray-800/50 to-gray-900/50 text-gray-400 border border-gray-700/50
              hover:text-white hover:border-green-500/50 hover:shadow-md hover:shadow-green-500/20
              data-[state=active]:bg-gradient-to-br data-[state=active]:from-green-500 data-[state=active]:to-green-600
              data-[state=active]:text-white data-[state=active]:border-green-400/50
              data-[state=active]:shadow-xl data-[state=active]:shadow-green-500/50
              transition-all duration-300 ease-in-out
              flex items-center justify-center gap-2.5"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            <History className="h-5 w-5 group-data-[state=active]:drop-shadow-lg relative z-10" />
            <span className="relative z-10 font-bold tracking-wide">History</span>
          </TabsTrigger>
          <TabsTrigger
            value="reclaim"
            className="group relative overflow-hidden rounded-xl py-4 px-4 font-semibold text-sm
              bg-gradient-to-br from-gray-800/50 to-gray-900/50 text-gray-400 border border-gray-700/50
              hover:text-white hover:border-amber-500/50 hover:shadow-md hover:shadow-amber-500/20
              data-[state=active]:bg-gradient-to-br data-[state=active]:from-amber-500 data-[state=active]:to-amber-600
              data-[state=active]:text-white data-[state=active]:border-amber-400/50
              data-[state=active]:shadow-xl data-[state=active]:shadow-amber-500/50
              transition-all duration-300 ease-in-out
              flex items-center justify-center gap-2.5"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            <Wallet className="h-5 w-5 group-data-[state=active]:drop-shadow-lg relative z-10" />
            <span className="hidden sm:inline relative z-10 font-bold tracking-wide">Reclaim Rewards</span>
            <span className="sm:hidden relative z-10 font-bold">Reclaim</span>
          </TabsTrigger>
        </TabsList>

        {/* Manual Steps */}
        <TabsContent value="manual">
          <Card className="gradient-card border-border/50">
            <CardHeader>
              <CardTitle>Manual Distribution Process</CardTitle>
              <CardDescription>
                Execute each step individually for more control
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Step 1: Execute Distribution */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-white font-bold">
                    1
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold">Execute Distribution</h3>
                </div>
                <p className="text-sm text-muted-foreground ml-4 sm:ml-10">
                  Trigger the reward distribution based on collateral ratio (7-day cycle)
                </p>

                {/* Collateral Error Alert */}
                {isCollateralRatioError && !isManualCalculation && (
                  <div className="ml-2 sm:ml-10 mt-2 mr-2 sm:mr-10">
                    <Alert className="bg-yellow-500/10 border-yellow-500/30">
                      <AlertCircle className="h-4 w-4 text-yellow-400" />
                      <AlertTitle className="text-yellow-400 font-semibold text-xs sm:text-base">Using Fallback Calculation</AlertTitle>
                      <AlertDescription className="mt-2 text-[10px] sm:text-sm text-gray-300">
                        <div className="space-y-2">
                          <div>
                            Contract function `getCurrentCollateralRatio()` is reverting. Using manual calculation instead.
                          </div>
                          <div className="text-[9px] sm:text-xs text-gray-400">
                            <strong>Formula:</strong> Total Collateral Value ÷ Total Supply
                          </div>
                          <div className="text-[9px] sm:text-xs text-gray-400">
                            This is a known issue with the current contract deployment. The calculated value is still accurate.
                          </div>
                          <div className="mt-2">
                            <Button
                              onClick={() => refetchCollateralRatio()}
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/20"
                            >
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Retry Direct Call
                            </Button>
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  </div>
                )}

                {isManualCalculation && (
                  <div className="ml-2 sm:ml-10 mt-2 mr-2 sm:mr-10">
                    <Alert className="bg-green-500/10 border-green-500/30">
                      <CheckCircle className="h-4 w-4 text-green-400" />
                      <AlertDescription className="text-[10px] sm:text-sm text-green-100">
                        ✅ Collateral ratio calculated successfully using fallback method
                      </AlertDescription>
                    </Alert>
                  </div>
                )}

                {/* Execution Requirements Alert */}
                {!canExecuteDistribution && (
                  <div className="ml-2 sm:ml-10 mt-2 mr-2 sm:mr-10">
                    <Alert className="bg-blue-500/10 border-blue-500/30">
                      <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 text-blue-400 shrink-0" />
                      <AlertTitle className="text-blue-400 font-semibold text-xs sm:text-base">Requirements</AlertTitle>
                      <AlertDescription className="mt-2 space-y-2 text-[10px] sm:text-sm text-gray-300">
                        <div className="flex items-start gap-1.5 sm:gap-2">
                          <span className="shrink-0 text-xs sm:text-sm">{finalCanDistribute ? '✅' : '❌'}</span>
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <div className="font-semibold text-[10px] sm:text-sm">Time Window:</div>
                            <div className="text-[9px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1 break-words leading-tight">
                              {finalCanDistribute
                                ? 'Ready (7 days passed) ✓'
                                : 'Need: 7 days since last distribution'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-start gap-1.5 sm:gap-2">
                          <span className="shrink-0 text-xs sm:text-sm">{isCollateralRatioSufficient ? '✅' : '❌'}</span>
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <div className="font-semibold text-[10px] sm:text-sm">Collateral:</div>
                            <div className="text-[9px] sm:text-xs mt-0.5 sm:mt-1 break-words leading-tight">
                              <span className={getCollateralRatioStatusColor()}>
                                {getCollateralRatioDisplay()}
                              </span>
                              {!isCollateralRatioLoading && !isCollateralRatioError && isConnected && (isCollateralRatioSufficient ? ' ✓' : ' (need ≥112%)')}
                              {isManualCalculation && isConnected && (isCollateralRatioSufficient ? ' ✓' : ' (need ≥112%)')}
                              {isCollateralRatioError && !isManualCalculation && (
                                <div className="mt-1 flex items-center gap-2">
                                  <Button
                                    onClick={() => refetchCollateralRatio()}
                                    variant="outline"
                                    size="sm"
                                    className="h-5 px-2 text-[8px] sm:text-xs border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                                  >
                                    <RefreshCw className="h-2 w-2 sm:h-3 sm:w-3 mr-1" />
                                    Retry
                                  </Button>
                                  <span className="text-[8px] text-yellow-400">Using fallback...</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-start gap-1.5 sm:gap-2">
                          <span className="shrink-0 text-xs sm:text-sm">{isAdmin() ? '✅' : '❌'}</span>
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <div className="font-semibold text-[10px] sm:text-sm">Admin:</div>
                            <div className="text-[9px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1 break-words leading-tight">
                              {isAdmin() ? 'Verified ✓' : 'Not admin'}
                            </div>
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  </div>
                )}

                <div className="ml-4 sm:ml-10">
                  <Button
                    onClick={handleExecuteDistribution}
                    disabled={!canExecuteDistribution || isExecuting || isConfirming}
                    className={`w-full ${!isCollateralRatioSufficient ? 'bg-gray-500 hover:bg-gray-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                  >
                    {isExecuting || isConfirming ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {isExecuting ? 'Executing...' : 'Confirming...'}
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Execute Distribution
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Step 2: Generate Merkle Tree */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-500 text-white font-bold">
                    2
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold">Generate Merkle Tree</h3>
                </div>
                <p className="text-sm text-muted-foreground ml-4 sm:ml-10">
                  Calculate rewards for all holders and create merkle proof
                </p>
                <div className="ml-4 sm:ml-10">
                  <Button
                    onClick={handleGenerateMerkleTree}
                    disabled={loading}
                    className="w-full bg-purple-600 hover:bg-purple-700"
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
                </div>
              </div>

              <Separator />

              {/* Step 3: Set Merkle Root */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500 text-white font-bold">
                    3
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold">Set Merkle Root</h3>
                </div>
                <p className="text-sm text-muted-foreground ml-4 sm:ml-10">
                  Submit the merkle root to enable claims
                </p>
                <div className="ml-4 sm:ml-10 space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="merkleRoot">Merkle Root</Label>
                    <Input
                      id="merkleRoot"
                      value={merkleRootInput}
                      onChange={(e) => setMerkleRootInput(e.target.value)}
                      placeholder="0x..."
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="totalTokens">Total Tokens (BTC1)</Label>
                    <Input
                      id="totalTokens"
                      value={totalTokens}
                      onChange={(e) => setTotalTokens(e.target.value)}
                      placeholder="0.00"
                      type="number"
                      step="0.00000001"
                    />
                  </div>
                  <Button
                    onClick={handleSetMerkleRoot}
                    disabled={!merkleRootInput || !totalTokens || isSettingRoot}
                    className="w-full bg-green-600 hover:bg-green-700"
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
              </div>

              {/* Transaction Status */}
              {executionError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{executionError.message}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Control Panel */}
        <TabsContent value="control">
          <Card className="gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-red-500" />
                Emergency Controls
              </CardTitle>
              <CardDescription>
                Admin controls for system pause/unpause
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Status Display */}
              <div className={`p-6 rounded-lg border-2 ${isPaused ? 'bg-red-500/10 border-red-500/50' : 'bg-green-500/10 border-green-500/50'}`}>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {isPaused ? (
                        <Pause className="h-5 w-5 text-red-500" />
                      ) : (
                        <Play className="h-5 w-5 text-green-500" />
                      )}
                      <span className="text-lg font-semibold">System Status</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Distribution system is currently {isPaused ? 'paused' : 'active'}
                    </p>
                  </div>
                  <Badge
                    variant={isPaused ? "destructive" : "default"}
                    className={`text-lg px-4 py-2 ${!isPaused && 'bg-green-500 hover:bg-green-600'}`}
                  >
                    {isPaused ? '⏸ Paused' : '▶ Active'}
                  </Badge>
                </div>
              </div>

              {/* Control Button */}
              <Button
                onClick={handleTogglePause}
                disabled={isPausing || isUnpausing || !isAdmin()}
                variant={isPaused ? "default" : "destructive"}
                className={`w-full h-14 text-lg ${isPaused && 'bg-green-600 hover:bg-green-700'}`}
              >
                {isPausing || isUnpausing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {isPaused ? 'Unpausing System...' : 'Pausing System...'}
                  </>
                ) : (
                  <>
                    {isPaused ? (
                      <><Play className="mr-2 h-5 w-5" /> Resume Distribution System</>
                    ) : (
                      <><Pause className="mr-2 h-5 w-5" /> Emergency Pause System</>
                    )}
                  </>
                )}
              </Button>

              {/* Info Alert */}
              <Alert variant={isPaused ? "destructive" : "default"}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {isPaused
                    ? '⚠️ System is paused. Users cannot claim rewards until resumed.'
                    : '✓ System is active. Users can claim their weekly rewards.'}
                </AlertDescription>
              </Alert>

              {!isAdmin() && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Admin access required to control the system.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Distribution History */}
        <TabsContent value="history">
          <Card className="gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-purple-500" />
                Distribution History
              </CardTitle>
              <CardDescription>
                Past distribution events and claim statistics
              </CardDescription>
            </CardHeader>
            <CardContent>
              {distributionHistory.length === 0 ? (
                <div className="text-center py-12">
                  <History className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-muted-foreground">No distribution history available yet</p>
                  <p className="text-sm text-muted-foreground mt-2">Execute your first distribution to see history here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {distributionHistory.map((dist, index) => {
                    const claimPercentage = ((parseFloat(dist.totalClaimed) / parseFloat(dist.totalRewards)) * 100).toFixed(1);
                    const isRecent = index === 0;

                    return (
                      <div
                        key={dist.id}
                        className={`p-4 rounded-lg border ${isRecent ? 'bg-primary/5 border-primary/30' : 'bg-muted/50 border-border'}`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-lg">Distribution #{dist.id}</span>
                              {isRecent && <Badge variant="default" className="bg-blue-500">Latest</Badge>}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {new Date(dist.timestamp).toLocaleDateString()} at {new Date(dist.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                          <Badge
                            variant="secondary"
                            className={`text-base px-3 py-1 ${parseFloat(claimPercentage) > 80 ? 'bg-green-500/20 text-green-500' : 'bg-yellow-500/20 text-yellow-500'}`}
                          >
                            {claimPercentage}% claimed
                          </Badge>
                        </div>

                        {/* Progress Bar */}
                        <div className="mb-3">
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full ${parseFloat(claimPercentage) > 80 ? 'bg-green-500' : 'bg-yellow-500'}`}
                              style={{ width: `${claimPercentage}%` }}
                            />
                          </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Total Rewards</p>
                            <p className="font-semibold text-sm">{formatUnits(BigInt(dist.totalRewards || 0), 8)} BTC1</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Claimed</p>
                            <p className="font-semibold text-sm text-green-500">{formatUnits(BigInt(dist.totalClaimed || 0), 8)} BTC1</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Calculated Unclaimed</p>
                            <p className="font-semibold text-sm text-amber-500">{formatUnits(BigInt(dist.totalRewards || 0) - BigInt(dist.totalClaimed || 0), 8)} BTC1</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reclaim Unclaimed Rewards */}
        <TabsContent value="reclaim">
          <Card className="gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-amber-500" />
                Reclaim Unclaimed Rewards
              </CardTitle>
              <CardDescription>
                Transfer unclaimed rewards from completed distributions to the Endowment Wallet
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Info Alert */}
              <Alert className="bg-amber-500/10 border-amber-500/30">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <AlertDescription className="text-sm">
                  This feature allows admins to reclaim unclaimed rewards from distributions and transfer them to the Endowment Wallet for treasury management.
                  {getReclaimedDistributions().size > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {getReclaimedDistributions().size} distribution(s) already reclaimed
                      </span>
                      <Button
                        onClick={() => {
                          if (window.confirm('Clear reclaimed history? This will show all distributions again.')) {
                            localStorage.removeItem('reclaimedDistributions');
                            fetchUnclaimedDistributions();
                          }
                        }}
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                      >
                        Clear History
                      </Button>
                    </div>
                  )}
                </AlertDescription>
              </Alert>

              {/* Loading State */}
              {loadingUnclaimed ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                  <p className="text-muted-foreground">Loading unclaimed distributions...</p>
                </div>
              ) : unclaimedDistributions.length === 0 && pendingDistributions.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p className="text-lg font-semibold text-green-500">All distributions fully claimed!</p>
                  <p className="text-sm text-muted-foreground mt-2">There are no unclaimed rewards to reclaim at this time.</p>
                  <Button
                    onClick={fetchUnclaimedDistributions}
                    variant="outline"
                    className="mt-4"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh Data
                  </Button>
                </div>
              ) : (
                <>
                  {/* Distributions with Unclaimed Rewards */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-5 w-5 text-amber-500" />
                          <h3 className="text-lg font-semibold">Eligible Distributions (Expired - Ready to Reclaim)</h3>
                        </div>
                        {lastRefreshTime && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Last updated: {getRelativeTime(lastRefreshTime)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={fetchUnclaimedDistributions}
                          variant="outline"
                          size="sm"
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Refresh
                        </Button>
                        {unclaimedDistributions.length > 0 && (
                          <Button
                            onClick={handleReclaimAllRewards}
                            disabled={isReclaiming || isConfirmingReclaim || !isAdmin()}
                            size="sm"
                            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
                          >
                            {isReclaiming || isConfirmingReclaim ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              <>
                                <Download className="mr-2 h-4 w-4" />
                                Transfer Available Balance ({merkleDistributorBalance ? formatUnits(BigInt(merkleDistributorBalance.toString()), 8) : '0'} BTC1) to Endowment Wallet
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Summary Stats */}
                    {(unclaimedDistributions.length > 0 || pendingDistributions.length > 0) && (
                      <div className="p-4 rounded-lg bg-gradient-to-r from-amber-500/10 to-amber-600/10 border border-amber-500/30">
                        <div className="grid grid-cols-4 gap-4">
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Eligible (Expired)</p>
                            <p className="text-lg font-bold text-amber-500">
                              {unclaimedDistributions.length}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Pending Expiration</p>
                            <p className="text-lg font-bold text-blue-400">
                              {pendingDistributions.length}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Available to Reclaim</p>
                            <p className="text-lg font-bold text-green-500">
                              {merkleDistributorBalance ? safeFormatUnits(merkleDistributorBalance as any, 8) : '0'} BTC1
                            </p>
                            <p className="text-xs text-muted-foreground italic">
                              (Actual contract balance)
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Current Distribution</p>
                            <p className="text-lg font-bold text-purple-400">
                              #{currentDistId} (Active)
                            </p>
                          </div>
                        </div>
                        <Alert className="mt-3 bg-blue-500/10 border-blue-500/30">
                          <AlertCircle className="h-4 w-4 text-blue-400" />
                          <AlertDescription className="text-xs text-blue-400">
                            Distributions must be 10 hours old before they can be reclaimed.
                            {unclaimedDistributions.length > 0 && ` ${unclaimedDistributions.length} distribution(s) ready to reclaim now.`}
                            {pendingDistributions.length > 0 && ` ${pendingDistributions.length} distribution(s) pending expiration.`}
                          </AlertDescription>
                        </Alert>
                      </div>
                    )}

                    {/* Show message if no eligible distributions but have pending ones */}
                    {unclaimedDistributions.length === 0 && pendingDistributions.length > 0 && (
                      <Alert className="bg-blue-500/10 border-blue-500/30">
                        <Clock className="h-4 w-4 text-blue-400" />
                        <AlertDescription className="text-sm text-blue-400">
                          No distributions have expired yet. Check the "Pending Distributions" section below to see when distributions will become eligible for reclaim.
                        </AlertDescription>
                      </Alert>
                    )}

                    {unclaimedDistributions.map((dist, index) => {
                      const totalRewards = BigInt(dist.rewards || 0);
                      const claimed = BigInt(dist.claimed || 0);
                      const unclaimed = safeDecimalToBigInt(dist.unclaimed || '0');
                      const claimPercentage = totalRewards > 0n
                        ? Number((claimed * 10000n) / totalRewards) / 100
                        : 0;

                      // Calculate age
                      const distTime = new Date(dist.date).getTime();
                      const ageMs = Date.now() - distTime;
                      const ageMinutes = Math.floor(ageMs / (60 * 1000));
                      const ageHours = Math.floor(ageMinutes / 60);
                      const ageDays = Math.floor(ageHours / 24);

                      let ageDisplay = '';
                      if (ageDays > 0) {
                        ageDisplay = `${ageDays}d ${ageHours % 24}h ago`;
                      } else if (ageHours > 0) {
                        ageDisplay = `${ageHours}h ${ageMinutes % 60}m ago`;
                      } else {
                        ageDisplay = `${ageMinutes}m ago`;
                      }

                      return (
                        <div
                          key={dist.distributionId || index}
                          className="p-6 rounded-lg border bg-gradient-to-r from-amber-500/5 to-amber-600/5 border-amber-500/20"
                        >
                          <div className="flex justify-between items-start mb-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-lg">Distribution #{dist.distributionId || (index + 1)}</span>
                                <Badge variant="secondary" className="bg-amber-500/20 text-amber-500">
                                  {claimPercentage.toFixed(1)}% claimed
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {ageDisplay}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {new Date(dist.date).toLocaleDateString()} at {new Date(dist.date).toLocaleTimeString()}
                              </div>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="mb-4">
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-amber-500 to-amber-600"
                                style={{ width: `${claimPercentage}%` }}
                              />
                            </div>
                          </div>

                          {/* Stats Grid */}
                          <div className="grid grid-cols-3 gap-4 mb-4">
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Total Rewards</p>
                              <p className="font-semibold text-sm">{formatUnits(totalRewards, 8)} BTC1</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Claimed</p>
                              <p className="font-semibold text-sm text-green-500">{formatUnits(claimed, 8)} BTC1</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Calculated Unclaimed</p>
                              <p className="font-semibold text-sm text-amber-500">{formatUnits(unclaimed, 8)} BTC1</p>
                            </div>
                          </div>

                          {/* Warning if calculated unclaimed exceeds actual balance */}
                          {(() => {
                            if (!merkleDistributorBalance) return null;
                            const merkleBalance = safeToBigInt(merkleDistributorBalance);
                            if (merkleBalance === null) return null;
                            const isInsufficient = unclaimed > merkleBalance;
                            
                            return isInsufficient ? (
                              <Alert variant="destructive" className="mb-4">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription className="text-xs">
                                  ⚠️ Note: Actual available balance ({safeFormatUnits(merkleDistributorBalance, 8)} BTC1) is less than calculated unclaimed.
                                  Use "Transfer All Unclaimed" button below to reclaim the available balance.
                                </AlertDescription>
                              </Alert>
                            ) : null;
                          })() || null}

                          {/* Action Buttons */}
                          <div className="space-y-2">
                            {/* Calculate if button should be disabled due to insufficient balance */}
                            {(() => {
                              if (!merkleDistributorBalance) {
                                const isDisabled = isReclaiming || 
                                  isConfirmingReclaim || 
                                  !isAdmin() || 
                                  unclaimed <= 0n;

                                return (
                                  <Button
                                    onClick={() => handleReclaimRewards(dist.distributionId || (index + 1).toString(), unclaimed)}
                                    disabled={isDisabled}
                                    className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
                                  >
                                    {isReclaiming || isConfirmingReclaim ? (
                                      <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {isReclaiming ? 'Processing...' : 'Confirming...'}
                                      </>
                                    ) : (
                                      <>
                                        <Download className="mr-2 h-4 w-4" />
                                        Transfer {merkleDistributorBalance ? formatUnits(BigInt(merkleDistributorBalance.toString()), 8) : '0'} BTC1 to Endowment Wallet
                                      </>
                                    )}
                                  </Button>
                                );
                              }
                              
                              const merkleBalance = safeToBigInt(merkleDistributorBalance);
                              const isInsufficientBalance = merkleBalance !== null && unclaimed > merkleBalance;
                              
                              const isDisabled = isReclaiming || 
                                isConfirmingReclaim || 
                                !isAdmin() || 
                                unclaimed <= 0n || 
                                isInsufficientBalance;

                              return (
                                <Button
                                  onClick={() => handleReclaimRewards(dist.distributionId || (index + 1).toString(), unclaimed)}
                                  disabled={isDisabled}
                                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
                                >
                                  {isReclaiming || isConfirmingReclaim ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      {isReclaiming ? 'Processing...' : 'Confirming...'}
                                    </>
                                  ) : isInsufficientBalance ? (
                                    <>
                                      <AlertCircle className="mr-2 h-4 w-4" />
                                      Insufficient Balance - Use "Transfer All" Below
                                    </>
                                  ) : (
                                    <>
                                      <Download className="mr-2 h-4 w-4" />
                                      Transfer {formatUnits(unclaimed, 8)} BTC1 to Endowment Wallet
                                    </>
                                  )}
                                </Button>
                              );
                            })() || null}

                            {/* Manual Mark as Reclaimed Button */}
                            <Button
                              onClick={() => {
                                if (window.confirm(`Mark Distribution #${dist.distributionId} as reclaimed? This will hide it from the list.`)) {
                                  markDistributionAsReclaimed(dist.distributionId);
                                  setUnclaimedDistributions(prev =>
                                    prev.filter(d => d.distributionId !== dist.distributionId)
                                  );
                                  setTransactionStatus("✅ Distribution marked as reclaimed");
                                  setTimeout(() => setTransactionStatus(""), 2000);
                                }
                              }}
                              variant="outline"
                              size="sm"
                              className="w-full text-xs"
                            >
                              Mark as Reclaimed (Manual)
                            </Button>
                          </div>

                          {!isAdmin() && (
                            <Alert variant="destructive" className="mt-3">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription className="text-xs">
                                Admin access required to reclaim rewards
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Pending Distributions (Not Yet Eligible) */}
                  {pendingDistributions.length > 0 && (
                    <div className="space-y-4 mt-8">
                      <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-blue-400" />
                        <h3 className="text-lg font-semibold">Pending Distributions (Not Yet Expired)</h3>
                      </div>
                      <Alert className="bg-blue-500/10 border-blue-500/30">
                        <AlertCircle className="h-4 w-4 text-blue-400" />
                        <AlertDescription className="text-sm text-blue-400">
                          These distributions have unclaimed rewards but have not reached the 10-hour expiration period yet. They will become eligible for reclaim after expiration.
                        </AlertDescription>
                      </Alert>

                      {pendingDistributions.map((dist, index) => {
                        const totalRewards = BigInt(dist.rewards || 0);
                        const claimed = BigInt(dist.claimed || 0);
                        const unclaimed = safeDecimalToBigInt(dist.unclaimed || '0');
                        const claimPercentage = totalRewards > 0n
                          ? Number((claimed * 10000n) / totalRewards) / 100
                          : 0;

                        // Calculate age
                        const distTime = new Date(dist.date).getTime();
                        const ageMs = Date.now() - distTime;
                        const ageMinutes = Math.floor(ageMs / (60 * 1000));
                        const ageHours = Math.floor(ageMinutes / 60);
                        const ageDays = Math.floor(ageHours / 24);

                        let ageDisplay = '';
                        if (ageDays > 0) {
                          ageDisplay = `${ageDays}d ${ageHours % 24}h ago`;
                        } else if (ageHours > 0) {
                          ageDisplay = `${ageHours}h ${ageMinutes % 60}m ago`;
                        } else {
                          ageDisplay = `${ageMinutes}m ago`;
                        }

                        // Calculate progress percentage (0-100)
                        const TEN_HOURS_MS = 10 * 60 * 60 * 1000; // 10 hours expiration period (matching testnet CLAIM_PERIOD)
                        const progressPercentage = Math.min(100, (ageMs / TEN_HOURS_MS) * 100);

                        return (
                          <div
                            key={dist.distributionId || `pending-${index}`}
                            className="p-6 rounded-lg border bg-gradient-to-r from-blue-500/5 to-blue-600/5 border-blue-500/20"
                          >
                            <div className="flex justify-between items-start mb-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-lg">Distribution #{dist.distributionId || (index + 1)}</span>
                                  <Badge variant="secondary" className="bg-blue-500/20 text-blue-400">
                                    Pending Expiration
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {ageDisplay}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(dist.date).toLocaleDateString()} at {new Date(dist.date).toLocaleTimeString()}
                                </div>
                              </div>
                            </div>

                            {/* Expiration Progress Bar */}
                            <div className="mb-4">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-muted-foreground">Time until eligible for reclaim</span>
                                <span className="text-xs font-semibold text-blue-400">
                                  {formatTimeUntilEligible(dist.timeUntilEligible)}
                                </span>
                              </div>
                              <div className="h-2 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-1000"
                                  style={{ width: `${progressPercentage}%` }}
                                />
                              </div>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-xs text-muted-foreground">Created</span>
                                <span className="text-xs text-muted-foreground">365 days (Eligible)</span>
                              </div>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-3 gap-4 mb-4">
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">Total Rewards</p>
                                <p className="font-semibold text-sm">{formatUnits(totalRewards, 8)} BTC1</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">Claimed</p>
                                <p className="font-semibold text-sm text-green-500">{formatUnits(claimed, 8)} BTC1</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">Pending Unclaimed</p>
                                <p className="font-semibold text-sm text-blue-400">{formatUnits(unclaimed, 8)} BTC1</p>
                              </div>
                            </div>

                            {/* Info Alert */}
                            <Alert className="bg-blue-500/10 border-blue-500/30">
                              <Clock className="h-4 w-4 text-blue-400" />
                              <AlertDescription className="text-xs text-blue-400">
                                This distribution will be eligible for reclaim in {formatTimeUntilEligible(dist.timeUntilEligible)} (after 365 days total).
                                Users can still claim their rewards during this period.
                              </AlertDescription>
                            </Alert>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Transaction Status Banner */}
      {transactionStatus && (
        <div className={`
          fixed top-4 left-1/2 transform -translate-x-1/2 z-50
          max-w-2xl w-full mx-4 px-6 py-4 rounded-xl shadow-2xl backdrop-blur-md
          border-2 animate-in slide-in-from-top duration-300
          ${
            transactionStatus.includes('✅')
              ? 'bg-gradient-to-r from-emerald-500/90 to-emerald-600/90 border-emerald-400'
              : transactionStatus.includes('❌')
              ? 'bg-gradient-to-r from-red-500/90 to-red-600/90 border-red-400'
              : transactionStatus.includes('⚠️')
              ? 'bg-gradient-to-r from-yellow-500/90 to-yellow-600/90 border-yellow-400'
              : 'bg-gradient-to-r from-blue-500/90 to-blue-600/90 border-blue-400'
          }
        `}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              {transactionStatus.includes('🔄') && (
                <div className="w-5 h-5 border-3 border-current border-t-transparent rounded-full animate-spin"></div>
              )}
              <p className="font-semibold text-base text-white">{transactionStatus}</p>
            </div>
            <button
              onClick={() => setTransactionStatus("")}
              className="text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Beautiful Safe Transaction Modal */}
      <Dialog open={showSafeModal} onOpenChange={setShowSafeModal}>
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto bg-gray-900 border-2 border-orange-500/60 shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-900/30 via-gray-900 to-red-900/30 rounded-lg"></div>
          <div className="relative z-10">
          <DialogHeader>
            <div className="flex items-center gap-2 sm:gap-3 mb-2">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg sm:text-2xl font-bold text-white">
                  Safe Transaction Required
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm text-gray-400">
                  Execute via Gnosis Safe with multi-sig approval
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 sm:space-y-4 py-2 sm:py-4">
            {/* Alert Banner */}
            <Alert className="bg-yellow-500/10 border-2 border-yellow-500/50">
              <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-400" />
              <AlertDescription className="text-yellow-200 text-xs sm:text-sm">
                ⚠️ Execute this transaction through Safe UI with the data below
              </AlertDescription>
            </Alert>

            {/* Connection Status */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 sm:p-4">
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs sm:text-sm font-medium text-blue-400 mb-1">Connected as UI Controller</p>
                  <code className="text-xs text-gray-300 bg-black/30 px-2 py-1 rounded font-mono break-all">
                    {address?.slice(0, 10)}...{address?.slice(-8)}
                  </code>
                </div>
              </div>
            </div>

            {/* Transaction Details */}
            <div className="space-y-2 sm:space-y-3">
              <h3 className="text-xs sm:text-sm font-semibold text-white flex items-center gap-2">
                <Terminal className="w-3 h-3 sm:w-4 sm:h-4" />
                Transaction Details
              </h3>
              
              <div className="bg-black/40 border border-gray-700 rounded-lg p-3 sm:p-4 space-y-2 sm:space-y-3">
                {/* Contract Address */}
                <div className="space-y-1">
                  <Label className="text-xs text-gray-400">Contract Address</Label>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <code className="text-xs text-green-400 bg-black/50 px-2 sm:px-3 py-2 rounded font-mono flex-1 overflow-x-auto break-all">
                      {WEEKLY_DISTRIBUTION_ADDRESS}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-full sm:w-8 p-0"
                      onClick={() => {
                        navigator.clipboard.writeText(WEEKLY_DISTRIBUTION_ADDRESS);
                        setCopiedField('contract');
                        setTimeout(() => setCopiedField(null), 2000);
                      }}
                    >
                      {copiedField === 'contract' ? (
                        <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-400" />
                      ) : (
                        <Copy className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Encoded Data */}
                <div className="space-y-1">
                  <Label className="text-xs text-gray-400">Encoded Transaction Data (Hex)</Label>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <code className="text-xs text-cyan-400 bg-black/50 px-3 py-2 rounded font-mono flex-1 overflow-x-auto max-h-20">
                      {(() => {
                        try {
                          return encodeFunctionData({
                            abi: WEEKLY_DISTRIBUTION_ABI,
                            functionName: 'executeDistribution',
                            args: []
                          });
                        } catch {
                          return '0x2e7ba6ef';
                        }
                      })()}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-full sm:w-8 p-0"
                      onClick={() => {
                        const encodedData = encodeFunctionData({
                          abi: WEEKLY_DISTRIBUTION_ABI,
                          functionName: 'executeDistribution',
                          args: []
                        });
                        navigator.clipboard.writeText(encodedData);
                        setCopiedField('data');
                        setTimeout(() => setCopiedField(null), 2000);
                      }}
                    >
                      {copiedField === 'data' ? (
                        <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-400" />
                      ) : (
                        <Copy className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Function selector for executeDistribution()</p>
                </div>

                {/* Function Name */}
                <div className="space-y-1">
                  <Label className="text-xs text-gray-400">Function</Label>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <code className="text-xs text-blue-400 bg-black/50 px-2 sm:px-3 py-2 rounded font-mono flex-1">
                      executeDistribution()
                    </code>
                  </div>
                </div>

                {/* Value */}
                <div className="space-y-1">
                  <Label className="text-xs text-gray-400">Value</Label>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <code className="text-xs text-yellow-400 bg-black/50 px-2 sm:px-3 py-2 rounded font-mono flex-1">
                      0 ETH
                    </code>
                  </div>
                </div>

                {/* Safe Address */}
                <div className="space-y-1">
                  <Label className="text-xs text-gray-400">Safe Multi-Sig Address</Label>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <code className="text-xs text-purple-400 bg-black/50 px-2 sm:px-3 py-2 rounded font-mono flex-1 overflow-x-auto break-all">
                      {process.env.NEXT_PUBLIC_SAFE_ADDRESS}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-full sm:w-8 p-0"
                      onClick={() => {
                        navigator.clipboard.writeText(process.env.NEXT_PUBLIC_SAFE_ADDRESS || '');
                        setCopiedField('safe');
                        setTimeout(() => setCopiedField(null), 2000);
                      }}
                    >
                      {copiedField === 'safe' ? (
                        <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-400" />
                      ) : (
                        <Copy className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Steps */}
            <div className="space-y-2 sm:space-y-3">
              <h3 className="text-xs sm:text-sm font-semibold text-white flex items-center gap-2">
                <ListOrdered className="w-3 h-3 sm:w-4 sm:h-4" />
                Execution Steps
              </h3>
              
              <div className="space-y-2">
                {[
                  { icon: ExternalLink, text: 'Open Safe UI in new tab', color: 'text-blue-400' },
                  { icon: Terminal, text: 'Create "New Transaction" → "Contract Interaction"', color: 'text-green-400' },
                  { icon: Copy, text: 'Paste contract address and hex data above', color: 'text-cyan-400' },
                  { icon: CheckCircle, text: 'Verify function: executeDistribution()', color: 'text-yellow-400' },
                  { icon: Users, text: 'Collect threshold signatures from Safe owners', color: 'text-purple-400' },
                  { icon: Sparkles, text: 'Execute transaction from Safe', color: 'text-orange-400' },
                ].map((step, index) => (
                  <div key={index} className="flex items-start gap-2 sm:gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-gray-400">{index + 1}</span>
                    </div>
                    <step.icon className={`w-3 h-3 sm:w-4 sm:h-4 ${step.color} flex-shrink-0 mt-1`} />
                    <p className="text-xs sm:text-sm text-gray-300 flex-1">{step.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => setShowSafeModal(false)}
              className="flex-1 border-gray-600 hover:bg-gray-800 h-10 sm:h-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const safeUrl = `https://app.safe.global/base:${process.env.NEXT_PUBLIC_SAFE_ADDRESS}`;
                window.open(safeUrl, '_blank');
              }}
              className="flex-1 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white shadow-lg shadow-orange-500/40 border-2 border-orange-400/60 font-semibold h-10 sm:h-auto"
            >
              <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Open Safe UI
              <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
            </Button>
          </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Merkle Root Safe Transaction Modal */}
      <Dialog open={showMerkleRootModal} onOpenChange={setShowMerkleRootModal}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto bg-gradient-to-br from-gray-900 via-purple-950 to-gray-900 border-2 border-purple-500/70 shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/50">
                <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl sm:text-2xl font-bold text-white">
                  Set Merkle Root
                </DialogTitle>
                <DialogDescription className="text-sm sm:text-base text-purple-200">
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
                  onClick={() => copyToClipboard(WEEKLY_DISTRIBUTION_ADDRESS, 'contract')}
                >
                  {copiedField === 'contract' ? (
                    <><CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copied!</>
                  ) : (
                    <><Copy className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copy</>
                  )}
                </Button>
              </div>
              <code className="text-xs sm:text-sm text-green-300 bg-black/60 px-3 sm:px-4 py-2 sm:py-3 rounded font-mono block overflow-x-auto border border-green-500/40 break-all">
                {WEEKLY_DISTRIBUTION_ADDRESS}
              </code>
            </div>

            {/* ABI JSON */}
            <div className="bg-gradient-to-br from-purple-900/20 to-indigo-900/20 border-2 border-purple-500/50 rounded-lg p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                <Label className="text-xs sm:text-sm text-purple-300 font-bold uppercase">2️⃣ Contract ABI (JSON)</Label>
                <Button
                  size="sm"
                  className="h-8 px-3 sm:px-4 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs sm:text-sm w-full sm:w-auto"
                  onClick={() => {
                    const abiJson = JSON.stringify([{
                      "inputs": [
                        { "internalType": "bytes32", "name": "merkleRoot", "type": "bytes32" },
                        { "internalType": "uint256", "name": "totalTokensForHolders", "type": "uint256" }
                      ],
                      "name": "updateMerkleRoot",
                      "outputs": [],
                      "stateMutability": "nonpayable",
                      "type": "function"
                    }], null, 2);
                    copyToClipboard(abiJson, 'abi');
                  }}
                >
                  {copiedField === 'abi' ? (
                    <><CheckCircle className="w-4 h-4 mr-2" /> Copied!</>
                  ) : (
                    <><Copy className="w-4 h-4 mr-2" /> Copy ABI</>
                  )}
                </Button>
              </div>
              <code className="text-xs sm:text-sm text-purple-200 bg-black/60 px-3 sm:px-4 py-2 sm:py-3 rounded font-mono block overflow-x-auto max-h-32 border border-purple-500/40">
                {JSON.stringify([{
                  "inputs": [
                    { "internalType": "bytes32", "name": "merkleRoot", "type": "bytes32" },
                    { "internalType": "uint256", "name": "totalTokensForHolders", "type": "uint256" }
                  ],
                  "name": "updateMerkleRoot",
                  "outputs": [],
                  "stateMutability": "nonpayable",
                  "type": "function"
                }], null, 2)}
              </code>
            </div>

            {/* Encoded Calldata */}
            <div className="bg-gradient-to-br from-cyan-900/20 to-blue-900/20 border-2 border-cyan-500/50 rounded-lg p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                <Label className="text-xs sm:text-sm text-cyan-300 font-bold uppercase">3️⃣ Encoded Calldata</Label>
                <Button
                  size="sm"
                  className="h-8 px-3 sm:px-4 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-xs sm:text-sm w-full sm:w-auto"
                  onClick={() => {
                    const encodedData = encodeFunctionData({
                      abi: WEEKLY_DISTRIBUTION_ABI,
                      functionName: 'updateMerkleRoot',
                      args: [merkleRootInput as `0x${string}`, parseUnits(totalTokens || '0', 8)]
                    });
                    copyToClipboard(encodedData, 'calldata');
                  }}
                >
                  {copiedField === 'calldata' ? (
                    <><CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copied!</>
                  ) : (
                    <><Copy className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Copy Calldata</>
                  )}
                </Button>
              </div>
              <code className="text-xs sm:text-sm text-cyan-200 bg-black/60 px-3 sm:px-4 py-2 sm:py-3 rounded font-mono block overflow-x-auto max-h-32 border border-cyan-500/40 break-all">
                {(() => {
                  try {
                    return encodeFunctionData({
                      abi: WEEKLY_DISTRIBUTION_ABI,
                      functionName: 'updateMerkleRoot',
                      args: [merkleRootInput as `0x${string}`, parseUnits(totalTokens || '0', 8)]
                    });
                  } catch {
                    return '0x...';
                  }
                })()}
              </code>
            </div>

            {/* Parameters */}
            <div className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 border border-gray-600/50 rounded-lg p-3 sm:p-4">
              <h3 className="text-xs sm:text-sm font-bold text-white mb-2 sm:mb-3">Parameters</h3>
              <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                  <span className="text-gray-400">Function:</span>
                  <code className="text-purple-300 bg-black/40 px-2 sm:px-3 py-1 rounded font-mono text-xs sm:text-sm">updateMerkleRoot</code>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                  <span className="text-gray-400">Merkle Root:</span>
                  <code className="text-xs text-purple-200 bg-black/40 px-2 py-1 rounded font-mono max-w-full sm:max-w-[300px] truncate">{merkleRootInput}</code>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                  <span className="text-gray-400">Total Tokens:</span>
                  <code className="text-white bg-black/40 px-2 sm:px-3 py-1 rounded font-mono text-xs sm:text-sm">{totalTokens} BTC1USD</code>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                  <span className="text-gray-400">Total (wei):</span>
                  <code className="text-xs text-gray-300 bg-black/40 px-2 py-1 rounded font-mono truncate">{parseUnits(totalTokens || '0', 8).toString()}</code>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                  <span className="text-gray-400">Value:</span>
                  <code className="text-yellow-300 bg-black/40 px-2 sm:px-3 py-1 rounded font-mono text-xs sm:text-sm">0 ETH</code>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-gradient-to-r from-orange-900/20 to-red-900/20 border border-orange-500/40 rounded-lg p-3 sm:p-4">
              <h3 className="text-xs sm:text-sm font-bold text-white mb-2 flex items-center gap-2">
                <span className="text-lg sm:text-xl">📝</span>
                How to Execute in Safe UI
              </h3>
              <div className="space-y-1.5 text-xs sm:text-sm text-gray-200">
                <div className="flex items-start gap-2">
                  <span className="text-orange-400 font-bold min-w-[16px] sm:min-w-[20px] text-xs sm:text-sm">1.</span>
                  <span className="text-xs sm:text-sm">Open Safe UI → <strong>New Transaction</strong> → <strong>Contract Interaction</strong></span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-orange-400 font-bold min-w-[16px] sm:min-w-[20px] text-xs sm:text-sm">2.</span>
                  <span className="text-xs sm:text-sm">Paste <span className="text-green-300 font-semibold">Contract Address</span></span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-orange-400 font-bold min-w-[16px] sm:min-w-[20px] text-xs sm:text-sm">3.</span>
                  <span className="text-xs sm:text-sm">Click <strong>"Enter ABI"</strong> and paste <span className="text-purple-300 font-semibold">ABI JSON</span></span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-orange-400 font-bold min-w-[16px] sm:min-w-[20px] text-xs sm:text-sm">4.</span>
                  <span className="text-xs sm:text-sm">Select <code className="text-purple-300 bg-black/40 px-1 rounded font-mono text-xs">updateMerkleRoot</code> function</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-orange-400 font-bold min-w-[16px] sm:min-w-[20px] text-xs sm:text-sm">5.</span>
                  <span className="text-xs sm:text-sm">Fill parameters OR paste <span className="text-cyan-300 font-semibold">Calldata</span></span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-orange-400 font-bold min-w-[16px] sm:min-w-[20px] text-xs sm:text-sm">6.</span>
                  <span className="text-xs sm:text-sm">Set Value = 0, Review → Execute</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3 border-t-2 border-purple-700 pt-3 sm:pt-4">
            <Button
              variant="outline"
              onClick={() => setShowMerkleRootModal(false)}
              className="flex-1 border-2 border-gray-600 hover:bg-gray-800 text-gray-200 font-semibold h-10 sm:h-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const safeUrl = `https://app.safe.global/base:${process.env.NEXT_PUBLIC_SAFE_ADDRESS}`;
                window.open(safeUrl, '_blank');
              }}
              className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg shadow-purple-500/40 border-2 border-purple-400/60 font-semibold h-10 sm:h-auto"
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
